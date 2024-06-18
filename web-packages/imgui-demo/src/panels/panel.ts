import { ImGui } from '../imgui';

export class Panel {
  title = 'New Window';

  draw () {
    ImGui.Begin(this.title);
    this.onGUI();
    ImGui.End();
  }

  onGUI () {

  }
}