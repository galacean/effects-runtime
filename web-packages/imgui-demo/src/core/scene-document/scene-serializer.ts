import {
  Component, CompositionComponent, EffectsObject, MaskableGraphic, Material, RendererComponent, ShapeComponent,
  SpriteComponent, TimelineAsset, TimelineClip, TrackAsset, VFXItem, effectsClassStore, math,
} from '@galacean/effects';
import type { Composition, TextComponentBase, spec } from '@galacean/effects';
import { UICanvas, UIControl } from '@galacean/effects-plugin-gui';
import { getEditorRotation } from '../editor-transform';
import { jsonData, patchData, sameData } from './scene-values';
import type { Data } from './scene-values';
import type { SceneEditorData } from './scene-storage';

export interface ObjectState {
  object: EffectsObject,
  data: Data,
  extras: Data,
}

export function isTextComponent (object: EffectsObject): object is Component & TextComponentBase {
  return object instanceof Component && 'textStyle' in object && 'textLayout' in object && typeof (object as any).setText === 'function';
}

const TABLES = ['items', 'components', 'materials', 'shaders', 'geometries', 'textures', 'animations', 'miscs'] as const;
const TRANSIENT = new Set(['engine', 'item', 'guid', 'definition', 'id', 'name', 'type', 'duration', 'endBehavior', 'transform',
  'parent', 'parentId', 'children', 'components', 'composition', 'time', 'visible', 'enabled', 'isActive', 'active',
  'disposed', 'isRegistered', 'isAwakeCalled', 'isStartCalled', 'isEnableCalled', 'isDuringPlay', 'isEnded', 'isEndCalled',
  'isDirty', 'renderer', 'geometry', 'defaultGeometry', 'boundingBoxInfo', 'material', 'materials', 'canvas', 'context',
  'text', 'textStyle', 'textLayout', 'maxLineWidth', 'ALPHA_FIX_VALUE', 'eventEmitter', 'eventProcessor', 'maskManager',
  'frameClipMasks', 'control', 'controlNode', 'linkedItemTransform', 'linkedControl', 'syncingLocation', 'timelineDirty']);

function editableValue (value: any, depth = 0, visited = new Set<object>()): any {
  if (typeof value === 'number') { return Number.isFinite(value) ? value : undefined; }
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) { return value; }
  if (!value || depth > 4 || visited.has(value) || ArrayBuffer.isView(value)) { return undefined; }
  if (value instanceof EffectsObject) { return { id: value.getInstanceId() }; }
  if (typeof value !== 'object') { return undefined; }
  const keys = Object.keys(value);
  const vector = keys.length > 0 && keys.every(key => ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'].includes(key));

  if (!vector && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) { return undefined; }
  visited.add(value);
  const result = Array.isArray(value) ? value.map(entry => editableValue(entry, depth + 1, visited)) : Object.fromEntries(keys
    .filter(key => !key.startsWith('_') && !TRANSIENT.has(key)).map(key => [key, editableValue(value[key], depth + 1, visited)])
    .filter(([, entry]) => entry !== undefined));

  visited.delete(value);

  return result;
}

export class SceneSerializer {
  private readonly ids = new Map<EffectsObject, string>();
  private readonly objects = new Map<string, EffectsObject>();

  constructor (readonly composition: Composition) { }

  id (object: EffectsObject): string {
    const cached = this.ids.get(object);

    if (cached) { return cached; }
    const type = object instanceof UICanvas ? 'UICanvas' : this.componentType(object) ?? object.constructor.name;
    let id: string = object.definition.id || (object instanceof Component && object.item ? this.id(object.item) + ':' + type : object.getInstanceId());

    if (this.objects.get(id)?.isRegistered && this.objects.get(id) !== object) { id = object.getInstanceId(); }
    this.ids.set(object, id); this.objects.set(id, object);

    return id;
  }

  reference (object: EffectsObject): { id: string } { return { id: this.id(object) }; }

  object (id: string): EffectsObject | undefined {
    const cached = this.objects.get(id);

    if (cached?.isRegistered) { return cached; }
    const live = Object.values(this.composition.engine.effectsObjectServer.objectInstance)
      .find(object => object.getInstanceId() === id || object.definition.id === id);

