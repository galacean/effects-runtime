import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import type { MaskProps, Maskable } from './types';
import { MaskMode } from './types';
import type { Renderer } from '../render/renderer';
import { TextureLoadAction } from '../texture/types';
import type { RenderPassClearAction } from '../render/render-pass';

export class MaskProcessor {
  maskable?: Maskable;

  private stencilClearAction: RenderPassClearAction;

  constructor (public engine: Engine) {
    this.stencilClearAction = { stencilAction:TextureLoadAction.clear };
  }

  getRefValue () {
    return 1;
  }

  getMaskMode (data: MaskProps) {
    let maskMode = MaskMode.NONE;

    if (data.mask) {
      const { mask = false, mode = MaskMode.NONE, ref } = data.mask;

      if (mask) {
        maskMode = MaskMode.MASK;
      } else if (mode === spec.ObscuredMode.OBSCURED || mode === spec.ObscuredMode.REVERSE_OBSCURED) {
        maskMode = mode === spec.ObscuredMode.OBSCURED ? MaskMode.OBSCURED : MaskMode.REVERSE_OBSCURED;
        this.maskable = ref;
      }
    }

    return maskMode;
  }

  drawStencilMask (renderer: Renderer) {
    renderer.clear(this.stencilClearAction);
    this.maskable?.drawStencilMask(renderer);
  }
}
