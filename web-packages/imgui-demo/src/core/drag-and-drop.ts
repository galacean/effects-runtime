export class DragAndDrop {
  static DragType: string = '';
  static objectReferences: object[] = [];

  static prepareStartDrag () {
    DragAndDrop.DragType = '';
    DragAndDrop.objectReferences.length = 0;
  }
}

export enum DragType {
  Material = 'Material',
  Geometry = 'Geometry'
}