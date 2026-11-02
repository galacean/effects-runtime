import type { MenuAction } from '../../../ui/controls/menu';
import type { EditorIcon } from '../../../ui/icons/control-icons';
import type { SceneItemPlacement } from '../operations/scene-item-operations';
import { SceneItemOperations } from '../operations/scene-item-operations';
import { sceneWorkspace } from '../scene-workspace';
import { SCENE_ITEM_DESCRIPTORS } from './scene-item-palette';

const categoryIcons: Record<string, EditorIcon> = {
  Basic: 'cube', '2D': 'sprite', Effects: 'particle', '3D': 'mesh', Media: 'video', Advanced: 'settings',
};

export function createItemActions (target?: SceneItemPlacement): MenuAction[] {
  const document = sceneWorkspace.current;
  const enabled = !!document && !sceneWorkspace.busy && !document.restoring;
  const entries = SCENE_ITEM_DESCRIPTORS.filter(entry => entry.creatable !== false);

  return [...new Set(entries.map(entry => entry.group))].map(group => ({ label: group, icon: categoryIcons[group], enabled,
    children: entries.filter(entry => entry.group === group).map(entry => ({ label: entry.label,
      icon: entry.icon,
      action: () => { if (document === sceneWorkspace.current) { new SceneItemOperations(document!).create(entry, target); } } })),
  }));
}
