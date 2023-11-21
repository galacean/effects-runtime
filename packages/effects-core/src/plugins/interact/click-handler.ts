import type * as spec from '@galacean/effects-specification';
import type { vec2, vec3 } from '@galacean/effects-specification';
import type { mat4, Ray, Triangle } from '../../math';

export enum HitTestType {
  triangle = 1,
  box = 2,
  sphere = 3,
  custom = 4,
}

export interface BoundingBoxData {
  type: HitTestType,
  area: (Triangle | Record<string, vec3>)[],
}

export interface BoundingBoxTriangle extends BoundingBoxData {
  type: HitTestType.triangle,
  area: Triangle[],
}

export interface BoundingBoxSphere extends BoundingBoxData {
  type: HitTestType.sphere,
  area: {
    center: vec3,
    size: vec3,
  }[],
}

export interface HitTestTriangleParams {
  type: HitTestType.triangle,
  triangles: Triangle[],
  backfaceCulling?: boolean,
  behavior?: spec.InteractBehavior,
}

export interface HitTestBoxParams {
  type: HitTestType.box,
  center: vec3,
  size: vec3,
  behavior?: spec.InteractBehavior,
}

export interface HitTestSphereParams {
  type: HitTestType.sphere,
  center: vec3,
  radius: number,
  behavior?: spec.InteractBehavior,
}

export interface HitTestCustomParams {
  type: HitTestType.custom,
  collect (ray: Ray, pointInCanvas: vec2): vec3[] | void,
  behavior?: spec.InteractBehavior,
}

export type Region = {
  name: string,
  id: string,
  position: vec3,
  behavior?: spec.InteractBehavior,
  parentId?: string,
  hitPositions?: vec3[],
};

export type HitTestParams = {
  camera: {
    position: vec3,
    direction: vec3,
    viewProjection: mat4,
  },
  x: number,
  y: number,
  inRect: (position: vec3, width: number, height: number) => boolean,
};
