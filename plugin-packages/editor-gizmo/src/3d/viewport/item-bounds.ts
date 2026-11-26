import type { VFXItem } from '@galacean/effects';
import { Vector3 } from '../../math/core';

/** World-space bounds corners of items and their descendants, used for marquee selection and camera focus. */
export function getItemWorldBoundsCorners (roots: readonly VFXItem[]): Vector3[] {
  const points: Vector3[] = [];
  const items = new Set(roots.flatMap(item => [item, ...item.getDescendants()]));

  items.forEach(item => {
    const bounds = item.definition.content?.options?.bounding as { center?: number[], size?: number[] } | undefined;
    const [cx, cy, cz] = bounds?.center ?? [0, 0, 0];
    const [width, height, depth] = bounds?.size ?? [item.transform.size.x, item.transform.size.y, 0];
    const matrix = item.transform.getWorldMatrix();

    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        for (const z of depth ? [-0.5, 0.5] : [0]) {
          points.push(new Vector3(cx + x * width, cy + y * height, cz + z * depth).applyMatrix(matrix));
        }
      }
    }
  });

  return points;
}
