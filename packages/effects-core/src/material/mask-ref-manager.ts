import type { Engine } from '../engine';
import type * as spec from '@galacean/effects-specification';
import type { Maskable } from './types';
import { MaskMode } from './types';
import type { Renderer } from '../render/renderer';
import { TextureLoadAction } from '../texture/types';
import type { RenderPassClearAction } from '../render/render-pass';

export class MaskProcessor {
  alphaMaskEnabled = false;
  maskMode: MaskMode = MaskMode.NONE;
  maskable: Maskable | null = null;

  private stencilClearAction: RenderPassClearAction;

  constructor (public engine: Engine) {
    this.stencilClearAction = { stencilAction:TextureLoadAction.clear };
  }

  getRefValue () {
    return 1;
  }

  getMaskMode (data: spec.MaskOptions) {
    const { isMask = false, inverted = false, reference, alphaMaskEnabled = false } = data;

    this.alphaMaskEnabled = alphaMaskEnabled;

    if (isMask) {
      this.maskMode = MaskMode.MASK;
    } else {
      this.maskMode = inverted ? MaskMode.REVERSE_OBSCURED : MaskMode.OBSCURED;
      if (reference) {
        this.maskable = this.engine.findObject<Maskable>(reference);
      }
    }

    return this.maskMode;
  }

  drawStencilMask (renderer: Renderer) {
    if (this.maskable) {
      renderer.clear(this.stencilClearAction);
      this.maskable.drawStencilMask(renderer);
    }
  }
}
