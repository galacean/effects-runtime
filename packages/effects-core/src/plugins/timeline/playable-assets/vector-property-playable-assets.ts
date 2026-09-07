import * as spec from '@galacean/effects-specification';
import type { Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';

interface Vector3PropertyPlayableAssetData extends spec.EffectsObjectData {
  curveData: spec.Vector3CurveValue,
}

@effectsClass(spec.DataType.Vector4PropertyPlayableAsset)
export class Vector4PropertyPlayableAsset extends PlayableAsset {
  curveData: spec.Vector4CurveValue;

  override fromData (data: spec.Vector4PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curveData = data.curveData;
  }

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector4>();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}

@effectsClass(spec.DataType.Vector3PropertyPlayableAsset)
export class Vector3ropertyPlayableAsset extends PlayableAsset {
  curveData: spec.Vector3CurveValue;

  override fromData (data: Vector3PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curveData = data.curveData;
  }

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector3>();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}

@effectsClass(spec.DataType.Vector2PropertyPlayableAsset)
export class Vector2PropertyPlayableAsset extends PlayableAsset {
  curveData: spec.Vector2CurveValue;

  override fromData (data: spec.Vector2PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curveData = data.curveData;
  }

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector2>();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
