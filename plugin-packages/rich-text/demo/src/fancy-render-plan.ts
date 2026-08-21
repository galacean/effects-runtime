import {
  BUILTIN_FANCY_PRESETS,
  Player,
  TextComponent,
  spec,
  type BaseLayerConfig,
  type Composition,
  type DecorativeLayerConfig,
} from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const sceneUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const status = document.getElementById('status');
const textInput = document.getElementById('text') as HTMLTextAreaElement | null;
const presetList = document.getElementById('preset-list');
const scopeSwitch = document.getElementById('scope-switch');
const scopeSummary = document.getElementById('scope-summary');
const segmentList = document.getElementById('segment-list');
const editorSections = document.getElementById('editor-sections');
const selectionStatus = document.getElementById('selection-status');
const splitSelectionButton = document.getElementById('split-selection') as HTMLButtonElement | null;
const mergeSelectionButton = document.getElementById('merge-selection') as HTMLButtonElement | null;
const glyphCount = document.getElementById('glyph-count');
const rangeCount = document.getElementById('range-count');
const paddingReadout = document.getElementById('padding-readout');
const surfaceReadout = document.getElementById('surface-readout');
const rangeList = document.getElementById('range-list');
const objectList = document.getElementById('object-list');
const plainContainer = document.getElementById('J-plain-container');
const plainStatus = document.getElementById('plain-status');
const plainPresetList = document.getElementById('plain-preset-list');
const plainTextInput = document.getElementById('plain-text') as HTMLInputElement | null;
const captureEnabled = new URLSearchParams(window.location.search).get('capture') === '1';

type PaletteName = 'mint' | 'sunset' | 'mono';
type ColorHex = string;

interface RangePreset {
  stroke: ColorHex,
  shadow: ColorHex,
  strokeWidth: number,
  shadowBlur: number,
  offsetX: number,
  offsetY: number,
}

interface Palette {
  colors: readonly ColorHex[],
  sharedStroke: ColorHex,
  sharedShadow: ColorHex,
  glow: ColorHex,
  sharedStrokeWidth: number,
  sharedShadowBlur: number,
  sharedOffsetX: number,
  sharedOffsetY: number,
  glowBlur: number,
  ranges: RangePreset[],
}

interface StyleState {
  fillVisible: boolean,
  fillColor: ColorHex,
  fillOpacity: number,
  strokeVisible: boolean,
  strokeColor: ColorHex,
  strokeOpacity: number,
  strokeWidth: number,
  shadowVisible: boolean,
  shadowColor: ColorHex,
  shadowOpacity: number,
  shadowBlur: number,
  shadowDistance: number,
  shadowAngle: number,
}

interface SharedStyle extends StyleState {
  glowVisible: boolean,
  glowColor: ColorHex,
  glowOpacity: number,
  glowBlur: number,
  glowIntensity: number,
}

interface SegmentState {
  id: string,
  start: number,
  end: number,
  override: boolean,
  style: StyleState,
}

type StyleField = keyof StyleState;
type GlowField = 'glowVisible' | 'glowColor' | 'glowOpacity' | 'glowBlur' | 'glowIntensity';

const palettes = {
  mint: {
    colors: ['#75f0c7ff', '#8a7dffff', '#ffbd69ff'],
    sharedStroke: '#142a31ff',
    sharedShadow: '#061014cc',
    glow: '#40ffd0c7',
    sharedStrokeWidth: 3,
    sharedShadowBlur: 7,
    sharedOffsetX: 2,
    sharedOffsetY: 5,
    glowBlur: 8,
    ranges: [
      { stroke: '#142a31ff', shadow: '#061014e6', strokeWidth: 5, shadowBlur: 12, offsetX: 3, offsetY: 6 },
      { stroke: '#493d8fff', shadow: '#2d2366cc', strokeWidth: 2, shadowBlur: 4, offsetX: -3, offsetY: 4 },
      { stroke: '#714819ff', shadow: '#36d8b0cc', strokeWidth: 8, shadowBlur: 15, offsetX: 0, offsetY: 5 },
    ],
  },
  sunset: {
    colors: ['#ff795fff', '#ffbd69ff', '#ffe6b8ff'],
    sharedStroke: '#4b160fff',
    sharedShadow: '#220803d9',
    glow: '#ff5b31c7',
    sharedStrokeWidth: 4,
    sharedShadowBlur: 8,
    sharedOffsetX: 2,
    sharedOffsetY: 6,
    glowBlur: 10,
    ranges: [
      { stroke: '#4b160fff', shadow: '#220803ed', strokeWidth: 6, shadowBlur: 14, offsetX: 3, offsetY: 7 },
      { stroke: '#8b371cff', shadow: '#5d1b0dcc', strokeWidth: 3, shadowBlur: 5, offsetX: -3, offsetY: 4 },
      { stroke: '#7b3119ff', shadow: '#ff6a36cc', strokeWidth: 9, shadowBlur: 18, offsetX: 0, offsetY: 6 },
    ],
  },
  mono: {
    colors: ['#f5f7fbff', '#b9c4d6ff', '#75f0c7ff'],
    sharedStroke: '#08111dff',
    sharedShadow: '#000000e6',
    glow: '#47c9ffff',
    sharedStrokeWidth: 2,
    sharedShadowBlur: 5,
    sharedOffsetX: 1,
    sharedOffsetY: 4,
    glowBlur: 7,
    ranges: [
      { stroke: '#08111dff', shadow: '#000000f2', strokeWidth: 4, shadowBlur: 9, offsetX: 2, offsetY: 5 },
      { stroke: '#263b5fff', shadow: '#16253dcc', strokeWidth: 1, shadowBlur: 3, offsetX: -2, offsetY: 3 },
      { stroke: '#0e5c60ff', shadow: '#2ec9c4cc', strokeWidth: 6, shadowBlur: 12, offsetX: 0, offsetY: 5 },
    ],
  },
} satisfies Record<PaletteName, Palette>;

const defaultText = textInput?.value ?? 'Range A  Range B\n跨行仍是同一个 source range';
let currentPalette: PaletteName = 'mint';
let editorText = defaultText;
let sharedStyle: SharedStyle;
let segments: SegmentState[];
let selectedSegmentIds: string[] = [];
let richText: RichTextComponent | undefined;
let renderComposition: (() => void) | undefined;
let plainTextComponent: TextComponent | undefined;
let plainComposition: Composition | undefined;
let renderPlainComposition: (() => void) | undefined;
let currentPlainPreset = 'neon';
let renderScheduled = false;
let nextSegmentId = 1;
let lastSelection = { start: 0, end: 0 };
let pendingEditSelection = { start: 0, end: 0 };

