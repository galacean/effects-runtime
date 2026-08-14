import { Player, spec, type FancyRenderLayer } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const sceneUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const status = document.getElementById('status');
const textInput = document.getElementById('text') as HTMLTextAreaElement | null;
const glowInput = document.getElementById('glow') as HTMLInputElement | null;
const glowValue = document.getElementById('glow-value');
const glyphCount = document.getElementById('glyph-count');
const rangeCount = document.getElementById('range-count');
const paddingReadout = document.getElementById('padding-readout');
const surfaceReadout = document.getElementById('surface-readout');
const rangeList = document.getElementById('range-list');
const objectList = document.getElementById('object-list');

type RangeSourceId = 'range-0' | 'range-2' | 'range-4';
type RangePreset = {
  stroke: string,
  shadow: string,
  strokeWidth: number,
  shadowBlur: number,
  offsetX: number,
  offsetY: number,
};

type Palette = {
  colors: readonly string[],
  sharedStroke: string,
  sharedShadow: string,
  glow: string,
  sharedStrokeWidth: number,
  sharedShadowBlur: number,
  sharedOffsetX: number,
  sharedOffsetY: number,
  glowBlur: number,
  ranges: Record<RangeSourceId, RangePreset>,
};

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
    ranges: {
      'range-0': { stroke: '#142a31ff', shadow: '#061014e6', strokeWidth: 5, shadowBlur: 12, offsetX: 3, offsetY: 6 },
      'range-2': { stroke: '#493d8fff', shadow: '#2d2366cc', strokeWidth: 2, shadowBlur: 4, offsetX: -3, offsetY: 4 },
      'range-4': { stroke: '#714819ff', shadow: '#36d8b0cc', strokeWidth: 8, shadowBlur: 15, offsetX: 0, offsetY: 5 },
    },
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
    ranges: {
      'range-0': { stroke: '#4b160fff', shadow: '#220803ed', strokeWidth: 6, shadowBlur: 14, offsetX: 3, offsetY: 7 },
      'range-2': { stroke: '#8b371cff', shadow: '#5d1b0dcc', strokeWidth: 3, shadowBlur: 5, offsetX: -3, offsetY: 4 },
      'range-4': { stroke: '#7b3119ff', shadow: '#ff6a36cc', strokeWidth: 9, shadowBlur: 18, offsetX: 0, offsetY: 6 },
    },
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
    ranges: {
      'range-0': { stroke: '#08111dff', shadow: '#000000f2', strokeWidth: 4, shadowBlur: 9, offsetX: 2, offsetY: 5 },
      'range-2': { stroke: '#263b5fff', shadow: '#16253dcc', strokeWidth: 1, shadowBlur: 3, offsetX: -2, offsetY: 3 },
      'range-4': { stroke: '#0e5c60ff', shadow: '#2ec9c4cc', strokeWidth: 6, shadowBlur: 12, offsetX: 0, offsetY: 5 },
    },
  },
} satisfies Record<string, Palette>;

type PaletteName = keyof typeof palettes;
const rangeDefinitions: Array<{ sourceRangeId: RangeSourceId, label: string, strokeInputId: string, shadowInputId: string, strokeValueId: string, shadowValueId: string }> = [
  { sourceRangeId: 'range-0', label: 'Range A', strokeInputId: 'range-a-stroke', shadowInputId: 'range-a-shadow', strokeValueId: 'range-a-stroke-value', shadowValueId: 'range-a-shadow-value' },
  { sourceRangeId: 'range-2', label: 'Range B', strokeInputId: 'range-b-stroke', shadowInputId: 'range-b-shadow', strokeValueId: 'range-b-stroke-value', shadowValueId: 'range-b-shadow-value' },
  { sourceRangeId: 'range-4', label: '第二行 / Range C', strokeInputId: 'range-c-stroke', shadowInputId: 'range-c-shadow', strokeValueId: 'range-c-stroke-value', shadowValueId: 'range-c-shadow-value' },
];

const rangeControls = Object.fromEntries(rangeDefinitions.map(definition => [
  definition.sourceRangeId,
  {
    stroke: document.getElementById(definition.strokeInputId) as HTMLInputElement | null,
    shadow: document.getElementById(definition.shadowInputId) as HTMLInputElement | null,
    strokeValue: document.getElementById(definition.strokeValueId),
    shadowValue: document.getElementById(definition.shadowValueId),
  },
])) as Record<RangeSourceId, {
  stroke: HTMLInputElement | null,
  shadow: HTMLInputElement | null,
  strokeValue: HTMLElement | null,
  shadowValue: HTMLElement | null,
}>;

let currentPalette: PaletteName = 'mint';
let richText: RichTextComponent | undefined;
let renderComposition: (() => void) | undefined;

function hexToRgba (hex: string): [number, number, number, number] {
  const value = hex.replace('#', '');
  const channels = value.match(/.{2}/g) ?? [];

  return channels.map(channel => parseInt(channel, 16) / 255) as [number, number, number, number];
}

