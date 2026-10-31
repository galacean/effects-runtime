import { math } from '@galacean/effects';
import type { Engine, InputEventKey } from '@galacean/effects';
import type { VBoxContainer } from '@galacean/effects-plugin-gui';
import { Button, Control, Label, AutowrapMode, MouseFilter, PanelContainer, SizeFlags } from '@galacean/effects-plugin-gui';
import { append, column, disposeChildren, expand, margin, row } from './layout';
import { EditorPopupPanel } from './popup-panel';
import { EditorWindowTitleBar } from './window-title-bar';
import { EditorPrimaryButton } from './primary-button';
import { editorBox, editorColors } from '../theme/control-theme';

export interface DialogAction { label: string, action(): void, enabled?: boolean | (() => boolean), primary?: boolean }

export class EditorDialog extends EditorPopupPanel {
  readonly body: VBoxContainer;
  readonly beforeButtons: VBoxContainer;
  private readonly titleBar: EditorWindowTitleBar;
  private readonly buttons: VBoxContainer;
  private readonly backdrop: Control;
  private actions: { action: DialogAction, button: Button }[] = [];
  private closing = false;
  canceled?: () => void;

  constructor (engine: Engine) {
    super(engine); this.themeTypeVariation = 'EditorDialog';
    const frame = append(this, column(engine));

    this.titleBar = append(frame, new EditorWindowTitleBar(engine, this, () => this.cancel()));
    const panel = append(frame, new PanelContainer(engine));

    panel.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel));
    const content = append(panel, column(engine));

    this.body = column(engine, [], 8); append(content, margin(engine, this.body, 16, 12));
    const footer = row(engine, [], 8), footerMargin = append(content, margin(engine, footer, 16, 0));

    footerMargin.setThemeConstantOverride('marginTop', 4); footerMargin.setThemeConstantOverride('marginBottom', 16);
    this.beforeButtons = append(footer, expand(column(engine), true, false)); this.beforeButtons.verticalSizeFlags = SizeFlags.ShrinkEnd;
    this.buttons = append(footer, column(engine)); this.buttons.verticalSizeFlags = SizeFlags.ShrinkEnd;
    this.backdrop = new Control(engine); this.backdrop.mouseFilter = MouseFilter.Stop;
    this.backdrop.onMouseDown = event => { this.grabFocus(); event.accept(); };
    this.onPopup('popupOpened', () => {
      this.backdrop.parent = this.parent; this.parent?.changeChildIndex(this.backdrop, this.parent.children.indexOf(this));
      this.resizeBackdrop();
    });
    this.onPopup('popupClosed', () => { this.backdrop.parent = null; if (!this.closing) { this.canceled?.(); } });
  }
  show (source: Control, title: string, build: (body: VBoxContainer) => void, actions: DialogAction[], width = 440): void {
    this.close(); this.titleBar.caption.text = title; disposeChildren(this.body); disposeChildren(this.buttons); disposeChildren(this.beforeButtons);
    this.actions = [];
    build(this.body);
    const bar = append(this.buttons, row(this.engine, [], 8));

    for (const action of actions) {
      const button = append(bar, action.primary ? new EditorPrimaryButton(this.engine, action.label) : new Button(this.engine, action.label));

      button.setCustomMinimumSize(80, 0); button.on('pressed', action.action); this.actions.push({ action, button });
    }
    this.refreshActions();
    this.setSize(width, 0); this.setCustomMinimumSize(width, 0);
    const size = this.getCombinedMinimumSize(), root = source.root, actualWidth = Math.max(width, size.x);

    this.setSize(actualWidth, size.y);
    this.popup(new math.Vector2(Math.max(12, ((root?.width ?? window.innerWidth) - actualWidth) / 2), Math.max(12, ((root?.height ?? window.innerHeight) - size.y) / 2)), root?.guiGetFocusOwner() ?? source);
    const focus = this.actions.find(({ action, button }) => action.primary && !button.disabled) ?? this.actions.filter(({ button }) => !button.disabled).at(-1);

    focus?.button.grabFocus();
  }
  close (): void { this.closing = true; this.hidePopup(); this.closing = false; }
  private cancel (): void {
    const cancel = this.actions.find(({ action }) => action.label === 'Cancel' || action.label === 'Close');

    if (cancel) { if (!cancel.button.disabled) { cancel.action.action(); } } else { this.hidePopup(); }
  }
  private refreshActions (): void { this.actions.forEach(({ action, button }) => button.disabled = typeof action.enabled === 'function' ? !action.enabled() : action.enabled === false); }
  private resizeBackdrop (): void { this.backdrop.setSize(this.root?.width ?? window.innerWidth, this.root?.height ?? window.innerHeight); }
  override update (dt: number): void { this.resizeBackdrop(); this.refreshActions(); super.update(dt); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.cancel(); event.accept(); } else if (event.keycode === 'Enter' && !event.echo) {
      const confirm = this.actions.find(({ action, button }) => action.primary && !button.disabled);

      if (confirm) { confirm.action.action(); event.accept(); }
    } else { super.onKeyDown(event); }
  }
  message (body: Control, text: string): Label {
    const label = append(body, new Label(this.engine, text));

    label.autowrapMode = AutowrapMode.WordSmart; label.setCustomMinimumSize(380, 0);

    return label;
  }
  override onDestroy (): void { this.backdrop.dispose(); super.onDestroy(); }
}
