import { Component, CompositionComponent, VFXItem, generateGUID } from '@galacean/effects';
import type { TimelineAsset, EffectsObject } from '@galacean/effects';
import { sceneWorkspace } from '../../core/scene-document/scene-workspace';
import type { SceneDocument } from '../../core/scene-document/scene-document';
import type { ObjectState } from '../../core/scene-document/scene-serializer';
import { jsonData } from '../../core/scene-document/scene-values';
import { Selection } from '../../core/selection';
import { createSceneItemTemplate } from '../../core/scene-document/scene-item-template';
import type { SceneItemType } from '../../core/scene-document/scene-item-template';
import { folderKey, hierarchyData } from './hierarchy-model';
import type { OutlinerModel, OutlinerNode } from './hierarchy-model';

interface Placement { parent: VFXItem | undefined, index: number, transform: any }
interface Graph { states: Map<EffectsObject, ObjectState>, placements: Map<VFXItem, Placement> }

function capture (document: SceneDocument): Graph {
  const states = document.serializer.capture([document.composition.sceneRoot]);
  const placements = new Map<VFXItem, Placement>();

  for (const [object, state] of states) {
    if (object instanceof VFXItem) { placements.set(object, { parent: object.parent, index: object.parent?.children.indexOf(object) ?? 0, transform: state.data.transform }); }
  }

  return { states, placements };
}

function restorePlacements (target: Graph, other: Graph): void {
  const changed = [...new Set([...target.placements.keys(), ...other.placements.keys()])].filter(item => {
    const a = target.placements.get(item), b = other.placements.get(item);

    return !a || !b || a.parent !== b.parent || a.index !== b.index;
  });

  for (const item of changed) { item.setParent(target.placements.get(item)?.parent ?? null); }
  for (const item of changed) {
    const entry = target.placements.get(item);

    if (!entry) { continue; }
    item.transform.fromData(entry.transform);
    if (entry.parent) { item.orderInParent = entry.index; }
  }
}

function roots (items: VFXItem[]): VFXItem[] {
  return items.filter(item => !items.some(other => other !== item && VFXItem.isAncestor(other, item)));
}

function attach (item: VFXItem, parent: VFXItem): void {
  if (item.parent === parent) { return; }
  const world = item.transform.getWorldMatrix().clone();
  const matrix = parent.transform.getWorldMatrix().clone();

  if (Math.abs(matrix.determinant()) < 1e-10) { throw new Error('Cannot attach to an item with zero scale.'); }
  matrix.invert(); matrix.multiply(world);
  item.setParent(parent); item.transform.cloneFromMatrix(matrix);
}

export class HierarchyActions {
  constructor (readonly document: SceneDocument) { }

  create (type: SceneItemType, target?: Pick<OutlinerNode, 'item' | 'folder'>): VFXItem | undefined {
    let item: VFXItem | undefined;

    this.run('Create ' + type.label, () => {
      const { item: definition, objects } = createSceneItemTemplate(type, this.document.composition.getDuration());
      const engine = this.document.composition.engine;
      const parent = target?.item ?? this.document.composition.sceneRoot;
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
      if (target?.folder) {
        const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };

        data.itemFolders[definition.id] = target.folder.id;
      }
      Selection.setObjects([item]);
    });

