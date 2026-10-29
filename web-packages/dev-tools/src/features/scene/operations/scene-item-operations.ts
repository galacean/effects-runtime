import type { EffectsObject, TimelineAsset } from '@galacean/effects';
import { CompositionComponent, VFXItem, generateGUID } from '@galacean/effects';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import type { SceneDocument } from '../document/scene-document';
import type { SceneItemOptions } from '../factories/scene-item-factory';
import { createSceneItemData } from '../factories/scene-item-factory';
import { sceneWorkspace } from '../scene-workspace';
import { jsonData } from '../serialization/scene-values';
import { attachPreservingWorld, editSceneStructure, rootItems } from './scene-structure-edit';

export interface SceneItemPlacement { parent?: VFXItem, folderId?: string }

export class SceneItemOperations {
  constructor (readonly document: SceneDocument) { }

  create (type: SceneItemOptions, target?: SceneItemPlacement): VFXItem | undefined {
    let item: VFXItem | undefined;

    this.run('Create ' + type.label, () => {
      const { item: definition, objects } = createSceneItemData(type, this.document.composition.getDuration());
      const engine = this.document.composition.engine;
      const parent = target?.parent ?? this.document.composition.sceneRoot;
      const names = new Set(parent.children.map(child => child.name));
      let name = type.label, index = 2;

      while (names.has(name)) { name = type.label + ' ' + index++; }
      definition.name = name;
      for (const data of [definition, ...objects]) { engine.assetServer.addEffectsObjectData(data); }
      item = engine.effectsObjectServer.findObject<VFXItem>({ id: definition.id });
      item.setParent(parent);
      item.renderOrder = Math.ceil(Math.max(0, ...this.document.composition.items.filter(other => other !== item).map(other => other.renderOrder))) + 1;
      for (const data of objects) {
        const object = engine.effectsObjectServer.findObject<EffectsObject>({ id: data.id });

        this.document.serializer.put(this.document.scene, data, object);
      }
      if (target?.folderId) {
        const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };

        data.itemFolders[definition.id] = target.folderId;
      }
      EditorSelection.setObjects([item]);
    });

