import * as spec from '@galacean/effects-specification';
import { createValueGetter, vecFill, vecMulCombine, type ValueGetter } from '../math';
import type { FrameContext } from '../plugins/cal/playable-graph';
import { Playable } from '../plugins/cal/playable-graph';
import { VFXItem } from '../vfx-item';
import type { Material } from '../material';
import type { ColorStop } from '../utils';
import { colorStopsFromGradient, getColorFromGradientStops } from '../utils';
import { BaseRenderComponent } from '../components';

export interface ColorPlayableAssetData extends spec.EffectsObjectData {
  colorOverLifetime?: spec.ColorOverLifetime,
}

const tempColor: spec.RGBAColorValue = [1, 1, 1, 1];

export class ColorPlayable extends Playable {
  clipData: { colorOverLifetime?: spec.ColorOverLifetime, startColor?: spec.RGBAColorValue };
  colorOverLifetime: ColorStop[];
  opacityOverLifetime: ValueGetter<number>;
  startColor: spec.RGBAColorValue;
  renderColor: spec.vec4 = [1, 1, 1, 1];
  activeComponent?: BaseRenderComponent;
  activeMaterial?: Material;

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

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

    this.activeComponent?.setAnimationTime(this.time);
    let colorInc = vecFill(tempColor, 1);
    let colorChanged;
    const life = this.time / boundObject.duration;

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
    this.clipData = clipData;
    const colorOverLifetime = clipData.colorOverLifetime;

    if (colorOverLifetime) {
      this.opacityOverLifetime = createValueGetter(colorOverLifetime.opacity ?? 1);
      if (colorOverLifetime.color && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR) {
        this.colorOverLifetime = colorStopsFromGradient(colorOverLifetime.color[1]);
      }
    }

    return this;
  }

  getActiveComponent (boundObject: VFXItem): BaseRenderComponent {
    return boundObject.getComponent(BaseRenderComponent);
  }

}
