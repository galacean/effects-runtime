import { Asset, Component, getClass, getEffectsClassName, EffectsObject, SerializationHelper, HideFlags, VFXItem, spec, version } from '@galacean/effects';
import type { Engine, Constructor } from '@galacean/effects';

import type { SceneGraph } from './scene-graph';

type ObjectData = spec.EffectsObjectData & Record<string, any>;

/**
 * Serializes ownership trees to JSONScene. Shared assets remain GUID references;
 * their persistence and loading belong to Content, not to the scene loader.
 * Loading returns detached, uninitialized trees and never starts playback.
 */
export class SceneSerializer {
  static serialize (scene: SceneGraph): spec.JSONScene {
    const objects = new Map<string, EffectsObject>();
    const roots = new Set(scene.compositions.map(composition => composition.root));
    const collect = (item: VFXItem) => {
      if (item.hideFlags & HideFlags.DontSave) {
        return;
      }
      if (VFXItem.isComposition(item)) {
        throw new Error('Precomposition instances require definition/instance serialization, which is not supported yet.');
      }
      add(item);
      for (const component of item.components) {
        if (component.item !== item) {
          throw new Error(`Component '${component.getInstanceId()}' has an inconsistent owner.`);
        }
        add(component);
      }
      for (const child of item.children) {
        if (child.parent !== item) {
          throw new Error(`Item '${child.getInstanceId()}' has an inconsistent parent.`);
        }
        collect(child);
      }
    };
    const add = (object: EffectsObject) => {
      const id = object.getInstanceId();

      if (objects.has(id)) {
        throw new Error(`Duplicate scene object or cyclic ownership: '${id}'.`);
      }
      assertSerializer(object);
      objects.set(id, object);
    };

    for (const { root } of scene.compositions) {
      if (root.hideFlags & HideFlags.DontSave) {
        throw new Error('A composition root cannot have HideFlags.DontSave.');
      }
      collect(root);
    }

    for (const { asset } of scene.assets ?? []) {add(asset);}

    const records = new Map<string, ObjectData>();

    for (const [id, object] of objects) {
      const data = snapshot(SerializationHelper.serialize(object)) as ObjectData;

      if (roots.has(object as VFXItem)) {
        delete data.parentId;
      }
      visitReferences(data, reference => {
        if (objects.has(reference)) {
          return;
        }
        const asset = object.engine.objectInstance[reference] ?? object.engine.content.getAsset(reference);

        if (!(asset instanceof Asset)) {
          throw new Error(`Object '${id}' references an unsaved scene object '${reference}'.`);
        }
      });
      records.set(id, data);
    }

    const compositions: spec.CompositionData[] = scene.compositions.map(composition => {
      const root = records.get(composition.root.getInstanceId())!;

      return {
        id: root.id,
        name: root.name ?? '',
        duration: root.duration,
        endBehavior: root.endBehavior,
        components: root.components,
        children: root.children,
        camera: snapshot(composition.camera) as spec.CameraOptions,
        previewSize: composition.previewSize?.slice() as [number, number] | undefined,
        startTime: composition.startTime ?? 0,
      };
    });
    const compositionId = scene.compositionId ?? compositions[0]?.id;

    if (!compositions.length || !compositions.some(composition => composition.id === compositionId)) {
      throw new Error('Scene must have an existing active composition.');
    }

    const result: spec.JSONScene = {
      // Explicit children belong to the 3.7 schema; older versions migrate and rebuild them.
      version: spec.JSONSceneVersion['3_7'],
      playerVersion: { web: version, native: '' },
      type: 'ge',
      compositionId,
      compositions,
      renderSettings: snapshot(scene.renderSettings) as spec.RenderSettings | undefined,
      items: Array.from(records.values()).filter(data => objects.get(data.id) instanceof VFXItem && !roots.has(objects.get(data.id) as VFXItem)) as spec.VFXItemData[],
      components: Array.from(records.values()).filter(data => objects.get(data.id) instanceof Component) as spec.ComponentData[],
      images: [], plugins: [], materials: [], shaders: [], geometries: [], animations: [], miscs: [],
    };

    for (const { asset, collection } of scene.assets ?? []) {
      const entries = (result[collection] ??= []) as spec.EffectsObjectData[];

      entries.push(records.get(asset.getInstanceId())!);
    }

    return result;
  }

  /** Run only after the entire tree has loaded. Does not call beginPlay. */
  static initialize (scene: SceneGraph): void {
    for (const { root } of scene.compositions) {
      root.initializeHierarchy();
    }
  }

