import type { FancyRenderLayer } from '@galacean/effects-core';
import {
  buildTextRenderPlanFromCharInfo,
  CanvasTextBackend,
  TextLayout,
  TextStyle,
  createTextFont,
  compileTextEffectPlan,
  FANCY_LAYER_CAPABILITIES,
  getFancyLayerCapability,
  isObjectFancyLayer,
  spec,
} from '@galacean/effects-core';
import type { TextLineInput } from '@galacean/effects-core';

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

  const charsInfo: TextLineInput[] = [
    { y: 20, width: 0, chars: [], charOffsetX: [] },
    { y: 50, width: 24, chars: ['A', 'B'], charOffsetX: [0, 12] },
  ];

  it('uses one capability table for layer semantics and object classification', () => {
    const expectedScopes = {
      shadow: 'range',
      glow: 'object',
      'single-stroke': 'range',
      'solid-fill': 'range',
      gradient: 'object',
      texture: 'object',
    } as const;

    expect(Object.keys(FANCY_LAYER_CAPABILITIES).sort()).to.eql(Object.keys(expectedScopes).sort());

    for (const [kind, isolation] of Object.entries(expectedScopes)) {
      const layer = { kind } as FancyRenderLayer;

      expect(getFancyLayerCapability(layer).isolation).to.eql(isolation);
      expect(isObjectFancyLayer(layer)).to.eql(isolation === 'object');
    }
  });

  it('builds a one-range plan and preserves empty layout lines', () => {
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, {
      effectPlan: compileTextEffectPlan({ defaultLayers: layers }),
      font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }),
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    expect(plan.glyphs).to.have.length(2);
    expect(plan.glyphs[0]).to.include({ glyphId: 'A', x: 0, y: 50, lineId: 1, sourceRangeId: 'text' });
    expect(plan.glyphs[1]).to.include({ glyphId: 'B', x: 12, y: 50, lineId: 1, sourceRangeId: 'text' });
    expect(plan.lines).to.have.length(2);
    expect(plan.lines[0]).to.include({ lineId: 0, baselineY: 20, width: 0 });
    expect(plan.rangePlans).to.have.length(1);
    expect(plan.rangePlans[0].glyphIds).to.eql([0, 1]);
    expect(plan.effects.defaultRangeLayers.map(item => item.layer.kind)).to.eql([
      'shadow',
      'single-stroke',
      'solid-fill',
    ]);
    expect(plan.effects.defaultRangeLayers.map(({ source, composite, isolation }) => ({ source, composite, isolation }))).to.eql([
      { source: 'fill-and-stroke-mask', composite: 'behind-content', isolation: 'range' },
      { source: 'glyph', composite: 'content', isolation: 'range' },
      { source: 'glyph', composite: 'content', isolation: 'range' },
    ]);
    expect(plan.effects.objectLayers.map(item => item.layer.kind)).to.eql(['glow']);
    expect(plan.effects.objectLayers[0]).to.include({
      source: 'object-fill-mask',
      composite: 'behind-content',
      isolation: 'object',
    });
    expect(plan.geometry.contentBounds).to.be.undefined;
    expect(plan.geometry.logicalSize).to.eql({ width: 100, height: 60 });
    expect(plan.geometry.renderSize).to.eql({ width: 200, height: 120 });
  });

  it('mirrors the fill color into the range basicStyle so plain text honors it like RichText', () => {
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, {
      effectPlan: compileTextEffectPlan({ defaultLayers: layers }),
      font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }),
      fillColor: [1, 0, 1, 1],
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    expect(plan.rangePlans).to.have.length(1);
    expect(plan.rangePlans[0].basicStyle).to.have.property('fillColor');
    expect(plan.rangePlans[0].basicStyle.fillColor).to.eql([1, 0, 1, 1]);
  });

  it('keeps a whole RTL line as one Canvas paint segment without replacing glyph metadata', () => {
    const plan = buildTextRenderPlanFromCharInfo([
      { y: 30, width: 80, chars: ['م', 'ر', 'ح', 'ب', 'ا'], charOffsetX: [0, 16, 32, 48, 64] },
    ], {
      effectPlan: compileTextEffectPlan({ defaultLayers: layers }),
      font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }),
      shapingRuns: [{
        text: 'مرحبا',
        x: 80,
        y: 30,
        lineId: 0,
        sourceRangeId: 'text',
        fontId: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }).id,
        direction: 'rtl',
      }],
    });

    expect(plan.glyphs).to.have.length(5);
    expect(plan.shapingRuns).to.have.length(1);
    expect(plan.shapingRuns?.[0]).to.include({ text: 'مرحبا', direction: 'rtl', x: 80, y: 30 });
    expect(plan.rangePlans[0].drawUnits).to.eql([{ kind: 'run', runId: 0 }]);
  });

  it('renders an RTL paint segment through the shared Canvas backend', () => {
    const plan = buildTextRenderPlanFromCharInfo([
      { y: 30, width: 80, chars: ['م', 'ر', 'ح', 'ب', 'ا'], charOffsetX: [0, 16, 32, 48, 64] },
    ], {
      effectPlan: compileTextEffectPlan({ defaultLayers: [{ kind: 'solid-fill', category: 'base', params: { color: [1, 1, 1, 1] } }] }),
      font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }),
      shapingRuns: [{
        text: 'مرحبا',
        x: 80,
        y: 30,
        lineId: 0,
        sourceRangeId: 'text',
        fontId: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }).id,
        direction: 'rtl',
      }],
    });
    const canvas = document.createElement('canvas');

    canvas.width = 120;
    canvas.height = 60;
    const context = canvas.getContext('2d')!;

    new CanvasTextBackend({ textureLayers: layers }).render(plan, { canvas, context });

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const visiblePixels = Array.from(pixels).filter((value, index) => index % 4 === 3 && value > 0).length;

    expect(visiblePixels).to.be.greaterThan(0);
  });

  it('falls back to a plain-text fill when the theme layers carry no per-range fill color', () => {
    const layersWithoutFill: FancyRenderLayer[] = [
      { kind: 'single-stroke', category: 'base', params: { color: [1, 0, 0, 1], width: 2, unit: 'px' } },
    ];
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, {
      effectPlan: compileTextEffectPlan({ defaultLayers: layersWithoutFill }),
      font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }),
      fillColor: [1, 1, 1, 1],
      logicalSize: { width: 100, height: 60 },
      renderSize: { width: 200, height: 120 },
    });

    // basicStyle.fillColor 保存普通文本颜色；即使主题层中没有 solid-fill，
    // 后端仍然会绘制可见填充（统一后端最终会使用 textColor 作为兜底颜色）。
    expect(plan.rangePlans[0].basicStyle.fillColor).to.eql([1, 1, 1, 1]);
  });

  it('renders a one-range plan through the unified Canvas backend', () => {
    const style = new TextStyle({ text: 'AB', fontSize: 24, fontFamily: 'Arial' });
    const layout = new TextLayout({ text: 'AB', fontSize: 24, textWidth: 100, textHeight: 60 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const plan = buildTextRenderPlanFromCharInfo(charsInfo, {
      effectPlan: compileTextEffectPlan({ defaultLayers: layers }), font: createTextFont({ family: 'Arial', size: 24, weight: spec.TextWeight.normal, style: spec.FontStyle.normal }) });
    const backend = new CanvasTextBackend({ textureLayers: layers });

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