    return item;
  }

  rename (item: VFXItem, name: string): boolean {
    name = name.trim();
    if (!name || name === item.name) { return true; }

    return this.run('Rename item', () => { item.name = name; item.transform.name = name; });
  }

  canReorder (items: VFXItem[], target: VFXItem): boolean {
    const parent = target.parent;

    if (!items.length || !parent || !target.definition.id || items.some(item => !item.definition.id || item === target || VFXItem.isAncestor(item, target))) { return false; }

    return items.every(item => item.parent === parent) || Math.abs(parent.transform.getWorldMatrix().determinant()) >= 1e-10;
  }

  reorder (selected: VFXItem[], target: VFXItem, position: 'before' | 'after', folderId?: string): boolean {
    if (!this.canReorder(selected, target)) { return false; }
    const order = new Map(this.document.composition.sceneRoot.getDescendants().map((item, index) => [item, index]));
    const items = rootItems(selected).sort((a, b) => order.get(a)! - order.get(b)!);
    const moving = new Set(items), parent = target.parent!;
    const siblings = parent.children.filter(item => !moving.has(item));
    const index = siblings.indexOf(target) + (position === 'after' ? 1 : 0);

    siblings.splice(index, 0, ...items);
    const folders = this.document.editor.hierarchy?.itemFolders ?? {};

    if (siblings.length === parent.children.length && siblings.every((item, index) => item === parent.children[index]) &&
      items.every(item => folders[this.document.serializer.id(item)] === folderId)) { return true; }

    return this.run('Reorder items', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };

      for (const item of items) {
        attachPreservingWorld(item, parent);
        const id = this.document.serializer.id(item);

        if (folderId) { data.itemFolders[id] = folderId; } else { delete data.itemFolders[id]; }
      }
      siblings.forEach((item, index) => { item.orderInParent = index; });
    });
  }

  setVisible (items: VFXItem[], visible: boolean): void {
    if (!items.length) { return; }
    sceneWorkspace.observe(visible ? 'Show items' : 'Hide items', () => {
      items.forEach(item => { item.setVisible(visible); item.getDescendants().forEach(child => child.setVisible(visible)); });
    }, items);
  }

  remove (selected: VFXItem[], beforeRemove?: () => void): void {
    const items = rootItems(selected);
    const deleting = new Set(items.flatMap(item => [item, ...item.getDescendants()]));
    const deletedObjects = new Set<EffectsObject>([...deleting].flatMap(item => [item, ...item.components]));

    this.run('Delete items', () => {
      const data = this.document.editor.hierarchy;

      beforeRemove?.();
      for (const item of [this.document.composition.sceneRoot, ...this.document.composition.items]) {
        for (const component of item.getComponents(CompositionComponent)) {
          component.items = component.items.filter(item => !deleting.has(item));
          const timeline = component.definition.timelineAsset ? component.findObject<TimelineAsset>(component.definition.timelineAsset) : undefined;

          for (const track of timeline?.flattenedTracks ?? []) {
            const binding = component.getBinding(track);

            if (binding && deletedObjects.has(binding)) { component.clearBinding(track); }
          }
        }
      }
      items.forEach(item => item.setParent(null));
      if (data) { deleting.forEach(item => delete data.itemFolders[this.document.serializer.id(item)]); }
      EditorSelection.setObjects(EditorSelection.getSelectedObjects().filter(object => !deletedObjects.has(object as EffectsObject)));
    });
  }

  duplicate (items: VFXItem[]): VFXItem[] {
    const selected = rootItems(items);
    const clones: VFXItem[] = [];

    if (!selected.length) { return clones; }
    this.run('Duplicate items', () => {
      const definitions = new Map<string, any>();
      const extras = new Map<string, any>();
      const shared = new Set(['Texture', 'Shader', 'Geometry']);
      const collect = (data: any): void => {
        if (!data || definitions.has(data.id) || shared.has(data.dataType)) { return; }
        definitions.set(data.id, jsonData(data));
        const visit = (value: any): void => {
          if (!value || typeof value !== 'object') { return; }
          if (Object.keys(value).length === 1 && typeof value.id === 'string') {
            const object = this.document.serializer.object(value.id);
            const source = object ? this.document.serializer.read(object).data : this.document.composition.engine.assetServer.findEffectsObjectData(value.id);

            if (object) { extras.set(value.id, this.document.serializer.read(object).extras); }
            if (source) { collect(source); }
          } else { Object.values(value).forEach(visit); }
        };

        for (const [key, value] of Object.entries(data)) { if (!['parentId', 'item'].includes(key)) { visit(value); } }
      };

      selected.forEach(item => {
        const state = this.document.serializer.read(item);

        extras.set(state.data.id, state.extras); collect(state.data);
      });
      const ids = new Map([...definitions.keys()].map(id => [id, generateGUID()]));
      const rewrite = (value: any): any => {
        if (Array.isArray(value)) { return value.map(rewrite); }
        if (!value || typeof value !== 'object') { return value; }

        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === 'string' && ['id', 'parentId', 'refId'].includes(key) ? ids.get(entry) ?? entry : rewrite(entry)]));
      };
      const engine = this.document.composition.engine;

      for (const data of definitions.values()) {
        const copy = rewrite(data);

        if (copy.dataType === 'VFXItemData') { delete copy.refId; }
        engine.assetServer.addEffectsObjectData(copy);
      }
      for (const item of selected) {
        const clone = engine.effectsObjectServer.findObject<VFXItem>({ id: ids.get(this.document.serializer.id(item))! });
        const names = new Set(item.parent?.children.map(child => child.name));
        let name = item.name + ' Copy', index = 2;

        while (names.has(name)) { name = item.name + ' Copy ' + index++; }
        clone.name = name; clone.transform.name = name; clone.setParent(item.parent ?? this.document.composition.sceneRoot);
        clones.push(clone);
        const folder = this.document.editor.hierarchy?.itemFolders[this.document.serializer.id(item)];

        if (folder) { this.document.editor.hierarchy!.itemFolders[this.document.serializer.id(clone)] = folder; }
      }
      for (const [id, extra] of extras) {
        const cloneId = ids.get(id), object = cloneId && engine.effectsObjectServer.objectInstance[cloneId];

        if (object) { this.document.serializer.applyExtras(object, rewrite(extra)); }
      }
      EditorSelection.setObjects(clones);
    });

    return clones;
  }

  private run (label: string, action: () => void): boolean { return editSceneStructure(this.document, label, action); }
}
