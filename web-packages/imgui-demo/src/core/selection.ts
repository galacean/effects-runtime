export class Selection {
  static activeObject: object | null;
  private static readonly _selectedObjects: Set<object> = new Set();

  static get selectedObjects (): ReadonlySet<object> {
    return Selection._selectedObjects;
  }

  static getSelectedObjects<T extends object> (): T[] {
    return Array.from(Selection._selectedObjects) as T[];
  }

  static isSelected (object: object | null | undefined): boolean {
    return !!object && Selection._selectedObjects.has(object);
  }

  static clear () {
    Selection._selectedObjects.clear();
    Selection.activeObject = null;
  }

  static replaceSelection (objects: Iterable<object>, activeObject?: object | null) {
    Selection._selectedObjects.clear();
    let lastSelected: object | null = null;

    for (const object of objects) {
      Selection._selectedObjects.add(object);
      lastSelected = object;
    }

    Selection.activeObject = (activeObject ?? lastSelected) ?? null;
  }

  static add (object: object, makeActive = true) {
    Selection._selectedObjects.add(object);

    if (makeActive || !Selection.activeObject) {
      Selection.activeObject = object;
    }
  }

  static toggle (object: object): boolean {
    if (Selection._selectedObjects.has(object)) {
      Selection._selectedObjects.delete(object);

      if (Selection.activeObject === object) {
        Selection.activeObject = Selection.getLastSelected();
      }

      if (Selection._selectedObjects.size === 0) {
        Selection.activeObject = null;
      }

      return false;
    }

    Selection._selectedObjects.add(object);
    Selection.activeObject = object;

    return true;
  }

  static setActiveObject (activeObject: object | null) {
    if (activeObject) {
      Selection.replaceSelection([activeObject], activeObject);
    } else {
      Selection.clear();
    }
  }

  private static getLastSelected (): object | null {
    let last: object | null = null;

    for (const object of Selection._selectedObjects) {
      last = object;
    }

    return last;
  }
}