    if (live) { this.ids.set(live, id); this.objects.set(id, live); }

    return live;
  }

  normalize<T> (value: T): T {
    const ids = new Map([...this.ids].map(([object, id]) => [object.getInstanceId(), id]));
    const result = jsonData(value);
    const visit = (entry: any): void => {
      if (!entry || typeof entry !== 'object') { return; }
      if (Object.keys(entry).length === 1 && typeof entry.id === 'string') { entry.id = ids.get(entry.id) ?? entry.id; } else {
        Object.values(entry).forEach(visit);
      }
    };

    visit(result);

    return result;
  }

  sceneObjects (): EffectsObject[] {
    const result: EffectsObject[] = [];
    const visit = (item: VFXItem): void => {
      if (item !== this.composition.sceneRoot && !item.definition.id) { return; }
      this.id(item); result.push(item);
      for (const component of item.components) {
        this.id(component); result.push(component);
        if (component instanceof RendererComponent) {
          component.materials.forEach((material, index) => {
            if (!material.definition.id) {
              const id = this.id(component) + ':material:' + index;

              this.ids.set(material, id); this.objects.set(id, material);
            } else { this.id(material); }
          });
        }
      }
      item.children.forEach(visit);
    };

    visit(this.composition.sceneRoot);
    for (const object of Object.values(this.composition.engine.effectsObjectServer.objectInstance)) {
      if (object.definition.id && !(object instanceof VFXItem) && !(object instanceof Component)) { this.id(object); result.push(object); }
    }

    return result;
  }

  bootstrap (scene: spec.JSONScene): void {
    const objects = this.sceneObjects();

    for (const object of objects) {
      if (object === this.composition.sceneRoot) { continue; }
      if (!(object instanceof VFXItem) && !(object instanceof Component) && !(object instanceof TimelineAsset) &&
        !(object instanceof TrackAsset) && !(object instanceof TimelineClip)) { continue; }
      if (object instanceof Component && !object.definition.id) { continue; }
      const data = this.structure(object);

      if (!data.dataType) { continue; }

      if (object instanceof VFXItem && object.definition.refId) {
        const original = scene.compositions.find(entry => entry.id === object.definition.refId);

        if (original) {
          const id = this.id(object) + ':composition';

          data.refId = id; delete data.children;
          const composition = { ...jsonData(original), id, children: object.children.filter(child => child.definition.id).map(child => this.reference(child)),
            components: object.components.filter(component => component.definition.id).map(component => this.reference(component)) };
          const index = scene.compositions.findIndex(entry => entry.id === id);

          if (index < 0) { scene.compositions.push(composition); } else { scene.compositions[index] = composition; }
        }
      }
      if (data.dataType || object instanceof Component || object instanceof VFXItem) { this.put(scene, data, object); }
    }
    const root = scene.compositions.find(entry => entry.id === this.composition.id) ?? scene.compositions[0];

    root.children = this.composition.sceneRoot.children.filter(item => item.definition.id).map(item => this.reference(item));
    root.components = this.composition.sceneRoot.components.filter(component => component.definition.id).map(component => this.reference(component));
    scene.compositionId = root.id;
  }

  private structure (object: EffectsObject): Data {
    const data: Data = this.normalize(object.definition);

    data.id = this.id(object);
    data.dataType ??= this.componentType(object);
    if (object instanceof VFXItem) {
      data.components = object.components.filter(component => component.definition.id).map(component => this.reference(component));
      data.children = object.children.filter(child => child.definition.id).map(child => this.reference(child));
      if (object.parent && object.parent !== this.composition.sceneRoot) { data.parentId = this.id(object.parent); } else { delete data.parentId; }
    }
    if (object instanceof Component && object.item) { data.item = this.reference(object.item); }
    if (object instanceof CompositionComponent) {
      data.items = object.items.filter(item => item.definition.id).map(item => this.reference(item));
      const timeline = object.definition.timelineAsset ? object.findObject<TimelineAsset>(object.definition.timelineAsset) : undefined;

      if (timeline) {
        data.timelineAsset = this.reference(timeline);
        data.sceneBindings = timeline.flattenedTracks.flatMap(track => {
          const target = object.getBinding(track);

          return target ? [{ key: this.reference(track), value: this.reference(target) }] : [];
        });
      }
    }
    if (object instanceof TimelineAsset) { data.tracks = object.tracks.map(track => this.reference(track)); }
    if (object instanceof TrackAsset) {
      data.name = object.name;
      data.children = object.getChildTracks().map(track => this.reference(track));
      data.clips = object.getClips().map(clip => this.reference(clip));
    }
    if (object instanceof TimelineClip) {
      Object.assign(data, { name: object.name, start: object.start, duration: object.duration, endBehavior: object.endBehavior });
    }

    return data;
  }

