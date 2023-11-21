import { ConstraintData } from './ConstraintData';
import type { BoneData } from './BoneData';

/** Stores the setup pose for a {@link TransformConstraint}.
 *
 * See [Transform constraints](http://esotericsoftware.com/spine-transform-constraints) in the Spine User Guide. */
export class TransformConstraintData extends ConstraintData {

  /** The bones that will be modified by this transform constraint. */
  bones = new Array<BoneData>();

  /** The target bone whose world transform will be copied to the constrained bones. */
  private _target: BoneData | null = null;
  public set target (boneData: BoneData) { this._target = boneData; }
  public get target () {
    if (!this._target) {throw new Error('BoneData not set.');} else {return this._target;}
  }

  mixRotate = 0;
  mixX = 0;
  mixY = 0;
  mixScaleX = 0;
  mixScaleY = 0;
  mixShearY = 0;

  /** An offset added to the constrained bone rotation. */
  offsetRotation = 0;

  /** An offset added to the constrained bone X translation. */
  offsetX = 0;

  /** An offset added to the constrained bone Y translation. */
  offsetY = 0;

  /** An offset added to the constrained bone scaleX. */
  offsetScaleX = 0;

  /** An offset added to the constrained bone scaleY. */
  offsetScaleY = 0;

  /** An offset added to the constrained bone shearY. */
  offsetShearY = 0;

  relative = false;
  local = false;

  constructor (name: string) {
    super(name, 0, false);
  }
}
