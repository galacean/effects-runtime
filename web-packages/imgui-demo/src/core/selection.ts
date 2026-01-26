type SelectionChangedCallback = () => void;

/**
 * 选择管理器
 */
export class Selection {
  private static readonly _selectedObjects: Set<object> = new Set();
  private static readonly _listeners: Set<SelectionChangedCallback> = new Set();

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

  /**
   * 添加对象到选择
   * @param object 要添加的对象
   */
  static addObject (object: object): void {
    if (Selection._selectedObjects.has(object)) {
      return;
    }

    Selection._selectedObjects.add(object);
    Selection.emitSelectionChanged();
  }

  /**
   * 从选择中移除对象
   * @param object 要移除的对象
   */
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

  /**
   * 获取所有已选择对象的数组
   */
  static getSelectedObjects<T extends object> (): T[] {
    return Array.from(Selection._selectedObjects) as T[];
  }

  /**
   * 清空所有选择
   */
  static clear (): void {
    if (Selection._selectedObjects.size === 0) {
      return;
    }

    Selection._selectedObjects.clear();
    Selection.emitSelectionChanged();
  }

  /**
   * 发送选择变更事件
   */
  private static emitSelectionChanged (): void {
    for (const listener of Selection._listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Selection change listener error:', error);
      }
    }
  }
}