function getValue (input: HTMLInputElement | null, fallback: number): number {
  return input ? Number(input.value) : fallback;
}

function setValue (input: HTMLInputElement | null, value: number): void {
  if (input) {
    input.value = String(value);
  }
}

function applyPresetValues (paletteName: PaletteName): void {
  const palette = palettes[paletteName];

  for (const definition of rangeDefinitions) {
    const preset = palette.ranges[definition.sourceRangeId];
    const controls = rangeControls[definition.sourceRangeId];

    setValue(controls.stroke, preset.strokeWidth);
    setValue(controls.shadow, preset.shadowBlur);
  }
  setValue(glowInput, palette.glowBlur);
}

function makeRangeLayers (palette: Palette, sourceRangeId: RangeSourceId): FancyRenderLayer[] {
  const preset = palette.ranges[sourceRangeId];
  const controls = rangeControls[sourceRangeId];

  return [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { color: hexToRgba(preset.stroke), width: getValue(controls.stroke, preset.strokeWidth), unit: 'px',
      },
    },
    {
      kind: 'shadow',
      category: 'decorative',
      params: {
        color: hexToRgba(preset.shadow),
        blur: getValue(controls.shadow, preset.shadowBlur),
        offsetX: preset.offsetX,
        offsetY: preset.offsetY,
      },
    },
    // A custom range replaces the shared range layers, so it must carry its
    // own fill layer as well. The Canvas backend still takes the actual fill
    // color from the span's basicStyle.fillColor.
    {
      kind: 'solid-fill',
      category: 'base',
      params: { color: hexToRgba(palette.colors[0]) },
    },
  ];
}

function createFancyOptions (paletteName: PaletteName) {
  const palette = palettes[paletteName];
  const colors = palette.colors.map(hexToRgba);
  const glowBlur = getValue(glowInput, palette.glowBlur);
  const rangeFancyLayers: Record<string, FancyRenderLayer[]> = {};

  for (const definition of rangeDefinitions) {
    rangeFancyLayers[definition.sourceRangeId] = makeRangeLayers(palette, definition.sourceRangeId);
  }

  return {
    text: textInput?.value ?? '',
    fontFamily: 'Arial',
    fontSize: 42,
    textColor: [1, 1, 1, 1] as [number, number, number, number],
    textWeight: spec.TextWeight.normal,
    textAlign: spec.TextAlignment.middle,
    textOverflow: spec.TextOverflow.display,
    textVerticalAlign: spec.TextVerticalAlign.middle,
    wrapEnabled: true,
    maxTextWidth: 680,
    maxTextHeight: 330,
    autoResize: spec.TextSizeMode.fixed,
    lineHeight: 52,
    rangeFancyLayers,
    // Reserve the largest interactive shadow/glow budget up front. Without a
    // stable surface, every blur step reallocates the Canvas/WebGL texture and
    // the preview visibly jumps. This is a runtime demo budget, not persisted
    // RichText schema.
    fancyRenderPadding: { left: 80, right: 80, top: 80, bottom: 80 },
    fancyConfig: {
      presetName: `rich-text-${paletteName}`,
      layers: [
        {
          kind: 'single-stroke' as const,
          category: 'base' as const,
          params: { color: hexToRgba(palette.sharedStroke), width: palette.sharedStrokeWidth, unit: 'px' as const },
          decorations: [
            {
              kind: 'shadow' as const,
              category: 'decorative' as const,
              params: {
                color: hexToRgba(palette.sharedShadow),
                blur: palette.sharedShadowBlur,
                offsetX: palette.sharedOffsetX,
                offsetY: palette.sharedOffsetY,
              },
            },
            {
              // Glow is intentionally kept in the object plan. It is not
              // repeated in rangeFancyLayers.
              kind: 'glow' as const,
              category: 'decorative' as const,
              params: { color: hexToRgba(palette.glow), blur: glowBlur, intensity: 1 },
            },
          ],
        },
        {
          kind: 'solid-fill' as const,
          category: 'base' as const,
          params: { color: colors[0] },
        },
      ],
    },
  };
}

function colorToHex (color: readonly number[] | undefined): string {
  if (!color) {
    return '#ffffff';
  }

  return `#${color.slice(0, 3).map(channel => Math.round(channel > 1 ? channel : channel * 255).toString(16).padStart(2, '0')).join('')}`;
}

function describeLayer (range: NonNullable<ReturnType<RichTextComponent['getRenderPlan']>>['rangePlans'][number], kind: 'single-stroke' | 'shadow'): string {
  const layer = range.layers.find(item => item.layer.kind === kind);

  if (!layer) {
    return `no ${kind}`;
  }

  if (kind === 'single-stroke' && layer.layer.kind === 'single-stroke') {
    return `stroke ${layer.layer.params.width}px ${colorToHex(layer.layer.params.color)}`;
  }
  if (kind === 'shadow' && layer.layer.kind === 'shadow') {
    return `shadow ${layer.layer.params.blur}px ${colorToHex(layer.layer.params.color)}`;
  }

  return kind;
}

