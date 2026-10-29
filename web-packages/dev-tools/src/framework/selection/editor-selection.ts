type SelectionListener = () => void;
export type SelectionSource = 'user' | 'sync' | 'history';
type SelectionHandler = (apply: () => void) => void;

export class EditorSelection {
  private static readonly _selectedObjects: Set<object> = new Set();
  private static readonly _listeners: Set<SelectionListener> = new Set();
  private static handler?: SelectionHandler;
  private static pending?: object[];
  private static source: SelectionSource = 'sync';

  static get changeSource (): SelectionSource { return EditorSelection.source; }

  static setChangeHandler (handler?: SelectionHandler): void { EditorSelection.handler = handler; }

  static select (object: object | null): void {
    EditorSelection.setObjects(object ? [object] : []);
  }

  /** 一次提交完整选区，避免多选同步时发出中间状态。 */
  static setObjects (objects: object[], source: SelectionSource = 'user'): void {
    const next = Array.from(new Set(objects));
    const current = EditorSelection.getSelectedObjects();

    if (next.length === current.length && next.every((object, index) => object === current[index])) { return; }
    if (EditorSelection.pending) {
      EditorSelection.pending = next;

      return;
    }
    const apply = () => {
      EditorSelection._selectedObjects.clear();
      next.forEach(object => EditorSelection._selectedObjects.add(object));
      const previousSource = EditorSelection.source;

      EditorSelection.source = source;
      try { EditorSelection.emitSelectionChanged(); } finally { EditorSelection.source = previousSource; }
    };

    if (source === 'user' && EditorSelection.handler) { EditorSelection.handler(apply); } else { apply(); }
  }

  /** Range selection and history replay publish one coherent selection change. */
  static batch (action: () => void, source: SelectionSource = 'user'): void {
    if (EditorSelection.pending) {
      action();

      return;
    }
    EditorSelection.pending = EditorSelection.getSelectedObjects();
    let next: object[];

    try { action(); next = EditorSelection.pending; } finally { EditorSelection.pending = undefined; }
    EditorSelection.setObjects(next!, source);
  }

  static addObject (object: object): void {
    EditorSelection.setObjects([...EditorSelection.getSelectedObjects(), object]);
  }

  static removeObject (object: object): void {
    EditorSelection.setObjects(EditorSelection.getSelectedObjects().filter(selected => selected !== object));
  }

  static isSelected (object: object): boolean {
    return EditorSelection.pending ? EditorSelection.pending.includes(object) : EditorSelection._selectedObjects.has(object);
  }

  static getSelectedObjects<T extends object> (): T[] {
    return (EditorSelection.pending ? [...EditorSelection.pending] : Array.from(EditorSelection._selectedObjects)) as T[];
  }

  static clear (source: SelectionSource = 'user'): void { EditorSelection.setObjects([], source); }

  static addSelectionListener (listener: SelectionListener): void {
    EditorSelection._listeners.add(listener);
  }

  static removeSelectionListener (listener: SelectionListener): void {
    EditorSelection._listeners.delete(listener);
  }

  private static emitSelectionChanged (): void {
    for (const listener of EditorSelection._listeners) {
      listener();
    }
  }
}