  static deserialize (source: spec.JSONScene, engine: Engine): SceneGraph {
    // A private snapshot prevents fromData implementations from mutating the file data.
    const data = snapshot(source) as spec.JSONScene;

    for (const collection of [data.materials, data.shaders, data.geometries, data.animations, data.miscs, data.textures, data.images, data.bins]) {
      if (collection?.length) {
        throw new Error('SceneSerializer requires assets to be loaded through Content before loading the scene tree.');
      }
    }
    const records = new Map<string, ObjectData>();
    const rootIds = new Set(data.compositions.map(composition => composition.id));
    const append = (record: ObjectData) => {
      if (!record.id || records.has(record.id)) {
        throw new Error(`Duplicate or missing object ID '${record.id}'.`);
      }
      if (engine.objectInstance[record.id] || engine.content.getAsset(record.id)) {
        throw new Error(`Object ID '${record.id}' is already in use in the target engine.`);
      }
      const Type = getClass<EffectsObject>(record.dataType);

      if (!Type || !(Type === VFXItem || Type.prototype instanceof VFXItem || Type.prototype instanceof Component)) {
        throw new Error(`Unsupported scene object type '${record.dataType}'.`);
      }
      records.set(record.id, record);
    };

    for (const composition of data.compositions) {
      append({ dataType: spec.DataType.VFXItemData, type: spec.ItemType.base, content: {}, ...composition });
    }
    data.items.forEach(record => {
      if (record.type === spec.ItemType.composition) {
        throw new Error('Precomposition instance loading is not supported by SceneSerializer yet.');
      }
      append(record as ObjectData);
    });
    data.components.forEach(record => append(record as ObjectData));
    if (!rootIds.size || (data.compositionId && !rootIds.has(data.compositionId))) {
      throw new Error('Scene must have an existing active composition.');
    }
    validateGraph(records, rootIds, engine);

    const objects = new Map<string, EffectsObject>();

    try {
      // Phase 1: allocate EVERY identity before any fromData resolves a reference.
      for (const [id, record] of records) {
        const Type = getClass<EffectsObject>(record.dataType)!;
        const object = new Type(engine);

        objects.set(id, object);
        object.setInstanceId(id);
      }
      // Phase 2: objects restore fields, references and ownership themselves,
      // just as Flax Actor.Deserialize restores ParentID after the Spawn stage.
      for (const [id, record] of records) {
        SerializationHelper.deserialize(record, objects.get(id)!);
      }
      // File child order is authoritative even when object records are shuffled.
      for (const [id, record] of records) {
        const object = objects.get(id)!;

        if (object instanceof VFXItem) {
          object.children = (record.children ?? []).map((reference: spec.DataPath) => objects.get(reference.id) as VFXItem);
        }
      }

      return {
        compositionId: data.compositionId ?? data.compositions[0].id,
        renderSettings: data.renderSettings,
        compositions: data.compositions.map(composition => ({
          root: objects.get(composition.id) as VFXItem,
          camera: composition.camera,
          previewSize: composition.previewSize,
          startTime: composition.startTime,
        })),
      };
    } catch (error) {
      // Remove only objects allocated by this load, never existing engine objects.
      for (const object of objects.values()) {
        try {
          object.dispose();
        } catch {
          // Keep cleaning up the remaining allocations and preserve the load error.
        } finally {
          object.unregisterObject();
        }
      }
      throw error;
    }
  }
}

function assertSerializer (object: EffectsObject): void {
  const type = getEffectsClassName(object.constructor as Constructor<EffectsObject>);

  if (!type) {
    throw new Error(`Unregistered scene object type '${object.constructor.name}'.`);
  }
  // Do not silently save just the base fields of a plugin that only implements
  // fromData. Plugins opt into scene saving by providing the matching toData.
  let prototype = Object.getPrototypeOf(object);

  while (prototype && prototype !== EffectsObject.prototype) {
    if (Object.prototype.hasOwnProperty.call(prototype, 'fromData') && !Object.prototype.hasOwnProperty.call(prototype, 'toData')) {
      throw new Error(`Type '${type}' needs a toData implementation for scene persistence.`);
    }
    prototype = Object.getPrototypeOf(prototype);
  }
}

function validateGraph (records: Map<string, ObjectData>, roots: Set<string>, engine: Engine): void {
  const owners = new Map<string, string>();
  const isItem = (id: string) => {
    const Type = getClass(records.get(id)?.dataType ?? '');

    return Type === VFXItem || !!Type && Type.prototype instanceof VFXItem;
  };

  for (const [id, record] of records) {
    visitReferences(record, reference => {
      const external = engine.objectInstance[reference] ?? engine.content.getAsset(reference);

      if (!records.has(reference) && !(external instanceof Asset && external.isLoaded)) {
        throw new Error(`Object '${id}' has unresolved reference '${reference}'.`);
      }
    });
    if (roots.has(id) && (!isItem(id) || record.parentId !== undefined)) {
      throw new Error(`Invalid composition root '${id}'.`);
    }
    if (!isItem(id)) {
      continue;
    }
    for (const field of ['children', 'components']) {
      for (const reference of record[field] ?? []) {
        const target = records.get(reference.id);

        if (!target || roots.has(reference.id) || owners.has(reference.id) || isItem(reference.id) !== (field === 'children')) {
          throw new Error(`Invalid ${field} ownership '${id}' -> '${reference.id}'.`);
        }
        if (field === 'components' && target.item?.id !== id) {
          throw new Error(`Component '${reference.id}' has an inconsistent owner.`);
        }
        if (field === 'children' && target.parentId !== undefined && target.parentId !== id) {
          throw new Error(`Item '${reference.id}' has an inconsistent parent.`);
        }
        owners.set(reference.id, id);
      }
    }
  }
  for (const id of records.keys()) {
    const visited = new Set<string>();
    let current = id;

    while (!roots.has(current)) {
      if (visited.has(current) || !owners.has(current)) {
        throw new Error(`Object '${id}' has cyclic ownership or is unreachable from a composition.`);
      }
      visited.add(current);
      current = owners.get(current)!;
    }
  }
}

function visitReferences (value: unknown, visit: (id: string) => void): void {
  if (SerializationHelper.checkDataPath(value)) {
    visit(value.id);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(entry => visitReferences(entry, visit));
  }
}

/** Detaches mutable values and normalizes object references without walking engines. */
function snapshot (value: unknown, ancestors = new Set<object>()): unknown {
  if (value instanceof EffectsObject) {
    return { id: value.getInstanceId() };
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (ancestors.has(value)) {
    throw new Error('Cannot serialize a cyclic value. Use an EffectsObject reference.');
  }
  ancestors.add(value);
  let result: unknown;

  if (Array.isArray(value)) {
    result = value.map(entry => snapshot(entry, ancestors));
  } else {
    const record: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      record[key] = snapshot((value as Record<string, unknown>)[key], ancestors);
    }
    result = record;
  }

  ancestors.delete(value);

  return result;
}
