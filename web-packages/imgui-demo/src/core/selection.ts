export class Selection {
  static activeObject: object | null;

  static setActiveObject (activeObject: object | null) {
    Selection.activeObject = activeObject;
  }
}