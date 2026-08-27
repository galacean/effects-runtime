import { math } from '@galacean/effects';
import type { FontStyle, FontWeight } from '@galacean/effects';

/** Global defaults copied by GUI controls when they are constructed. */
export class GUIStyle {
  static current = new GUIStyle();

  fontFamily = 'sans-serif';
  fontSize = 14;
  fontWeight: FontWeight = 'normal';
  fontStyle: FontStyle = 'normal';

  textColor = new math.Color(0.92, 0.94, 0.98, 1);
  disabledTextColor = new math.Color(0.55, 0.58, 0.64, 1);
  panelColor = new math.Color(0.10, 0.12, 0.16, 0.96);
  borderColor = new math.Color(0.28, 0.32, 0.40, 1);
  normalColor = new math.Color(0.22, 0.25, 0.31, 1);
  hoverColor = new math.Color(0.30, 0.34, 0.42, 1);
  pressedColor = new math.Color(0.16, 0.19, 0.25, 1);
  disabledColor = new math.Color(0.16, 0.18, 0.22, 0.75);
  accentColor = new math.Color(0.25, 0.58, 0.92, 1);
  accentHoverColor = new math.Color(0.34, 0.67, 1, 1);
  trackColor = new math.Color(0.12, 0.14, 0.18, 0.82);
  fillColor = new math.Color(0.25, 0.58, 0.92, 1);
}

export function cloneColor (color: math.Color): math.Color {
  return new math.Color(color.r, color.g, color.b, color.a);
}
