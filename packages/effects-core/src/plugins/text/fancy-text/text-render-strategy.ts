import type { TextRenderBackend, TextRenderPlan } from './text-render-plan';

/**
 * Per-adapter execution seam. Canvas and MSDF may have different target and
 * result types; the common contract is intentionally limited to plan
 * consumption and capability checking. A cross-backend coordinator should be
 * introduced only with a common binding/host contract.
 */
export interface TextRenderStrategy<TTarget, TResult = void> extends TextRenderBackend<TTarget, TResult> {
  readonly mode: string,
  canRender(plan: TextRenderPlan, target: TTarget): boolean,
}
