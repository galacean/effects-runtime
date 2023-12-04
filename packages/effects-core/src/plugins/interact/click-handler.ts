import type * as spec from '@galacean/effects-specification';
import type { Matrix4, Ray, TriangleLike, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { CompVFXItem } from '../../comp-vfx-item';

export enum HitTestType {
  triangle = 1,
  box = 2,
  sphere = 3,
  custom = 4,
}

export interface BoundingBoxData {
  type: HitTestType,
  area: (TriangleLike | Record<string, Vector3>)[],
}

export interface BoundingBoxTriangle extends BoundingBoxData {
  type: HitTestType.triangle,
  area: TriangleLike[],
}

export interface BoundingBoxSphere extends BoundingBoxData {
  type: HitTestType.sphere,
  area: {
    center: Vector3,
    size: Vector3,
  }[],
}

export interface HitTestTriangleParams {
  type: HitTestType.triangle,
  triangles: TriangleLike[],
  backfaceCulling?: boolean,
  behavior?: spec.InteractBehavior,
}

export interface HitTestBoxParams {
  type: HitTestType.box,
  center: Vector3,
  size: Vector3,
  behavior?: spec.InteractBehavior,
}

export interface HitTestSphereParams {
  type: HitTestType.sphere,
  center: Vector3,
  radius: number,
  behavior?: spec.InteractBehavior,
}

export interface HitTestCustomParams {
  type: HitTestType.custom,
  collect (ray: Ray, pointInCanvas: Vector2): Vector3[] | void,
  behavior?: spec.InteractBehavior,
}

export type Region = {
  compContent: CompVFXItem,
  name: string,
  id: string,
  position: Vector3,
  behavior?: spec.InteractBehavior,
  parentId?: string,
  hitPositions?: Vector3[],
};

export type HitTestParams = {
  camera: {
    position: Vector3,
    direction: Vector3,
    viewProjection: Matrix4,
  },
  x: number,
  y: number,
  inRect: (position: Vector3, width: number, height: number) => boolean,
};
