import {
  math,
} from '@galacean/effects';
import {
  StyleBoxEmpty,
  StyleBoxFlat,
  ThemeItemType,
  ThemeRegistry,
} from '../core/theme';
import type { StyleBox, ThemeItemDefinitions } from '../core/theme';

const palette = {
  text: new math.Color(0.92, 0.94, 0.98, 1),
  disabledText: new math.Color(0.55, 0.58, 0.64, 1),
  panel: new math.Color(0.10, 0.12, 0.16, 0.96),
  border: new math.Color(0.28, 0.32, 0.40, 1),
  normal: new math.Color(0.22, 0.25, 0.31, 1),
  hover: new math.Color(0.30, 0.34, 0.42, 1),
  pressed: new math.Color(0.16, 0.19, 0.25, 1),
  disabled: new math.Color(0.16, 0.18, 0.22, 0.75),
  accent: new math.Color(0.25, 0.58, 0.92, 1),
  accentHover: new math.Color(0.34, 0.67, 1, 1),
  track: new math.Color(0.12, 0.14, 0.18, 0.82),
  clear: new math.Color(0, 0, 0, 0),
  white: new math.Color(1, 1, 1, 1),
};

function flat (
  background: math.Color,
  border = palette.clear,
  borderWidth = 0,
  contentHorizontal = 0,
  contentVertical = 0,
): StyleBoxFlat {
  const style = new StyleBoxFlat();

  style.setBackgroundColor(background);
  style.setBorderColor(border);
  style.setBorderWidths(borderWidth, borderWidth, borderWidth, borderWidth);
  style.setContentMargins(contentHorizontal, contentVertical, contentHorizontal, contentVertical);

  return style;
}

function empty (contentHorizontal = 0, contentVertical = 0): StyleBoxEmpty {
  const style = new StyleBoxEmpty();

  style.setContentMargins(contentHorizontal, contentVertical, contentHorizontal, contentVertical);

  return style;
}

function style (value: StyleBox): { type: ThemeItemType.StyleBox, defaultValue: StyleBox, affectsLayout: true } {
  return { type: ThemeItemType.StyleBox, defaultValue: value, affectsLayout: true };
}

function color (value: math.Color) {
  return { type: ThemeItemType.Color, defaultValue: value } as const;
}

function constant (value: number, affectsLayout = true) {
  return { type: ThemeItemType.Constant, defaultValue: value, affectsLayout } as const;
}

const fontItems: ThemeItemDefinitions = {
  font: {
    type: ThemeItemType.Font,
    defaultValue: { family: 'sans-serif', weight: 'normal', style: 'normal' },
    affectsLayout: true,
  },
  fontSize: { type: ThemeItemType.FontSize, defaultValue: 14, affectsLayout: true },
};