  private componentType (object: EffectsObject): string | undefined {
    return object.definition.dataType ?? Object.keys(effectsClassStore).find(key => effectsClassStore[key] === object.constructor);
  }

  read (object: EffectsObject): ObjectState {
    const data = this.structure(object), extras: Data = { fields: {} };

    for (const [key, value] of Object.entries(object)) {
      if (key.startsWith('_') || TRANSIENT.has(key)) { continue; }
      const field = editableValue(value);

      if (field !== undefined) { extras.fields[key] = this.normalize(field); }
      if (key in data && field !== undefined && !['dataType', 'clips', 'tracks', 'options', 'renderer'].includes(key)) { data[key] = this.normalize(field); }
    }
    if (object instanceof VFXItem) {
      Object.assign(data, { name: object.name, type: object.type, duration: object.duration, endBehavior: object.endBehavior,
        transform: { ...jsonData(object.definition.transform ?? {}), position: jsonData(object.transform.position),
          eulerHint: jsonData(getEditorRotation(object.transform)), scale: jsonData(object.transform.scale),
          size: jsonData(object.transform.size), anchor: jsonData(object.transform.anchor) } });
      extras.active = object.isActive; extras.renderOrder = object.renderOrder; extras.visible = object.isVisible;
    }
    if (object instanceof Component) {
      if (object.definition.id) { data._enabled = object.enabled; }
      extras.enabled = object.enabled;
    }
    if (object instanceof RendererComponent) {
      extras.priority = object.priority;
      const materials = object.materials.filter(material => material.definition.id).map(material => this.reference(material));

      if (materials.length || object.definition.materials) { data.materials = materials; }
    }
    if (object instanceof SpriteComponent) {
      const color = object.material.getColor('_Color') ?? object.color;

      data.options = { ...data.options, startColor: [color.r, color.g, color.b, color.a] };
      if (object.sprite) { data.sprite = this.reference(object.sprite); }
    }
    if (object instanceof MaskableGraphic) { extras.graphicColor = jsonData(object.material.getColor('_Color') ?? object.color); }
    if (isTextComponent(object)) {
      const style = object.textStyle, layout = object.textLayout as any;

      data.options = { ...data.options, text: object.text, fontFamily: style.fontFamily, fontSize: style.fontSize,
        fontWeight: style.textWeight, fontStyle: style.fontStyle, textColor: jsonData(style.textColor),
        textAlign: layout.textAlign, textVerticalAlign: layout.textVerticalAlign, autoResize: layout.autoResize,
        width: layout.width, height: layout.height, lineHeight: layout.lineHeight, letterSpace: layout.letterSpace,
        textOverflow: layout.overflow, maxTextWidth: layout.maxTextWidth, maxTextHeight: layout.maxTextHeight,
        wrapEnabled: layout.wrapEnabled, useLegacyRichText: layout.useLegacyRichText,
        outline: style.isOutlined ? { ...data.options?.outline, outlineWidth: style.outlineWidth, outlineColor: jsonData(style.outlineColor) } : undefined,
        shadow: style.hasShadow ? { ...data.options?.shadow, shadowColor: jsonData(style.shadowColor), shadowBlur: style.shadowBlur,
          shadowOffsetX: style.shadowOffsetX, shadowOffsetY: style.shadowOffsetY } : undefined };
    }
    if (object instanceof ShapeComponent) {
      for (const key of ['fillTrimPath', 'strokeTrimPath'] as const) {
        const trim = object[key];

        if (trim) { data[key] = { ...data[key], mode: trim.mode, start: trim.start, end: trim.end, offset: trim.offset }; }
      }
    }
    if (object instanceof UIControl && object.control) {
      const control = object.control;

      extras.layout = Object.fromEntries(['position', 'size', 'anchorMin', 'anchorMax', 'offsetMin', 'offsetMax', 'pivot']
        .map(key => [key, jsonData((control as any)[key])]));
    }
    if (object instanceof Material) {
      const definition = object.definition;

      try { object.definition = jsonData(definition); Object.assign(data, this.normalize(object.toData())); } finally { object.definition = definition; }
      data.id = this.id(object);
      extras.material = Object.fromEntries(['floats', 'ints', 'vector4s', 'colors', 'textures', 'stringTags'].map(key => [key, data[key] ?? {}]));
    }

    return { object, data: jsonData(data), extras: jsonData(extras) };
  }

