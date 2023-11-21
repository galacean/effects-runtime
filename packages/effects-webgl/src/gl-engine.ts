import { Engine, GPUCapability } from '@galacean/effects-core';
import type { GLRendererInternal } from './gl-renderer-internal';
import type { GLRenderer } from './gl-renderer';
import type { GLPipelineContext } from './gl-pipeline-context';

export class GLEngine extends Engine {

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext) {
    super();
    this.gpuCapability = new GPUCapability(gl);
  }

  override dispose () {
    if (this.isDestroyed) {
      return;
    }

    super.dispose();
  }

  getGLRenderer (): GLRenderer {
    return this.renderer as GLRenderer;
  }

  getGLRendererInternal (): GLRendererInternal {
    return this.getGLRenderer().glRenderer;
  }

  getGLPipelineContext (): GLPipelineContext {
    return this.getGLRenderer().pipelineContext;
  }
}