ThemeRegistry.registerType('Control', null, fontItems);
ThemeRegistry.registerType('Container', 'Control');
ThemeRegistry.registerType('Label', 'Control', {
  fontColor: color(palette.text),
  lineSpacing: constant(0),
});
ThemeRegistry.registerType('BaseButton', 'Control');
ThemeRegistry.registerType('Button', 'BaseButton', {
  normal: style(flat(palette.normal, palette.border, 1, 8, 4)),
  hover: style(flat(palette.hover, palette.border, 1, 8, 4)),
  pressed: style(flat(palette.pressed, palette.border, 1, 8, 4)),
  hoverPressed: style(flat(palette.pressed, palette.accent, 1, 8, 4)),
  disabled: style(flat(palette.disabled, palette.border, 1, 8, 4)),
  focus: style(flat(palette.clear, palette.accentHover, 1)),
  fontColor: color(palette.text),
  fontFocusColor: color(palette.text),
  fontHoverColor: color(palette.text),
  fontPressedColor: color(palette.text),
  fontHoverPressedColor: color(palette.text),
  fontDisabledColor: color(palette.disabledText),
  iconTint: color(palette.white),
  iconFocusTint: color(palette.white),
  iconHoverTint: color(palette.white),
  iconPressedTint: color(palette.white),
  iconHoverPressedTint: color(palette.white),
  iconDisabledTint: color(palette.disabledText),
  icon: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  iconSeparation: constant(4),
  alignToLargestStyleBox: constant(0),
});
ThemeRegistry.registerType('Checkbox', 'Button', {
  normal: style(empty(4, 4)),
  hover: style(empty(4, 4)),
  pressed: style(empty(4, 4)),
  hoverPressed: style(empty(4, 4)),
  disabled: style(empty(4, 4)),
  checked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  unchecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  checkedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  uncheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  radioChecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  radioUnchecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  radioCheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  radioUncheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  checkedColor: color(palette.white),
  uncheckedColor: color(palette.white),
  checkedDisabledColor: color(palette.disabledText),
  markColor: color(palette.accent),
  markDisabledColor: color(palette.disabledText),
  markUncheckedColor: color(new math.Color(0.88, 0.88, 0.88, 0.2)),
  markUncheckedDisabledColor: color(new math.Color(0.5, 0.5, 0.5, 0.2)),
  markOutlineColor: color(palette.border),
  markSize: constant(16),
  markSeparation: constant(8),
  checkVOffset: constant(0),
});
ThemeRegistry.registerType('CheckButton', 'Button', {
  normal: style(empty(6, 4)),
  hover: style(empty(6, 4)),
  pressed: style(empty(6, 4)),
  hoverPressed: style(empty(6, 4)),
  disabled: style(empty(6, 4)),
  checked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  unchecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  checkedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  uncheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  buttonCheckedColor: color(palette.white),
  buttonUncheckedColor: color(palette.white),
  switchColor: color(palette.accent),
  switchDisabledColor: color(palette.disabledText),
  switchOffColor: color(palette.border),
  switchKnobColor: color(palette.text),
  switchWidth: constant(28),
  switchHeight: constant(14),
  switchSeparation: constant(6),
  checkVOffset: constant(0),
});
ThemeRegistry.registerType('Panel', 'Control', {
  panel: style(flat(palette.panel, palette.border, 1)),
});
ThemeRegistry.registerType('PanelContainer', 'Container', {
  panel: style(flat(palette.panel, palette.border, 1, 4, 4)),
});
ThemeRegistry.registerType('Separator', 'Control', {
  separator: style(flat(palette.border)),
  separation: constant(1),
});
ThemeRegistry.registerType('HSeparator', 'Separator');
ThemeRegistry.registerType('VSeparator', 'Separator');
ThemeRegistry.registerType('TextInput', 'Control', {
  normal: style(flat(palette.track, palette.border, 1, 6, 4)),
  readOnly: style(flat(palette.disabled, palette.border, 1, 6, 4)),
  focus: style(flat(palette.clear, palette.accentHover, 1)),
  fontColor: color(palette.text),
  fontReadOnlyColor: color(palette.disabledText),
  fontPlaceholderColor: color(palette.disabledText),
  selectionColor: color(new math.Color(palette.accent.r, palette.accent.g, palette.accent.b, 0.45)),
  caretColor: color(palette.text),
  caretWidth: constant(1, false),
});
ThemeRegistry.registerType('LineEdit', 'TextInput');
ThemeRegistry.registerType('TextEdit', 'TextInput');
ThemeRegistry.registerType('Popup', 'PanelContainer', {
  panel: style(flat(palette.panel, palette.border, 1, 6, 6)),
});
ThemeRegistry.registerType('PopupPanel', 'Popup');
ThemeRegistry.registerType('PopupMenu', 'Popup', {
  hover: style(flat(palette.hover)),
  separator: style(flat(palette.border)),
  fontColor: color(palette.text),
  fontDisabledColor: color(palette.disabledText),
  checkColor: color(palette.accent),
  itemHeight: constant(28),
  separatorHeight: constant(9),
  horizontalPadding: constant(8),
  iconWidth: constant(20),
});
ThemeRegistry.registerType('MenuButton', 'Button');
ThemeRegistry.registerType('OptionButton', 'MenuButton', {
  arrow: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  arrowSize: constant(12),
  arrowMargin: constant(4),
  hSeparation: constant(4),
  modulateArrow: constant(1),
});
ThemeRegistry.registerType('ColorPickerButton', 'Button', {
  swatchBorderColor: color(palette.border),
});
ThemeRegistry.registerType('Range', 'Control');
ThemeRegistry.registerType('ProgressBar', 'Range', {
  background: style(flat(palette.track)),
  fill: style(flat(palette.accent)),
  fontColor: color(palette.text),
});
ThemeRegistry.registerType('Slider', 'Range', {
  track: style(flat(palette.track)),
  fill: style(flat(palette.accent)),
  fillHighlight: style(flat(palette.accentHover)),
  grabber: style(flat(palette.normal, palette.border, 1)),
  grabberHighlight: style(flat(palette.accentHover, palette.border, 1)),
  grabberDisabled: style(flat(palette.disabled, palette.border, 1)),
  trackThickness: constant(4),
  grabberSize: constant(14),
});
ThemeRegistry.registerType('HSlider', 'Slider');
ThemeRegistry.registerType('VSlider', 'Slider');
ThemeRegistry.registerType('ScrollBar', 'Range', {
  scroll: style(flat(palette.track)),
  scrollFocus: style(flat(palette.track, palette.accentHover, 1)),
  grabber: style(flat(palette.disabledText, palette.clear, 0, 4, 4)),
  grabberHighlight: style(flat(palette.accent, palette.clear, 0, 4, 4)),
  grabberPressed: style(flat(palette.accentHover, palette.clear, 0, 4, 4)),
  decrement: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  decrementHighlight: { type: ThemeItemType.Icon, defaultValue: null },
  decrementPressed: { type: ThemeItemType.Icon, defaultValue: null },
  increment: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  incrementHighlight: { type: ThemeItemType.Icon, defaultValue: null },
  incrementPressed: { type: ThemeItemType.Icon, defaultValue: null },
  paddingLeft: constant(0),
  paddingTop: constant(0),
  paddingRight: constant(0),
  paddingBottom: constant(0),
});
ThemeRegistry.registerType('HScrollBar', 'ScrollBar', {
  scroll: style(flat(palette.track, palette.clear, 0, 0, 4)),
});
ThemeRegistry.registerType('VScrollBar', 'ScrollBar', {
  scroll: style(flat(palette.track, palette.clear, 0, 4, 0)),
});
ThemeRegistry.registerType('BoxContainer', 'Container', { separation: constant(0) });
ThemeRegistry.registerType('HBoxContainer', 'BoxContainer');
ThemeRegistry.registerType('VBoxContainer', 'BoxContainer');
ThemeRegistry.registerType('ColorPicker', 'VBoxContainer');
ThemeRegistry.registerType('GridContainer', 'Container', {
  horizontalSeparation: constant(0),
  verticalSeparation: constant(0),
});
ThemeRegistry.registerType('MarginContainer', 'Container', {
  marginLeft: constant(0),
  marginTop: constant(0),
  marginRight: constant(0),
  marginBottom: constant(0),
});
ThemeRegistry.registerType('CenterContainer', 'Container');
ThemeRegistry.registerType('AspectRatioContainer', 'Container');
ThemeRegistry.registerType('ScrollContainer', 'Container');
ThemeRegistry.registerType('ColorRect', 'Control');
ThemeRegistry.registerType('TextureRect', 'Control');
ThemeRegistry.registerType('NinePatchRect', 'Control');

// Keep an explicit empty style available to themes that want to remove a layer.
ThemeRegistry.registerType('Control', null, {
  empty: style(StyleBoxEmpty.shared),
});