const plainPresetLabels: Record<string, string> = {
  'none': '无',
  'single-stroke': '单描边',
  'multi-stroke': '多描边',
  'gradient': '渐变',
  'shadow': '阴影',
  'texture': '纹理',
  'glow': '发光',
  'neon': '霓虹',
  'metallic': '金属',
  'glow-stroke-gradient': '发光渐变',
  'rainbow': '彩虹',
  'frost': '霜冻',
  'flame': '火焰',
  'stereo': '立体',
};

function normalizeHex (color: string): string {
  const value = color.replace('#', '').toLowerCase();

  if (value.length === 3) {
    return `#${value.split('').map(channel => channel + channel).join('')}`;
  }

  return `#${value.slice(0, 6).padEnd(6, '0')}`;
}

function alphaFromHex (color: string): number {
  const value = color.replace('#', '');

  return value.length >= 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1;
}

function colorWithOpacity (color: ColorHex, opacity: number): ColorHex {
  return `${normalizeHex(color)}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
}

function colorToRgba (color: ColorHex, opacity = alphaFromHex(color)): [number, number, number, number] {
  const value = normalizeHex(color).slice(1);
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;

  return [red, green, blue, Math.max(0, Math.min(1, opacity))];
}

function colorForInput (color: ColorHex): string {
  return normalizeHex(color);
}

function colorToCss (color: ColorHex, opacity: number): string {
  const [red, green, blue] = colorToRgba(color, opacity);

  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${opacity})`;
}

function escapeHtml (value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[character] ?? character);
}

function escapeRichText (value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[=<>/]/g, character => `\\${character}`);
}

function cloneStyle (style: StyleState): StyleState {
  return { ...style };
}

function offsetToDistance (offsetX: number, offsetY: number): number {
  return Math.round(Math.hypot(offsetX, offsetY) * 10) / 10;
}

function offsetToAngle (offsetX: number, offsetY: number): number {
  return Math.round(Math.atan2(offsetY, offsetX) * 180 / Math.PI);
}

function distanceToOffset (distance: number, angle: number): { offsetX: number, offsetY: number } {
  const radians = angle * Math.PI / 180;

  return { offsetX: distance * Math.cos(radians), offsetY: distance * Math.sin(radians) };
}

function createStyle (palette: Palette, range: RangePreset | undefined, fillColor: ColorHex): StyleState {
  const preset = range ?? {
    stroke: palette.sharedStroke,
    shadow: palette.sharedShadow,
    strokeWidth: palette.sharedStrokeWidth,
    shadowBlur: palette.sharedShadowBlur,
    offsetX: palette.sharedOffsetX,
    offsetY: palette.sharedOffsetY,
  };

  return {
    fillVisible: true,
    fillColor: normalizeHex(fillColor),
    fillOpacity: alphaFromHex(fillColor),
    strokeVisible: preset.strokeWidth > 0,
    strokeColor: normalizeHex(preset.stroke),
    strokeOpacity: alphaFromHex(preset.stroke),
    strokeWidth: preset.strokeWidth,
    shadowVisible: preset.shadowBlur > 0,
    shadowColor: normalizeHex(preset.shadow),
    shadowOpacity: alphaFromHex(preset.shadow),
    shadowBlur: preset.shadowBlur,
    shadowDistance: offsetToDistance(preset.offsetX, preset.offsetY),
    shadowAngle: offsetToAngle(preset.offsetX, preset.offsetY),
  };
}

function createSharedStyle (paletteName: PaletteName): SharedStyle {
  const palette = palettes[paletteName];
  const style = createStyle(palette, undefined, palette.colors[0]);

  return {
    ...style,
    strokeOpacity: alphaFromHex(palette.sharedStroke),
    shadowOpacity: alphaFromHex(palette.sharedShadow),
    glowVisible: true,
    glowColor: normalizeHex(palette.glow),
    glowOpacity: alphaFromHex(palette.glow),
    glowBlur: palette.glowBlur,
    glowIntensity: 1,
  };
}

function createInitialSegments (paletteName: PaletteName): SegmentState[] {
  const palette = palettes[paletteName];
  const firstGap = editorText.indexOf('  ');
  const secondStart = firstGap >= 0 ? firstGap + 2 : editorText.indexOf('Range B');
  const newline = editorText.indexOf('\n');
  const thirdStart = newline >= 0 ? newline + 1 : editorText.length;
  const firstEnd = firstGap >= 0 ? firstGap : Math.min(editorText.length, 7);
  const secondEnd = newline >= 0 ? newline : editorText.length;
  const ranges = [
    { start: 0, end: firstEnd, override: true, preset: palette.ranges[0], fill: palette.colors[0] },
    { start: firstEnd, end: secondStart, override: false, preset: undefined, fill: palette.colors[0] },
    { start: secondStart, end: secondEnd, override: true, preset: palette.ranges[1], fill: palette.colors[1] },
    { start: secondEnd, end: thirdStart, override: false, preset: undefined, fill: palette.colors[0] },
    { start: thirdStart, end: editorText.length, override: true, preset: palette.ranges[2], fill: palette.colors[2] },
  ];

  return ranges
    .filter(range => range.end > range.start)
    .map(range => ({
      id: `segment-${nextSegmentId++}`,
      start: range.start,
      end: range.end,
      override: range.override,
      style: createStyle(palette, range.preset, range.fill),
    }));
}

function segmentText (segment: SegmentState): string {
  return editorText.slice(segment.start, segment.end);
}

function segmentLabel (segment: SegmentState): string {
  const text = segmentText(segment).replace(/\s+/g, ' ').trim();

  return text ? text.slice(0, 24) : '空白';
}

function meaningfulSegments (): Array<{ segment: SegmentState, index: number, displayIndex: number }> {
  let displayIndex = 0;

  return segments.reduce<Array<{ segment: SegmentState, index: number, displayIndex: number }>>((result, segment, index) => {
    if (!segmentText(segment).trim()) {
      return result;
    }

    result.push({ segment, index, displayIndex: displayIndex++ });

    return result;
  }, []);
}

function styleForSegment (segment: SegmentState): StyleState {
  return segment.override ? segment.style : sharedStyle;
}

