import { math, spec } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { MouseFilter, VerticalAlignment } from '@galacean/effects-plugin-gui';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { EditorColorButton } from '../../../ui/controls/color-picker';
import { EditorComboBox } from '../../../ui/controls/combo-box';
import { EditorFloatingToolbar, FLOATING_TOOL_CONTROL_HEIGHT } from '../../../ui/controls/floating-toolbar';
import { NumberEdit } from '../../../ui/controls/number-edit';
import { append, column, expand, label, row, screenPosition } from '../../../ui/controls/layout';
import { EditorPopupPanel } from '../../../ui/controls/popup-panel';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { editorColors, EDITOR_SMALL_FONT_SIZE, setEditorFont } from '../../../ui/theme/control-theme';
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
export class SceneBrushSettingsBar extends EditorFloatingToolbar {
  private readonly fields: { control: Control, caption: Label, preferredWidth: number }[] = [];
  private readonly numbers: { control: NumberEdit, key: 'width' | 'smoothing' | 'spacing' | 'miterLimit' }[] = [];
  private readonly colors: EditorColorButton[] = [];
  private readonly more: EditorIconButton;
  private readonly popup: EditorPopupPanel;
  private readonly popupColor: Control;
  private readonly popupProfile: Control;

  constructor (engine: Engine, private readonly settings: SceneBrushSettings) {
    super(engine);
    this.field('Width', this.number('width', .005, 3, .001, 100, ''), 100, 'Stroke width in scene units, matching the Shape inspector.');
    const colorTooltip = 'Stroke color and opacity.';
    const profileTooltip = 'Stroke width variation along the path.';

    this.field('Color', this.color(), 70, colorTooltip);
    this.field('Profile', this.profile(), 156, profileTooltip);
    this.more = append(this, new EditorIconButton(engine, 'more'));
    this.more.on('pressed', () => this.showSettings());
    setTooltip(this.more, 'Advanced brush settings');
    this.groups = [...this.fields.map(field => [field.control]), [this.more]];
    this.popup = new EditorPopupPanel(engine);
    this.setSettingsPopup(this.more, this.popup);
    const body = append(this.popup, column(engine, [], 4));

    body.theme = this.theme;
    append(body, label(engine, 'Advanced brush settings', editorColors.foregroundHeader));
    const scope = append(body, label(engine, 'Applies to new strokes.', editorColors.muted));

    setEditorFont(scope, EDITOR_SMALL_FONT_SIZE);
    this.popupColor = this.popupField(body, 'Color', this.color(this.popup.modal), colorTooltip);
    this.popupColor.visible = false;
    this.popupField(body, 'Smoothing', this.number('smoothing', 1, 0, 0, 100, '%'),
      'Smooth short movements over a larger screen distance as the value increases.\nZero preserves the sampled polyline.');
    this.popupProfile = this.popupField(body, 'Width profile', this.profile(), profileTooltip);
    this.popupProfile.visible = false;
    this.popupField(body, 'Cap', this.cap(), 'Shape of the two ends of an open stroke.');
    this.popupField(body, 'Join', this.join(), 'Join style at sharp corners.\nSmooth curves may have no visible corner.');
    this.popupField(body, 'Miter limit', this.number('miterLimit', .5, 1, 1, 100, ''), 'Maximum miter length relative to the stroke width.');
    this.popupField(body, 'Sample spacing', this.number('spacing', .5, 1, .5, 16, ' px'),
      'Distance along the pointer trace between samples, in screen pixels.\nSmaller values preserve finer movements.');
  }

  protected override selectControls (available: number): Set<Control> {
    const [width, color, profile] = this.fields;
    const visible = new Set(this.groups.flat());

    width.caption.visible = available >= 180;
    width.control.setCustomMinimumSize(width.preferredWidth, 0);
    const excess = this.collapseToFit(visible, available, [profile.control, color.control]);

    if (excess > 0) { width.control.setCustomMinimumSize(width.preferredWidth - excess, 0); }
    this.popupColor.visible = !visible.has(color.control);
    this.popupProfile.visible = !visible.has(profile.control);

    return visible;
  }

  override update (dt: number): void {
    this.colors.forEach(button => { button.color = this.settings.color; });
    for (const { control, key } of this.numbers) {
      if (!control.isEditing) { control.value = this.settings[key]; }
      if (key === 'miterLimit') {
        control.dragButton.disabled = this.settings.join !== spec.LineJoin.Miter;
        control.lineEdit.editable = !control.dragButton.disabled;
      }
    }
    super.update(dt);
  }

  private field (title: string, input: Control, preferredWidth: number, tooltip: string): void {
    input.setCustomMinimumSize(32, FLOATING_TOOL_CONTROL_HEIGHT);
    const caption = label(this.engine, title);
    const control = append(this, row(this.engine, [caption, expand(input, true, false)], 6));

    control.setCustomMinimumSize(preferredWidth, 0);
    caption.verticalAlignment = VerticalAlignment.Center;
    caption.mouseFilter = MouseFilter.Pass;
    setTooltip(caption, tooltip);
    this.fields.push({ control, caption, preferredWidth });
  }

  private color (modal = false): EditorColorButton {
    const button = new EditorColorButton(this.engine, modal);

    button.color = this.settings.color;
    button.changed = color => this.settings.color.copyFrom(color);
    this.colors.push(button);

    return button;
  }

  private number (key: 'width' | 'smoothing' | 'spacing' | 'miterLimit', step: number, precision: number,
    min: number, max: number, suffix: string): NumberEdit {
    const control = new NumberEdit(this.engine, this.settings[key]);

    control.step = step; control.precision = precision; control.minimum = min; control.maximum = max; control.suffix = suffix;
    control.changed = value => { this.settings[key] = value; };
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

    caption.setCustomMinimumSize(104, FLOATING_TOOL_CONTROL_HEIGHT); caption.verticalAlignment = VerticalAlignment.Center;
    caption.mouseFilter = MouseFilter.Pass;
    setTooltip(caption, tooltip);
    input.setCustomMinimumSize(156, FLOATING_TOOL_CONTROL_HEIGHT);

    return append(parent, row(this.engine, [caption, expand(input, true, false)], 8));
  }

  private showSettings (): void {
    const size = this.popup.getCombinedMinimumSize();
    const origin = screenPosition(this, this.width, this.height + 4);

    this.popup.setSize(size.x, size.y);
    this.popup.popup(new math.Vector2(origin.x - size.x, origin.y), this.more);
  }

  override onDestroy (): void {
    this.popup.dispose(); super.onDestroy();
  }
}