  capture (targets?: unknown[]): Map<EffectsObject, ObjectState> {
    const objects = new Set<EffectsObject>();
    const visit = (object: unknown): void => {
      if (!(object instanceof EffectsObject) || objects.has(object)) { return; }
      objects.add(object);
      if (object instanceof VFXItem) { object.components.forEach(visit); object.children.forEach(visit); }
      if (object instanceof RendererComponent) { object.materials.forEach(visit); }
    };

    if (targets) { targets.forEach(visit); } else { this.sceneObjects().filter(object => object instanceof VFXItem || object instanceof Component).forEach(visit); }

    return new Map([...objects].filter(object => object !== this.composition.sceneRoot).map(object => [object, this.read(object)]));
  }

  put (scene: spec.JSONScene, data: Data, object?: EffectsObject): void {
    const existing = TABLES.find(table => (scene[table] as Data[] | undefined)?.some(entry => entry.id === data.id));
    const table = existing ?? (object instanceof VFXItem ? 'items' : object instanceof Component ? 'components' :
      ({ Material: 'materials', Shader: 'shaders', Geometry: 'geometries', Texture: 'textures', AnimationClip: 'animations' } as Data)[data.dataType] ?? 'miscs');
    const entries: Data[] = (scene as any)[table] ??= [];
    const index = entries.findIndex(entry => entry.id === data.id);

    if (index < 0) { entries.push(jsonData(data)); } else { entries[index] = jsonData(data); }
  }

  patch (scene: spec.JSONScene, editor: SceneEditorData, before: ObjectState, after: ObjectState): void {
    const table = TABLES.find(name => (scene[name] as Data[] | undefined)?.some(entry => entry.id === after.data.id));
    const current = table ? (scene[table] as Data[]).find(entry => entry.id === after.data.id)! : jsonData(before.data);

    if (after.data.dataType && !((after.object instanceof Material || after.object instanceof Component) && !after.object.definition.id)) {
      patchData(current, before.data, after.data); this.put(scene, current, after.object);
    }
    const extra = editor.objects[after.data.id] ??= {};

    patchData(extra, before.extras, after.extras);
    if (!Object.keys(extra).length) { delete editor.objects[after.data.id]; }
    this.dependencies(scene, current);
    this.dependencies(scene, extra);
  }

  private dependencies (scene: spec.JSONScene, value: any, visited = new Set<string>()): void {
    if (!value || typeof value !== 'object') { return; }
    if (Object.keys(value).length === 1 && typeof value.id === 'string') {
      const id = value.id;

      if (visited.has(id) || scene.compositions.some(entry => entry.id === id) || TABLES.some(table => (scene[table] as Data[] | undefined)?.some(entry => entry.id === id))) { return; }
      visited.add(id);
      const object = this.objects.get(id) ?? this.composition.engine.effectsObjectServer.objectInstance[id];

      if (object?.definition.id && object.definition.dataType) {
        const data = object instanceof Material ? this.read(object).data : this.normalize(object.definition);

        this.put(scene, data, object); this.dependencies(scene, data, visited);
      }
    } else { Object.values(value).forEach(entry => this.dependencies(scene, entry, visited)); }
  }

