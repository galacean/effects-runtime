import * as spec from '@galacean/effects-specification';
import { createValueGetter, vecFill, vecMulCombine, type ValueGetter } from '../math';
import type { FrameContext } from '../plugins/timeline/playable';
import type { CacheDataManager } from '../plugins/timeline/cache-data-manager';
import { ClipPlayable } from '../plugins/timeline/playable';
import { VFXItem } from '../vfx-item';
import type { Material } from '../material';
import type { ColorStop } from '../utils';
import { colorStopsFromGradient, getColorFromGradientStops } from '../utils';
import { MaskableGraphic } from '../components';

export interface ColorPlayableAssetData extends spec.EffectsObjectData {
  colorOverLifetime?: spec.ColorOverLifetime,
}

const tempColor: spec.RGBAColorValue = [1, 1, 1, 1];

interface ColorEvaluationState {
  component?: MaskableGraphic,
  material?: Material,
  startColor: spec.RGBAColorValue,
}

export class ColorPlayable extends ClipPlayable {
  colorOverLifetime: ColorStop[];
  opacityOverLifetime: ValueGetter<number>;

  override evaluate (boundObject: object | undefined, context: FrameContext, cache: CacheDataManager): void {
    if (!(boundObject instanceof VFXItem)) {
      return;
    }
    const states = cache.getOrAddClipData(() => new WeakMap<VFXItem, ColorEvaluationState>());
    let state = states.get(boundObject);

    if (!state) {
      state = { startColor: [1, 1, 1, 1] };
      states.set(boundObject, state);
    }
    if (!state.component) {
      state.component = this.getActiveComponent(boundObject);
    }
    if (!state.material) {
      state.material = state.component?.material;
      const startColor = state.material?.getColor('_Color');

      if (startColor) {
        state.startColor = startColor.toArray();
      }
    }
    let colorInc = vecFill(tempColor, 1);
    let colorChanged;
    const life = context.time / this.duration;

    const opacityOverLifetime = this.opacityOverLifetime;
    const colorOverLifetime = this.colorOverLifetime;

    if (colorOverLifetime) {
      colorInc = getColorFromGradientStops(colorOverLifetime, life, true) as spec.vec4;
      colorChanged = true;
    }
    if (opacityOverLifetime) {
      colorInc[3] *= opacityOverLifetime.getValue(life);
      colorChanged = true;
    }

    if (colorChanged) {
      vecMulCombine<spec.vec4>(tempColor, colorInc, state.startColor);
      state.material?.getColor('_Color')?.setFromArray(tempColor);
    }
  }

  create (clipData: ColorPlayableAssetData) {
    const colorOverLifetime = clipData.colorOverLifetime;

    if (colorOverLifetime) {
      this.opacityOverLifetime = createValueGetter(colorOverLifetime.opacity ?? 1);
      if (colorOverLifetime.color && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR) {
        this.colorOverLifetime = colorStopsFromGradient(colorOverLifetime.color[1]);
      }
    }

    return this;
  }

  getActiveComponent (boundObject: VFXItem): MaskableGraphic {
    return boundObject.getComponent(MaskableGraphic);
  }

}
