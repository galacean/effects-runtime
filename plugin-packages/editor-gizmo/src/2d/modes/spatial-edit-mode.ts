import type { EditMode } from './edit-mode';
import type { Transform3DEditMode } from './transform-3d-edit-mode';
import type { Viewport3DEditMode } from './viewport-3d-edit-mode';

/** Identify the spatial modes without changing the shared EditMode contract. */
export function isSpatialEditMode (mode: EditMode): mode is Transform3DEditMode | Viewport3DEditMode {
  return mode.id === 'transform-3d' || mode.id === 'viewport-3d';
}
