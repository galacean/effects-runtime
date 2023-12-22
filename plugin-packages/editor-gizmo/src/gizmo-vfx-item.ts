import type { Engine, HitTestCustomParams, Mesh, VFXItemProps } from '@galacean/effects';
import { HitTestType, Transform, VFXItem, math, spec } from '@galacean/effects';
import { GizmoSubType } from './define';
import { GizmoComponent } from './gizmo-component';
import { computeOrthographicOffCenter } from './math-utils';
import { intersectRayLine } from './raycast';
import { moveToPointWidthFixDistance } from './util';

type Ray = math.Ray;
type TriangleLike = math.TriangleLike;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;

const { Vector2, Vector3, Matrix4, Ray, Quaternion } = math;

/**
 * 包围盒类型
 */
export enum BoundingType {
  box,
  sphere,
  triangle,
  line
}

/**
 * 线条包围盒类型
 */
export interface GizmoItemBoundingLine {
  type: BoundingType.line,
  // 线条包围盒两端点
  points: [Vector3, Vector3],
  // 射线与线条距离阈值
  width: number,
}

/**
 * 立方体包围盒类型
 */
export interface GizmoItemBoundingBox {
  type: BoundingType.box,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围盒的xyz长度，当type为box时生效
  size: Vector3,
}

/**
 * 球体包围盒类型
 */
export interface GizmoItemBoundingSphere {
  type: BoundingType.sphere,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围球的半径，当type为sphere时生效
  radius: number,
}

/**
 * 三角数组包围盒类型
 */
export interface GizmoItemBoundingTriangle {
  type: BoundingType.triangle,
  triangles: TriangleLike[],
  backfaceCulling?: boolean,
}

export type GizmoItemBounding =
  | GizmoItemBoundingBox
  | GizmoItemBoundingSphere
  | GizmoItemBoundingTriangle
  | GizmoItemBoundingLine
  ;

/**
 *
 */
export class GizmoVFXItem extends VFXItem<Mesh | undefined> {
  target!: number;
  subType!: GizmoSubType;
  size: any;
  contents?: Map<Mesh, Transform>;
  targetItem?: VFXItem<any>;
  boundingMap: Map<string, GizmoItemBounding> = new Map();
  hitBounding?: { key: string, position: Vector3 };
  wireframeMesh?: Mesh;

  constructor (engine: Engine, props?: VFXItemProps) {
    super(engine, props);
    const gizmoComponent = this.addComponent(GizmoComponent);

    if (props) {
      gizmoComponent.fromData(props);
    }
  }

  override set content (content: Mesh | undefined) {
  }

  override get content () {
    return this._content;
  }

