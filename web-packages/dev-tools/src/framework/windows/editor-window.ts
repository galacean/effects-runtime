import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { DockWorkspace } from '../../ui/controls/dock-workspace';
import type { EditorIcon } from '../../ui/icons/control-icons';

const panelIcons: Record<string, EditorIcon> = {
  Scene: 'camera', Hierarchy: 'sourcesOpen', Inspector: 'details', 'Content Browser': 'browseContent', Sequencer: 'sequence',
  Composition: 'sequence', 'Runtime Assets': 'cube', 'Animation Clip': 'curve', AnimationGraph: 'graph',
  'Content Asset Editor': 'materialAsset', 'Texture Editor': 'texture', 'Asset Editor': 'materialAsset',
};

let getWindowFn: (<T extends EditorWindow>(type: new () => T) => T) | null = null;

export function setGetWindowProvider (fn: <T extends EditorWindow>(type: new () => T) => T): void { getWindowFn = fn; }

/** A panel owns its Control tree for its entire lifetime, including while its tab is hidden. */
export abstract class EditorWindow {
  private windowTitle = 'New Window';
  get title (): string { return this.windowTitle; }
  set title (value: string) { this.windowTitle = value; this.dock?.updateTitle(this.layoutId, value.split('###')[0]); }
  protected initialSize = new math.Vector2(800, 600);
  protected dockingRole: 'panel' | 'document' = 'panel';
  private opened = false;
  private active = false;
  private dock?: DockWorkspace;
  private view?: Control;
  private panelIcon?: EditorIcon;
  get tabIcon (): EditorIcon | undefined { return this.panelIcon ?? panelIcons[this.layoutId]; }
  set tabIcon (value: EditorIcon | undefined) {
    this.panelIcon = value;
    const panel = this.dock?.panels.get(this.layoutId);

    if (panel) { panel.icon = this.tabIcon; }
  }

  get layoutId (): string { return this.title.includes('###') ? this.title.split('###')[1] : this.title; }
  get content (): Control | undefined { return this.view; }

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    if (!getWindowFn) { throw new Error('EditorApplication not initialized'); }

    return getWindowFn(type);
  }

  mount (engine: Engine, dock: DockWorkspace): void {
    if (this.view) { return; }
    this.dock = dock; this.view = this.createContent(engine);
    dock.register({ id: this.layoutId, title: this.title.split('###')[0], icon: this.tabIcon, content: this.view, opened: this.opened, initialSize: this.initialSize, dockingRole: this.dockingRole,
      close: () => this.close(), visibilityChanged: active => this.setActive(active) });
  }

  protected abstract createContent (engine: Engine): Control;
  update (dt: number): void {}
  flushEdits (): void {}
  onSelectionChange (): void {}
  onUndoRedo (): void {}
  protected onEnable (): void {}
  protected onDisable (): void {}

  open (): void {
    if (this.opened) {
      this.dock?.activatePanel(this.layoutId);

      return;
    }
    this.opened = true; this.dock?.setOpened(this.layoutId, true);
  }
  close (): void {
    if (!this.opened) { return; }
    this.flushEdits(); this.opened = false; this.dock?.setOpened(this.layoutId, false);
  }
  isOpened (): boolean { return this.opened; }
  isActive (): boolean { return this.active; }
  isHovered (): boolean {
    const view = this.view;

    return !!view?.visibleInHierarchy && view.hasPoint(view.getLocalMousePosition());
  }
  hasFocus (): boolean {
    for (let control = this.view?.root?.guiGetFocusOwner(); control; control = control.parent) {
      if (control === this.view) { return true; }
    }

    return false;
  }
  dispose (): void { this.flushEdits(); this.setActive(false); this.view?.dispose(); this.view = undefined; }
  private setActive (active: boolean): void {
    if (this.active === active) { return; }
    this.active = active;
    if (active) { this.onEnable(); } else { this.onDisable(); }
  }
}
