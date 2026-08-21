import type { TextStyle } from '../text-style';
import { CanvasTextRenderBackend } from './canvas-text-render-backend';
import type { TextRenderBackend, TextRenderPlan } from './text-render-plan';

export interface TextRenderTarget {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
}

export interface CanvasTextBackendOptions {
  style: TextStyle,
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
      textStyle: options.style,
      layers: options.style.fancyRenderStyle.layers,
    });
  }

  render (plan: TextRenderPlan, target: TextRenderTarget): void {
    this.planBackend.render(plan, target.context);
  }
}