function selectedSegmentEntries (): Array<{ segment: SegmentState, index: number, displayIndex: number }> {
  const start = Math.min(lastSelection.start, lastSelection.end);
  const end = Math.max(lastSelection.start, lastSelection.end);
  const hasRange = end > start;
  const hasFocusedCaret = document.activeElement === textInput;
  let matches = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => {
      if (!segmentText(segment).trim()) {
        return false;
      }
      if (hasRange) {
        return segment.start < end && segment.end > start;
      }
      if (hasFocusedCaret) {
        return segment.start <= start && start < segment.end;
      }

      return false;
    });

  if (selectedSegmentIds.length > 0 && !hasRange && !hasFocusedCaret) {
    matches = segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => selectedSegmentIds.includes(segment.id) && segmentText(segment).trim());
  }

  // 没有任何选中时默认全选所有可见片段：修改 Fill/Stroke/Shadow 会应用到
  // 全部片段，而不是只改“全文默认样式”并让部分片段保持不变。
  if (matches.length === 0 && !hasRange && !hasFocusedCaret && selectedSegmentIds.length === 0) {
    matches = meaningfulSegments();
  }

  const displayIndexById = new Map(meaningfulSegments().map(entry => [entry.segment.id, entry.displayIndex]));

  return matches.map(({ segment, index }) => ({ segment, index, displayIndex: displayIndexById.get(segment.id) ?? 0 }));
}

function selectedSegments (): SegmentState[] {
  return selectedSegmentEntries().map(entry => entry.segment);
}

/** 当前是否等效选中了全部可见片段（“全文”即全部片段）。 */
function isAllSegmentsSelected (): boolean {
  const selected = selectedSegmentEntries();
  const meaningful = meaningfulSegments();

  return meaningful.length > 0 && selected.length === meaningful.length;
}

function ensureSegmentOverride (segment: SegmentState): StyleState {
  if (!segment.override) {
    segment.override = true;
    segment.style = cloneStyle(sharedStyle);
  }

  return segment.style;
}

function setStyleField (field: StyleField, value: string | number | boolean): void {
  const targets = selectedSegments();
  const styles = targets.length > 0
    ? targets.map(segment => ensureSegmentOverride(segment))
    : [sharedStyle];

  // 全文（默认全选）修改时同步更新 sharedStyle，让“全文默认样式”与当前显示
  // 一致，避免“全部恢复继承”后跳回旧的默认值。
  if (isAllSegmentsSelected() && !styles.includes(sharedStyle)) {
    styles.unshift(sharedStyle);
  }

  for (const target of styles) {
    switch (field) {
      case 'fillVisible': target.fillVisible = Boolean(value);

        break;
      case 'fillColor': target.fillColor = String(value);

        break;
      case 'fillOpacity': target.fillOpacity = Number(value) / 100;

        break;
      case 'strokeVisible': target.strokeVisible = Boolean(value);

        break;
      case 'strokeColor': target.strokeColor = String(value);

        break;
      case 'strokeOpacity': target.strokeOpacity = Number(value) / 100;

        break;
      case 'strokeWidth': target.strokeWidth = Number(value);

        break;
      case 'shadowVisible': target.shadowVisible = Boolean(value);

        break;
      case 'shadowColor': target.shadowColor = String(value);

        break;
      case 'shadowOpacity': target.shadowOpacity = Number(value) / 100;

        break;
      case 'shadowBlur': target.shadowBlur = Number(value);

        break;
      case 'shadowDistance': target.shadowDistance = Number(value);

        break;
      case 'shadowAngle': target.shadowAngle = Number(value);

        break;
    }
  }
}

function setGlowField (field: GlowField, value: string | number | boolean): void {
  switch (field) {
    case 'glowVisible': sharedStyle.glowVisible = Boolean(value);

      break;
    case 'glowColor': sharedStyle.glowColor = String(value);

      break;
    case 'glowOpacity': sharedStyle.glowOpacity = Number(value) / 100;

      break;
    case 'glowBlur': sharedStyle.glowBlur = Number(value);

      break;
    case 'glowIntensity': sharedStyle.glowIntensity = Number(value);

      break;
  }
}

function rangeLayersFromStyle (style: StyleState): BaseLayerConfig[] {
  const layers: BaseLayerConfig[] = [];
  const offset = distanceToOffset(style.shadowDistance, style.shadowAngle);

  if (style.strokeVisible) {
    const decorations: DecorativeLayerConfig[] = [];

    if (style.shadowVisible) {
      decorations.push({
        kind: 'shadow',
        category: 'decorative',
        params: { color: colorToRgba(style.shadowColor, style.shadowOpacity), blur: style.shadowBlur, offsetX: offset.offsetX, offsetY: offset.offsetY },
      });
    }

    layers.push({
      kind: 'single-stroke',
      category: 'base',
      params: { color: colorToRgba(style.strokeColor, style.strokeOpacity), width: style.strokeWidth, unit: 'px' },
      decorations,
    });
  }
  if (style.fillVisible) {
    layers.push({
      kind: 'solid-fill',
      category: 'base',
      params: { color: colorToRgba(style.fillColor, style.fillOpacity) },
    });
  }

  return layers;
}

function createFancyOptions (): Parameters<RichTextComponent['updateWithOptions']>[0] {
  const sharedOffset = distanceToOffset(sharedStyle.shadowDistance, sharedStyle.shadowAngle);
  const sharedLayers: Array<Record<string, unknown>> = [];

  if (sharedStyle.strokeVisible) {
    const decorations: Array<Record<string, unknown>> = [];

    if (sharedStyle.shadowVisible) {
      decorations.push({
        kind: 'shadow',
        category: 'decorative',
        params: { color: colorToRgba(sharedStyle.shadowColor, sharedStyle.shadowOpacity), blur: sharedStyle.shadowBlur, offsetX: sharedOffset.offsetX, offsetY: sharedOffset.offsetY },
      });
    }
    if (sharedStyle.glowVisible) {
      decorations.push({
        kind: 'glow',
        category: 'decorative',
        params: { color: colorToRgba(sharedStyle.glowColor, sharedStyle.glowOpacity), blur: sharedStyle.glowBlur, intensity: sharedStyle.glowIntensity },
      });
    }
    sharedLayers.push({
      kind: 'single-stroke',
      category: 'base',
      params: { color: colorToRgba(sharedStyle.strokeColor, sharedStyle.strokeOpacity), width: sharedStyle.strokeWidth, unit: 'px' },
      decorations,
    });
  }
  if (sharedStyle.fillVisible) {
    sharedLayers.push({
      kind: 'solid-fill',
      category: 'base',
      params: { color: colorToRgba(sharedStyle.fillColor, sharedStyle.fillOpacity) },
    });
  }

  const rangeStacks: BaseLayerConfig[][] = [];
  const rangeStackIndexByJson = new Map<string, number>();
  const rangeOverrides: Array<null | number> = [];

  segments.forEach(segment => {
    if (segment.override) {
      const layers = rangeLayersFromStyle(segment.style);
      const key = JSON.stringify(layers);
      let stackNumber = rangeStackIndexByJson.get(key);

      if (stackNumber === undefined) {
        rangeStacks.push(layers);
        stackNumber = rangeStacks.length;
        rangeStackIndexByJson.set(key, stackNumber);
      }

      rangeOverrides.push(stackNumber);
    } else {
      rangeOverrides.push(null);
    }
  });

  const text = segments.map(segment => {
    const style = styleForSegment(segment);
    const color = colorWithOpacity(style.fillColor, style.fillOpacity);

    return `<seg><color=${color}>${escapeRichText(segmentText(segment))}</color></seg>`;
  }).join('');

  return {
    text: text || ' ',
    fontFamily: 'Arial',
    fontSize: 42,
    textColor: colorToRgba(sharedStyle.fillColor, sharedStyle.fillOpacity),
    textWeight: spec.TextWeight.normal,
    textAlign: spec.TextAlignment.middle,
    textVerticalAlign: spec.TextVerticalAlign.middle,
    wrapEnabled: true,
    maxTextWidth: 680,
    maxTextHeight: 220,
    autoResize: spec.TextSizeMode.fixed,
    lineHeight: 52,
    fancyRenderPadding: { left: 80, right: 80, top: 80, bottom: 80 },
    fancyConfig: {
      layers: sharedLayers,
      rangeStacks: rangeStacks.map(layers => ({ layers })),
      rangeOverrides,
    },
  } as unknown as Parameters<RichTextComponent['updateWithOptions']>[0];
}

