import type { BoneData } from './BoneData';
import { ConstraintData } from './ConstraintData';
import type { SlotData } from './SlotData';

/** Stores the setup pose for a {@link PathConstraint}.
 *
 * See [path constraints](http://esotericsoftware.com/spine-path-constraints) in the Spine User Guide. */
export class PathConstraintData extends ConstraintData {

  /** The bones that will be modified by this path constraint. */
  bones = new Array<BoneData>();

  /** The slot whose path attachment will be used to constrained the bones. */
  private _target: SlotData | null = null;
  public set target (slotData: SlotData) { this._target = slotData; }
  public get target () {
    if (!this._target) {throw new Error('SlotData not set.');} else {return this._target;}
  }

  /** The mode for positioning the first bone on the path. */
  positionMode: PositionMode = PositionMode.Fixed;

  /** The mode for positioning the bones after the first bone on the path. */
  spacingMode: SpacingMode = SpacingMode.Fixed;

  /** The mode for adjusting the rotation of the bones. */
  rotateMode: RotateMode = RotateMode.Chain;

  /** An offset added to the constrained bone rotation. */
  offsetRotation = 0;

  /** The position along the path. */
  position = 0;

  /** The spacing between bones. */
  spacing = 0;

  mixRotate = 0;
  mixX = 0;
  mixY = 0;

  constructor (name: string) {
    super(name, 0, false);
  }
}

/** Controls how the first bone is positioned along the path.
 *
 * See [position](http://esotericsoftware.com/spine-path-constraints#Position) in the Spine User Guide. */
export enum PositionMode { Fixed, Percent }

/** Controls how bones after the first bone are positioned along the path.
 *
 * See [spacing](http://esotericsoftware.com/spine-path-constraints#Spacing) in the Spine User Guide. */
export enum SpacingMode { Length, Fixed, Percent, Proportional }

/** Controls how bones are rotated, translated, and scaled to match the path.
 *
 * See [rotate mix](http://esotericsoftware.com/spine-path-constraints#Rotate-mix) in the Spine User Guide. */
export enum RotateMode { Tangent, Chain, ChainScale }
