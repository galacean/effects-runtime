import { math } from '@galacean/effects';
import type { FontStyle, FontWeight } from '@galacean/effects';
import {
  StyleBoxEmpty,
  StyleBoxFlat,
  Theme,
  ThemeItemType,
  ThemeRegistry,
} from '@galacean/effects-plugin-gui';
import type { Control, StyleBox, ThemeItemDefinitions } from '@galacean/effects-plugin-gui';

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type ThemeName = 'dark' | 'light';
export type AccentName = 'gray' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'orange' | 'rose';

export type ThemeTokens = {
  appBg: math.Color,
  sidebarBg: math.Color,
  panelBg: math.Color,
  panelRaisedBg: math.Color,
  borderSubtle: math.Color,
  borderStrong: math.Color,
  textPrimary: math.Color,
  textSecondary: math.Color,
  textTertiary: math.Color,
  textOnAccent: math.Color,
  accent: math.Color,
  accentHover: math.Color,
  accentSoft: math.Color,
  amber: math.Color,
  success: math.Color,
  warning: math.Color,
  danger: math.Color,
  cyan: math.Color,
  violet: math.Color,
  rose: math.Color,
  controlTrack: math.Color,
};

type ThemeBase = Omit<ThemeTokens, 'accent' | 'accentHover' | 'accentSoft'>;

function color (hex: string, alpha = 1): math.Color {
  const value = Number.parseInt(hex.replace('#', ''), 16);

  return new math.Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
    alpha,
  );
}

function copy (source: math.Color, alpha = source.a): math.Color {
  return new math.Color(source.r, source.g, source.b, alpha);
}

function makeEmpty (contentHorizontal: number, contentVertical: number): StyleBoxEmpty {
  const style = new StyleBoxEmpty();

  style.setContentMargins(contentHorizontal, contentVertical, contentHorizontal, contentVertical);

  return style;
}

function style (value: StyleBox) {
  return { type: ThemeItemType.StyleBox, defaultValue: value, affectsLayout: true } as const;
}

function themeColor (value: math.Color) {
  return { type: ThemeItemType.Color, defaultValue: value } as const;
}

function constant (value: number, affectsLayout = true) {
  return { type: ThemeItemType.Constant, defaultValue: value, affectsLayout } as const;
}

function registerInspectorThemeTypes (): void {
  const clear = new math.Color();
  const defaults: Record<string, { base: string, definitions?: ThemeItemDefinitions }> = {
    EditorInspector: {
      base: 'PanelContainer',
      definitions: {
        panel: style(makeFlat(new math.Color(0.08, 0.08, 0.08, 1), new math.Color(0.18, 0.18, 0.18, 1), 1)),
      },
    },
    EditorInspectorCategory: { base: 'VBoxContainer' },
    EditorInspectorSection: { base: 'VBoxContainer' },
    EditorProperty: {
      base: 'Container',
      definitions: {
        background: style(makeFlat(clear)),
        backgroundSelected: style(makeFlat(new math.Color(0.24, 0.24, 0.24, 1))),
        hover: style(makeFlat(new math.Color(0.17, 0.17, 0.17, 1))),
        rowHeight: constant(30),
        padding: constant(5),
        separation: constant(5),
        revertWidth: constant(24),
        wideThreshold: constant(270),
        splitRatio: constant(0.48, false),
      },
    },
    EditorSpinSlider: { base: 'LineEdit' },
  };

  for (const [type, registration] of Object.entries(defaults)) {
    if (!ThemeRegistry.hasType(type)) {
      ThemeRegistry.registerType(type, registration.base, registration.definitions);
    }
  }
}

