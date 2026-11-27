import { type Plane } from '@galacean/effects-math/es/extension/index';
import { type Matrix4, Ray, type Vector2, Vector3 } from './core';

/**
 * 射线碰撞相机参数
 */
export type RayCasterCamera = {
  /**
   * 位置
   */
  position: Vector3,
  /**
   * 视图投影逆矩阵
   */
  inverseViewProjectMatrix: Matrix4,
};

/**
 * 射线碰撞结果
 */
export type RayCastResult = {
  /**
   * 相交点
   */
  point: Vector3,
  /**
   * 相交距离
   */
  distance: number,
  /**
   * 相交构件ID
   */
  id?: string,
};

/**
 * 射线投射器，由屏幕坐标与相机参数构建射线并进行平面求交。
 */
export class RayCaster {
  ray: Ray;

  /**
   * 构造射线投射器。
   * @param ray 初始射线，默认为新建射线
   */
  constructor (
    ray: Ray = new Ray(),
  ) {
    this.ray = ray.clone();
  }

  /**
   * 由屏幕坐标与相机参数构建投射射线。
   * @param coords 屏幕坐标（归一化）
   * @param camera 相机参数
   * @returns 当前实例（链式调用）
   */
  setFromCamera (coords: Vector2, camera: RayCasterCamera) {
    const origin = camera.position;
    const direction = new Vector3(coords.x, coords.y, 0.5).applyProjectionMatrix(camera.inverseViewProjectMatrix).subtract(origin).normalize();

    this.ray.set(origin, direction);

    return this;
  }

  /**
   * 将当前射线与平面求交。
   * @param plane 目标平面
   * @returns 相交结果，不相交时返回 undefined
   */
  rayCastPlane (plane: Plane): RayCastResult | undefined {
    const distance = this.ray.distanceToPlane(plane);

    if (distance === null) {
      return undefined;
    }

    return {
      distance,
      point: new Vector3().copyFrom(this.ray.at(distance)),
    };
  }
}
