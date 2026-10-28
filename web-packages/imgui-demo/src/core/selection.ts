type SelectionListener = () => void;
export type SelectionSource = 'user' | 'sync' | 'history';
type SelectionHandler = (apply: () => void) => void;

export class Selection {
  private static readonly _selectedObjects: Set<object> = new Set();
  private static readonly _listeners: Set<SelectionListener> = new Set();
  private static handler?: SelectionHandler;
  private static pending?: object[];
  private static source: SelectionSource = 'sync';

  static get changeSource (): SelectionSource { return Selection.source; }

  static setChangeHandler (handler?: SelectionHandler): void { Selection.handler = handler; }

  static select (object: object | null): void {
    Selection.setObjects(object ? [object] : []);
  }

  /** 一次提交完整选区，避免多选同步时发出中间状态。 */
  static setObjects (objects: object[], source: SelectionSource = 'user'): void {
    const next = Array.from(new Set(objects));
    const current = Selection.getSelectedObjects();

    if (next.length === current.length && next.every((object, index) => object === current[index])) { return; }
    if (Selection.pending) {
      Selection.pending = next;

      return;
    }
    const apply = () => {
      Selection._selectedObjects.clear();
      next.forEach(object => Selection._selectedObjects.add(object));
      const previousSource = Selection.source;

      Selection.source = source;
      try { Selection.emitSelectionChanged(); } finally { Selection.source = previousSource; }
    };

    if (source === 'user' && Selection.handler) { Selection.handler(apply); } else { apply(); }
  }

  /** Range selection and history replay publish one coherent selection change. */
  static batch (action: () => void, source: SelectionSource = 'user'): void {
    if (Selection.pending) {
      action();

      return;
    }
    Selection.pending = Selection.getSelectedObjects();
    let next: object[];

    try { action(); next = Selection.pending; } finally { Selection.pending = undefined; }
    Selection.setObjects(next!, source);
  }

  static addObject (object: object): void {
    Selection.setObjects([...Selection.getSelectedObjects(), object]);
  }

  static removeObject (object: object): void {
    Selection.setObjects(Selection.getSelectedObjects().filter(selected => selected !== object));
  }

  static isSelected (object: object): boolean {
    return Selection.pending ? Selection.pending.includes(object) : Selection._selectedObjects.has(object);
  }

  static getSelectedObjects<T extends object> (): T[] {
    return (Selection.pending ? [...Selection.pending] : Array.from(Selection._selectedObjects)) as T[];
  }

  static clear (source: SelectionSource = 'user'): void { Selection.setObjects([], source); }

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
