import type { EffectsObject } from '@galacean/effects';
import { Component, VFXItem } from '@galacean/effects';
import type { SceneDocument } from '../document/scene-document';
import { sceneWorkspace } from '../scene-workspace';
import type { ObjectState } from '../serialization/scene-serializer';

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

export function rootItems (items: VFXItem[]): VFXItem[] {
  return items.filter(item => !items.some(other => other !== item && VFXItem.isAncestor(other, item)));
}

export function attachPreservingWorld (item: VFXItem, parent: VFXItem): void {
  if (item.parent === parent) { return; }
  const world = item.transform.getWorldMatrix().clone();
  const matrix = parent.transform.getWorldMatrix().clone();

  if (Math.abs(matrix.determinant()) < 1e-10) { throw new Error('Cannot attach to an item with zero scale.'); }
  matrix.invert(); matrix.multiply(world);
  item.setParent(parent); item.transform.cloneFromMatrix(matrix);
}

export function editSceneStructure (document: SceneDocument, label: string, action: () => void): boolean {

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
