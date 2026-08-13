import { TextStyle, type FancyRenderLayer, spec } from '@galacean/effects';
import { RichTextLayout } from '../../src/rich-text-layout';
import { RichWrapEnabledStrategy } from '../../src/strategies/wrap/rich-wrap-enabled';
import {
  buildRichTextRenderPlan,
  CanvasRichTextFancyBackend,
  CanvasRichTextFillBackend,
  calculateTextEffectPadding,
  parseRichTextOptions,
} from '@galacean/effects-plugin-rich-text';
import type {
  HorizontalAlignResult,
  OverflowResult,
  VerticalAlignResult,
  WrapResult,
} from '../../src/strategies/rich-text-interfaces';

const { expect } = chai;

describe('rich-text/render-plan', () => {
  const textStyle = new TextStyle({
    text: '',
    fontSize: 20,
    fontFamily: 'Arial',
    fontWeight: spec.TextWeight.normal,
    fontStyle: spec.FontStyle.normal,
    textColor: [10, 20, 30, 1],
  });

  it('keeps the parser range id stable when one source range is split by newlines', () => {
    const options = parseRichTextOptions(
      '<color=#ff0000ff>AB\nCD</color><b>E</b>',
      textStyle,
    );

    expect(options).to.have.length(3);
    expect(options.map(item => item.sourceRangeId)).to.eql(['range-0', 'range-0', 'range-1']);
    expect(options.map(item => item.isNewLine)).to.eql([false, true, false]);
    expect(options[0].fontColor).to.eql([255, 0, 0, 1]);
    expect(options[2].fontWeight).to.equal(spec.TextWeight.bold);
  });

  it('preserves the source range id after automatic wrapping', () => {
    const options = parseRichTextOptions('<color=#ff0000ff>ABCD</color>', textStyle);
    const context = document.createElement('canvas').getContext('2d')!;
    const layout = new RichTextLayout({
      text: '',
      fontSize: 20,
      lineHeight: 24,
      wrapEnabled: true,
      maxTextWidth: 45,
    });

    context.measureText = () => ({
      width: 10,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    } as TextMetrics);

    const result = new RichWrapEnabledStrategy().computeLines(options, context, textStyle, layout, 0);

    expect(result.lines).to.have.length(2);
    expect(result.lines.map(line => line.richOptions[0].sourceRangeId)).to.eql(['range-0', 'range-0']);
    expect(result.lines.map(line => line.chars[0].map(char => char.char).join(''))).to.eql(['AB', 'CD']);
  });

  it('builds positioned glyphs and range styles from wrapped RichText output', () => {
    const options = parseRichTextOptions(
      '<color=#ff0000ff>AB\nCD</color><b>E</b>',
      textStyle,
    );
    const wrapResult: WrapResult = {
      lines: [
        {
          richOptions: [options[0]],
          offsetX: [0],
          width: 20,
          lineHeight: 30,
          offsetY: 0,
          chars: [[{ char: 'A', x: 0 }, { char: 'B', x: 10 }]],
        },
        {
          richOptions: [options[1], options[2]],
          offsetX: [0, 20],
          width: 30,
          lineHeight: 30,
          offsetY: 0,
          chars: [
            [{ char: 'C', x: 0 }, { char: 'D', x: 10 }],
            [{ char: 'E', x: 0 }],
          ],
        },
      ],
      maxLineWidth: 30,
      totalHeight: 60,
      bboxTop: -18,
      bboxBottom: 42,
      bboxHeight: 60,
    };
    const horizontalAlignResult: HorizontalAlignResult = { lineOffsets: [5, 10] };
    const verticalAlignResult: VerticalAlignResult = { baselineY: 20, lineYOffsets: [0, 30] };
    const overflowResult: OverflowResult = {
      canvasWidth: 100,
      canvasHeight: 80,
      renderOffsetX: 2,
      renderOffsetY: 3,
    };
    const layers: FancyRenderLayer[] = [
      {
        kind: 'shadow',
        category: 'decorative',
        params: { color: [0, 0, 0, 1], blur: 4, offsetX: 1, offsetY: 2 },
      },
      {
        kind: 'glow',
        category: 'decorative',
        params: { color: [0, 1, 1, 1], blur: 6, intensity: 2 },
      },
    ];

    const plan = buildRichTextRenderPlan({
      textStyle,
      wrapResult,
      horizontalAlignResult,
      verticalAlignResult,
      overflowResult,
      layers,
    });

    expect(plan.glyphs.map(glyph => glyph.sourceRangeId)).to.eql([
      'range-0', 'range-0', 'range-0', 'range-0', 'range-1',
    ]);
    expect(plan.glyphs.map(glyph => [glyph.glyph, glyph.x, glyph.y])).to.eql([
      ['A', 7, 23], ['B', 17, 23], ['C', 12, 53], ['D', 22, 53], ['E', 32, 53],
    ]);
    expect(plan.rangePlans).to.have.length(2);
    expect(plan.rangePlans[0].glyphIds).to.eql([0, 1, 2, 3]);
    expect(plan.rangePlans[0].basicStyle.fillColor).to.eql([255, 0, 0, 1]);
    expect(plan.rangePlans[0].layers.map(layer => layer.layer.kind)).to.eql(['shadow']);
    expect(plan.rangePlans[1].basicStyle.fontRef).to.equal('normal bold 20px Arial');
    expect(plan.objectPlan.layers.map(layer => layer.layer.kind)).to.eql(['glow']);
    expect(plan.geometry.contentBounds).to.eql({ x: 7, y: 5, width: 35, height: 60 });
  });

  it('assigns independent range layers and keeps unmapped ranges on the shared plan', () => {
    const sharedLayers: FancyRenderLayer[] = [
      {
        kind: 'single-stroke',
        category: 'base',
        params: { color: [0, 0, 0, 1], width: 1, unit: 'px' },
      },
      {
        kind: 'shadow',
        category: 'decorative',
        params: { color: [0, 0, 0, 1], blur: 2, offsetX: 1, offsetY: 1 },
      },
      {
        kind: 'solid-fill',
        category: 'base',
        params: { color: [1, 1, 1, 1] },
      },
    ];
    const rangeLayers = {
      'range-0': [
        {
          kind: 'single-stroke' as const,
          category: 'base' as const,
          params: { color: [1, 0, 0, 1] as spec.vec4, width: 7, unit: 'px' as const },
        },
        {
          kind: 'shadow' as const,
          category: 'decorative' as const,
          params: { color: [1, 0, 0, 1] as spec.vec4, blur: 13, offsetX: 3, offsetY: 5 },
        },
        {
          kind: 'solid-fill' as const,
          category: 'base' as const,
          params: { color: [1, 1, 1, 1] as spec.vec4 },
        },
      ],
      'range-2': [
        {
          kind: 'single-stroke' as const,
          category: 'base' as const,
          params: { color: [0, 0, 1, 1] as spec.vec4, width: 3, unit: 'px' as const },
        },
        {
          kind: 'shadow' as const,
          category: 'decorative' as const,
          params: { color: [0, 0, 1, 1] as spec.vec4, blur: 4, offsetX: -2, offsetY: 2 },
        },
        {
          kind: 'solid-fill' as const,
          category: 'base' as const,
          params: { color: [1, 1, 1, 1] as spec.vec4 },
        },
      ],
    };
    const options = parseRichTextOptions(
      '<color=#ff0000ff>A</color>B<color=#0000ffff>C</color>',
      textStyle,
      rangeLayers,
    );
    const plan = buildRichTextRenderPlan({
      textStyle,
      wrapResult: {
        lines: [{
          richOptions: options,
          offsetX: [0, 10, 20],
          width: 30,
          lineHeight: 20,
          offsetY: 0,
          chars: [[{ char: 'A', x: 0 }], [{ char: 'B', x: 0 }], [{ char: 'C', x: 0 }]],
        }],
        maxLineWidth: 30,
        totalHeight: 20,
        bboxTop: -15,
        bboxBottom: 5,
        bboxHeight: 20,
      },
      horizontalAlignResult: { lineOffsets: [0] },
      verticalAlignResult: { baselineY: 20, lineYOffsets: [0] },
      overflowResult: { canvasWidth: 30, canvasHeight: 20, renderOffsetX: 0, renderOffsetY: 0 },
      layers: sharedLayers,
    });

    const getLayer = (sourceRangeId: string, kind: 'single-stroke' | 'shadow') => {
      const range = plan.rangePlans.find(item => item.sourceRangeId === sourceRangeId);
      const layer = range?.layers.find(item => item.layer.kind === kind);

      return layer;
    };

    expect(getLayer('range-0', 'single-stroke')?.layer).to.have.property('params').that.deep.includes({ width: 7 });
    expect(getLayer('range-0', 'shadow')?.layer).to.have.property('params').that.deep.includes({ blur: 13 });
    expect(getLayer('range-2', 'single-stroke')?.layer).to.have.property('params').that.deep.includes({ width: 3 });
    expect(getLayer('range-2', 'shadow')?.layer).to.have.property('params').that.deep.includes({ blur: 4 });
    expect(getLayer('range-1', 'single-stroke')?.layer).to.have.property('params').that.deep.includes({ width: 1 });
    expect(getLayer('range-1', 'shadow')?.layer).to.have.property('params').that.deep.includes({ blur: 2 });
    expect(getLayer('range-0', 'single-stroke')?.layerId).to.not.equal(getLayer('range-2', 'single-stroke')?.layerId);
  });

  it('computes padding from range and object fancy layers', () => {
    const style = new TextStyle({ text: '', fontSize: 20, fontFamily: 'Arial' });

    style.fancyRenderStyle = {
      layers: [
        {
          kind: 'single-stroke',
          category: 'base',
          params: { color: [1, 1, 1, 1], width: 3, unit: 'px' },
        },
        {
          kind: 'shadow',
          category: 'decorative',
          params: { color: [0, 0, 0, 1], blur: 4, offsetX: 2, offsetY: 2 },
        },
        {
          kind: 'glow',
          category: 'decorative',
          params: { color: [0, 1, 1, 1], blur: 6, intensity: 2 },
        },
      ],
    };

    expect(calculateTextEffectPadding(style)).to.eql({
      left: 23,
      right: 23,
      top: 23,
      bottom: 23,
    });

    expect(calculateTextEffectPadding(style, {
      'range-0': [{
        kind: 'single-stroke',
        category: 'base',
        params: { color: [1, 1, 1, 1], width: 9, unit: 'px' },
      }, {
        kind: 'shadow',
        category: 'decorative',
        params: { color: [0, 0, 0, 1], blur: 18, offsetX: 3, offsetY: 4 },
      }],
    })).to.eql({
      left: 46,
      right: 46,
      top: 46,
      bottom: 46,
    });
  });

  it('composites a range shadow from only that range\'s glyph source', () => {
    const makeRangeLayers = (blur: number, color: spec.vec4): FancyRenderLayer[] => [
      {
        kind: 'single-stroke',
        category: 'base',
        params: { color, width: 1, unit: 'px' },
      },
      {
        kind: 'shadow',
        category: 'decorative',
        params: { color, blur, offsetX: 2, offsetY: 2 },
      },
      {
        kind: 'solid-fill',
        category: 'base',
        params: { color },
      },
    ];
    const makePlan = (firstRangeBlur: number): ReturnType<typeof buildRichTextRenderPlan> => {
      const rangeLayers = {
        'range-0': makeRangeLayers(firstRangeBlur, [1, 0, 0, 1]),
        'range-1': makeRangeLayers(3, [0, 0, 1, 1]),
      };
      const options = parseRichTextOptions(
        '<color=#ff0000ff>A</color><color=#0000ffff>B</color>',
        textStyle,
        rangeLayers,
      );

      return buildRichTextRenderPlan({
        textStyle,
        wrapResult: {
          lines: [{
            richOptions: options,
            offsetX: [0, 0],
            width: 90,
            lineHeight: 30,
            offsetY: 0,
            chars: [[{ char: 'A', x: 10 }], [{ char: 'B', x: 65 }]],
          }],
          maxLineWidth: 90,
          totalHeight: 30,
          bboxTop: -24,
          bboxBottom: 6,
          bboxHeight: 30,
        },
        horizontalAlignResult: { lineOffsets: [0] },
        verticalAlignResult: { baselineY: 30, lineYOffsets: [0] },
        overflowResult: { canvasWidth: 100, canvasHeight: 50, renderOffsetX: 0, renderOffsetY: 0 },
        layers: [],
      });
    };
    const render = (plan: ReturnType<typeof buildRichTextRenderPlan>): Uint8ClampedArray => {
      const canvas = document.createElement('canvas');

      canvas.width = 100;
      canvas.height = 50;
      const context = canvas.getContext('2d')!;

      new CanvasRichTextFancyBackend({ textStyle, layers: [] }).render(plan, context);

      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const before = render(makePlan(1));
    const after = render(makePlan(16));
    let changedPixelsOutsideFirstRange = 0;

    for (let y = 0; y < 50; y++) {
      for (let x = 45; x < 100; x++) {
        const offset = (y * 100 + x) * 4;

        if (before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1] || before[offset + 2] !== after[offset + 2] || before[offset + 3] !== after[offset + 3]) {
          changedPixelsOutsideFirstRange++;
        }
      }
    }

    expect(changedPixelsOutsideFirstRange).to.equal(0);
  });

  it('renders range fill/stroke and object glow on the Canvas backend', () => {
    const options = parseRichTextOptions('<color=#ff0000ff>A</color>', textStyle);
    const layers: FancyRenderLayer[] = [
      {
        kind: 'single-stroke',
        category: 'base',
        params: { color: [0, 0, 0, 1], width: 2, unit: 'px' },
      },
      {
        kind: 'solid-fill',
        category: 'base',
        params: { color: [1, 1, 1, 1] },
      },
      {
        kind: 'glow',
        category: 'decorative',
        params: { color: [0, 1, 1, 1], blur: 4, intensity: 1 },
      },
    ];
    const plan = buildRichTextRenderPlan({
      textStyle,
      wrapResult: {
        lines: [{
          richOptions: options,
          offsetX: [0],
          width: 20,
          lineHeight: 20,
          offsetY: 0,
          chars: [[{ char: 'A', x: 0 }]],
        }],
        maxLineWidth: 20,
        totalHeight: 20,
        bboxTop: -15,
        bboxBottom: 5,
        bboxHeight: 20,
      },
      horizontalAlignResult: { lineOffsets: [0] },
      verticalAlignResult: { baselineY: 20, lineYOffsets: [0] },
      overflowResult: { canvasWidth: 80, canvasHeight: 50, renderOffsetX: 0, renderOffsetY: 0 },
      layers,
    });
    const canvas = document.createElement('canvas');

    canvas.width = 80;
    canvas.height = 50;
    const context = canvas.getContext('2d')!;

    new CanvasRichTextFancyBackend({ textStyle, layers }).render(plan, context);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const visiblePixels = Array.from(pixels).filter((value, index) => index % 4 === 3 && value > 0).length;

    expect(visiblePixels).to.be.greaterThan(0);
  });

  it('renders the normalized glyph stream with the style resolved for each range', () => {
    const options = parseRichTextOptions('<color=#ff0000ff>A</color><b>B</b>', textStyle);
    const plan = buildRichTextRenderPlan({
      textStyle,
      wrapResult: {
        lines: [{
          richOptions: options,
          offsetX: [0, 10],
          width: 20,
          lineHeight: 20,
          offsetY: 0,
          chars: [[{ char: 'A', x: 0 }], [{ char: 'B', x: 0 }]],
        }],
        maxLineWidth: 20,
        totalHeight: 20,
        bboxTop: -15,
        bboxBottom: 5,
        bboxHeight: 20,
      },
      horizontalAlignResult: { lineOffsets: [0] },
      verticalAlignResult: { baselineY: 20, lineYOffsets: [0] },
      overflowResult: { canvasWidth: 20, canvasHeight: 20, renderOffsetX: 0, renderOffsetY: 0 },
    });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const calls: Array<{ text: string, font: string, fillStyle: string }> = [];

    context.fillText = text => {
      calls.push({ text, font: context.font, fillStyle: String(context.fillStyle) });
    };

    new CanvasRichTextFillBackend().render(plan, context);

    expect(calls).to.eql([
      { text: 'A', font: '20px Arial', fillStyle: '#ff0000' },
      { text: 'B', font: 'bold 20px Arial', fillStyle: '#000000' },
    ]);
  });
});