const BASE_THEMES: Record<ThemeName, ThemeBase> = {
  light: {
    appBg: color('#F1F5FA'),
    sidebarBg: color('#FFFFFF'),
    panelBg: color('#FFFFFF'),
    panelRaisedBg: color('#F3F7FC'),
    borderSubtle: color('#D9E2EE'),
    borderStrong: color('#B7C5D8'),
    textPrimary: color('#17202A'),
    textSecondary: color('#5E6B7A'),
    textTertiary: color('#8A96A3'),
    textOnAccent: color('#FFFFFF'),
    amber: color('#F08C00'),
    success: color('#0EA66A'),
    warning: color('#F59E0B'),
    danger: color('#EF3E4E'),
    cyan: color('#0891B2'),
    violet: color('#7C3AED'),
    rose: color('#E11D48'),
    controlTrack: color('#DFE7F2'),
  },
  dark: {
    appBg: color('#0D0D0D'),
    sidebarBg: color('#121212'),
    panelBg: color('#171717'),
    panelRaisedBg: color('#202020'),
    borderSubtle: color('#2A2A2A'),
    borderStrong: color('#3A3A3A'),
    textPrimary: color('#E6E6E6'),
    textSecondary: color('#A8A8A8'),
    textTertiary: color('#747474'),
    textOnAccent: color('#0D0D0D'),
    amber: color('#FFB020'),
    success: color('#34D399'),
    warning: color('#FBBF24'),
    danger: color('#FB5A67'),
    cyan: color('#22D3EE'),
    violet: color('#A78BFA'),
    rose: color('#FB7185'),
    controlTrack: color('#242424'),
  },
};

export const ACCENTS: Record<AccentName, Record<ThemeName, math.Color>> = {
  blue: { light: color('#146EF5'), dark: color('#4F8EF7') },
  indigo: { light: color('#5B4AF5'), dark: color('#8175F7') },
  emerald: { light: color('#05A66A'), dark: color('#2CC98B') },
  amber: { light: color('#E98900'), dark: color('#F5B83D') },
  orange: { light: color('#EA6A00'), dark: color('#F28A3B') },
  rose: { light: color('#E92D63'), dark: color('#F05F87') },
  gray: { light: color('#697386'), dark: color('#A6AFBD') },
};

let currentTheme: ThemeTokens = makeTheme('light', 'blue');
const runtimeTheme = new Theme();

registerInspectorThemeTypes();

export function makeTheme (
  name: ThemeName,
  accentName: AccentName,
  customAccent?: [number, number, number] | null,
): ThemeTokens {
  const base = BASE_THEMES[name];
  const accent = customAccent
    ? new math.Color(customAccent[0] / 255, customAccent[1] / 255, customAccent[2] / 255, 1)
    : ACCENTS[accentName][name];
  const accentHover = name === 'light'
    ? mix(accent, color('#000000'), 0.10)
    : mix(accent, color('#FFFFFF'), 0.10);
  const accentSoft = name === 'light'
    ? mix(base.panelBg, accent, 0.18)
    : mix(base.panelBg, accent, 0.30);

  return { ...base, accent, accentHover, accentSoft };
}

export function getTheme (): ThemeTokens {
  return currentTheme;
}

export function getRuntimeTheme (): Theme {
  return runtimeTheme;
}