function renderText (): void {
  if (!richText) {
    return;
  }

  richText.updateWithOptions(createFancyOptions());
  richText.setOverflow(spec.TextOverflow.display);
  richText.onUpdate(0);
  renderComposition?.();
  updateDiagnostics();
}

/**
 * 高频编辑（颜色选择器拖动）时把多次输入合并到一帧渲染，避免每个 input
 * 事件都同步触发一次 ~100ms 的 Canvas 2D 重绘导致主线程卡死。
 */
function scheduleRenderText (): void {
  if (renderScheduled) {
    return;
  }

  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderText();
  });
}

function buildPlainTextOptions (presetKey: string): Record<string, unknown> {
  return {
    text: plainTextInput?.value || 'Galacean 普通文本',
    fontFamily: 'Arial',
    fontSize: 42,
    textColor: [255, 255, 255, 1],
    fontWeight: spec.TextWeight.normal,
    fontStyle: spec.FontStyle.normal,
    textAlign: spec.TextAlignment.middle,
    textVerticalAlign: spec.TextVerticalAlign.middle,
    textWidth: 680,
    textHeight: 220,
    lineHeight: 52,
    letterSpace: 0,
    overflow: spec.TextOverflow.display,
    wrapEnabled: true,
    autoResize: spec.TextSizeMode.fixed,
    fancyConfig: BUILTIN_FANCY_PRESETS[presetKey] ?? BUILTIN_FANCY_PRESETS.none,
  };
}

/** 最小内联场景：一个 TextComponent（普通文本）元素，预览尺寸与富文本一致。 */
function buildPlainTextScene (): Record<string, unknown> {
  const componentId = 'plain-text-comp';
  const itemId = 'plain-item';

  return {
    playerVersion: { web: '2.1.2', native: '0.0.1' },
    images: [],
    fonts: [],
    version: '3.1',
    shapes: [],
    type: 'ge',
    compositionId: 'plain-composition',
    compositions: [{
      id: 'plain-composition',
      name: '普通文本合成',
      duration: 5,
      startTime: 0,
      endBehavior: 4,
      previewSize: [750, 750],
      items: [{ id: itemId }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      sceneBindings: [],
    }],
    components: [{
      id: componentId,
      item: { id: itemId },
      dataType: 'TextComponent',
      options: buildPlainTextOptions(currentPlainPreset),
      renderer: { renderMode: 1 },
    }],
    items: [{
      id: itemId,
      name: 'plainText_1',
      duration: 5,
      type: 'text',
      visible: true,
      endBehavior: 0,
      delay: 0,
      renderLevel: 'B+',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      components: [{ id: componentId }],
      dataType: 'VFXItemData',
    }],
    geometries: [],
    materials: [],
    plugins: [],
    shaders: [],
    bins: [],
    textures: [],
    animations: [],
    miscs: [],
  };
}

function renderPlainPresets (): void {
  if (!plainPresetList) {
    return;
  }

  plainPresetList.innerHTML = Object.keys(BUILTIN_FANCY_PRESETS)
    .map(key => `<button class="preset-button" type="button" data-plain-preset="${key}" data-active="${key === currentPlainPreset}">${plainPresetLabels[key] ?? key}</button>`)
    .join('');

  plainPresetList.querySelectorAll<HTMLButtonElement>('[data-plain-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.plainPreset;

      if (!key) {
        return;
      }
      currentPlainPreset = key;
      renderPlainPresets();
      renderPlainText();
    });
  });
}

function renderPlainText (): void {
  if (!plainTextComponent) {
    return;
  }

  plainTextComponent.updateWithOptions(buildPlainTextOptions(currentPlainPreset) as unknown as Parameters<TextComponent['updateWithOptions']>[0]);
  plainTextComponent.isDirty = true;
  plainTextComponent.onUpdate(0);
  renderPlainComposition?.();
  if (plainStatus) {
    plainStatus.textContent = `preset · ${plainPresetLabels[currentPlainPreset] ?? currentPlainPreset}`;
  }
  // 纹理预设的 pattern 是异步加载的，加载完成后补渲染一帧。
  window.setTimeout(() => {
    plainTextComponent?.onUpdate(0);
    renderPlainComposition?.();
  }, 500);
}

async function initPlainText (): Promise<void> {
  if (!plainContainer || !plainTextInput) {
    throw new Error('Plain text container was not found.');
  }

  const player = new Player({ container: plainContainer, manualRender: true });
  const composition = await player.loadScene(buildPlainTextScene(), { autoplay: false });

  composition.gotoAndStop(0);
  renderPlainComposition = () => {
    player.clearCanvas();
    composition.render();
  };
  plainComposition = composition;
  plainTextComponent = composition.getItemByName('plainText_1')?.getComponent(TextComponent);

  if (!plainTextComponent) {
    throw new Error('TextComponent was not found in the plain text scene.');
  }

  Reflect.set(window, '__plainTextDemo', plainTextComponent);

  plainTextInput.addEventListener('input', renderPlainText);
  renderPlainPresets();
  renderPlainText();
  if (plainStatus) {
    plainStatus.textContent = 'editor online';
  }
}

