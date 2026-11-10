import { math, spec } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Container, MouseFilter, SizeFlags, VerticalAlignment } from '@galacean/effects-plugin-gui';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { EditorColorButton } from '../../../ui/controls/color-picker';
import { EditorComboBox } from '../../../ui/controls/combo-box';
import { NumberEdit } from '../../../ui/controls/number-edit';
import { append, column, expand, label, place, row, screenPosition } from '../../../ui/controls/layout';
import { EditorPopupPanel } from '../../../ui/controls/popup-panel';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { editorBox, editorColors, EDITOR_COMPACT_FONT_SIZE, EDITOR_SMALL_FONT_SIZE, setEditorFont } from '../../../ui/theme/control-theme';
import { STROKE_WIDTH_PRESETS } from '../factories/stroke-width-presets';

export interface SceneBrushSettings {
  width: number,
  color: math.Color,
  smoothing: number,
  spacing: number,
  cap: spec.LineCap,
  join: spec.LineJoin,
  miterLimit: number,
  profile: number,
}

export function createBrushSettings (): SceneBrushSettings {
  return { width: .04, color: new math.Color(.4, .85, .94, 1), smoothing: 60, spacing: 2,
    cap: spec.LineCap.Round, join: spec.LineJoin.Round, miterLimit: 10, profile: 0 };
}

/** Brush preferences apply to the next stroke and do not create scene edits. */
export class SceneBrushSettingsBar extends Container {
  private readonly fields: { control: Control, caption: Label, input: Control, width: number }[] = [];
  private readonly numbers: { control: NumberEdit, key: 'width' | 'smoothing' | 'spacing' | 'miterLimit' }[] = [];
  private readonly color: EditorColorButton;
  private readonly more: EditorIconButton;
  private readonly popup: EditorPopupPanel;
  private readonly popupProfile: Control;
  private readonly background = editorBox(editorColors.panel, 0, 6, editorColors.outline);
  private viewportWidth = -1;