  /**
   * 射线检测算法
   * @returns 包含射线检测算法回调方法的参数
   */
  override getHitTestParams (): void | HitTestCustomParams {
    const boundingMap = this.boundingMap;

    if (boundingMap.size > 0) {
      const boundingKeys = boundingMap.keys();
      let worldMat4: Matrix4;

      worldMat4 = this.transform.getWorldMatrix();

      if (this.targetItem) {
        //const targetTransform = this.targetItem.transform.clone();
        const worldPos = new Vector3();
        const worldQuat = new Quaternion();
        const worldSca = new Vector3(1, 1, 1);

        this.targetItem.transform.assignWorldTRS(worldPos, worldQuat);

        const targetTransform = new Transform({
          position: worldPos,
          quat: worldQuat,
          scale: worldSca,
          valid: true,
        });

        // 移动\旋转\缩放gizmo去除近大远小
        if (
          this.subType === GizmoSubType.rotation ||
          this.subType === GizmoSubType.scale ||
          this.subType === GizmoSubType.translation ||
          this.subType === GizmoSubType.camera ||
          this.subType === GizmoSubType.light
        ) {
          const camera = this.composition!.camera;
          const cameraPos = camera.position || [0, 0, 0];
          const itemPos = targetTransform.position;
          const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

          targetTransform.setPosition(newPos.x, newPos.y, newPos.z);
          worldMat4 = targetTransform.getWorldMatrix();
        } else {
          worldMat4 = targetTransform.getWorldMatrix();
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return {
        type: HitTestType.custom,
        /**
         * 自定义射线检测算法
         * @param ray 射线参数
         * @param pointInCanvas 屏幕坐标
         * @returns
         */
        collect (ray: Ray, pointInCanvas: Vector2): Vector3[] | void {
          const hitPositions = [];

          self.hitBounding = undefined;
          for (const key of boundingKeys) {
            const bounding = boundingMap.get(key);
            const center = new Vector3();
            const worldCenter = new Vector3();

            if (bounding?.type === BoundingType.box || bounding?.type === BoundingType.sphere) {
              if (bounding?.center) {
                center.copyFrom(bounding?.center);
              }
              worldMat4.projectPoint(center, worldCenter);
            }
            let position: Vector3 | undefined;

            switch (bounding?.type) {
              case BoundingType.box: // 立方体包围盒
                {
                  const boxHalfSize = bounding.size.clone().multiply(0.5);
                  const boxMax = center.clone().add(boxHalfSize);
                  const boxMin = center.clone().subtract(boxHalfSize);

                  position = ray.intersectBox({ min: boxMin, max: boxMax }, new Vector3());
                }

                break;
              case BoundingType.sphere: // 球体包围盒

                // viewHelper 使用了正交投影，使用屏幕投影点计算
                if (self.subType === GizmoSubType.viewHelper) {
                  // 计算正交投影矩阵
                  const viewMat4 = self.composition!.camera.getViewMatrix();
                  const fov = 30; // 指定fov角度
                  const screenWidth = self.composition!.renderer.getWidth();
                  const screenHeight = self.composition!.renderer.getHeight();
                  const distance = 16; // 指定物体与相机的距离
                  const width = 2 * Math.tan(fov * Math.PI / 360) * distance;
                  const aspect = screenWidth / screenHeight;
                  const height = width / aspect;
                  const proMat4 = computeOrthographicOffCenter(-width / 2, width / 2, -height / 2, height / 2, -distance, distance);

                  // 将包围盒挂到相机的 transform 上
                  const cameraModelMat4 = self.composition!.camera.getInverseViewMatrix();
                  const localTransform = new Transform({
                    valid: true,
                  });

                  localTransform.cloneFromMatrix(worldMat4);
                  const pos = localTransform.position;
                  const padding = self.size.padding || 1; // 指定viewHelper与屏幕右上角的边距

                  localTransform.setPosition((pos.x + width / 2) - padding, (pos.y + height / 2) - padding, pos.z);
                  const localMat4 = localTransform.getWorldMatrix();
                  const modelMat4 = cameraModelMat4.clone().multiply(localMat4);

                  modelMat4.projectPoint(center, worldCenter);

                  // 包围球中心点正交投影到屏幕上
                  const vpMat4 = proMat4.clone().multiply(viewMat4);
                  const mvpMat4 = vpMat4.clone().multiply(modelMat4);
                  const screenCenter = mvpMat4.projectPoint(center, new Vector3());
                  const screenCenterX = screenCenter.x;
                  const screenCenterY = screenCenter.y;

                  // 包围球上的点正交投影到屏幕上
                  const radius = bounding.radius;
                  const up = new Vector3(
                    localMat4.elements[1],
                    localMat4.elements[5],
                    localMat4.elements[9],
                  ).normalize();

                  const point = up.clone().multiply(radius);

                  point.add(center);

                  const screenPoint = mvpMat4.projectPoint(point, new Vector3());
                  const screenPointX = screenPoint.x;
                  const screenPointY = screenPoint.y;

                  // 计算正交投影到屏幕上的包围球的半径
                  const screenCenter2 = screenCenter.toVector2();
                  const screenPoint2 = screenPoint.toVector2();
                  const screenRadius = screenCenter2.distance(screenPoint2);

                  if (pointInCanvas.distance(screenCenter2) < screenRadius * 1.2) {
                    position = worldCenter;
                  }
                } else {
                  position = ray.intersectSphere({ center: worldCenter, radius: bounding.radius }, new Vector3());
                }

                break;
              case BoundingType.triangle: {// 三角数组包围盒
                const { triangles, backfaceCulling } = bounding;
                const tmpPositions: Vector3[] = [];
                let tmpPosition;

                for (let j = 0; j < triangles.length; j++) {
                  const triangle = triangles[j];
                  const worldTriangle: TriangleLike = {
                    p0: worldMat4.projectPoint(triangle.p0 as Vector3, new Vector3()),
                    p1: worldMat4.projectPoint(triangle.p1 as Vector3, new Vector3()),
                    p2: worldMat4.projectPoint(triangle.p2 as Vector3, new Vector3()),
                  };

                  tmpPosition = ray.intersectTriangle(worldTriangle, new Vector3(), backfaceCulling);
                  if (tmpPosition) {
                    tmpPositions.push(tmpPosition);
                  }
                }
                // 仅保存距离相机最近的点
                if (tmpPositions.length > 0) {
                  let lastDistance: number;

                  tmpPositions.forEach(item => {
                    const distance = ray.origin.distanceSquared(item);

                    if (!lastDistance || distance < lastDistance) {
                      lastDistance = distance;
                      position = item;
                    }
                  });
                }

                break;
              }
              case BoundingType.line: {// 线条包围盒，将线条转换到屏幕空间，计算线条与屏幕交互点的距离，小于阈值判定为点中
                const { points, width } = bounding;

                position = intersectRayLine(new Vector3(), pointInCanvas, points, width / 2, worldMat4, self.composition!.camera);

                break;
              }
              default:
                break;
            }
            if (position) {
              hitPositions.push(position);
              //  缓存距离相机最近的 BoundingKey
              if (self.hitBounding) {
                const distance = ray.origin.distanceSquared(position);
                const lastDistance = ray.origin.distanceSquared(self.hitBounding.position);

                if (distance < lastDistance) {
                  self.hitBounding.key = key;
                  self.hitBounding.position = position;
                }
              } else {
                self.hitBounding = {
                  key,
                  position,
                };
              }
            }
          }
          if (hitPositions.length === 0) {
            self.hitBounding = undefined;
          }

          return hitPositions;
        },
        behavior: spec.InteractBehavior.NOTIFY,
      };
    }
  }
}