function updateScopeSummary (): void {
  if (!scopeSummary) {
    return;
  }

  const selected = selectedSegmentEntries();
  const all = isAllSegmentsSelected();

  if (all) {
    scopeSummary.textContent = `全文 · 全部 ${selected.length} 个片段 · 批量修改`;
  } else if (selected.length === 0) {
    scopeSummary.textContent = '全文 · 默认样式';
  } else if (selected.length === 1) {
    scopeSummary.textContent = `片段 · ${segmentLabel(selected[0].segment)}`;
  } else {
    scopeSummary.textContent = `已选 ${selected.length} 个片段 · 批量修改`;
  }
}

function renderPresets (): void {
  if (!presetList) {
    return;
  }

  presetList.innerHTML = [
    ['mint', '薄荷 / 紫'],
    ['sunset', '日落 / 奶油'],
    ['mono', '黑白 / 青'],
  ].map(([key, label]) => `<button class="preset-button" type="button" data-preset="${key}" data-active="${key === currentPalette}">${label}</button>`).join('');

  presetList.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const paletteName = button.dataset.preset as PaletteName;

      applyPalette(paletteName);
    });
  });
}

function renderScopes (): void {
  if (!scopeSwitch || !textInput) {
    return;
  }

  const selected = selectedSegmentEntries();
  const all = isAllSegmentsSelected();
  const chips = [
    `<span class="scope-button object" data-active="${all}"><span class="scope-dot" style="background:conic-gradient(#75f0c7 0 120deg, #8a7dff 120deg 240deg, #ffbd69 240deg 360deg)"></span>全文</span>`,
    ...(all
      ? []
      : selected.map(({ segment, displayIndex }) => `<span class="scope-button" data-active="true"><span class="scope-dot" style="background:${styleForSegment(segment).fillColor}"></span>片段 ${displayIndex + 1}</span>`)),
  ].join('');

  scopeSwitch.innerHTML = chips;

  scopeSwitch.querySelectorAll<HTMLElement>('.scope-button').forEach(chip => {
    chip.addEventListener('click', () => {
      const label = chip.textContent?.trim() ?? '';

      if (label === '全文') {
        textInput.setSelectionRange(0, 0);
        lastSelection = { start: 0, end: 0 };
        selectedSegmentIds = [];
        renderEditor();

        return;
      }

      const match = label.match(/片段 (\d+)/);
      const displayIndex = match ? Number(match[1]) - 1 : -1;
      const entry = displayIndex >= 0 ? meaningfulSegments()[displayIndex] : undefined;

      if (!entry) {
        return;
      }

      textInput.setSelectionRange(entry.segment.start, entry.segment.start);
      lastSelection = { start: entry.segment.start, end: entry.segment.start };
      selectedSegmentIds = [entry.segment.id];
      renderEditor();
    });
  });
}

function renderSegments (): void {
  if (!segmentList || !textInput) {
    return;
  }

  const selectedIds = new Set(selectedSegmentEntries().map(entry => entry.segment.id));

  segmentList.innerHTML = meaningfulSegments().map(({ segment, displayIndex }) => {
    const style = styleForSegment(segment);
    const overrideLabel = segment.override ? '已自定义' : '继承全文';
    const selectedLabel = selectedIds.has(segment.id) ? ' · 当前选择' : '';

    return `<div class="segment-row" data-segment="${segment.id}" data-active="${selectedIds.has(segment.id)}">
      <span class="segment-dot" style="background:${style.fillColor}"></span>
      <span class="segment-copy"><strong>片段 ${displayIndex + 1} · ${escapeHtml(segmentLabel(segment))}</strong><small>${overrideLabel}${selectedLabel} · ${segment.end - segment.start} 字</small></span>
      <span class="segment-arrow">${selectedIds.has(segment.id) ? '●' : '·'}</span>
    </div>`;
  }).join('');

  segmentList.querySelectorAll<HTMLElement>('.segment-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.segment;
      const segment = id ? segments.find(item => item.id === id) : undefined;

      if (!segment) {
        return;
      }

      textInput.setSelectionRange(segment.start, segment.start);
      lastSelection = { start: segment.start, end: segment.start };
      selectedSegmentIds = [segment.id];
      renderEditor();
    });
  });
}

function inheritanceMarkup (selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  if (selected.length === 0) {
    return '<div class="inherit-row"><span>全文默认样式</span><small>片段默认继承这套配置</small></div>';
  }

  if (selected.length > 1) {
    const overrideCount = selected.filter(entry => entry.segment.override).length;

    return `<div class="inherit-row ${overrideCount > 0 ? 'override' : ''}"><span>已选 ${selected.length} 个片段 · ${overrideCount} 个已有自定义</span><button class="tool-button" type="button" data-action="toggle-inherit" ${overrideCount === 0 ? 'disabled' : ''}>${overrideCount > 0 ? '全部恢复继承' : '已全部继承'}</button></div>`;
  }

  const segment = selected[0].segment;

  return `<div class="inherit-row ${segment.override ? 'override' : ''}"><span>${segment.override ? '当前片段已覆盖全文默认' : '当前片段继承全文默认'}</span><button class="tool-button" type="button" data-action="toggle-inherit">${segment.override ? '恢复继承' : '编辑片段'}</button></div>`;
}

function controlAttribute (field: StyleField | GlowField): string {
  return field.startsWith('glow') ? 'data-glow-field' : 'data-field';
}

function colorRow (label: string, field: StyleField | GlowField, value: ColorHex): string {
  const attribute = controlAttribute(field);

  return `<div class="param-row wide"><label>${label}</label><input type="color" ${attribute}="${field}" value="${colorForInput(value)}" /></div>`;
}

function rangeRow (label: string, field: StyleField | GlowField, value: number, min: number, max: number, step: number, outputValue: string | number = value): string {
  const attribute = controlAttribute(field);

  return `<div class="param-row"><label>${label}</label><input type="range" ${attribute}="${field}" min="${min}" max="${max}" step="${step}" value="${value}" /><output data-output="${field}">${outputValue}</output></div>`;
}

function toggleMarkup (field: StyleField | GlowField, checked: boolean): string {
  const attribute = controlAttribute(field);

  return `<input class="layer-toggle" type="checkbox" ${attribute}="${field}" ${checked ? 'checked' : ''} />`;
}

function selectionValues (selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>, kind: 'fill' | 'stroke' | 'shadow', summary: (style: StyleState) => string): string {
  if (selected.length < 2) {
    return '';
  }

  return `<div class="selection-values"><div class="selection-values-title">选中片段的当前值</div>${selected.map(({ segment, displayIndex }) => `<div class="selection-value-row" data-selection-segment="${segment.id}" data-selection-kind="${kind}"><span>片段 ${displayIndex + 1} · ${escapeHtml(segmentLabel(segment))}</span><strong>${summary(styleForSegment(segment))}</strong></div>`).join('')}</div>`;
}

