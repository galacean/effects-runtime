import { sceneWorkspace } from '../core/scene-document/scene-workspace';
import { SCENE_ITEM_TYPES } from '../core/scene-document/scene-item-template';
import { HierarchyActions } from '../panels/hierarchy/hierarchy-actions';
import type { OutlinerNode } from '../panels/hierarchy/hierarchy-model';
import { ImGui } from '../imgui';
import { beginEditorMenu, endEditorMenu, editorIconMenuItem, editorMenuSection } from './editor-menu';

export function drawCreateItemMenu (target?: Pick<OutlinerNode, 'item' | 'folder'>): void {
  const document = sceneWorkspace.current;
  const enabled = !!document && !sceneWorkspace.busy && !document.restoring;
  const entries = SCENE_ITEM_TYPES.filter(entry => entry.creatable !== false);

  editorMenuSection('Create Item');
  for (const group of new Set(entries.map(entry => entry.group))) {
    if (beginEditorMenu(group, enabled)) {
      for (const entry of entries.filter(entry => entry.group === group)) {
        if (editorIconMenuItem((entry.empty ? 'Empty ' : '') + entry.label, entry.icon)) {
          new HierarchyActions(document!).create(entry, target);
        }
        if (entry.empty && ImGui.IsItemHovered()) { ImGui.SetTooltip('Creates an empty ' + entry.label + ' item without a source asset.'); }
      }
      endEditorMenu();
    }
  }
}
