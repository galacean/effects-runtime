import type { BoneData } from './BoneData';
import { Color } from '../utils';

/** Stores the setup pose for a {@link Slot}. */
export class SlotData {
  /** The index of the slot in {@link Skeleton#getSlots()}. */
  index = 0;

  /** The name of the slot, which is unique across all slots in the skeleton. */
  name: string;

  /** The bone this slot belongs to. */
  boneData: BoneData;

  /** The color used to tint the slot's attachment. If {@link #getDarkColor()} is set, this is used as the light color for two
	 * color tinting. */
  color = new Color(1, 1, 1, 1);

  /** The dark color used to tint the slot's attachment for two color tinting, or null if two color tinting is not used. The dark
	 * color's alpha is not used. */
  darkColor: Color | null = null;

  /** The name of the attachment that is visible for this slot in the setup pose, or null if no attachment is visible. */
  attachmentName: string | null = null;

  /** The blend mode for drawing the slot's attachment. */
  blendMode: BlendMode = BlendMode.Normal;

  constructor (index: number, name: string, boneData: BoneData) {
    if (index < 0) {throw new Error('index must be >= 0.');}
    if (!name) {throw new Error('name cannot be null.');}
    if (!boneData) {throw new Error('boneData cannot be null.');}
    this.index = index;
    this.name = name;
    this.boneData = boneData;
  }
}

/** Determines how images are blended with existing pixels when drawn. */
export enum BlendMode { Normal, Additive, Multiply, Screen }
