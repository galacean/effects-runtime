import { editorTooltip } from '../../../ui/widgets/editor-tooltip';
import { ImGui } from '../../../platform/imgui/index';
import { beginEditorMenu, editorIconMenuItem, editorMenuSection, endEditorMenu } from '../../../ui/widgets/editor-menu';
import type { SceneItemPlacement } from '../operations/scene-item-operations';
import { SceneItemOperations } from '../operations/scene-item-operations';
import { sceneWorkspace } from '../scene-workspace';
import { SCENE_ITEM_DESCRIPTORS } from './scene-item-palette';

export function drawCreateItemMenu (target?: SceneItemPlacement): void {
  const document = sceneWorkspace.current;
  const enabled = !!document && !sceneWorkspace.busy && !document.restoring;
  const entries = SCENE_ITEM_DESCRIPTORS.filter(entry => entry.creatable !== false);

  editorMenuSection('Create Item');
  for (const group of new Set(entries.map(entry => entry.group))) {
    if (beginEditorMenu(group, enabled)) {
      for (const entry of entries.filter(entry => entry.group === group)) {
        if (editorIconMenuItem((entry.empty ? 'Empty ' : '') + entry.label, entry.icon)) {
          new SceneItemOperations(document!).create(entry, target);
        }
        if (entry.empty && ImGui.IsItemHovered()) { editorTooltip('Creates an empty ' + entry.label + ' item without a source asset.'); }
      }
      endEditorMenu();
    }
  }
}
