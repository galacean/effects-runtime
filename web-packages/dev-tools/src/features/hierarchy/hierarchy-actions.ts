import type { VFXItem } from '@galacean/effects';
import { generateGUID } from '@galacean/effects';
import type { SceneDocument } from '../scene/document/scene-document';
import { sceneWorkspace } from '../scene/scene-workspace';
import type { HierarchyModel, HierarchyNode } from './hierarchy-model';
import { folderKey, hierarchyData } from './hierarchy-model';

import { SceneItemOperations } from '../scene/operations/scene-item-operations';
import { attachPreservingWorld, editSceneStructure, rootItems } from '../scene/operations/scene-structure-edit';

export class HierarchyActions {
  private readonly items: SceneItemOperations;

  constructor (readonly document: SceneDocument) { this.items = new SceneItemOperations(document); }

  rename (node: HierarchyNode, name: string): boolean {
    name = name.trim();
    if (!node.editable || !name || name === node.label) { return true; }
    const data = hierarchyData(this.document);

    if (node.folder && data.folders.some(folder => folder.id !== node.folder!.id && folder.parentId === node.folder!.parentId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      sceneWorkspace.report(new Error('A folder with this name already exists here.'));

      return false;
    }

    if (node.item) { return this.items.rename(node.item, name); }

    return this.run('Rename ' + node.type, () => {
      if (node.folder) { node.folder.name = name; }
    });
  }

  createFolder (model: HierarchyModel, selection: HierarchyNode[], onCreated: (id: string) => void): string | undefined {
    let id: string | undefined;

    this.run('Create folder', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };
      const parent = selection.length === 1 && selection[0].folder ? selection[0].folder.id : undefined;
      const names = new Set(data.folders.filter(folder => folder.parentId === parent).map(folder => folder.name.toLocaleLowerCase()));
      let name = 'NewFolder', index = 1;

      while (names.has(name.toLowerCase())) { name = 'NewFolder' + index++; }
      id = generateGUID(); data.folders.push({ id, name, parentId: parent });
      const items = rootItems(model.elements(selection));

      for (const item of items) {
        attachPreservingWorld(item, this.document.composition.sceneRoot);
        data.itemFolders[this.document.serializer.id(item)] = id;
      }
      onCreated(folderKey(id));
    });

    return id ? folderKey(id) : undefined;
  }

  canMove (selection: HierarchyNode[], target: HierarchyNode): boolean {
    if (!selection.length || target.kind === 'item' && !target.editable) { return false; }
    if (selection.some(node => !node.editable || node.id === target.id)) { return false; }
    for (let parent: HierarchyNode | undefined = target; parent; parent = parent.parent) {
      if (selection.some(node => node.id === parent.id)) { return false; }
    }
    if (target.kind === 'item' && selection.some(node => node.kind !== 'item')) { return false; }
    if (target.item && Math.abs(target.item.transform.getWorldMatrix().determinant()) < 1e-10) { return false; }

    return true;
  }

  canReorder (selection: HierarchyNode[], target: HierarchyNode): boolean {
    return !!target.editable && !!target.item && selection.every(node => node.editable && !!node.item) &&
      this.items.canReorder(selection.flatMap(node => node.item ? [node.item] : []), target.item);
  }

  reorder (model: HierarchyModel, selection: HierarchyNode[], target: HierarchyNode, position: 'before' | 'after'): boolean {
    return this.canReorder(selection, target) && this.items.reorder(model.elements(selection), target.item!, position, target.parent?.folder?.id);
  }

  move (model: HierarchyModel, selection: HierarchyNode[], target: HierarchyNode): void {
    if (!this.canMove(selection, target)) { return; }
    this.run(target.kind === 'item' ? 'Attach items' : 'Move to folder', () => {
      const data = this.document.editor.hierarchy ??= { folders: [], itemFolders: {} };
      const selected = selection.filter(node => !selection.some(other => other !== node && model.descendants(other).includes(node)));

      for (const node of selected) {
        if (node.folder) { node.folder.parentId = target.folder?.id; } else if (node.item) {
          attachPreservingWorld(node.item, target.item ?? this.document.composition.sceneRoot);
          const id = this.document.serializer.id(node.item);
          const folder = target.folder?.id ?? (target.item ? data.itemFolders[this.document.serializer.id(target.item)] : undefined);

          if (folder) { data.itemFolders[id] = folder; } else { delete data.itemFolders[id]; }
        }
      }
    });
  }

  setVisible (items: VFXItem[], visible: boolean): void { this.items.setVisible(items, visible); }

  remove (model: HierarchyModel, selection: HierarchyNode[]): void {
    this.items.remove(model.elements(selection.filter(node => node.kind === 'item')), () => {
      const data = this.document.editor.hierarchy;

      for (const node of selection) {
        if (!node.folder || !data) { continue; }
        data.folders.forEach(folder => { if (folder.parentId === node.folder!.id) { folder.parentId = node.folder!.parentId; } });
        for (const [id, folder] of Object.entries(data.itemFolders)) {
          if (folder === node.folder.id) { if (node.folder.parentId) { data.itemFolders[id] = node.folder.parentId; } else { delete data.itemFolders[id]; } }
        }
        data.folders = data.folders.filter(folder => folder.id !== node.folder!.id);
      }

    });
  }

  duplicate (model: HierarchyModel, selection: HierarchyNode[]): VFXItem[] { return this.items.duplicate(model.elements(selection.filter(node => node.kind === 'item'))); }

  private run (label: string, action: () => void): boolean { return editSceneStructure(this.document, label, action); }
}
