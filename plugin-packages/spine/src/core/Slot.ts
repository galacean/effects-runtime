import type { Attachment } from './attachments';
import { VertexAttachment } from './attachments';
import type { Bone } from './Bone';
import type { Skeleton } from './Skeleton';
import type { SlotData } from './SlotData';
import { Color } from '../utils';

/** Stores a slot's current pose. Slots organize attachments for {@link Skeleton#drawOrder} purposes and provide a place to store
 * state for an attachment. State cannot be stored in an attachment itself because attachments are stateless and may be shared
 * across multiple skeletons. */
export class Slot {
  /** The slot's setup pose data. */
  data: SlotData;

  /** The bone this slot belongs to. */
  bone: Bone;

  /** The color used to tint the slot's attachment. If {@link #getDarkColor()} is set, this is used as the light color for two
	 * color tinting. */
  color: Color;

  /** The dark color used to tint the slot's attachment for two color tinting, or null if two color tinting is not used. The dark
	 * color's alpha is not used. */
  darkColor: Color | null = null;

  attachment: Attachment | null = null;

  attachmentState = 0;

  /** The index of the texture region to display when the slot's attachment has a {@link Sequence}. -1 represents the
	 * {@link Sequence#getSetupIndex()}. */
  sequenceIndex = -1;

  /** Values to deform the slot's attachment. For an unweighted mesh, the entries are local positions for each vertex. For a
	 * weighted mesh, the entries are an offset for each vertex which will be added to the mesh's local vertex positions.
	 *
	 * See {@link VertexAttachment#computeWorldVertices()} and {@link DeformTimeline}. */
  deform = new Array<number>();

  constructor (data: SlotData, bone: Bone) {
    if (!data) {throw new Error('data cannot be null.');}
    if (!bone) {throw new Error('bone cannot be null.');}
    this.data = data;
    this.bone = bone;
    this.color = new Color();
    this.darkColor = !data.darkColor ? null : new Color();
    this.setToSetupPose();
  }

  /** The skeleton this slot belongs to. */
  getSkeleton (): Skeleton {
    return this.bone.skeleton;
  }

  /** The current attachment for the slot, or null if the slot has no attachment. */
  getAttachment (): Attachment | null {
    return this.attachment;
  }

  /** Sets the slot's attachment and, if the attachment changed, resets {@link #sequenceIndex} and clears the {@link #deform}.
	 * The deform is not cleared if the old attachment has the same {@link VertexAttachment#getTimelineAttachment()} as the
	 * specified attachment. */
  setAttachment (attachment: Attachment | null) {
    if (this.attachment == attachment) {return;}
    if (!(attachment instanceof VertexAttachment) || !(this.attachment instanceof VertexAttachment)
			|| (attachment).timelineAttachment != (this.attachment).timelineAttachment) {
      this.deform.length = 0;
    }
    this.attachment = attachment;
    this.sequenceIndex = -1;
  }

  /** Sets this slot to the setup pose. */
  setToSetupPose () {
    this.color.setFromColor(this.data.color);
    if (this.darkColor) {this.darkColor.setFromColor(this.data.darkColor!);}
    if (!this.data.attachmentName) {this.attachment = null;} else {
      this.attachment = null;
      this.setAttachment(this.bone.skeleton.getAttachment(this.data.index, this.data.attachmentName));
    }
  }
}
