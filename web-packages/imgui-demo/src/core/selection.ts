export class Selection {
  static activeObject: object;

  static setActiveObject (activeObject: object) {
    Selection.activeObject = activeObject;
  }
}