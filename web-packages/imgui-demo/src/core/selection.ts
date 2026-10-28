type SelectionListener = () => void;

export class Selection {
  private static readonly _selectedObjects: Set<object> = new Set();
  private static readonly _listeners: Set<SelectionListener> = new Set();

  static select (object: object | null): void {
    Selection.setObjects(object ? [object] : []);
  }

  /** 一次提交完整选区，避免多选同步时发出中间状态。 */
  static setObjects (objects: object[]): void {
    const next = Array.from(new Set(objects));
    const current = Selection.getSelectedObjects();

    if (next.length === current.length && next.every((object, index) => object === current[index])) {
      return;
    }
    Selection._selectedObjects.clear();
    next.forEach(object => Selection._selectedObjects.add(object));
    Selection.emitSelectionChanged();
  }

  static addObject (object: object): void {
    if (Selection._selectedObjects.has(object)) {
      return;
    }

    Selection._selectedObjects.add(object);
    Selection.emitSelectionChanged();
  }

  static removeObject (object: object): void {
    if (!Selection._selectedObjects.has(object)) {
      return;
    }

    Selection._selectedObjects.delete(object);
    Selection.emitSelectionChanged();
  }

  static isSelected (object: object): boolean {
    return Selection._selectedObjects.has(object);
  }

  static getSelectedObjects<T extends object> (): T[] {
    return Array.from(Selection._selectedObjects) as T[];
  }

  static clear (): void {
    if (Selection._selectedObjects.size === 0) {
      return;
    }

    Selection._selectedObjects.clear();
    Selection.emitSelectionChanged();
  }

  static addSelectionListener (listener: SelectionListener): void {
    Selection._listeners.add(listener);
  }

  static removeSelectionListener (listener: SelectionListener): void {
    Selection._listeners.delete(listener);
  }

  private static emitSelectionChanged (): void {
    for (const listener of Selection._listeners) {
      listener();
    }
  }
}