    return item;
  }

  rename (node: OutlinerNode, name: string): boolean {
    name = name.trim();
    if (!node.editable || !name || name === node.label) { return true; }
    const data = hierarchyData(this.document);

    if (node.folder && data.folders.some(folder => folder.id !== node.folder!.id && folder.parentId === node.folder!.parentId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      sceneWorkspace.report(new Error('A folder with this name already exists here.'));

      return false;
    }

    return this.run('Rename ' + node.type, () => {
      if (node.item) { node.item.name = name; node.item.transform.name = name; } else if (node.folder) { node.folder.name = name; }
    });
  }

  createFolder (model: OutlinerModel, selection: OutlinerNode[], onCreated: (id: string) => void): string | undefined {
    let id: string | undefined;

    this.run('Create folder', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };
      const parent = selection.length === 1 && selection[0].folder ? selection[0].folder.id : undefined;
      const names = new Set(data.folders.filter(folder => folder.parentId === parent).map(folder => folder.name.toLocaleLowerCase()));
      let name = 'NewFolder', index = 1;

      while (names.has(name.toLowerCase())) { name = 'NewFolder' + index++; }
      id = generateGUID(); data.folders.push({ id, name, parentId: parent });
      const items = roots(model.elements(selection));

      for (const item of items) {
        attach(item, this.document.composition.sceneRoot);
        data.itemFolders[this.document.serializer.id(item)] = id;
      }
      onCreated(folderKey(id));
    });

    return id ? folderKey(id) : undefined;
  }

  canMove (selection: OutlinerNode[], target: OutlinerNode): boolean {
    if (!selection.length || target.kind === 'item' && !target.editable) { return false; }
    if (selection.some(node => !node.editable || node.id === target.id)) { return false; }
    for (let parent: OutlinerNode | undefined = target; parent; parent = parent.parent) {
      if (selection.some(node => node.id === parent.id)) { return false; }
    }
    if (target.kind === 'item' && selection.some(node => node.kind !== 'item')) { return false; }
    if (target.item && Math.abs(target.item.transform.getWorldMatrix().determinant()) < 1e-10) { return false; }

    return true;
  }

  canReorder (selection: OutlinerNode[], target: OutlinerNode): boolean {
    const item = target.item, parent = item?.parent;

    if (!selection.length || !target.editable || !parent || !item || target.kind !== 'item') { return false; }
    if (selection.some(node => !node.editable || !node.item || node.kind !== 'item' || node.item === item || VFXItem.isAncestor(node.item, item))) { return false; }

    return selection.every(node => node.item!.parent === parent) || Math.abs(parent.transform.getWorldMatrix().determinant()) >= 1e-10;
  }

  reorder (model: OutlinerModel, selection: OutlinerNode[], target: OutlinerNode, position: 'before' | 'after'): boolean {
    if (!this.canReorder(selection, target)) { return false; }
    const order = new Map(model.items.map((item, index) => [item, index]));
    const items = roots(model.elements(selection)).sort((a, b) => order.get(a)! - order.get(b)!);
    const moving = new Set(items), parent = target.item!.parent!;
    const siblings = parent.children.filter(item => !moving.has(item));
    const index = siblings.indexOf(target.item!) + (position === 'after' ? 1 : 0);
    const folder = target.parent?.folder?.id;

    siblings.splice(index, 0, ...items);
    const folders = hierarchyData(this.document).itemFolders;

    if (siblings.length === parent.children.length && siblings.every((item, index) => item === parent.children[index]) &&
      items.every(item => folders[this.document.serializer.id(item)] === folder)) { return true; }

    return this.run('Reorder items', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };

      for (const item of items) {
        attach(item, parent);
        const id = this.document.serializer.id(item);

        if (folder) { data.itemFolders[id] = folder; } else { delete data.itemFolders[id]; }
      }
      siblings.forEach((item, index) => { item.orderInParent = index; });
    });
  }

  move (model: OutlinerModel, selection: OutlinerNode[], target: OutlinerNode): void {
    if (!this.canMove(selection, target)) { return; }
    this.run(target.kind === 'item' ? 'Attach items' : 'Move to folder', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };
      const selected = selection.filter(node => !selection.some(other => other !== node && model.descendants(other).includes(node)));

      for (const node of selected) {
        if (node.folder) { node.folder.parentId = target.folder?.id; } else if (node.item) {
          attach(node.item, target.item ?? this.document.composition.sceneRoot);
          const id = this.document.serializer.id(node.item);
          const folder = target.folder?.id ?? (target.item ? data.itemFolders[this.document.serializer.id(target.item)] : undefined);

          if (folder) { data.itemFolders[id] = folder; } else { delete data.itemFolders[id]; }
        }
      }
    });
  }

  setVisible (items: VFXItem[], visible: boolean): void {
    if (!items.length) { return; }
    sceneWorkspace.observe(visible ? 'Show items' : 'Hide items', () => {
      items.forEach(item => { item.setVisible(visible); item.getDescendants().forEach(child => child.setVisible(visible)); });
    }, items);
  }

  remove (model: OutlinerModel, selection: OutlinerNode[]): void {
    const items = roots(model.elements(selection.filter(node => node.kind === 'item')));
    const deleting = new Set(items.flatMap(item => [item, ...item.getDescendants()]));
    const deletedObjects = new Set<EffectsObject>([...deleting].flatMap(item => [item, ...item.components]));

    this.run('Delete items', () => {
      const data = this.document.editor.hierarchy;

      for (const node of selection) {
        if (!node.folder || !data) { continue; }
        data.folders.forEach(folder => { if (folder.parentId === node.folder!.id) { folder.parentId = node.folder!.parentId; } });
        for (const [id, folder] of Object.entries(data.itemFolders)) {
          if (folder === node.folder.id) { if (node.folder.parentId) { data.itemFolders[id] = node.folder.parentId; } else { delete data.itemFolders[id]; } }
        }
        data.folders = data.folders.filter(folder => folder.id !== node.folder!.id);
      }
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
      Selection.setObjects(Selection.getSelectedObjects().filter(object => !deletedObjects.has(object as EffectsObject)));
    });
  }

  duplicate (model: OutlinerModel, selection: OutlinerNode[]): VFXItem[] {
    const selected = roots(model.elements(selection.filter(node => node.kind === 'item')));
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
      Selection.setObjects(clones);
    });

    return clones;
  }

  private run (label: string, action: () => void): boolean {
    const document = this.document;

    if (sceneWorkspace.busy || document.restoring) { return false; }
    sceneWorkspace.flushEdits(); document.commit(true);
    const before = capture(document);
    let after: Graph | undefined;
    let success = false;

    document.observeEditor(label, () => {
      document.begin(label);
      document.recordMutation({}, { undo: () => restorePlacements(before, after ?? capture(document)), redo: () => { if (after) { restorePlacements(after, before); } },
        valid: () => [...before.placements.keys(), ...after?.placements.keys() ?? []].every(item => item.isRegistered), bytes: before.placements.size * 256 });
      try {
        action(); document.serializer.stabilizeRenderOrder(document.scene); after = capture(document);
        const removed = new Set([...before.states].filter(([object]) => !after!.states.has(object) && (object instanceof VFXItem || object instanceof Component)).map(([, state]) => state.data.id));

        for (const [object, state] of after.states) {
          const previous = before.states.get(object);

          if (previous) { document.recordObject(label, previous, state); } else if (object.definition.id && (object instanceof VFXItem || object instanceof Component)) {
            document.serializer.put(document.scene, state.data, object);
            document.editor.objects[state.data.id] = state.extras;
            document.serializer.patch(document.scene, document.editor, state, state);
          }
        }
        document.scene.items = document.scene.items.filter(item => !removed.has(item.id));
        document.scene.components = document.scene.components.filter(component => !removed.has(component.id));
        removed.forEach(id => delete document.editor.objects[id]);
        for (const composition of document.scene.compositions) {
          composition.children = composition.children?.filter(item => !removed.has(item.id));
          composition.components = composition.components?.filter(component => !removed.has(component.id));
          const owner = document.composition.items.find(item => document.serializer.id(item) + ':composition' === composition.id);

          if (owner) { composition.children = owner.children.filter(item => item.definition.id).map(item => document.serializer.reference(item)); }
        }
        const root = document.scene.compositions.find(entry => entry.id === document.scene.compositionId)!;

        root.children = document.composition.sceneRoot.children.filter(item => item.definition.id).map(item => document.serializer.reference(item));
        document.validate(); document.commit(); success = true;
      } catch (error) {
        document.cancel(); sceneWorkspace.report(error);
      }
    });
    if (success) { sceneWorkspace.onRestored(); }

    return success;
  }
}
