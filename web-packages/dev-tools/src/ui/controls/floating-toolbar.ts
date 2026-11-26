import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Button, Container, Theme } from '@galacean/effects-plugin-gui';
import type { Control, StyleBoxFlat } from '@galacean/effects-plugin-gui';
import { editorBox, editorColors, EDITOR_COMPACT_FONT_SIZE, getEditorFont } from '../theme/control-theme';
import { place } from './layout';
import type { EditorPopupPanel } from './popup-panel';

export const FLOATING_TOOL_CONTROL_HEIGHT = 24;

const BAR_HEIGHT = FLOATING_TOOL_CONTROL_HEIGHT + 4;
const SIDE_PADDING = 6;
const GROUP_GAP = 8;
const CONTROL_GAP = 2;

type ToolbarSlot = { control: Control, x: number, width: number };

function floatingToolPanel (padding: number): StyleBoxFlat {
  return editorBox(editorColors.panel, padding, 4, editorColors.outline);
}

/** A compact, grouped toolbar centered over the viewport. */
export abstract class EditorFloatingToolbar extends Container {
  protected groups: Control[][] = [];
  private readonly background = floatingToolPanel(0);
  private settingsPopup?: EditorPopupPanel;
  private viewportWidth = 0;
  private slots: ToolbarSlot[] = [];
  private separators: number[] = [];

  constructor (engine: Engine) {
    super(engine);
    this.theme = new Theme();
    this.theme.setFontSize('Control', 'fontSize', EDITOR_COMPACT_FONT_SIZE);
    this.theme.setFont('Control', 'font', { family: getEditorFont(engine, EDITOR_COMPACT_FONT_SIZE), weight: 'normal', style: 'normal' });
    this.on('visibilityChanged', () => { if (!this.visibleInHierarchy) { this.closePopup(); } });
  }

  protected abstract selectControls (available: number): Set<Control>;

  protected setSettingsPopup (button: Button, popup: EditorPopupPanel): void {
    button.themeTypeVariation = 'EditorViewportMenu';
    popup.setThemeStyleBoxOverride('panel', floatingToolPanel(6));
    this.settingsPopup = popup;
  }

  closePopup (): void { this.settingsPopup?.hidePopup(); }

  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, BAR_HEIGHT); }

  layoutForViewport (width: number): void {
    if (width < 1 || width === this.viewportWidth) { return; }
    this.viewportWidth = width;
    this.refreshLayout();
  }

  protected refreshLayout (): void {
    if (!this.viewportWidth) { return; }
    this.closePopup();
    const available = Math.max(80, this.viewportWidth - 16);
    const visible = this.selectControls(available);
    const layout = this.measureRow(visible);
    const width = Math.min(available, layout.width);

    this.groups.flat().forEach(control => { control.visible = visible.has(control); });
    this.slots = layout.slots;
    this.separators = layout.separators;
    place(this, Math.floor((this.viewportWidth - width) / 2), 4, width, BAR_HEIGHT);
    this.queueSort();
  }

  /** Returns the remaining excess width after folding lower-priority controls. */
  protected collapseToFit (visible: Set<Control>, available: number, order: Control[], onHidden?: (control: Control) => void): number {
    let width = this.measureRow(visible).width;

    for (const control of order) {
      if (width <= available) { break; }
      if (visible.delete(control)) {
        onHidden?.(control);
        width = this.measureRow(visible).width;
      }
    }

    return Math.max(0, width - available);
  }

  private measureRow (visible: ReadonlySet<Control>) {
    const slots: ToolbarSlot[] = [], separators: number[] = [];
    let x = SIDE_PADDING;

    for (const group of this.groups) {
      const controls = group.filter(control => visible.has(control));

      if (!controls.length) { continue; }
      if (slots.length) { separators.push(x + GROUP_GAP / 2); x += GROUP_GAP; }
      controls.forEach((control, index) => {
        const width = Math.max(control instanceof Button ? 26 : 0, control.getCombinedMinimumSize().x);

        if (index) { x += CONTROL_GAP; }
        slots.push({ control, x, width });
        x += width;
      });
    }

    return { slots, separators, width: x + SIDE_PADDING };
  }

  protected override sortChildren (): void {
    const y = (this.height - FLOATING_TOOL_CONTROL_HEIGHT) / 2;

    for (const { control, x, width } of this.slots) {
      place(control, x, y, width, FLOATING_TOOL_CONTROL_HEIGHT);
    }
  }

  override draw (): void {
    this.drawStyleBox(this.background, 0, 0, this.width, this.height);
    this.separators.forEach(x => this.drawLine(x, 7, x, this.height - 7, editorColors.outline));
  }
}
