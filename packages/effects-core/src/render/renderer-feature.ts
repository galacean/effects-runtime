import type { Disposable } from '../utils';
import type { Renderer } from './renderer';
import type { RenderingData } from './rendering-data';

/** A renderer-owned extension that creates and schedules its own passes. */
export abstract class RendererFeature implements Disposable {
  active = true;

  /** Called once when attached to the renderer. Create reusable passes here. */
  abstract create (renderer: Renderer): void;

  /** Called for each scene render. Enqueue only the passes needed by this render. */
  abstract addRenderPasses (renderer: Renderer, data: RenderingData): void;

  /** Override to release passes and resources owned by this feature. */
  dispose (): void {}
}
