import type { Skin } from '../Skin';
import type { BoundingBoxAttachment } from './BoundingBoxAttachment';
import type { ClippingAttachment } from './ClippingAttachment';
import type { MeshAttachment } from './MeshAttachment';
import type { PathAttachment } from './PathAttachment';
import type { PointAttachment } from './PointAttachment';
import type { RegionAttachment } from './RegionAttachment';
import type { Sequence } from './Sequence';

/** The interface which can be implemented to customize creating and populating attachments.
 *
 * See [Loading skeleton data](http://esotericsoftware.com/spine-loading-skeleton-data#AttachmentLoader) in the Spine
 * Runtimes Guide. */
export interface AttachmentLoader {
  /** @return May be null to not load an attachment. */
  newRegionAttachment (skin: Skin, name: string, path: string, sequence: Sequence | null): RegionAttachment,

  /** @return May be null to not load an attachment. */
  newMeshAttachment (skin: Skin, name: string, path: string, sequence: Sequence | null): MeshAttachment,

  /** @return May be null to not load an attachment. */
  newBoundingBoxAttachment (skin: Skin, name: string): BoundingBoxAttachment,

  /** @return May be null to not load an attachment */
  newPathAttachment (skin: Skin, name: string): PathAttachment,

  /** @return May be null to not load an attachment */
  newPointAttachment (skin: Skin, name: string): PointAttachment,

  /** @return May be null to not load an attachment */
  newClippingAttachment (skin: Skin, name: string): ClippingAttachment,
}
