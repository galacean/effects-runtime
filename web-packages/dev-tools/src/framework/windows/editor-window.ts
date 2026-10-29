import { ImGui } from '../../platform/imgui/index';

let getWindowFn: (<T extends EditorWindow>(type: new () => T) => T) | null = null;

export function setGetWindowProvider (fn: <T extends EditorWindow>(type: new () => T) => T) {
  getWindowFn = fn;
}

export class EditorWindow {
  title = 'New Window';
  protected initialSize = new ImGui.Vec2(500, 300);

  private opened = false;
  private active = false;
  private hovered = false;
  private firstFrame = true;
  private windowFlags = ImGui.WindowFlags.None;

  get layoutId (): string { return this.title.includes('###') ? this.title.split('###')[1] : this.title; }

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    if (!getWindowFn) {
      throw new Error('EditorApplication not initialized');
    }

    return getWindowFn(type);
  }

  update (dt: number) {
  }

  flushEdits (): void {
  }

  draw () {
    if (!this.opened) {
      return;
    }
    if (this.firstFrame) {
      ImGui.SetNextWindowSize(this.initialSize, ImGui.Cond.FirstUseEver);
      this.firstFrame = false;
    }

    const visible = ImGui.Begin(this.title, (value = this.opened) => {
      if (!value) {
        this.close();
      }

      return this.opened;
    }, this.windowFlags);

    this.setActive(this.opened && visible);
    if (this.opened && visible) {
      this.hovered = ImGui.IsWindowHovered();

      this.onGUI();
    } else {
      this.hovered = false;
    }

    ImGui.End();
  }

  open () {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.setActive(true);
  }

  close () {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.setActive(false);
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

  onUndoRedo (): void {
  }

  private setActive (active: boolean): void {
    if (this.active === active) {
      return;
    }
    this.active = active;
    if (active) {
      this.onEnable();
    } else {
      this.hovered = false;
      this.onDisable();
    }
  }
}
