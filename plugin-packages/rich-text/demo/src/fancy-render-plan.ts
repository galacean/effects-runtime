import { Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const sceneUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const status = document.getElementById('status');
const textInput = document.getElementById('text') as HTMLTextAreaElement | null;
const strokeInput = document.getElementById('stroke') as HTMLInputElement | null;
const shadowInput = document.getElementById('shadow') as HTMLInputElement | null;
const glowInput = document.getElementById('glow') as HTMLInputElement | null;
const strokeValue = document.getElementById('stroke-value');
const shadowValue = document.getElementById('shadow-value');
const glowValue = document.getElementById('glow-value');
const glyphCount = document.getElementById('glyph-count');
const rangeCount = document.getElementById('range-count');
const paddingReadout = document.getElementById('padding-readout');
const surfaceReadout = document.getElementById('surface-readout');
const rangeList = document.getElementById('range-list');
const objectList = document.getElementById('object-list');

const palettes = {
  mint: {
    colors: ['#75f0c7ff', '#8a7dffff', '#ffbd69ff'],
    stroke: [0.08, 0.11, 0.16, 1],
    glow: [0.25, 1, 0.78, 0.78],
    shadow: [0, 0, 0, 0.72],
  },
  sunset: {
    colors: ['#ff795fff', '#ffbd69ff', '#ffe6b8ff'],
    stroke: [0.18, 0.06, 0.04, 1],
    glow: [1, 0.28, 0.16, 0.72],
    shadow: [0.06, 0.01, 0, 0.78],
  },
  mono: {
    colors: ['#f5f7fbff', '#b9c4d6ff', '#75f0c7ff'],
    stroke: [0.03, 0.06, 0.09, 1],
    glow: [0.28, 0.72, 1, 0.7],
    shadow: [0, 0, 0, 0.85],
  },
} as const;

type PaletteName = keyof typeof palettes;
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

function createFancyOptions (paletteName: PaletteName) {
  const palette = palettes[paletteName];
  const colors = palette.colors.map(hexToRgba);
  const strokeWidth = getValue(strokeInput, 4);
  const shadowBlur = getValue(shadowInput, 9);
  const glowBlur = getValue(glowInput, 16);

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
    fancyConfig: {
      presetName: `rich-text-${paletteName}`,
      layers: [
        {
          kind: 'single-stroke' as const,
          category: 'base' as const,
          params: { color: palette.stroke, width: strokeWidth, unit: 'px' as const },
          decorations: [
            {
              kind: 'shadow' as const,
              category: 'decorative' as const,
              params: { color: palette.shadow, blur: shadowBlur, offsetX: 4, offsetY: 7 },
            },
            {
              kind: 'glow' as const,
              category: 'decorative' as const,
              params: { color: palette.glow, blur: glowBlur, intensity: 1 },
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

function updateScopeMap (plan: NonNullable<ReturnType<RichTextComponent['getRenderPlan']>>): void {
  if (rangeList) {
    rangeList.innerHTML = plan.rangePlans.map(range => `
      <div class="scope-row">
        <span class="scope-dot" style="background:${colorToHex(range.basicStyle.fillColor)}"></span>
        <code>${range.sourceRangeId}</code>
        <span>${range.glyphIds.length} glyphs · ${range.layers.map(layer => layer.layer.kind).join(' · ')}</span>
      </div>
    `).join('');
  }

  if (objectList) {
    objectList.innerHTML = plan.objectPlan.layers.map(layer => `
      <div class="scope-row object-row">
        <span class="scope-tag">OBJECT</span>
        <code>${layer.layer.kind}</code>
        <span>one shared pass</span>
      </div>
    `).join('');
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
  if (strokeValue) {strokeValue.textContent = `${getValue(strokeInput, 4)}px`;}
  if (shadowValue) {shadowValue.textContent = `${getValue(shadowInput, 9)}px`;}
  if (glowValue) {glowValue.textContent = `${getValue(glowInput, 16)}px`;}
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

  [strokeInput, shadowInput, glowInput].forEach(input => input?.addEventListener('input', refresh));
  textInput?.addEventListener('input', refresh);
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => {
    button.addEventListener('click', () => {
      currentPalette = button.dataset.preset as PaletteName;
      document.querySelectorAll('[data-preset]').forEach(item => item.setAttribute('data-active', String(item === button)));
      refresh();
    });
  });
}

main().catch(error => {
  if (status) {status.textContent = 'render failed';}
  console.error('[RichText RenderPlan Demo]', error);
});