  private runtimeData (value: any): any {
    if (!value || typeof value !== 'object') { return value; }
    if (Object.keys(value).length === 1 && typeof value.id === 'string') {
      return { id: this.objects.get(value.id)?.getInstanceId() ?? value.id };
    }

    return Array.isArray(value) ? value.map(entry => this.runtimeData(entry)) : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, this.runtimeData(entry)]));
  }

  apply (state: ObjectState, other?: ObjectState): void {
    const { object, extras } = state;
    const data = this.runtimeData(state.data);

    data.id = object.getInstanceId();
    if (object instanceof VFXItem) {
      object.name = data.name; object.transform.name = data.name; object.duration = data.duration; object.endBehavior = data.endBehavior;
      object.transform.fromData(data.transform);
    } else if (object instanceof Component && object.definition.id) {
      const enabled = object.enabled;

      object.definition = jsonData(data); object.fromData({ ...data, _enabled: enabled });
      object.enabled = data._enabled;
    } else if (data.dataType && !(object instanceof Material && !object.definition.id)) {
      object.definition = jsonData(data); object.fromData(data);
    }
    this.applyExtras(object, extras, other?.extras);
  }

  applyResolved (state: ObjectState, other?: ObjectState): void {
    const object = this.object(state.data.id);

    if (!object) { throw new Error('The edited object is no longer available: ' + state.data.id); }
    this.apply({ ...state, object }, other);
  }

  applyExtras (object: EffectsObject, extras: Data, other?: Data): void {
    if (object instanceof Component && 'enabled' in extras) { object.enabled = extras.enabled; }
    if (object instanceof VFXItem) {
      if ('active' in extras) { object.setActive(extras.active); }
      if ('renderOrder' in extras) { object.renderOrder = extras.renderOrder; }
      if ('visible' in extras && object.isVisible !== extras.visible) { object.setVisible(extras.visible); }
    }
    if (object instanceof RendererComponent && 'priority' in extras) { object.priority = extras.priority; }
    if (object instanceof MaskableGraphic && extras.graphicColor) {
      const color = extras.graphicColor;

      object.color = new math.Color(color.r, color.g, color.b, color.a);
    }
    if (object instanceof Material && extras.material) {
      const data = object.toData() as any;

      for (const [key, entries] of Object.entries<Data>(extras.material)) {
        for (const [name, value] of Object.entries(entries)) {
          if (!other || !sameData(other.material?.[key]?.[name], value)) { (data[key] ??= {})[name] = this.runtimeData(value); }
        }
      }
      object.fromData(data);
    }
    for (const [key, value] of Object.entries(extras.fields ?? {})) {
      if (other && sameData(other.fields?.[key], value)) { continue; }
      const current = (object as any)[key];
      const next = value && typeof value === 'object' && Object.keys(value).length === 1 && 'id' in value
        ? this.objects.get((value as Data).id) : this.runtimeData(value);

      if (current && typeof current === 'object' && next && typeof next === 'object' && !(current instanceof EffectsObject)) {
        Object.assign(current, jsonData(next));
      } else { (object as any)[key] = next; }
    }
    if (object instanceof UIControl && object.control && extras.layout) {
      const c = object.control, layout = extras.layout;

      c.setAnchorMin(layout.anchorMin.x, layout.anchorMin.y); c.setAnchorMax(layout.anchorMax.x, layout.anchorMax.y);
      c.setOffsetMin(layout.offsetMin.x, layout.offsetMin.y); c.setOffsetMax(layout.offsetMax.x, layout.offsetMax.y);
      c.setPivot(layout.pivot.x, layout.pivot.y);
      c.setSize(layout.size.x, layout.size.y); c.setPosition(layout.position.x, layout.position.y);
    }
  }

  restoreEditor (editor: SceneEditorData): void {
    // Item visibility is applied after component data by the loader; restore authored component switches afterward.
    for (const object of this.objects.values()) {
      if (object instanceof Component && object.item.isVisible && typeof object.definition._enabled === 'boolean') {
        object.enabled = object.definition._enabled;
      }
    }
    for (const [id, extras] of Object.entries(editor.objects)) {
      const object = this.object(id);

      if (object) { this.applyExtras(object, extras); }
    }
  }
}