function isRangeOverride (range: NonNullable<ReturnType<RichTextComponent['getRenderPlan']>>['rangePlans'][number]): boolean {
  return range.layers.some(layer => layer.layerId.startsWith(`range-${range.sourceRangeId}-`));
}

function updateScopeMap (plan: NonNullable<ReturnType<RichTextComponent['getRenderPlan']>>): void {
  if (rangeList) {
    rangeList.innerHTML = plan.rangePlans.map(range => {
      const scope = isRangeOverride(range) ? 'override' : 'inherit shared';
      const layers = [
        describeLayer(range, 'single-stroke'),
        describeLayer(range, 'shadow'),
        range.layers.some(layer => layer.layer.kind === 'solid-fill') ? 'fill' : 'no fill',
      ];

      return `
        <div class="scope-row">
          <span class="scope-dot" style="background:${colorToHex(range.basicStyle.fillColor)}"></span>
          <code>${range.sourceRangeId}</code>
          <span>${range.glyphIds.length} glyphs · ${scope} · ${layers.join(' · ')}</span>
        </div>
      `;
    }).join('');
  }

  if (objectList) {
    objectList.innerHTML = plan.objectPlan.layers.map(layer => {
      if (layer.layer.kind === 'glow') {
        return `
          <div class="scope-row object-row">
            <span class="scope-tag">OBJECT</span>
            <code>glow</code>
            <span>blur ${layer.layer.params.blur}px · intensity ${layer.layer.params.intensity} · ${colorToHex(layer.layer.params.color)} · shared params · complete content source</span>
          </div>
        `;
      }

      return `
        <div class="scope-row object-row">
          <span class="scope-tag">OBJECT</span>
          <code>${layer.layer.kind}</code>
          <span>one shared pass</span>
        </div>
      `;
    }).join('');
  }
}

function updateReadout (): void {
  const plan = richText?.getRenderPlan();

  if (!plan) {
    return;
  }

  const { padding, renderSize } = plan.geometry;

  updateScopeMap(plan);

  if (glyphCount) {
    glyphCount.textContent = String(plan.glyphs.length);
  }
  if (rangeCount) {
    rangeCount.textContent = String(plan.rangePlans.length);
  }
  if (paddingReadout) {
    paddingReadout.textContent = `${padding.left}px / ${padding.top}px`;
  }
  if (surfaceReadout) {
    surfaceReadout.textContent = `${renderSize.width} × ${renderSize.height}`;
  }
}

function updateLabels (): void {
  for (const definition of rangeDefinitions) {
    const controls = rangeControls[definition.sourceRangeId];

    if (controls.strokeValue) {controls.strokeValue.textContent = `${getValue(controls.stroke, 0)}px`;}
    if (controls.shadowValue) {controls.shadowValue.textContent = `${getValue(controls.shadow, 0)}px`;}
  }
  if (glowValue) {glowValue.textContent = `${getValue(glowInput, 0)}px`;}
}

function refresh (): void {
  if (!richText) {
    return;
  }

  richText.updateWithOptions(createFancyOptions(currentPalette));
  richText.setOverflow(spec.TextOverflow.display);
  richText.onUpdate(0);
  renderComposition?.();
  updateLabels();
  updateReadout();
}

async function main (): Promise<void> {
  if (!container) {
    throw new Error('RichText demo container was not found.');
  }

  applyPresetValues(currentPalette);

  const player = new Player({ container, manualRender: true });
  const composition = await player.loadScene(sceneUrl, {
    autoplay: false,
    variables: { richText_1: textInput?.value ?? '' },
  });

  composition.gotoAndStop(0);

  renderComposition = () => composition.render();
  richText = composition.getItemByName('richText_1')?.getComponent(RichTextComponent);

  if (richText) {
    Reflect.set(window, '__richTextDemo', richText);
  }

  if (!richText) {
    throw new Error('RichTextComponent was not found in the demo scene.');
  }

  // The scene starts with a plain RichText component. Rebuild its options so
  // the live object uses the same RenderPlan path exposed in the inspector.
  richText.updateWithOptions(createFancyOptions(currentPalette));
  richText.setOverflow(spec.TextOverflow.display);
  richText.onUpdate(0);
  renderComposition?.();
  updateLabels();
  updateReadout();
  if (status) {
    status.textContent = 'render plan online';
  }

  for (const definition of rangeDefinitions) {
    const controls = rangeControls[definition.sourceRangeId];

    controls.stroke?.addEventListener('input', refresh);
    controls.shadow?.addEventListener('input', refresh);
  }
  glowInput?.addEventListener('input', refresh);
  textInput?.addEventListener('input', refresh);
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const paletteName = button.dataset.preset as PaletteName;

      if (!palettes[paletteName]) {
        return;
      }
      currentPalette = paletteName;
      applyPresetValues(currentPalette);
      document.querySelectorAll('[data-preset]').forEach(item => item.setAttribute('data-active', String(item === button)));
      refresh();
    });
  });
}

main().catch(error => {
  if (status) {status.textContent = 'render failed';}
  console.error('[RichText RenderPlan Demo]', error);
});
