import { ImGui } from '../../platform/imgui/index';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

class NodeGraphDragAndDropState {
  public m_mouseCanvasPos: ImVec2;  // The mouse canvas position at which the drag and drop occurred
  public m_mouseScreenPos: ImVec2;  // The mouse screen position at which the drag and drop occurred
  public payloadID: string;
  public payloadData: any;

  constructor () {
    this.m_mouseCanvasPos = new ImVec2(0, 0);
    this.m_mouseScreenPos = new ImVec2(0, 0);
    this.payloadID = '';
    this.payloadData = new Uint8Array();
  }

  public TryAcceptDragAndDrop (payloadID: string): boolean {
    const payload = ImGui.AcceptDragDropPayload(payloadID);

    if (payload) {
      this.payloadID = payloadID;
      // this.payloadData = new Uint8Array(payload.dataSize);
      // this.payloadData.set(new Uint8Array(payload.data.buffer, payload.data.byteOffset, payload.dataSize));
      this.payloadData = payload.Data;

      return true;
    }

    return false;
  }
}

export class DragAndDropState extends NodeGraphDragAndDropState {
  m_isActiveDragAndDrop: boolean = false;

  Reset (): void {
    this.m_mouseCanvasPos = this.m_mouseCanvasPos = new ImVec2(0, 0);
    this.payloadID = '';
    this.payloadData = '';
    this.m_isActiveDragAndDrop = false;
  }
}