  constructor (engine: Engine, private readonly settings: SceneBrushSettings) {
    super(engine);
    this.field('Width', this.number('width', .005, 3, .001, 100, ''), 108, 'Stroke width in scene units, matching the Shape inspector.');
    this.color = new EditorColorButton(engine);
    this.color.color = settings.color;
    this.color.changed = color => settings.color.copyFrom(color);
    this.field('Color', this.color, 74, 'Stroke color and opacity.');
    const profileTooltip = 'Stroke width variation along the path.';

    this.field('Profile', this.profile(), 174, profileTooltip);
    this.more = append(this, new EditorIconButton(engine, 'details'));
    this.more.setCustomMinimumSize(28, 24);
    this.more.on('pressed', () => this.showSettings());
    setTooltip(this.more, 'Advanced brush settings');
    this.popup = new EditorPopupPanel(engine);
    this.popup.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel, 12, 6, editorColors.outline));
    const body = append(this.popup, column(engine, [], 8));

    append(body, label(engine, 'Advanced brush settings', editorColors.foregroundHeader));
    const scope = append(body, label(engine, 'Applies to new strokes.', editorColors.muted));

    setEditorFont(scope, EDITOR_SMALL_FONT_SIZE);
    this.popupField(body, 'Smoothing', this.number('smoothing', 1, 0, 0, 100, '%'),
      'Smooth short movements over a larger screen distance as the value increases.\nZero preserves the sampled polyline.');
    this.popupProfile = this.popupField(body, 'Width profile', this.profile(), profileTooltip);
    this.popupProfile.visible = false;
    this.popupField(body, 'Cap', this.cap(), 'Shape of the two ends of an open stroke.');
    this.popupField(body, 'Join', this.join(), 'Join style at sharp corners.\nSmooth curves may have no visible corner.');
    this.popupField(body, 'Miter limit', this.number('miterLimit', .5, 1, 1, 100, ''), 'Maximum miter length relative to the stroke width.');
    this.popupField(body, 'Sample spacing', this.number('spacing', .5, 1, .5, 16, ' px'),
      'Distance along the pointer trace between samples, in screen pixels.\nSmaller values preserve finer movements.');
    this.popup.setCustomMinimumSize(300, 0);
    this.on('visibilityChanged', () => { if (!this.visibleInHierarchy) { this.closePopup(); } });
    this.setCustomMinimumSize(0, 40);
  }

  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, 40); }

  /** This overlay never contributes to the viewport's layout or render size. */
  layoutForViewport (width: number): void {
    if (width === this.viewportWidth) { return; }
    this.viewportWidth = width;
    const available = Math.max(80, width - 16);
    const naturalWidth = (): number => 46 + this.fields.filter(field => field.control.visible).reduce((sum, field) => sum + field.width + 12, 0);

    this.fields.forEach(field => { field.control.visible = true; field.caption.visible = true; });
    for (const field of this.fields.slice(1).reverse()) {
      if (naturalWidth() <= available) { break; }
      field.control.visible = false;
    }
    this.fields[0].caption.visible = available >= 180;
    this.popupProfile.visible = !this.fields[2].control.visible;
    const actualWidth = Math.min(available, naturalWidth());

    place(this, Math.floor((width - actualWidth) / 2), 8, actualWidth, 40);
    this.queueSort();
  }

  closePopup (): void { this.popup.hidePopup(); }

  override update (dt: number): void {
    this.color.color = this.settings.color;
    for (const { control, key } of this.numbers) {
      if (!control.isEditing) { control.value = this.settings[key]; }
      if (key === 'miterLimit') {
        control.dragButton.disabled = this.settings.join !== spec.LineJoin.Miter;
        control.lineEdit.editable = !control.dragButton.disabled;
      }
    }
    super.update(dt);
  }

  override draw (): void {
    this.drawStyleBox(this.background, 0, 0, this.width, this.height);
    this.drawLine(this.width - 40, 11, this.width - 40, 29, editorColors.outline);
  }

  protected override sortChildren (): void {
    let x = 10;

    for (const { control, width } of this.fields) {
      if (!control.visible) { continue; }
      const size = Math.min(width, this.width - x - 40);

      place(control, x, 8, size, 24); x += size + 12;
    }
    place(this.more, this.width - 36, 8, 28, 24);
  }

  private field (title: string, input: Control, width: number, tooltip: string): void {
    input.setCustomMinimumSize(32, 24);
    input.verticalSizeFlags = SizeFlags.ShrinkCenter;
    const caption = label(this.engine, title);
    const control = append(this, row(this.engine, [caption, expand(input, true, false)], 6));

    caption.verticalAlignment = VerticalAlignment.Center;
    caption.mouseFilter = MouseFilter.Pass;
    setTooltip(caption, tooltip);
    setEditorFont(caption, EDITOR_COMPACT_FONT_SIZE);
    setEditorFont(input, EDITOR_COMPACT_FONT_SIZE);
    this.fields.push({ control, caption, input, width });
  }

  private number (key: 'width' | 'smoothing' | 'spacing' | 'miterLimit', step: number, precision: number,
    min: number, max: number, suffix: string): NumberEdit {
    const control = new NumberEdit(this.engine, this.settings[key]);

    control.step = step; control.precision = precision; control.minimum = min; control.maximum = max; control.suffix = suffix;
    control.changed = value => { this.settings[key] = value; };
    setEditorFont(control.dragButton, EDITOR_COMPACT_FONT_SIZE);
    setEditorFont(control.lineEdit, EDITOR_COMPACT_FONT_SIZE);
    this.numbers.push({ control, key });

    return control;
  }

  private profile (): Control {
    return new EditorComboBox(this.engine, STROKE_WIDTH_PRESETS.map((preset, value) => ({ label: preset.name, value })),
      () => this.settings.profile, value => { this.settings.profile = value; });
  }

  private cap (): Control {
    return new EditorComboBox(this.engine, [spec.LineCap.Butt, spec.LineCap.Round, spec.LineCap.Square].map(value => ({ label: spec.LineCap[value], value })),
      () => this.settings.cap, value => { this.settings.cap = value; });
  }

  private join (): Control {
    return new EditorComboBox(this.engine, [spec.LineJoin.Miter, spec.LineJoin.Round, spec.LineJoin.Bevel].map(value => ({ label: spec.LineJoin[value], value })),
      () => this.settings.join, value => { this.settings.join = value; });
  }

  private popupField (parent: Control, title: string, input: Control, tooltip: string): Control {
    const caption = label(this.engine, title);

    caption.setCustomMinimumSize(104, 24); caption.verticalAlignment = VerticalAlignment.Center;
    caption.mouseFilter = MouseFilter.Pass;
    setTooltip(caption, tooltip);
    setEditorFont(caption, EDITOR_COMPACT_FONT_SIZE); setEditorFont(input, EDITOR_COMPACT_FONT_SIZE);
    input.setCustomMinimumSize(156, 24);

    return append(parent, row(this.engine, [caption, expand(input, true, false)], 8));
  }

  private showSettings (): void {
    const origin = screenPosition(this.more, this.more.width, this.more.height + 8);

    this.popup.setSize(300, this.popup.getCombinedMinimumSize().y);
    this.popup.popup(new math.Vector2(origin.x - 300, origin.y), this.more);
  }

  override onDestroy (): void {
    this.popup.dispose(); super.onDestroy();
  }
}
