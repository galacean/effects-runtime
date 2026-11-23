import type { Engine, FontStyle, FontWeight } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';

export const EDITOR_FONT = 'Alibaba PuHuiTi';
export const EDITOR_FONT_SIZE = 40 / 3;
export const EDITOR_COMPACT_FONT_SIZE = 12;
export const EDITOR_SMALL_FONT_SIZE = 32 / 3;
export const EDITOR_TINY_FONT_SIZE = 28 / 3;

type EditorFont = { name: string, size: number, weight: FontWeight, style: FontStyle };
type EditorFonts = {
  resolution: number,
  names: Map<number, Map<FontWeight, Map<FontStyle, string>>>,
  fonts: EditorFont[],
};

const fontsByEngine = new WeakMap<Engine, EditorFonts>();

function install (engine: Engine, font: EditorFont, resolution: number): void {
  engine.renderingServer.graphics.textCache.install({
    name: font.name,
    style: { fontFamily: EDITOR_FONT, fontSize: font.size, fontWeight: font.weight, fontStyle: font.style },
    resolution, padding: 4, chars: '',
  });
}

/** Returns a named font rasterized at the requested display size. */
export function getEditorFont (engine: Engine, size = EDITOR_FONT_SIZE, weight: FontWeight = 'normal', style: FontStyle = 'normal'): string {
  let state = fontsByEngine.get(engine);

  if (!state) {
    state = { resolution: engine.displayServer.pixelRatio, names: new Map(), fonts: [] };
    fontsByEngine.set(engine, state);
  }
  refreshEditorFonts(engine);
  let weights = state.names.get(size);

  if (!weights) { weights = new Map(); state.names.set(size, weights); }
  let styles = weights.get(weight);

  if (!styles) { styles = new Map(); weights.set(weight, styles); }
  let name = styles.get(style);

  if (!name) {
    name = size === EDITOR_FONT_SIZE && weight === 'normal' && style === 'normal' ? EDITOR_FONT : `${EDITOR_FONT}:${size}:${weight}:${style}`;
    const font = { name, size, weight, style };

    install(engine, font, state.resolution); state.fonts.push(font); styles.set(style, name);
  }

  return name;
}

/** Recreates installed font pages when the display pixel ratio changes. */
export function refreshEditorFonts (engine: Engine): void {
  const state = fontsByEngine.get(engine), resolution = engine.displayServer.pixelRatio;

  if (!state || state.resolution === resolution) { return; }
  for (const font of state.fonts) { install(engine, font, resolution); }
  state.resolution = resolution;
}

/** Keeps a control's font resource and display size in sync. */
export function setEditorFont (control: Control, size: number, weight?: FontWeight, style?: FontStyle): void {
  const current = control.getThemeFont('font');
  const fontWeight = weight ?? current.weight, fontStyle = style ?? current.style;

  control.setThemeFontOverride('font', { family: getEditorFont(control.engine, size, fontWeight, fontStyle), weight: fontWeight, style: fontStyle });
  control.setThemeFontSizeOverride('fontSize', size);
}
