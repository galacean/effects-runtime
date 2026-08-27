import {
  StyleBoxEmpty,
  StyleBoxFlat,
  ThemeItemType,
  ThemeRegistry,
  math,
} from '@galacean/effects';
import type { StyleBox, ThemeItemDefinitions } from '@galacean/effects';

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
  fontHoverColor: color(palette.text),
  fontPressedColor: color(palette.text),
  fontHoverPressedColor: color(palette.text),
  fontDisabledColor: color(palette.disabledText),
  iconTint: color(palette.white),
  iconHoverTint: color(palette.white),
  iconPressedTint: color(palette.white),
  iconHoverPressedTint: color(palette.white),
  iconDisabledTint: color(palette.disabledText),
  icon: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  iconSeparation: constant(4),
});
ThemeRegistry.registerType('CheckBox', 'Button', {
  checked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  unchecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  checkedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  uncheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  markColor: color(palette.accent),
  markDisabledColor: color(palette.disabledText),
  markOutlineColor: color(palette.border),
  markSize: constant(14),
  markSeparation: constant(6),
});
ThemeRegistry.registerType('CheckButton', 'Button', {
  checked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  unchecked: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  checkedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  uncheckedDisabled: { type: ThemeItemType.Icon, defaultValue: null, affectsLayout: true },
  switchColor: color(palette.accent),
  switchDisabledColor: color(palette.disabledText),
  switchOffColor: color(palette.border),
  switchKnobColor: color(palette.text),
  switchWidth: constant(28),
  switchHeight: constant(14),
  switchSeparation: constant(6),
});
ThemeRegistry.registerType('Panel', 'Control', {
  panel: style(flat(palette.panel, palette.border, 1)),
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
  grabber: style(flat(palette.normal, palette.border, 1)),
  grabberHighlight: style(flat(palette.accentHover, palette.border, 1)),
  grabberDisabled: style(flat(palette.disabled, palette.border, 1)),
  focus: style(flat(palette.clear, palette.accentHover, 1)),
  trackThickness: constant(4),
  grabberSize: constant(14),
});
ThemeRegistry.registerType('HSlider', 'Slider');
ThemeRegistry.registerType('VSlider', 'Slider');
ThemeRegistry.registerType('ScrollBar', 'Range', {
  scroll: style(flat(palette.track)),
  scrollFocus: style(flat(palette.track, palette.accentHover, 1)),
  decrement: style(flat(palette.track)),
  decrementHighlight: style(flat(palette.hover)),
  decrementPressed: style(flat(palette.pressed)),
  increment: style(flat(palette.track)),
  incrementHighlight: style(flat(palette.hover)),
  incrementPressed: style(flat(palette.pressed)),
  grabber: style(flat(palette.disabledText)),
  grabberHighlight: style(flat(palette.accent)),
  grabberPressed: style(flat(palette.accentHover)),
  decrementIcon: { type: ThemeItemType.Icon, defaultValue: null },
  decrementIconHighlight: { type: ThemeItemType.Icon, defaultValue: null },
  decrementIconPressed: { type: ThemeItemType.Icon, defaultValue: null },
  incrementIcon: { type: ThemeItemType.Icon, defaultValue: null },
  incrementIconHighlight: { type: ThemeItemType.Icon, defaultValue: null },
  incrementIconPressed: { type: ThemeItemType.Icon, defaultValue: null },
  arrowColor: color(palette.text),
  buttonSize: constant(12),
  grabberMinimumSize: constant(12),
  thickness: constant(12),
});
ThemeRegistry.registerType('HScrollBar', 'ScrollBar');
ThemeRegistry.registerType('VScrollBar', 'ScrollBar');
ThemeRegistry.registerType('BoxContainer', 'Container', { separation: constant(0) });
ThemeRegistry.registerType('HBoxContainer', 'BoxContainer');
ThemeRegistry.registerType('VBoxContainer', 'BoxContainer');
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
