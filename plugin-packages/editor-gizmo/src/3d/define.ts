import type { GeometryDrawMode, spec } from '@galacean/effects';

export interface GizmoVFXItemOptions {
  target: string,
  subType: GizmoSubType,
  renderMode?: GeometryDrawMode,
  type: 'editor-gizmo',
  color: spec.vec3,
  size?: number,
  depthTest?: boolean,
}

export const GizmoVFXItemType = 'gizmo' as spec.ItemType;

/**
 * Gizmo 类型
 */
export enum GizmoSubType {
  particleEmitter = 1,
  modelWireframe = 2,
  box,
  sphere,
  cylinder,
  cone,
  torus,
  sprite,
  plane,
  rotation,
  translation,
  scale,
  viewHelper,
  camera,
  frustum,
  light,
  directionLight,
  pointLight,
  spotLight,
  boundingBox,
  floorGrid,
}
