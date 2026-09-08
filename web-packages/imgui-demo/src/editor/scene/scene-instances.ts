import { generateGUID, SerializationHelper, spec } from '@galacean/effects';
import type { SceneInstance } from './scene-graph';

type RecordData = spec.EffectsObjectData & Record<string, any>;

/** Expands definitions into independently owned authoring objects before allocation. */
export function expandSceneInstances (source: spec.JSONScene): {
  data: spec.JSONScene,
  instances: Map<string, Omit<SceneInstance, 'root'>>,
} {
  const definitions = new Map(source.compositions.map(data => [data.id, data]));
  const items = new Map(source.items.map(data => [data.id, data]));
  const components = new Map(source.components.map(data => [data.id, data]));
  const referenced = new Set(source.items.filter(data => data.type === spec.ItemType.composition)
    .map(data => (data as spec.CompositionItem).content.options.refId));
  // Validate all definitions, including cycles disconnected from the active root.
  const checked = new Set<string>();
  const checking = new Set<string>();
  const validate = (id: string) => {
    if (checking.has(id)) {throw new Error(`Cyclic precomposition '${id}'.`);}
    if (checked.has(id)) {return;}
    const definition = definitions.get(id);

    if (!definition) {throw new Error(`Missing precomposition '${id}'.`);}
    checking.add(id);
    const seen = new Set<string>();
    const visit = (paths: spec.DataPath[]) => {
      for (const path of paths) {
        if (seen.has(path.id)) {throw new Error(`Cyclic or duplicate scene ownership '${path.id}'.`);}
        seen.add(path.id);
        const item = items.get(path.id);

        if (!item) {throw new Error(`Missing scene item '${path.id}'.`);}
        if (item.type === spec.ItemType.composition) {validate((item as spec.CompositionItem).content.options.refId);}
        visit(item.children ?? []);
      }
    };

    visit(definition.children ?? []);
    checking.delete(id);
    checked.add(id);
  };

  for (const id of definitions.keys()) {validate(id);}
  const roots = source.compositions.filter(data => !referenced.has(data.id) || data.id === source.compositionId);
  const used = new Set<string>();
  const definitionIds = new Set(roots.map(root => root.id));
  const outputItems: spec.VFXItemData[] = [];
  const outputComponents: spec.ComponentData[] = [];
  const instances = new Map<string, Omit<SceneInstance, 'root'>>();
  const allocate = (id: string) => {
    const result = used.has(id) ? generateGUID() : id;

    used.add(result);

    return result;
  };
  const expand = (definition: spec.CompositionData, root: RecordData, ancestors: Set<string>): RecordData => {
    if (ancestors.has(definition.id)) {throw new Error(`Cyclic precomposition '${definition.id}'.`);}
    const stack = new Set([...ancestors, definition.id]);
    const owned: spec.VFXItemData[] = [];
    const collect = (references: spec.DataPath[]) => {
      for (const { id } of references) {
        const item = items.get(id);

        if (!item) {throw new Error(`Missing scene item '${id}'.`);}
        if (owned.includes(item)) {throw new Error(`Cyclic or duplicate scene ownership '${id}'.`);}
        owned.push(item);
        collect(item.children ?? []);
      }
    };

    collect(definition.children ?? []);
    const remap = new Map<string, string>([[definition.id, root.id]]);

    for (const item of owned) {remap.set(item.id, allocate(item.id));}
    const componentPaths = [...(definition.components ?? []), ...owned.flatMap(item => item.components ?? [])];

    for (const { id } of componentPaths) {remap.set(id, allocate(id));}
    const convert = (value: any): any => {
      if (SerializationHelper.checkDataPath(value)) {return { id: remap.get(value.id) ?? value.id };}
      if (Array.isArray(value)) {return value.map(convert);}
      if (!value || typeof value !== 'object') {return value;}
      const result: Record<string, any> = {};

      for (const [key, entry] of Object.entries(value)) {
        result[key] = (key === 'id' || key === 'parentId') && typeof entry === 'string'
          ? remap.get(entry) ?? entry : convert(entry);
      }

      return result;
    };

    for (const { id } of componentPaths) {
      const component = components.get(id);

      if (!component) {throw new Error(`Missing component '${id}'.`);}
      outputComponents.push(convert(component));
    }
    const isInstance = root.id !== definition.id;

    root.components = [...convert(definition.components ?? []), ...(isInstance ? root.components ?? [] : [])];
    root.children = [...convert(definition.children ?? []), ...(isInstance ? root.children ?? [] : [])];
    for (const data of owned) {
      const item = convert(data) as RecordData;

      if (data.type === spec.ItemType.composition) {
        const sourceId = (data as spec.CompositionItem).content.options.refId;
        const nested = definitions.get(sourceId);

        if (!nested) {throw new Error(`Missing precomposition '${sourceId}'.`);}
        const definitionId = definitionIds.has(sourceId) ? generateGUID() : sourceId;

        definitionIds.add(definitionId);
        instances.set(item.id, { id: definitionId, camera: structuredClone(nested.camera),
          previewSize: nested.previewSize, startTime: nested.startTime,
          name: nested.name, duration: nested.duration, endBehavior: nested.endBehavior });
        expand(nested, item, stack);
        // fromData restores ownership; instance expansion is the importer's responsibility.
        item.type = spec.ItemType.base;
        item.content = {};
      }
      outputItems.push(item as spec.VFXItemData);
    }

    return root;
  };
  const compositions = roots.map(definition => {
    used.add(definition.id);
    const root = expand(definition, structuredClone(definition) as unknown as RecordData, new Set());

    return root as unknown as spec.CompositionData;
  });

  return { data: { ...source, compositions, items: outputItems, components: outputComponents }, instances };
}
