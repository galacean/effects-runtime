import { math } from '@galacean/effects';
import type { FontStyle, FontWeight } from '@galacean/effects';
import { StyleBoxFlat, Theme, ThemeRegistry } from '@galacean/effects-plugin-gui';
import type { Control } from '@galacean/effects-plugin-gui';

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type ThemeName = 'dark' | 'light';
export type AccentName = 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose';

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
    appBg: color('#0B1220'),
    sidebarBg: color('#0F1828'),
    panelBg: color('#152033'),
    panelRaisedBg: color('#1C2A42'),
    borderSubtle: color('#2B3A52'),
    borderStrong: color('#47617F'),
    textPrimary: color('#F2F5F8'),
    textSecondary: color('#A8B2C0'),
    textTertiary: color('#738092'),
    textOnAccent: color('#FFFFFF'),
    amber: color('#FFB020'),
    success: color('#34D399'),
    warning: color('#FBBF24'),
    danger: color('#FB5A67'),
    cyan: color('#22D3EE'),
    violet: color('#A78BFA'),
    rose: color('#FB7185'),
    controlTrack: color('#293A54'),
  },
};

export const ACCENTS: Record<AccentName, Record<ThemeName, math.Color>> = {
  blue: { light: color('#146EF5'), dark: color('#5B9CFF') },
  indigo: { light: color('#5B4AF5'), dark: color('#8C82FF') },
  emerald: { light: color('#05A66A'), dark: color('#34D399') },
  amber: { light: color('#E98900'), dark: color('#FFBF3F') },
  rose: { light: color('#E92D63'), dark: color('#FF7096') },
};

let currentTheme: ThemeTokens = makeTheme('light', 'blue');
const runtimeTheme = new Theme();

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
    runtimeTheme.setFont('Control', 'font', { family: FONT_FAMILY, weight: 'normal', style: 'normal' });
    runtimeTheme.setFontSize('Control', 'fontSize', 13);
    runtimeTheme.setColor('Label', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontHoverColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontPressedColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontHoverPressedColor', theme.textPrimary);
    runtimeTheme.setColor('Button', 'fontDisabledColor', copy(theme.textTertiary, 0.72));
    // Button icon colors are multiplicative tints. White preserves authored
    // texture colors; using the light theme's dark text color turns them black.
    runtimeTheme.setColor('Button', 'iconTint', theme.textOnAccent);
    runtimeTheme.setColor('Button', 'iconHoverTint', theme.textOnAccent);
    runtimeTheme.setColor('Button', 'iconPressedTint', theme.textOnAccent);
    runtimeTheme.setColor('Button', 'iconHoverPressedTint', theme.textOnAccent);
    runtimeTheme.setColor('Button', 'iconDisabledTint', copy(theme.textOnAccent, 0.45));
    runtimeTheme.setStyleBox('Button', 'normal', makeFlat(theme.panelBg, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'hover', makeFlat(theme.panelRaisedBg, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'pressed', makeFlat(theme.accentSoft, theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'hoverPressed', makeFlat(theme.accentSoft, theme.accent, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'disabled', makeFlat(copy(theme.panelRaisedBg, 0.72), theme.borderSubtle, 1, 8, 4));
    runtimeTheme.setStyleBox('Button', 'focus', makeFlat(new math.Color(0, 0, 0, 0), theme.accentHover, 1));
    runtimeTheme.setStyleBox('Panel', 'panel', makeFlat(theme.panelBg, theme.borderSubtle, 1));
    runtimeTheme.setStyleBox('ProgressBar', 'background', makeFlat(theme.controlTrack));
    runtimeTheme.setStyleBox('ProgressBar', 'fill', makeFlat(theme.accent));
    runtimeTheme.setColor('ProgressBar', 'fontColor', theme.textPrimary);
    runtimeTheme.setStyleBox('Slider', 'track', makeFlat(theme.controlTrack));
    runtimeTheme.setStyleBox('Slider', 'fill', makeFlat(theme.accent));
    runtimeTheme.setStyleBox(
      'Slider',
      'grabber',
      makeFlat(mix(theme.borderStrong, theme.textPrimary, 0.18), theme.borderSubtle, 1),
    );
    runtimeTheme.setStyleBox('Slider', 'grabberHighlight', makeFlat(theme.accentHover, theme.borderSubtle, 1));
    runtimeTheme.setStyleBox('Slider', 'grabberDisabled', makeFlat(theme.borderSubtle, theme.borderSubtle, 1));
    runtimeTheme.setStyleBox('Slider', 'focus', makeFlat(new math.Color(0, 0, 0, 0), theme.accentHover, 1));
    runtimeTheme.setColor('CheckBox', 'markColor', theme.accent);
    runtimeTheme.setColor('CheckBox', 'markDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('CheckBox', 'markOutlineColor', theme.borderStrong);
    runtimeTheme.setColor('CheckButton', 'switchColor', theme.accent);
    runtimeTheme.setColor('CheckButton', 'switchDisabledColor', theme.textTertiary);
    runtimeTheme.setColor('CheckButton', 'switchOffColor', theme.borderStrong);
    runtimeTheme.setColor('CheckButton', 'switchKnobColor', theme.textOnAccent);
    runtimeTheme.setStyleBox('ScrollBar', 'scroll', makeFlat(theme.controlTrack));
    runtimeTheme.setStyleBox('ScrollBar', 'scrollFocus', makeFlat(theme.controlTrack, theme.accentHover, 1));
    runtimeTheme.setStyleBox('ScrollBar', 'decrement', makeFlat(theme.panelRaisedBg));
    runtimeTheme.setStyleBox('ScrollBar', 'decrementHighlight', makeFlat(theme.accentSoft));
    runtimeTheme.setStyleBox('ScrollBar', 'decrementPressed', makeFlat(theme.accent));
    runtimeTheme.setStyleBox('ScrollBar', 'increment', makeFlat(theme.panelRaisedBg));
    runtimeTheme.setStyleBox('ScrollBar', 'incrementHighlight', makeFlat(theme.accentSoft));
    runtimeTheme.setStyleBox('ScrollBar', 'incrementPressed', makeFlat(theme.accent));
    runtimeTheme.setStyleBox('ScrollBar', 'grabber', makeFlat(theme.borderStrong));
    runtimeTheme.setStyleBox('ScrollBar', 'grabberHighlight', makeFlat(theme.accent));
    runtimeTheme.setStyleBox('ScrollBar', 'grabberPressed', makeFlat(theme.accentHover));
    runtimeTheme.setColor('ScrollBar', 'arrowColor', theme.textSecondary);
  });
  document.body.style.background = toCss(theme.appBg);
}

export function makeFlat (
  background: math.Color,
  border = new math.Color(),
  borderWidth = 0,
  horizontalMargin = 0,
  verticalMargin = 0,
): StyleBoxFlat {
  const style = new StyleBoxFlat();

  style.setBackgroundColor(background);
  style.setBorderColor(border);
  style.setBorderWidths(borderWidth, borderWidth, borderWidth, borderWidth);
  style.setContentMargins(horizontalMargin, verticalMargin, horizontalMargin, verticalMargin);

  return style;
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
