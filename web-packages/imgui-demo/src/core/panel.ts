import { UIManager } from './ui-manager';
import { ImGui } from '../imgui';

export class EditorWindow {
  title = 'New Window';

  private opened = false;
  private hovered = false;
  private firstFrame = true;

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    return UIManager.getWindow(type);
  }

  draw () {
    if (!this.opened) {
      return;
    }
    if (this.firstFrame) {
      ImGui.SetNextWindowSize(new ImGui.Vec2(500, 300));
      this.firstFrame = false;
    }

    ImGui.Begin(this.title, (value = this.opened) => this.opened = value);
    this.hovered = ImGui.IsWindowHovered();

    this.onGUI();
    ImGui.End();
  }

  open () {
    this.opened = true;
  }

  close () {
    this.opened = false;
  }

  isOpened () {
    return this.opened;
  }

  isHovered () {
    return this.hovered;
  }

  protected onGUI () {

  }
}