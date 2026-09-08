import { Asset, Component, generateGUID, ParticleSystem, SerializationHelper, spec, Texture, VFXItem } from '@galacean/effects';
import type { Constructor, EffectsObject, Engine } from '@galacean/effects';
import { UIControl } from '@galacean/effects-plugin-gui';
import { SceneSerializer } from './scene-serializer';

/** Owns the simulated copies; textures are shared read-only GPU resources. */
export class PreviewObjects {
  readonly copies = new Map<EffectsObject, EffectsObject>();
  readonly originals = new Map<EffectsObject, EffectsObject>();
  private readonly ids = new Map<string, string>();
  private readonly records = new Map<EffectsObject, Record<string, any>>();
  private readonly assets: Asset[] = [];
  private readonly initializedAssets = new Set<Asset>();

  constructor (private readonly engine: Engine, readonly sourceRoot: VFXItem) {}

  initialize (): void {
    const sourceRoot = this.sourceRoot;

    for (const item of [sourceRoot, ...sourceRoot.getDescendants()]) {
      this.allocate(item);
      for (const component of item.components) {this.allocate(component);}
    }
    // Allocation precedes restoration, including references between assets.
    for (const [source] of this.copies) {
      const record = SceneSerializer.serializeObject(source);

      this.records.set(source, record);
      this.collectReferences(record);
    }
    for (const [source, copy] of this.copies) {
      if (source instanceof Asset) {
        SerializationHelper.deserialize(this.remap(this.records.get(source)), copy);
        this.initializedAssets.add(copy as Asset);
      }
    }
    for (const [source, copy] of this.copies) {
      if (source instanceof Asset) {continue;}
      const record = this.remap(this.records.get(source));

      // The authored hierarchy already contains expanded precomposition children.
      if (copy instanceof VFXItem) {record.type = spec.ItemType.base;}
      SerializationHelper.deserialize(record, copy);
      if (copy instanceof VFXItem && source instanceof VFXItem) {copy.type = source.type;}
    }
  }

  private allocate (source: EffectsObject): void {
    if (this.copies.has(source)) {return;}
    const Type = source.constructor as Constructor<EffectsObject>;
    const copy = source instanceof Asset
      ? this.engine.content.createVirtualAsset(Type as Constructor<Asset>) : new Type(this.engine);

    if (copy instanceof Asset) {this.assets.push(copy);}
    this.copies.set(source, copy);
    this.originals.set(copy, source);
    this.ids.set(source.getInstanceId(), copy.getInstanceId());
  }

  private collectReferences (value: any): void {
    if (!value || typeof value !== 'object' || SerializationHelper.checkTypedArray(value)) {return;}
    if (SerializationHelper.checkDataPath(value)) {
      const asset = this.engine.findObject<EffectsObject>(value);

      if (asset instanceof Asset && !(asset instanceof Texture)) {this.allocate(asset);}
    } else if (typeof value.id === 'string' && !this.ids.has(value.id)) {
      // Inline objects such as GUI Controls create their own instances in fromData.
      this.ids.set(value.id, generateGUID());
    }
    for (const entry of Object.values(value)) {this.collectReferences(entry);}
  }

  private remap (value: any): any {
    if (typeof value === 'string') {return this.ids.get(value) ?? value;}
    if (!value || typeof value !== 'object') {return value;}
    if (SerializationHelper.checkTypedArray(value)) {return structuredClone(value);}
    if (Array.isArray(value)) {return value.map(entry => this.remap(entry));}

    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, this.remap(entry)]));
  }

  sync (source: EffectsObject): void {
    const copy = this.copies.get(source);

    if (!copy) {return;}
    const record = SceneSerializer.serializeObject(source);
    const previous = this.records.get(source)!;

    if (JSON.stringify(record) === JSON.stringify(previous)) {return;}
    this.collectReferences(record);
    for (const [dependency] of this.copies) {
      if (this.records.has(dependency)) {continue;}
      const data = SceneSerializer.serializeObject(dependency);

      this.records.set(dependency, data);
      this.collectReferences(data);
    }
    for (const [dependency, instance] of this.copies) {
      if (instance instanceof Asset && !this.initializedAssets.has(instance)) {
        SerializationHelper.deserialize(this.remap(this.records.get(dependency)), instance);
        this.initializedAssets.add(instance);
      }
    }
    this.records.set(source, record);
    if (copy instanceof VFXItem) {
      copy.name = source instanceof VFXItem ? source.name : copy.name;
      copy.duration = record.duration;
      copy.endBehavior = record.endBehavior;
      copy.setVisible(record.visible);
      if (JSON.stringify(record.transform) !== JSON.stringify(previous.transform)) {
        copy.transform.fromData(record.transform);
        const particle = copy.getComponent(ParticleSystem);

        if (particle?.isStartCalled) {particle.initEmitterTransform();}
      }
    } else if (copy instanceof UIControl && copy.control && record.control === previous.control) {
      copy.control.fromData(this.remap(record.data));
      copy.onParentChanged();
    } else if (copy instanceof ParticleSystem) {
      const owner = copy.item;
      const runtimeId = copy.getInstanceId();

      copy.renderer?.dispose();
      copy.dispose();
      const replacement = new ParticleSystem(this.engine);

      replacement.setInstanceId(runtimeId);
      SerializationHelper.deserialize(this.remap(record), replacement);
      replacement.setVFXItem(null);
      replacement.setVFXItem(owner);
      this.copies.set(source, replacement);
      this.originals.delete(copy);
      this.originals.set(replacement, source);
      // Rebind components whose masks or other references point at this component.
      for (const [dependent, instance] of this.copies) {
        if (dependent !== source && instance instanceof Component &&
          JSON.stringify(this.records.get(dependent)).includes(source.getInstanceId())) {
          SerializationHelper.deserialize(this.remap(this.records.get(dependent)), instance);
        }
      }
    } else {
      SerializationHelper.deserialize(this.remap(record), copy);
      if (copy instanceof Component) {copy.onApplyAnimationProperties();}
    }
  }

  dispose (): void {
    // Disposing the hierarchy handles generated components and their resources.
    for (const copy of this.copies.values()) {
      if (!(copy instanceof Asset) && copy.isRegistered) {copy.dispose();}
    }
    for (const asset of this.assets) {this.engine.content.unloadAsset(asset);}
    this.copies.clear();
    this.originals.clear();
    this.records.clear();
    this.initializedAssets.clear();
  }
}
