import type { BaseLayout } from '../base-layout';
import type { TextStyle } from '../text-style';
import type { TextLayerDrawer } from './fancy-types';
import { renderWithTextLayers } from './render-with-text-layers';
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

/**
 * First Canvas compatibility backend for TextRenderPlan.
 *
 * The plan is the new boundary, while the actual drawing is temporarily
 * delegated to the legacy drawer pipeline. A later coordinator can consume
 * range/object plans directly without changing TextRenderBackend callers.
 */
export class CanvasTextBackend implements TextRenderBackend<TextRenderTarget> {
  constructor (private readonly options: CanvasTextBackendOptions) {}

  render (plan: TextRenderPlan, target: TextRenderTarget): void {
    renderWithTextLayers(
      target.canvas,
      target.context,
      this.options.style,
      this.options.layout,
      planToLegacyCharInfo(plan),
      this.options.legacyLayerDrawers,
    );
  }
}
