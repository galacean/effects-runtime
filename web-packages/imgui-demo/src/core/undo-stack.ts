/**
 * 命令模式 Undo/Redo 栈。
 */
export interface ProCommand {
  readonly label: string,
  execute (): void,
  undo (): void,
}

export class ProUndoStack {
  private commands: ProCommand[] = [];
  private cursor = -1;
  private maxSize = 100;

  get canUndo (): boolean {
    return this.cursor >= 0;
  }

  get canRedo (): boolean {
    return this.cursor < this.commands.length - 1;
  }

  get undoLabel (): string {
    return this.canUndo ? this.commands[this.cursor].label : '';
  }

  get redoLabel (): string {
    return this.canRedo ? this.commands[this.cursor + 1].label : '';
  }

  execute (command: ProCommand): void {
    // Truncate redo history
    this.commands.length = this.cursor + 1;
    command.execute();
    this.commands.push(command);
    this.cursor++;

    if (this.commands.length > this.maxSize) {
      this.commands.shift();
      this.cursor--;
    }
  }

  undo (): void {
    if (!this.canUndo) {
      return;
    }
    this.commands[this.cursor].undo();
    this.cursor--;
  }

  redo (): void {
    if (!this.canRedo) {
      return;
    }
    this.cursor++;
    this.commands[this.cursor].execute();
  }

  clear (): void {
    this.commands.length = 0;
    this.cursor = -1;
  }
}

// Convenience command factories

export function createSetValueCommand<T extends object, K extends keyof T> (
  target: T,
  key: K,
  newValue: T[K],
  label?: string,
): ProCommand {
  const oldValue = target[key];

  return {
    label: label ?? `Set ${String(key)}`,
    execute () { target[key] = newValue; },
    undo () { target[key] = oldValue; },
  };
}

export function createAddItemCommand<T> (
  array: T[],
  item: T,
  label?: string,
): ProCommand {
  return {
    label: label ?? 'Add item',
    execute () { array.push(item); },
    undo () {
      const idx = array.indexOf(item);

      if (idx >= 0) {
        array.splice(idx, 1);
      }
    },
  };
}

export function createRemoveItemCommand<T> (
  array: T[],
  item: T,
  label?: string,
): ProCommand {
  let removedIndex = -1;

  return {
    label: label ?? 'Remove item',
    execute () {
      removedIndex = array.indexOf(item);
      if (removedIndex >= 0) {
        array.splice(removedIndex, 1);
      }
    },
    undo () {
      if (removedIndex >= 0) {
        array.splice(removedIndex, 0, item);
      }
    },
  };
}

export function createReorderCommand<T> (
  array: T[],
  item: T,
  newIndex: number,
  label?: string,
): ProCommand {
  let oldIndex = -1;

  return {
    label: label ?? 'Reorder',
    execute () {
      oldIndex = array.indexOf(item);
      if (oldIndex >= 0) {
        array.splice(oldIndex, 1);
        array.splice(Math.min(newIndex, array.length), 0, item);
      }
    },
    undo () {
      const curIdx = array.indexOf(item);

      if (curIdx >= 0) {
        array.splice(curIdx, 1);
        array.splice(Math.min(oldIndex, array.length), 0, item);
      }
    },
  };
}

export const globalUndoStack = new ProUndoStack();
