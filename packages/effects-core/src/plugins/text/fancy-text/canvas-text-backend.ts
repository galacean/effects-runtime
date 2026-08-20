import type { BaseLayout } from '../base-layout';
import type { TextStyle } from '../text-style';
import type { TextLayerDrawer } from './fancy-types';
import { renderWithTextLayers } from './render-with-text-layers';
import { CanvasTextRenderBackend } from './canvas-text-render-backend';
import { planToLegacyCharInfo, type TextRenderBackend, type TextRenderPlan } from './text-render-plan';

export interface TextRenderTarget {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
}

export interface CanvasTextBackendOptions {
  style: TextStyle,
  layout: BaseLayout,
  legacyLayerDrawers: TextLayerDrawer[],
}

/** RTL/连写字行：旧流水线整行 direction=rtl 绘制以保证字形连接，plan 逐字后端暂不覆盖。 */
const HAS_RTL_OR_JOINING = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function planHasRtlLine (plan: TextRenderPlan): boolean {
  return plan.lines.some(line => {
    const text = line.glyphIds.map(glyphId => plan.glyphs[glyphId]?.glyph ?? '').join('');

    return text.length > 0 && HAS_RTL_OR_JOINING.test(text);
  });
}

/**
 * 普通文本 Canvas 后端：优先走与富文本统一的 plan 执行（CanvasTextRenderBackend），
 * RTL/连写行回退到 legacy drawer 流水线，避免统一后丢字形连接。
 */
export class CanvasTextBackend implements TextRenderBackend<TextRenderTarget> {
  private readonly planBackend: CanvasTextRenderBackend;

  constructor (private readonly options: CanvasTextBackendOptions) {
    this.planBackend = new CanvasTextRenderBackend({
      textStyle: options.style,
      layers: options.style.fancyRenderStyle.layers,
    });
  }

  render (plan: TextRenderPlan, target: TextRenderTarget): void {
    if (planHasRtlLine(plan)) {
      renderWithTextLayers(
        target.canvas,
        target.context,
        this.options.style,
        this.options.layout,
        planToLegacyCharInfo(plan),
        this.options.legacyLayerDrawers,
      );

      return;
    }

    this.planBackend.render(plan, target.context);
  }
}
