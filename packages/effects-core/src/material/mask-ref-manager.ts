import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import type { IMaskProps } from './types';
import { MaskMode } from './types';

export class MaskRefManager {
  currentRef: number;

  constructor (initRef?: number) {
    this.currentRef = initRef || 0;
  }

  distributeRef () {
    return ++this.currentRef;
  }
}

export class MaskManager {
  maskRef: number;

  constructor (public engine: Engine) {
  }

  getRefValue () {
    if (isNaN(this.maskRef)) {
      this.maskRef = this.engine.maskRefManager.distributeRef();
    }

    return this.maskRef;
  }

  getMaskMode (data: IMaskProps) {
    let maskMode = MaskMode.NONE;

    if (data.mask) {
      const { mask = false, mode = MaskMode.NONE, ref } = data.mask;

      if (mask) {
        maskMode = MaskMode.MASK;
        this.getRefValue();
      } else if (mode === spec.ObscuredMode.OBSCURED || mode === spec.ObscuredMode.REVERSE_OBSCURED) {
        maskMode = mode === spec.ObscuredMode.OBSCURED ? MaskMode.OBSCURED : MaskMode.REVERSE_OBSCURED;
        this.maskRef = ref!.maskManager.getRefValue();
      }
    }

    return maskMode;
  }
}
