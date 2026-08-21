import type { FancyRenderLayer } from '@galacean/effects-core';
import {
  buildTextRenderPlanFromCharInfo,
  CanvasTextBackend,
  TextLayout,
  TextStyle,
} from '@galacean/effects-core';
import type { CharInfo } from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/text-render-plan', () => {
  const layers: FancyRenderLayer[] = [
    {
      kind: 'shadow',
      category: 'decorative',
      params: { color: [0, 0, 0, 1], blur: 4, offsetX: 2, offsetY: 2 },
    },
    {
      kind: 'single-stroke',
      category: 'base',
      params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
    },
    {
      kind: 'solid-fill',
      category: 'base',
      params: { color: [1, 1, 1, 1] },
    },
    {
      kind: 'glow',
      category: 'decorative',
      params: { color: [0, 1, 1, 1], blur: 6, intensity: 2 },
    },
  ];

  const charsInfo: CharInfo[] = [
    { y: 20, width: 0, chars: [], charOffsetX: [] },
    { y: 50, width: 24, chars: ['A', 'B'], charOffsetX: [0, 12] },
  ];

  it('builds a one-range plan and preserves empty layout lines', () => {
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, layers, {
      fontRef: '24px Arial',
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    expect(plan.glyphs).to.have.length(2);
    expect(plan.glyphs[0]).to.include({ glyph: 'A', x: 0, y: 50, lineId: 1, sourceRangeId: 'text' });
    expect(plan.glyphs[1]).to.include({ glyph: 'B', x: 12, y: 50, lineId: 1, sourceRangeId: 'text' });
    expect(plan.lines).to.have.length(2);
    expect(plan.lines[0]).to.include({ lineId: 0, baselineY: 20, width: 0 });
    expect(plan.rangePlans).to.have.length(1);
    expect(plan.rangePlans[0].glyphIds).to.eql([0, 1]);
    expect(plan.rangePlans[0].layers.map(item => item.layer.kind)).to.eql([
      'shadow',
      'single-stroke',
      'solid-fill',
    ]);
    expect(plan.objectPlan.layers.map(item => item.layer.kind)).to.eql(['glow']);
    expect(plan.geometry.contentBounds).to.be.undefined;
    expect(plan.geometry.logicalSize).to.eql({ width: 100, height: 60 });
    expect(plan.geometry.renderSize).to.eql({ width: 200, height: 120 });
  });

  it('mirrors the fill color into the range basicStyle so plain text honors it like RichText', () => {
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, layers, {
      fontRef: '24px Arial',
      fillColor: [1, 0, 1, 1],
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    expect(plan.rangePlans).to.have.length(1);
    expect(plan.rangePlans[0].basicStyle).to.have.property('fillColor');
    expect(plan.rangePlans[0].basicStyle.fillColor).to.eql([1, 0, 1, 1]);
  });

  it('falls back to a plain-text fill when the theme layers carry no per-range fill color', () => {
    const layersWithoutFill: FancyRenderLayer[] = [
      { kind: 'single-stroke', category: 'base', params: { color: [1, 0, 0, 1], width: 2, unit: 'px' } },
    ];
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, layersWithoutFill, {
      fontRef: '24px Arial',
      fillColor: [1, 1, 1, 1],
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    // basicStyle.fillColor carries the plain-text color; the backend still
    // renders a visible fill even though no solid-fill layer is present in the
    // theme (the unified backend uses textColor as the final fallback).
    expect(plan.rangePlans[0].basicStyle.fillColor).to.eql([1, 1, 1, 1]);
  });

  it('renders a one-range plan through the unified Canvas backend', () => {
    const style = new TextStyle({ text: 'AB', fontSize: 24, fontFamily: 'Arial' });
    const layout = new TextLayout({ text: 'AB', fontSize: 24, textWidth: 100, textHeight: 60 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, layers, { fontRef: style.fontDesc });
    const backend = new CanvasTextBackend({ style, layout, legacyLayerDrawers: [] });

    canvas.width = 200;
    canvas.height = 120;
    context.scale(2, 2);
    backend.render(plan, { canvas, context });

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        nonTransparent++;
      }
    }
    expect(nonTransparent).to.be.greaterThan(0);
  });
});