function renderFillSection (style: StyleState, selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  const multiple = selected.length > 1;

  return `<section class="section"><div class="section-label"><span>填充</span><small>${multiple ? '多选批量修改' : '当前作用范围'}</small></div>${inheritanceMarkup(selected)}<div class="layer-card ${style.fillVisible ? '' : 'disabled'}"><div class="layer-head">${toggleMarkup('fillVisible', style.fillVisible)}<span class="layer-preview" style="background:${colorToCss(style.fillColor, style.fillOpacity)}"></span><span class="layer-info"><strong>纯色填充</strong><small>${style.fillVisible ? 'Fill' : '已隐藏'}</small></span></div><div class="layer-params">${colorRow('颜色', 'fillColor', style.fillColor)}${rangeRow('不透明度', 'fillOpacity', Math.round(style.fillOpacity * 100), 0, 100, 1, multiple ? '多值' : Math.round(style.fillOpacity * 100))}</div>${selectionValues(selected, 'fill', current => `${colorToCss(current.fillColor, current.fillOpacity)} · ${Math.round(current.fillOpacity * 100)}%`)}</div></section>`;
}

function renderStrokeSection (style: StyleState, selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  const multiple = selected.length > 1;

  return `<section class="section"><div class="section-label"><span>描边</span><small>${multiple ? '多选批量修改' : '片段级'}</small></div><div class="layer-card ${style.strokeVisible ? '' : 'disabled'}"><div class="layer-head">${toggleMarkup('strokeVisible', style.strokeVisible)}<span class="layer-preview" style="background:${colorToCss(style.strokeColor, style.strokeOpacity)}"></span><span class="layer-info"><strong>单描边</strong><small>${style.strokeVisible ? `${style.strokeWidth}px` : '已隐藏'}</small></span></div><div class="layer-params">${colorRow('颜色', 'strokeColor', style.strokeColor)}${rangeRow('宽度', 'strokeWidth', style.strokeWidth, 0, 16, 1, multiple ? '多值' : style.strokeWidth)}${rangeRow('不透明度', 'strokeOpacity', Math.round(style.strokeOpacity * 100), 0, 100, 1, multiple ? '多值' : Math.round(style.strokeOpacity * 100))}</div>${selectionValues(selected, 'stroke', current => `${current.strokeWidth}px · ${colorToCss(current.strokeColor, current.strokeOpacity)}`)}</div></section>`;
}

function renderShadowLayer (style: StyleState, selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  const multiple = selected.length > 1;

  return `<div class="layer-card ${style.shadowVisible ? '' : 'disabled'}"><div class="layer-head">${toggleMarkup('shadowVisible', style.shadowVisible)}<span class="layer-preview" style="background:${colorToCss(style.shadowColor, style.shadowOpacity)}"></span><span class="layer-info"><strong>阴影</strong><small>${style.shadowVisible ? `${style.shadowBlur}px` : '已隐藏'}</small></span></div><div class="layer-params">${colorRow('颜色', 'shadowColor', style.shadowColor)}${rangeRow('模糊', 'shadowBlur', style.shadowBlur, 0, 28, 1, multiple ? '多值' : style.shadowBlur)}${rangeRow('距离', 'shadowDistance', style.shadowDistance, 0, 40, 1, multiple ? '多值' : style.shadowDistance)}${rangeRow('角度', 'shadowAngle', style.shadowAngle, -180, 180, 1, multiple ? '多值' : style.shadowAngle)}${rangeRow('不透明度', 'shadowOpacity', Math.round(style.shadowOpacity * 100), 0, 100, 1, multiple ? '多值' : Math.round(style.shadowOpacity * 100))}</div>${selectionValues(selected, 'shadow', current => `${current.shadowBlur}px · ${current.shadowDistance}px · ${current.shadowAngle}°`)}</div>`;
}

function renderGlowLayer (selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  // “全文”就是全部片段：此时可以编辑对象级 Glow；只有选中部分片段时才锁定。
  if (!isAllSegmentsSelected()) {
    return '<div class="layer-card disabled"><div class="layer-head"><span class="layer-preview" style="background:#9c8dff"></span><span class="layer-info"><strong>发光</strong><small>全文效果 · 请切换到全文编辑</small></span></div><div class="locked-note">Glow 作用于整个文本对象，多选片段时不会重复显示。</div></div>';
  }

  return `<div class="layer-card ${sharedStyle.glowVisible ? '' : 'disabled'}"><div class="layer-head">${toggleMarkup('glowVisible', sharedStyle.glowVisible)}<span class="layer-preview" style="background:${colorToCss(sharedStyle.glowColor, sharedStyle.glowOpacity)}"></span><span class="layer-info"><strong>发光</strong><small>全文效果 · OBJECT</small></span></div><div class="layer-params">${colorRow('颜色', 'glowColor', sharedStyle.glowColor)}${rangeRow('模糊', 'glowBlur', sharedStyle.glowBlur, 0, 32, 1)}${rangeRow('强度', 'glowIntensity', sharedStyle.glowIntensity, 1, 5, 1)}${rangeRow('不透明度', 'glowOpacity', Math.round(sharedStyle.glowOpacity * 100), 0, 100, 1)}</div></div>`;
}

function renderEffectsSection (style: StyleState, selected: Array<{ segment: SegmentState, index: number, displayIndex: number }>): string {
  const multiple = selected.length > 1;

  return `<section class="section"><div class="section-label"><span>效果</span><small>${multiple ? '多选批量修改 Shadow · Glow 全文级' : 'Shadow · Range / Glow · Object'}</small></div>${inheritanceMarkup(selected)}${renderShadowLayer(style, selected)}${renderGlowLayer(selected)}</section>`;
}

function renderEditor (): void {
  updateSelectionState();
  renderPresets();
  renderScopes();
  renderSegments();
  updateScopeSummary();

  if (editorSections) {
    const selected = selectedSegmentEntries();
    const style = selected.length > 0 ? styleForSegment(selected[0].segment) : sharedStyle;

    editorSections.innerHTML = `${renderFillSection(style, selected)}${renderStrokeSection(style, selected)}${renderEffectsSection(style, selected)}`;
    bindEditorControls();
    updateControlReadouts();
  }
}

