export interface EditorCommand {
  label: string | (() => string),
  shortcut?: string,
  execute: () => void | Promise<unknown>,
  canExecute?: () => boolean,
  isChecked?: () => boolean,
}

export class EditorCommandRegistry {
  private readonly commands = new Map<string, EditorCommand>();
  onError: (error: unknown) => void = console.error;

  register (id: string, command: EditorCommand): void { this.commands.set(id, command); }
  get (id: string): EditorCommand | undefined { return this.commands.get(id); }
  canExecute (id: string): boolean {
    const command = this.commands.get(id);

    return !!command && (command.canExecute?.() ?? true);
  }

  execute (id: string): void {
    const command = this.commands.get(id);

    if (!command || !this.canExecute(id)) { return; }
    try { void Promise.resolve(command.execute()).catch(error => this.onError(error)); } catch (error) { this.onError(error); }
  }
}

export const editorCommands = new EditorCommandRegistry();
