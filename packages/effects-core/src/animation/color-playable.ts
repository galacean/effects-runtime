import * as spec from '@galacean/effects-specification';
import { createValueGetter, vecFill, vecMulCombine, type ValueGetter } from '../math';
import type { FrameContext } from '../plugins/timeline/playable';
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

export class ColorPlayable extends ClipPlayable {
  colorOverLifetime: ColorStop[];
  opacityOverLifetime: ValueGetter<number>;
  startColor: spec.RGBAColorValue = [1, 1, 1, 1];
  renderColor: spec.vec4 = [1, 1, 1, 1];
  activeComponent?: MaskableGraphic;
  activeMaterial?: Material;

  constructor () {
    super();
    this.requiresTearDown = true;
  }

  protected override tearDown (): void {
    this.activeComponent = undefined;
    this.activeMaterial = undefined;
    this.startColor = [1, 1, 1, 1];
  }

  override evaluate (boundObject: object | undefined, context: FrameContext): void {
    if (!(boundObject instanceof VFXItem)) {
      return;
    }
    if (!this.activeComponent) {
      this.activeComponent = this.getActiveComponent(boundObject);
    }
    if (!this.activeMaterial) {
      this.activeMaterial = this.activeComponent?.material;
      const startColor = this.activeMaterial?.getColor('_Color');

      if (startColor) {
        this.startColor = startColor.toArray();
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
      vecMulCombine<spec.vec4>(this.renderColor, colorInc, this.startColor);
      this.activeMaterial?.getColor('_Color')?.setFromArray(this.renderColor);
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
