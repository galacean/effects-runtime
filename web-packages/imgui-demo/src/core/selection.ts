type SelectionListener = () => void;

export class Selection {
  private static readonly _selectedObjects: Set<object> = new Set();
  private static readonly _listeners: Set<SelectionListener> = new Set();

  static select (object: object | null): void {
    if (object === null) {
      Selection.clear();

      return;
    }

    if (Selection._selectedObjects.has(object) && Selection._selectedObjects.size === 1) {
      return;
    }

    Selection._selectedObjects.clear();
    Selection._selectedObjects.add(object);
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
