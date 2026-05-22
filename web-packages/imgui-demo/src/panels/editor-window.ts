import { ImGui } from '../imgui';

let getWindowFn: (<T extends EditorWindow>(type: new () => T) => T) | null = null;

export function setGetWindowProvider (fn: <T extends EditorWindow>(type: new () => T) => T) {
  getWindowFn = fn;
}

export class EditorWindow {
  title = 'New Window';

  private opened = false;
  private hovered = false;
  private firstFrame = true;
  private windowFlags = ImGui.WindowFlags.None;

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    if (!getWindowFn) {
      throw new Error('EditorApplication not initialized');
    }

    return getWindowFn(type);
  }

  update (dt: number) {
  }

  draw () {
    if (!this.opened) {
      return;
    }
    if (this.firstFrame) {
      ImGui.SetNextWindowSize(new ImGui.Vec2(500, 300));
      this.firstFrame = false;
    }

    if (ImGui.Begin(this.title, (value = this.opened) => this.opened = value, this.windowFlags)) {
      this.hovered = ImGui.IsWindowHovered();

      this.onGUI();
    }

    ImGui.End();
  }

  open () {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.onEnable();
  }

  close () {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.onDisable();
  }

  isOpened () {
    return this.opened;
  }

  isHovered () {
    return this.hovered;
  }

  setWindowFlags (flags: ImGui.WindowFlags) {
    this.windowFlags = flags;
  }

  protected onEnable () {
  }

  protected onDisable () {
  }

  protected onGUI () {
  }

  onSelectionChange () {
  }
}