function updateControlReadouts (): void {
  editorSections?.querySelectorAll<HTMLOutputElement>('[data-output]').forEach(output => {
    const field = output.dataset.output as StyleField | GlowField | undefined;

    if (!field) {
      return;
    }

    const attribute = controlAttribute(field);
    const input = editorSections?.querySelector<HTMLInputElement>(`[${attribute}="${field}"]`);

    if (!input) {
      return;
    }

    if (selectedSegmentEntries().length > 1 && !field.startsWith('glow')) {
      output.value = '多值';

      return;
    }

    const suffix = field.toLowerCase().includes('opacity') ? '%' : field.toLowerCase().includes('angle') ? '°' : field.toLowerCase().includes('width') || field.toLowerCase().includes('blur') || field.toLowerCase().includes('distance') ? 'px' : '';

    output.value = `${input.value}${suffix}`;
  });
}

function updateSelectionValueRows (): void {
  editorSections?.querySelectorAll<HTMLElement>('[data-selection-segment]').forEach(row => {
    const segment = segments.find(item => item.id === row.dataset.selectionSegment);
    const value = row.querySelector('strong');
    const kind = row.dataset.selectionKind;

    if (!segment || !value) {
      return;
    }

    const style = styleForSegment(segment);

    if (kind === 'fill') {
      value.textContent = `${colorToCss(style.fillColor, style.fillOpacity)} · ${Math.round(style.fillOpacity * 100)}%`;
    } else if (kind === 'stroke') {
      value.textContent = `${style.strokeWidth}px · ${colorToCss(style.strokeColor, style.strokeOpacity)}`;
    } else if (kind === 'shadow') {
      value.textContent = `${style.shadowBlur}px · ${style.shadowDistance}px · ${style.shadowAngle}°`;
    }
  });
}

function refreshAfterEdit (): void {
  scheduleRenderText();
  updateControlReadouts();
  updateSelectionValueRows();
  updateScopesAndSegmentsOnly();
}

function updateScopesAndSegmentsOnly (): void {
  renderScopes();
  renderSegments();
  updateScopeSummary();
}

function bindEditorControls (): void {
  editorSections?.querySelectorAll<HTMLInputElement>('[data-field]').forEach(input => {
    const field = input.dataset.field as StyleField | undefined;

    if (!field) {
      return;
    }

    input.addEventListener('input', () => {
      const value = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : Number(input.value);

      setStyleField(field, value);
      refreshAfterEdit();
    });
  });

  editorSections?.querySelectorAll<HTMLInputElement>('[data-glow-field]').forEach(input => {
    const field = input.dataset.glowField as GlowField | undefined;

    if (!field) {
      return;
    }

    input.addEventListener('input', () => {
      const value = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : Number(input.value);

      setGlowField(field, value);
      refreshAfterEdit();
    });
  });

  editorSections?.querySelectorAll<HTMLButtonElement>('[data-action="toggle-inherit"]').forEach(button => {
    button.addEventListener('click', () => {
      const selected = selectedSegments();

      if (selected.length === 0) {
        return;
      }
      if (selected.length > 1 || selected[0].override) {
        selected.forEach(segment => { segment.override = false; });
      } else {
        selected[0].override = true;
        selected[0].style = cloneStyle(sharedStyle);
      }
      renderEditor();
      renderText();
    });
  });
}

function applyPalette (paletteName: PaletteName): void {
  currentPalette = paletteName;
  sharedStyle = createSharedStyle(paletteName);
  const palette = palettes[paletteName];
  let visibleIndex = 0;

  segments.forEach(segment => {
    if (!segmentText(segment).trim()) {
      segment.override = false;

      return;
    }

    const rangePreset = palette.ranges[Math.min(visibleIndex, palette.ranges.length - 1)];

    segment.override = true;
    segment.style = createStyle(palette, rangePreset, palette.colors[Math.min(visibleIndex, palette.colors.length - 1)]);
    visibleIndex++;
  });

  renderEditor();
  renderText();
}

function splitAt (position: number): void {
  const index = segments.findIndex(segment => segment.start < position && position < segment.end);

  if (index < 0) {
    return;
  }

  const source = segments[index];
  const left: SegmentState = { ...source, id: `segment-${nextSegmentId++}`, end: position, style: cloneStyle(source.style) };
  const right: SegmentState = { ...source, id: `segment-${nextSegmentId++}`, start: position, style: cloneStyle(source.style) };

  segments.splice(index, 1, left, right);
}

function normalizeSegments (): void {
  const sorted = [...segments].sort((left, right) => left.start - right.start);
  const normalized: SegmentState[] = [];
  let cursor = 0;

  for (const source of sorted) {
    const start = Math.max(cursor, Math.min(editorText.length, source.start));
    const end = Math.max(start, Math.min(editorText.length, source.end));

    if (start > cursor) {
      normalized.push({ id: `segment-${nextSegmentId++}`, start: cursor, end: start, override: false, style: cloneStyle(sharedStyle) });
    }
    if (end > start) {
      normalized.push({ ...source, start, end });
      cursor = end;
    }
  }
  if (cursor < editorText.length) {
    normalized.push({ id: `segment-${nextSegmentId++}`, start: cursor, end: editorText.length, override: false, style: cloneStyle(sharedStyle) });
  }
  segments = normalized.length > 0 ? normalized : [{ id: `segment-${nextSegmentId++}`, start: 0, end: editorText.length, override: false, style: cloneStyle(sharedStyle) }];
}

function splitSelection (): void {
  if (!textInput) {
    return;
  }

  const start = Math.min(textInput.selectionStart, textInput.selectionEnd);
  const end = Math.max(textInput.selectionStart, textInput.selectionEnd);

  if (start === end) {
    return;
  }

  normalizeSegments();
  splitAt(start);
  splitAt(end);
  textInput.setSelectionRange(start, end);
  renderEditor();
  renderText();
}

function mergeSelection (): void {
  if (!textInput) {
    return;
  }

  const start = Math.min(textInput.selectionStart, textInput.selectionEnd);
  const end = Math.max(textInput.selectionStart, textInput.selectionEnd);

  if (start === end) {
    return;
  }

  normalizeSegments();
  splitAt(start);
  splitAt(end);
  const selected = segments.filter(segment => segment.start >= start && segment.end <= end);

  if (selected.length < 2) {
    return;
  }

  const firstIndex = segments.indexOf(selected[0]);
  const merged: SegmentState = {
    id: `segment-${nextSegmentId++}`,
    start,
    end,
    override: selected[0].override,
    style: cloneStyle(selected[0].style),
  };

  segments.splice(firstIndex, selected.length, merged);
  textInput.setSelectionRange(start, end);
  renderEditor();
  renderText();
}

