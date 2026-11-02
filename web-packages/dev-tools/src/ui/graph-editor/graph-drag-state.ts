import { math } from '@galacean/effects';

export class DragAndDropState {
  m_mouseCanvasPos = new math.Vector2();
  m_mouseScreenPos = new math.Vector2();
  payloadID = '';
  payloadData: unknown;
}
