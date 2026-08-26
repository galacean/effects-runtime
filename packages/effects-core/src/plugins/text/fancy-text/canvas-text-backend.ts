import { CanvasTextRenderBackend } from './canvas-text-render-backend';
import type { FancyRenderLayer } from './fancy-types';
import type { TextRenderBackend, TextRenderPlan } from './text-render-plan';

export interface TextRenderTarget {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
}

export interface CanvasTextBackendOptions {
  textureLayers: FancyRenderLayer[],
}

/**
 * Ordinary-text adapter for the shared Canvas fancy backend.
 *
 * Layout supplies the paint units in TextRenderPlan. The backend owns only
 * layer execution; it does not inspect text direction or fall back to a
 * second drawer pipeline.
 */
export class CanvasTextBackend implements TextRenderBackend<TextRenderTarget> {
  private readonly planBackend: CanvasTextRenderBackend;

  constructor (options: CanvasTextBackendOptions) {
    this.planBackend = new CanvasTextRenderBackend({
      textureLayers: options.textureLayers,
      // TextComponent's pre-fancy path used Canvas's default miter joins.
      // Keep that paint detail while still executing through the shared backend.
      strokeLineJoin: 'miter',
    });
  }

  render (plan: TextRenderPlan, target: TextRenderTarget): void {
    this.planBackend.render(plan, target.context);
  }
}