export function applyTheme (
  name: ThemeName,
  accentName: AccentName,
  customAccent?: [number, number, number] | null,
): void {
  const theme = makeTheme(name, accentName, customAccent);

  currentTheme = theme;
  runtimeTheme.batch(() => {
    registerThemeVariations();
    runtimeTheme.setFont('Control', 'font', { family: FONT_FAMILY, weight: 'normal', style: 'normal' });
    runtimeTheme.setFontSize('Control', 'fontSize', 13);
    runtimeTheme.setColor('Label', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontFocusColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontHoverColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontPressedColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontHoverPressedColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontDisabledColor', copy(theme.textTertiary, 0.72));
    const iconTint = color('#FFFFFF');

    runtimeTheme.setColor('Button', 'iconTint', iconTint);
    runtimeTheme.setColor('Button', 'iconFocusTint', iconTint);
    runtimeTheme.setColor('Button', 'iconHoverTint', iconTint);
    runtimeTheme.setColor('Button', 'iconPressedTint', iconTint);
    runtimeTheme.setColor('Button', 'iconHoverPressedTint', iconTint);
    runtimeTheme.setColor('Button', 'iconDisabledTint', copy(iconTint, 0.45));
    runtimeTheme.setStyleBox('Button', 'normal', makeFlat(theme.panelBg, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'hover', makeFlat(theme.panelRaisedBg, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'pressed', makeFlat(theme.accentSoft, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'hoverPressed', makeFlat(theme.accentSoft, theme.accent, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'disabled', makeFlat(copy(theme.panelRaisedBg, 0.72), theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'focus', makeFlat(new math.Color(0, 0, 0, 0), theme.accentHover, 1));
    runtimeTheme.setConstant('Button', 'alignToLargestStyleBox', 1);
    const checkboxStyle = makeEmpty(4, 4);
    const checkButtonStyle = makeEmpty(6, 4);

    for (const name of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
      runtimeTheme.setStyleBox('Checkbox', name, checkboxStyle);
      runtimeTheme.setStyleBox('CheckButton', name, checkButtonStyle);
    }
    runtimeTheme.setStyleBox('Panel', 'panel', makeFlat(theme.panelBg, theme.borderSubtle, 1));
    runtimeTheme.setStyleBox('PanelContainer', 'panel', makeFlat(theme.panelBg, theme.borderSubtle, 1, 6, 6, 4));
    runtimeTheme.setStyleBox('Separator', 'separator', makeFlat(theme.borderSubtle));
    runtimeTheme.setConstant('Separator', 'separation', 1);
    runtimeTheme.setStyleBox('TextInput', 'normal', makeFlat(theme.panelRaisedBg, theme.borderStrong, 1, 7, 5, 4));
    runtimeTheme.setStyleBox('TextInput', 'readOnly', makeFlat(theme.panelBg, theme.borderSubtle, 1, 7, 5, 4));
    runtimeTheme.setStyleBox('TextInput', 'focus', makeFlat(theme.panelRaisedBg, theme.textSecondary, 1, 0, 0, 4));
    runtimeTheme.setColor('TextInput', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('TextInput', 'fontReadOnlyColor', theme.textTertiary);
    runtimeTheme.setColor('TextInput', 'fontPlaceholderColor', theme.textTertiary);
    runtimeTheme.setColor('TextInput', 'selectionColor', copy(theme.textPrimary, name === 'dark' ? 0.24 : 0.18));
    runtimeTheme.setColor('TextInput', 'caretColor', theme.textPrimary);
    runtimeTheme.setStyleBox('Popup', 'panel', makeFlat(theme.panelRaisedBg, theme.borderStrong, 1, 8, 8, 5));
    runtimeTheme.setStyleBox('PopupMenu', 'hover', makeFlat(name === 'dark' ? color('#303030') : theme.accentSoft, undefined, 0, 4, 2, 3));
    runtimeTheme.setStyleBox('PopupMenu', 'separator', makeFlat(theme.borderSubtle));
    runtimeTheme.setColor('PopupMenu', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('PopupMenu', 'fontDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('PopupMenu', 'checkColor', name === 'dark' ? theme.textPrimary : theme.accent);
    runtimeTheme.setColor('ColorPickerButton', 'swatchBorderColor', theme.borderStrong);
    runtimeTheme.setStyleBox('ProgressBar', 'background', makeFlat(theme.controlTrack));
    runtimeTheme.setStyleBox('ProgressBar', 'fill', makeFlat(theme.accent));
    runtimeTheme.setColor('ProgressBar', 'fontColor', theme.textPrimary);
    runtimeTheme.setStyleBox('Slider', 'track', makeFlat(theme.controlTrack));
    runtimeTheme.setStyleBox('Slider', 'fill', makeFlat(theme.accent));
    runtimeTheme.setStyleBox('Slider', 'fillHighlight', makeFlat(theme.accentHover));
    runtimeTheme.setStyleBox(
      'Slider',
      'grabber',
      makeFlat(mix(theme.borderStrong, theme.textPrimary, 0.18), theme.borderSubtle, 1),
    );
    runtimeTheme.setStyleBox('Slider', 'grabberHighlight', makeFlat(theme.accentHover, theme.borderSubtle, 1));
    runtimeTheme.setStyleBox('Slider', 'grabberDisabled', makeFlat(theme.borderSubtle, theme.borderSubtle, 1));
    runtimeTheme.setColor('Checkbox', 'markColor', theme.accent);
    runtimeTheme.setColor('Checkbox', 'markDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('Checkbox', 'checkedDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('Checkbox', 'markUncheckedColor', copy(theme.textPrimary, 0.2));
    runtimeTheme.setColor('Checkbox', 'markUncheckedDisabledColor', copy(theme.textTertiary, 0.2));
    runtimeTheme.setColor('Checkbox', 'markOutlineColor', theme.borderStrong);
    runtimeTheme.setColor('CheckButton', 'switchColor', theme.accent);
    runtimeTheme.setColor('CheckButton', 'switchDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('CheckButton', 'switchOffColor', theme.borderStrong);
    runtimeTheme.setColor('CheckButton', 'switchKnobColor', theme.textOnAccent);
    runtimeTheme.setStyleBox('HScrollBar', 'scroll', makeFlat(theme.controlTrack, undefined, 0, 0, 4));
    runtimeTheme.setStyleBox('VScrollBar', 'scroll', makeFlat(theme.controlTrack, undefined, 0, 4, 0));
    runtimeTheme.setStyleBox('ScrollBar', 'scrollFocus', makeFlat(theme.controlTrack, theme.accentHover, 1));
    runtimeTheme.setStyleBox('ScrollBar', 'grabber', makeFlat(theme.borderStrong, undefined, 0, 4, 4));
    runtimeTheme.setStyleBox('ScrollBar', 'grabberHighlight', makeFlat(theme.accent, undefined, 0, 4, 4));
    runtimeTheme.setStyleBox('ScrollBar', 'grabberPressed', makeFlat(theme.accentHover, undefined, 0, 4, 4));
    applyInspectorTheme(theme, name);
  });
  document.body.style.background = toCss(theme.appBg);
}

export function makeFlat (
  background: math.Color,
  border = new math.Color(),
  borderWidth = 0,
  horizontalMargin = 0,
  verticalMargin = 0,
  cornerRadius = 0,
): StyleBoxFlat {
  const style = new StyleBoxFlat();

  style.setBackgroundColor(background);
  style.setBorderColor(border);
  style.setBorderWidths(borderWidth, borderWidth, borderWidth, borderWidth);
  style.setContentMargins(horizontalMargin, verticalMargin, horizontalMargin, verticalMargin);
  style.setCornerRadii(cornerRadius, cornerRadius, cornerRadius, cornerRadius);

  return style;
}

function registerThemeVariations (): void {
  const variations: Record<string, string> = {
    EditorInspectorContainer: 'VBoxContainer',
    EditorInspectorCategoryPanel: 'PanelContainer',
    EditorPropertyContainer: 'VBoxContainer',
    EditorInspectorTitle: 'Label',
    EditorInspectorHint: 'Label',
    EditorInspectorCategoryLabel: 'Label',
    EditorPropertyLabel: 'Label',
    EditorAxisX: 'Label',
    EditorAxisY: 'Label',
    EditorAxisW: 'Label',
    EditorAxisH: 'Label',
    EditorInspectorButton: 'Button',
    EditorInspectorFlatButton: 'Button',
    EditorInspectorCheck: 'Checkbox',
    EditorInspectorOptionButton: 'OptionButton',
    EditorVectorPanel: 'PanelContainer',
    EditorVectorSpinSlider: 'EditorSpinSlider',
  };

  for (const [variation, base] of Object.entries(variations)) {
    runtimeTheme.setTypeVariation(variation, base);
  }
}

function applyInspectorTheme (theme: ThemeTokens, name: ThemeName): void {
  const clear = new math.Color();
  const categoryBackground = name === 'dark' ? color('#202020') : color('#E8EEF6');
  const rowHover = name === 'dark' ? color('#242424') : color('#EDF3FA');
  const rowSelected = name === 'dark' ? color('#303030') : mix(theme.panelBg, theme.accent, 0.14);
  const buttonHover = name === 'dark' ? color('#2B2B2B') : theme.panelRaisedBg;
  const fieldBackground = name === 'dark' ? color('#1B1B1B') : theme.panelRaisedBg;

  runtimeTheme.setStyleBox('EditorInspector', 'panel', makeFlat(theme.panelBg, theme.borderSubtle, 1));
  runtimeTheme.setConstant('EditorInspectorContainer', 'separation', 0);
  runtimeTheme.setStyleBox('EditorInspectorCategoryPanel', 'panel', makeFlat(categoryBackground, theme.borderSubtle, 0, 10, 5));
  runtimeTheme.setConstant('EditorPropertyContainer', 'separation', 0);
  runtimeTheme.setColor('EditorInspectorTitle', 'fontColor', theme.textPrimary);
  runtimeTheme.setFontSize('EditorInspectorTitle', 'fontSize', 15);
  runtimeTheme.setColor('EditorInspectorHint', 'fontColor', theme.textTertiary);
  runtimeTheme.setFontSize('EditorInspectorHint', 'fontSize', 11);
  runtimeTheme.setColor('EditorInspectorCategoryLabel', 'fontColor', theme.textSecondary);
  runtimeTheme.setFontSize('EditorInspectorCategoryLabel', 'fontSize', 11);
  runtimeTheme.setColor('EditorPropertyLabel', 'fontColor', theme.textSecondary);
  runtimeTheme.setColor('EditorAxisX', 'fontColor', theme.danger);
  runtimeTheme.setColor('EditorAxisY', 'fontColor', theme.success);
  runtimeTheme.setColor('EditorAxisW', 'fontColor', theme.warning);
  runtimeTheme.setColor('EditorAxisH', 'fontColor', theme.cyan);
  runtimeTheme.setStyleBox('EditorProperty', 'background', makeFlat(clear, theme.borderSubtle, 0));
  runtimeTheme.setStyleBox('EditorProperty', 'hover', makeFlat(rowHover));
  runtimeTheme.setStyleBox('EditorProperty', 'backgroundSelected', makeFlat(rowSelected));
  runtimeTheme.setConstant('EditorProperty', 'rowHeight', 30);
  runtimeTheme.setConstant('EditorProperty', 'padding', 5);
  runtimeTheme.setConstant('EditorProperty', 'separation', 5);
  runtimeTheme.setConstant('EditorProperty', 'revertWidth', 24);
  runtimeTheme.setConstant('EditorProperty', 'wideThreshold', 270);
  runtimeTheme.setConstant('EditorProperty', 'splitRatio', 0.48);
  for (const state of ['normal', 'pressed', 'disabled']) {
    runtimeTheme.setStyleBox('EditorInspectorFlatButton', state, makeFlat(clear, undefined, 0, 5, 3, 3));
  }
  for (const state of ['hover', 'hoverPressed']) {
    runtimeTheme.setStyleBox('EditorInspectorFlatButton', state, makeFlat(buttonHover, undefined, 0, 5, 3, 3));
  }
  runtimeTheme.setStyleBox('EditorInspectorFlatButton', 'focus', makeFlat(clear, theme.borderStrong, 1, 0, 0, 3));
  runtimeTheme.setColor('EditorInspectorFlatButton', 'fontColor', theme.textSecondary);
  runtimeTheme.setColor('EditorInspectorFlatButton', 'fontHoverColor', theme.textPrimary);
  runtimeTheme.setColor('EditorInspectorFlatButton', 'fontPressedColor', theme.textPrimary);
  runtimeTheme.setColor('EditorInspectorFlatButton', 'fontHoverPressedColor', theme.textPrimary);
  runtimeTheme.setStyleBox('EditorSpinSlider', 'normal', makeFlat(theme.panelRaisedBg, theme.borderSubtle, 1, 6, 4, 3));
  runtimeTheme.setStyleBox('EditorSpinSlider', 'focus', makeFlat(theme.panelRaisedBg, theme.textSecondary, 1, 0, 0, 3));
  for (const state of ['normal', 'pressed', 'disabled']) {
    runtimeTheme.setStyleBox('EditorInspectorCheck', state, makeFlat(fieldBackground, undefined, 0, 6, 3, 4));
    runtimeTheme.setStyleBox('EditorInspectorOptionButton', state, makeFlat(fieldBackground, undefined, 0, 9, 4, 4));
  }
  for (const state of ['hover', 'hoverPressed']) {
    runtimeTheme.setStyleBox('EditorInspectorCheck', state, makeFlat(buttonHover, undefined, 0, 6, 3, 4));
    runtimeTheme.setStyleBox('EditorInspectorOptionButton', state, makeFlat(buttonHover, undefined, 0, 9, 4, 4));
  }
  runtimeTheme.setStyleBox('EditorInspectorCheck', 'focus', makeFlat(clear, theme.borderStrong, 1, 0, 0, 4));
  runtimeTheme.setStyleBox('EditorInspectorOptionButton', 'focus', makeFlat(clear, theme.borderStrong, 1, 0, 0, 4));
  runtimeTheme.setConstant('EditorInspectorOptionButton', 'arrowSize', 12);
  runtimeTheme.setConstant('EditorInspectorOptionButton', 'arrowMargin', 8);
  runtimeTheme.setConstant('EditorInspectorOptionButton', 'hSeparation', 4);
  runtimeTheme.setStyleBox('EditorVectorPanel', 'panel', makeFlat(fieldBackground, undefined, 0, 9, 3, 4));
  runtimeTheme.setStyleBox('EditorVectorSpinSlider', 'normal', makeFlat(clear, undefined, 0, 0, 3));
  runtimeTheme.setStyleBox('EditorVectorSpinSlider', 'readOnly', makeFlat(clear, undefined, 0, 0, 3));
  runtimeTheme.setStyleBox('EditorVectorSpinSlider', 'focus', makeFlat(clear, undefined, 0, 0, 3));
}

export function setFontOverrides (
  control: Control,
  options: {
    family?: string,
    size?: number,
    weight?: FontWeight,
    style?: FontStyle,
    color?: math.Color,
    colorItem?: string,
  },
): void {
  if (options.family !== undefined || options.weight !== undefined || options.style !== undefined) {
    const font = control.getThemeFont('font');

    control.setThemeFontOverride('font', {
      family: options.family ?? font.family,
      weight: options.weight ?? font.weight,
      style: options.style ?? font.style,
    });
  }
  if (options.size !== undefined) {control.setThemeFontSizeOverride('fontSize', options.size);}
  if (options.color !== undefined) {
    control.setThemeColorOverride(options.colorItem ?? 'fontColor', options.color);
  }
}

export function setFlatStyleOverride (
  control: Control,
  name: string,
  options: {
    background?: math.Color,
    border?: math.Color,
    borderWidth?: number,
    horizontalMargin?: number,
    verticalMargin?: number,
  },
): void {
  // Demo controls are commonly styled before they are attached to the Canvas
  // theme tree. Resolve their base from the active demo Theme explicitly so a
  // partial override (for example, margins only) cannot snapshot the dark
  // built-in fallback while Light Mode is active.
  const source = getRuntimeStyleBox(control, name);
  const result = new StyleBoxFlat();
  const content = source.getContentMargins();
  let border = { left: 0, top: 0, right: 0, bottom: 0 };

  if (source instanceof StyleBoxFlat) {
    border = source.getBorderWidths();
    result.setBackgroundColor(options.background ?? source.getBackgroundColor());
    result.setBorderColor(options.border ?? source.getBorderColor());
  } else {
    if (options.background) {result.setBackgroundColor(options.background);}
    if (options.border) {result.setBorderColor(options.border);}
  }
  const borderWidth = options.borderWidth;

  result.setBorderWidths(
    borderWidth ?? border.left,
    borderWidth ?? border.top,
    borderWidth ?? border.right,
    borderWidth ?? border.bottom,
  );
  result.setContentMargins(
    options.horizontalMargin ?? content.left,
    options.verticalMargin ?? content.top,
    options.horizontalMargin ?? content.right,
    options.verticalMargin ?? content.bottom,
  );
  control.setThemeStyleBoxOverride(name, result);
}

function getRuntimeStyleBox (control: Control, name: string) {
  for (const type of ThemeRegistry.getTypeChain(control.getThemeType())) {
    const style = runtimeTheme.getStyleBox(type, name);

    if (style) {return style;}
  }

  return control.getThemeStyleBox(name);
}

export function withAlpha (source: math.Color, alpha: number): math.Color {
  return copy(source, alpha);
}

export function mix (left: math.Color, right: math.Color, ratio: number): math.Color {
  const t = Math.max(0, Math.min(1, ratio));

  return new math.Color(
    left.r + (right.r - left.r) * t,
    left.g + (right.g - left.g) * t,
    left.b + (right.b - left.b) * t,
    left.a + (right.a - left.a) * t,
  );
}

export function toCss (value: math.Color): string {
  return `rgba(${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)}, ${value.a})`;
}
