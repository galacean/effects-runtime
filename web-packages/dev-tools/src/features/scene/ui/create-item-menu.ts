import type { MenuAction } from '../../../ui/controls/menu';
import type { SceneItemPlacement } from '../operations/scene-item-operations';
import { SceneItemOperations } from '../operations/scene-item-operations';
import { sceneWorkspace } from '../scene-workspace';
import { SCENE_ITEM_DESCRIPTORS } from './scene-item-palette';

export function createItemActions (target?: SceneItemPlacement): MenuAction[] {
  const document = sceneWorkspace.current;
  const enabled = !!document && !sceneWorkspace.busy && !document.restoring;
  const entries = SCENE_ITEM_DESCRIPTORS.filter(entry => entry.creatable !== false);

  return [...new Set(entries.map(entry => entry.group))].map(group => ({ label: group, enabled,
    children: entries.filter(entry => entry.group === group).map(entry => ({ label: (entry.empty ? 'Empty ' : '') + entry.label,
      action: () => { if (document === sceneWorkspace.current) { new SceneItemOperations(document!).create(entry, target); } } })),
  }));
}
