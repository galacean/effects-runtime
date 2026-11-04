import { math } from '@galacean/effects';
import type { AssetPreviewMesh } from '../model/asset-types';

export type PreviewPrimitive = AssetPreviewMesh;

export interface MaterialPreviewSettings {
  primitive: PreviewPrimitive,
  yaw: number,
  pitch: number,
  distance: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  aspect: number,
  lightYaw: number,
  lightPitch: number,
  lit: boolean,
  orthographic: boolean,
  grid: boolean,
  background: boolean,
}

export function defaultMaterialPreview (): MaterialPreviewSettings {
  return { primitive: 'sphere', yaw: -0.45, pitch: -Math.PI / 12, distance: 3.2, targetX: 0, targetY: 0, targetZ: 0, aspect: 1,
    lightYaw: -0.5, lightPitch: 0.58, lit: true, orthographic: false, grid: false, background: true };
}

export const thumbnailMaterialView = defaultMaterialPreview();
export const previewFieldOfView = Math.PI / 4;

export function materialPreviewCamera (view: MaterialPreviewSettings) {
  const world = math.Matrix4.fromTranslation(view.targetX, view.targetY, view.targetZ)
    .multiply(math.Matrix4.fromRotationY(view.yaw)).multiply(math.Matrix4.fromRotationX(view.pitch))
    .multiply(math.Matrix4.fromTranslation(0, 0, view.distance));
  const extent = view.distance * Math.tan(previewFieldOfView / 2);
  const projection = view.orthographic
    ? new math.Matrix4().orthographic(-extent * view.aspect, extent * view.aspect, extent, -extent, 0.05, 100)
    : new math.Matrix4().perspective(previewFieldOfView, view.aspect, 0.05, 100);
  const inverse = world.clone().invert();

  return { world, view: inverse, projection, viewProjection: projection.clone().multiply(inverse) };
}

export function frameMaterialPreview (view: MaterialPreviewSettings): void {
  const radius = { sphere: 1, plane: Math.hypot(0.85, 0.85), cube: Math.hypot(0.85, 0.85, 0.85), cylinder: Math.hypot(1, 0.85) }[view.primitive];
  const halfFov = Math.atan(Math.tan(previewFieldOfView / 2) * Math.min(1, view.aspect));

  view.distance = radius / Math.sin(halfFov) * 1.15;
  view.targetX = view.targetY = view.targetZ = 0;
}
