import { editorCommands } from '../../framework/commands/editor-commands';
import { editorMenuItem } from '../widgets/editor-menu';

export function commandMenuItem (id: string, options: { label?: string, shortcut?: string } = {}): boolean {
  const command = editorCommands.get(id);

  if (!command) { return false; }
  const label = options.label ?? (typeof command.label === 'function' ? command.label() : command.label);
  const clicked = editorMenuItem(label, options.shortcut ?? command.shortcut, command.isChecked?.() ?? false, editorCommands.canExecute(id));

  if (clicked) { editorCommands.execute(id); }

  return clicked;
}
