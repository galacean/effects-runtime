import { ImGui } from '../imgui';

export class EditorWindow {
  title = 'New Window';

  private opened = false;
  private firstFrame = true;

  draw () {
    if (!this.opened) {
      return;
    }
    if (this.firstFrame) {
      ImGui.SetNextWindowSize(new ImGui.Vec2(500, 300));
      this.firstFrame = false;
    }
    ImGui.Begin(this.title, (value = this.opened) => this.opened = value);
    this.onGUI();
    ImGui.End();
  }

  open () {
    this.opened = true;
  }

  close () {
    this.opened = false;
  }

  protected onGUI () {

  }
}