function reconcileSegmentsAfterTextEdit (oldText: string, newText: string, oldStart: number, oldEnd: number): void {
  const removedLength = oldEnd - oldStart;
  const insertedLength = newText.length - (oldText.length - removedLength);
  const delta = insertedLength - removedLength;
  const mapBoundary = (position: number): number => {
    if (position <= oldStart) {return position;}
    if (position >= oldEnd) {return position + delta;}

    return oldStart + insertedLength;
  };

  segments = segments.map(segment => ({
    ...segment,
    start: mapBoundary(segment.start),
    end: mapBoundary(segment.end),
  })).filter(segment => segment.end > segment.start);
  editorText = newText;
  normalizeSegments();
}

function updateSelectionState (): void {
  if (!textInput || !selectionStatus || !splitSelectionButton || !mergeSelectionButton) {
    return;
  }

  const start = Math.min(textInput.selectionStart, textInput.selectionEnd);
  const end = Math.max(textInput.selectionStart, textInput.selectionEnd);
  const hasRange = end > start;
  let matches = segments.filter(segment => {
    if (!segmentText(segment).trim()) {
      return false;
    }
    if (hasRange) {
      return segment.start < end && segment.end > start;
    }

    return document.activeElement === textInput && segment.start <= start && start < segment.end;
  });

  // 显式选择的片段（点击片段行）在文本框失焦时保留，不被“默认全选”覆盖。
  if (matches.length === 0 && selectedSegmentIds.length > 0 && !hasRange && document.activeElement !== textInput) {
    matches = segments.filter(segment => selectedSegmentIds.includes(segment.id) && segmentText(segment).trim());
  }

  // 未选中任何片段时默认全选所有可见片段（与 selectedSegmentEntries 一致）。
  const allSelected = matches.length === 0 && !hasRange && document.activeElement !== textInput;
  const selectedSegments = allSelected
    ? segments.filter(segment => segmentText(segment).trim())
    : matches;

  lastSelection = { start, end };
  selectedSegmentIds = selectedSegments.map(segment => segment.id);

  if (allSelected) {
    selectionStatus.textContent = `全文 · 已选择全部 ${selectedSegments.length} 个片段 · 批量修改`;
  } else if (matches.length === 0) {
    selectionStatus.textContent = hasRange ? '未选中可编辑片段' : '未选择文字';
  } else if (matches.length === 1) {
    selectionStatus.textContent = hasRange ? `已选择 1 个片段 · ${segmentLabel(matches[0])}` : `当前片段 · ${segmentLabel(matches[0])}`;
  } else {
    selectionStatus.textContent = `已选择 ${matches.length} 个片段 · 修改参数会同时应用`;
  }
  splitSelectionButton.disabled = !hasRange;
  mergeSelectionButton.disabled = selectedSegments.length < 2;
}

function updateDiagnostics (): void {
  const plan = richText?.getRenderPlan();

  if (!plan) {
    return;
  }

  if (glyphCount) {glyphCount.textContent = String(plan.glyphs.length);}
  if (rangeCount) {rangeCount.textContent = String(plan.rangePlans.length);}
  if (paddingReadout) {paddingReadout.textContent = `${plan.geometry.padding.left}px / ${plan.geometry.padding.top}px`;}
  if (surfaceReadout) {surfaceReadout.textContent = `${plan.geometry.renderSize.width} × ${plan.geometry.renderSize.height}`;}

  if (rangeList) {
    rangeList.innerHTML = plan.rangePlans.map((range, index) => `<div class="scope-map-row"><span>RANGE</span><code>range-${index}</code><span>${range.glyphIds.length} glyphs · ${segments[index]?.override ? 'override' : 'inherit'}</span></div>`).join('');
  }
  if (objectList) {
    objectList.innerHTML = plan.objectPlan.layers.map(layer => `<div class="scope-map-row"><span>OBJECT</span><code>${layer.layer.kind}</code><span>shared pass</span></div>`).join('');
  }
}

function updateSelectionListeners (): void {
  if (!textInput) {
    return;
  }

  const captureSelection = (): void => {
    lastSelection = { start: textInput.selectionStart, end: textInput.selectionEnd };
    renderEditor();
  };

  textInput.addEventListener('beforeinput', () => {
    pendingEditSelection = { start: textInput.selectionStart, end: textInput.selectionEnd };
  });
  ['select', 'keyup', 'mouseup', 'focus'].forEach(eventName => textInput.addEventListener(eventName, captureSelection));
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === textInput) {
      renderEditor();
    }
  });
  textInput.addEventListener('input', () => {
    const oldText = editorText;
    const editSelection = pendingEditSelection.start === pendingEditSelection.end && lastSelection.end > lastSelection.start ? lastSelection : pendingEditSelection;

    reconcileSegmentsAfterTextEdit(oldText, textInput.value, editSelection.start, editSelection.end);
    renderEditor();
    scheduleRenderText();
    pendingEditSelection = { start: textInput.selectionStart, end: textInput.selectionEnd };
  });
}

async function main (): Promise<void> {
  if (!container || !textInput) {
    throw new Error('RichText editor container was not found.');
  }

  sharedStyle = createSharedStyle(currentPalette);
  segments = createInitialSegments(currentPalette);
  normalizeSegments();
  textInput.value = editorText;
  updateSelectionListeners();
  splitSelectionButton?.addEventListener('click', splitSelection);
  mergeSelectionButton?.addEventListener('click', mergeSelection);
  renderEditor();

  const player = new Player({ container, manualRender: true });
  const composition = await player.loadScene(sceneUrl, {
    autoplay: false,
    variables: { richText_1: editorText },
  });

  composition.gotoAndStop(0);
  // manualRender skips the engine main loop, which is what normally clears the
  // default framebuffer before drawing. Without the clear, consecutive renders
  // (e.g. rapid color-picker drags) composite the semi-transparent shadow halo
  // on top of the previous frame and make it grow brighter frame by frame.
  renderComposition = () => {
    player.clearCanvas();
    composition.render();
  };
  richText = composition.getItemByName('richText_1')?.getComponent(RichTextComponent);

  if (!richText) {
    throw new Error('RichTextComponent was not found in the demo scene.');
  }

  Reflect.set(window, '__richTextDemo', richText);
  renderText();
  await initPlainText();

  // Continuous rendering is only for Spector capture. In the normal editor,
  // renderText() already renders after each edit; keeping a second RAF render
  // path active can make high-frequency color input harder to reason about.
  if (captureEnabled) {
    const renderFrame = (): void => {
      renderComposition?.();
      renderPlainComposition?.();
      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  }

  if (status) {status.textContent = 'editor online';}
}

main().catch(error => {
  if (status) {status.textContent = 'render failed';}
  console.error('[RichText Fancy Editor]', error);
});
