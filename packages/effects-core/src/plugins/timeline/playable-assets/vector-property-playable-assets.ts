import * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import type { TimelineClipData } from '../timeline-clip';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { ValueGetter } from '../../../math';

/** TODO: update to spec. */
interface Vector4PropertyPlayableAssetData extends TimelineClipData {
  dataType: spec.DataType.Vector4PropertyPlayableAsset,
  curveData: spec.Vector4CurveValue,
}

/** TODO: update to spec. */
interface Vector3PropertyPlayableAssetData extends TimelineClipData {
  curveData: spec.Vector3CurveValue,
}

/** TODO: update to spec. */
interface Vector2PropertyPlayableAssetData extends TimelineClipData {
  dataType: spec.DataType.Vector2PropertyPlayableAsset,
  curveData: spec.Vector2CurveValue,
}

@effectsClass(spec.DataType.Vector4PropertyPlayableAsset)
export class Vector4PropertyPlayableAsset extends TimelineClip {
  curve: ValueGetter<Vector4>;

  override fromData (data: Vector4PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): ClipPlayable {
    const clipPlayable = new PropertyClipPlayable<Vector4>();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0, new Vector4());

    return clipPlayable;
  }
}

@effectsClass(spec.DataType.Vector3PropertyPlayableAsset)
export class Vector3ropertyPlayableAsset extends TimelineClip {
  curve: ValueGetter<Vector3>;

  override fromData (data: Vector3PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): ClipPlayable {
    const clipPlayable = new PropertyClipPlayable<Vector3>();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0, new Vector3());

    return clipPlayable;
  }
}

@effectsClass(spec.DataType.Vector2PropertyPlayableAsset)
export class Vector2PropertyPlayableAsset extends TimelineClip {
  curve: ValueGetter<Vector2>;

  override fromData (data: Vector2PropertyPlayableAssetData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): ClipPlayable {
    const clipPlayable = new PropertyClipPlayable<Vector2>();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0, new Vector2());

    return clipPlayable;
  }
}
