import { editorCommands } from '../../framework/commands/editor-commands';
import type { MenuAction } from '../controls/menu';
import type { EditorIcon } from '../icons/control-icons';

const icons: Record<string, EditorIcon> = { 'scene.new': 'scene', 'scene.open': 'folderOpen', 'scene.save': 'save', 'scene.save-as': 'save', 'scene.save-all': 'save', 'document.undo': 'undo', 'document.redo': 'redo', 'project.settings': 'settings', 'project.new': 'project', 'project.open': 'folderOpen', 'project.import': 'import', 'project.export': 'export' };

export function commandMenuItem (id: string): MenuAction {
  const command = editorCommands.get(id);

  return { label: command ? typeof command.label === 'function' ? command.label() : command.label : id, shortcut: command?.shortcut, icon: icons[id],
    enabled: editorCommands.canExecute(id), checked: command?.isChecked?.(), action: () => editorCommands.execute(id) };
}
