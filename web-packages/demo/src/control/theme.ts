import { math } from '@galacean/effects';
import { GUIStyle } from '@galacean/effects-plugin-gui';

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

export function applyTheme (
  name: ThemeName,
  accentName: AccentName,
  customAccent?: [number, number, number] | null,
): void {
  const theme = makeTheme(name, accentName, customAccent);
  const style = GUIStyle.current;

  currentTheme = theme;
  style.fontFamily = FONT_FAMILY;
  style.fontSize = 13;
  style.textColor = copy(theme.textPrimary);
  style.disabledTextColor = copy(theme.textTertiary, 0.72);
  style.panelColor = copy(theme.panelBg);
  style.borderColor = copy(theme.borderSubtle);
  style.normalColor = copy(theme.panelBg);
  style.hoverColor = copy(theme.panelRaisedBg);
  style.pressedColor = copy(theme.accentSoft);
  style.disabledColor = copy(theme.panelRaisedBg, 0.72);
  style.accentColor = copy(theme.accent);
  style.accentHoverColor = copy(theme.accentHover);
  style.trackColor = copy(theme.controlTrack);
  style.fillColor = copy(theme.accent);
  document.body.style.background = toCss(theme.appBg);
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
