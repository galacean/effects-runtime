import { TextStyle, type FancyRenderLayer, spec } from '@galacean/effects';
import { RichTextLayout } from '../../src/rich-text-layout';
import { RichWrapEnabledStrategy } from '../../src/strategies/wrap/rich-wrap-enabled';
import {
  buildRichTextRenderPlan,
  CanvasRichTextFillBackend,
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
