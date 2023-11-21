import type { Engine, GeometryDrawMode, HitTestCustomParams, Mesh, Ray, SpriteMesh, SpriteVFXItem, Texture, Triangle } from '@galacean/effects';
import { spec, HitTestType, Transform, VFXItem, glContext, intersectRayBox, intersectRaySphere, intersectRayTriangle, assertExist } from '@galacean/effects';
import type { GizmoVFXItemOptions } from './define';
import { GizmoSubType, GizmoVFXItemType } from './define';
import { createModeWireframe, updateWireframeMesh, WireframeGeometryType } from './wireframe';
import { createMeshFromShape } from './shape';
import { createMeshFromSubType } from './mesh';
import {
  vecSquareDistance,
  vec3MulMat4,
  vecSub,
  mat4MulMat4,
  computeOrthographicOffCenter,
  vec3ToVec2,
  vec4MulMat4,
  vecAdd,
  vecNormalize,
  vecMulScalar,
} from './math/vec';
import { intersectRayLine } from './raycast';
import { moveToPointWidthFixDistance } from './util';

const constants = glContext;

type mat4 = spec.mat4;
type vec3 = spec.vec3;
type vec2 = spec.vec2;
type vec4 = spec.vec4;

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
  points: [vec3, vec3],
  // 射线与线条距离阈值
  width: number,
}

/**
 * 立方体包围盒类型
 */
export interface GizmoItemBoundingBox {
  type: BoundingType.box,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: vec3,
  //包围盒的xyz长度，当type为box时生效
  size: vec3,
}

/**
 * 球体包围盒类型
 */
export interface GizmoItemBoundingSphere {
  type: BoundingType.sphere,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: vec3,
  //包围球的半径，当type为sphere时生效
  radius: number,
}

/**
 * 三角数组包围盒类型
 */
export interface GizmoItemBoundingTriangle {
  type: BoundingType.triangle,
  triangles: Triangle[],
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
  override duration!: number;
  target!: number;
  subType!: GizmoSubType;
  color!: vec3;
  renderMode!: GeometryDrawMode;
  depthTest?: boolean;
  size: any;
  contents?: Map<Mesh, Transform>;
  targetItem?: VFXItem<any>;
  boundingMap: Map<string, GizmoItemBounding> = new Map();
  hitBounding?: { key: string, position: vec3 };
  mat: mat4 = [] as unknown as mat4;
  wireframeMesh?: Mesh;
  spriteMesh?: SpriteMesh;

  private engine: Engine;

  override get type () {
    return GizmoVFXItemType;
  }

  override set type (t) {
  }

  override set content (content: Mesh | undefined) {
  }

  override get content () {
    return this._content;
  }

  override onConstructed (options: { content: { options: any, transform?: any } }) {
    this.duration = 999;
    const opt = options.content.options as GizmoVFXItemOptions;

    this.target = opt.target;
    this.subType = opt.subType;
    this.renderMode = opt.renderMode || this.getDefaultRenderMode();
    this.size = opt.size || this.getDefaultSize();
    this.depthTest = opt.depthTest;
    const c = (opt.color || [255, 255, 255]);

    this.color = [c[0] / 255, c[1] / 255, c[2] / 255] as unknown as vec3;
    if (options.content) { this.transform = new Transform(options.content.transform); }
  }

  /**
   * 获取默认绘制模式
   * @returns 绘制模式常量
   */
  getDefaultRenderMode (): GeometryDrawMode {
    let result: GeometryDrawMode;

    switch (this.subType) {
      case GizmoSubType.particleEmitter:
      case GizmoSubType.modelWireframe:
      case GizmoSubType.frustum:
      case GizmoSubType.directionLight:
      case GizmoSubType.spotLight:
      case GizmoSubType.pointLight:
      case GizmoSubType.floorGrid:
        result = constants.LINES;

        break;
      default:
        result = constants.TRIANGLES;

        break;
    }

    return result;
  }

  /**
   * 获取默认尺寸
   * @returns 几何体尺寸
   */
  getDefaultSize () {
    let result = {};

    switch (this.subType) {
      case GizmoSubType.box:
        result = { width: 1, height: 1, depth: 1 };

        break;
      case GizmoSubType.sphere:
        result = { radius: 1 };

        break;
      case GizmoSubType.cylinder:
        result = { radius: 1, height: 1 };

        break;
      case GizmoSubType.cone:
        result = { radius: 1, height: 1 };

        break;
      default:
        result = {};

        break;
    }

    return result;
  }

  createModelContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const ms = item.content.mriMeshs as Mesh[];
    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    if (ms) {
      this.targetItem = item;
      ms.forEach(m => {
        const mesh = this.wireframeMesh = createModeWireframe(engine, m, this.color);

        meshesToAdd.push(mesh);
      });
    }
  }

  createParticleContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const shape = (item as any).particle?.shape;
    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    this.targetItem = item;
    if (shape && shape.type) {
      const mesh = this._content = createMeshFromShape(engine, shape, { color: this.color });

      meshesToAdd.push(mesh);
    }
    // if (item.content?.particleMesh) {
    //   const mesh = this.wireframeMesh = createParticleWireframe(engine, item.content.particleMesh.mesh, this.color);

    //   meshesToAdd.push(mesh);
    // }
    if (item.type === spec.ItemType.sprite || item.type === spec.ItemType.filter) {
      const color = this.color.slice();
      const mesh = this.spriteMesh = (item as SpriteVFXItem).createWireframeMesh(item.content, color as vec4);

      this.wireframeMesh = mesh.mesh;
      meshesToAdd.push(mesh.mesh);
    }
  }

  /**
   * 创建 BoundingBox 几何体模型
   * @param item - VFXItem
   * @param meshesToAdd - 插件缓存的 Mesh 数组
   */
  createBoundingBoxContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const shape = {
      shape: 'Box',
      width: this.size.width,
      height: this.size.height,
      depth: this.size.depth,
      center: this.size.center,
    };
    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    this.targetItem = item;
    if (shape) {
      const mesh = this._content = createMeshFromShape(engine, shape, { color: this.color, depthTest: this.depthTest });

      meshesToAdd.push(mesh);
    }
  }

  /**
   * 创建基础几何体模型
   * @param item - VFXItem
   * @param meshesToAdd - 插件缓存的 Mesh 数组
   * @param subType - GizmoSubType 类型
   */
  createBasicContent (item: VFXItem<Mesh | undefined>, meshesToAdd: Mesh[], subType: GizmoSubType, iconTextures?: Map<string, Texture>) {
    const options = {
      size: this.size,
      color: this.color,
      renderMode: this.renderMode,
      depthTest: this.depthTest,
    };
    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    const mesh = this._content = createMeshFromSubType(engine, subType, this.boundingMap, iconTextures, options) as Mesh;

    this.targetItem = item;
    meshesToAdd.push(mesh);
  }

  /**
   * 创建组合几何体模型
   * @param item - VFXItem
   * @param meshesToAdd - 插件缓存的 Mesh 数组
   * @param subType - GizmoSubType 类型
   * @param iconTextures - XYZ 图标纹理（viewHelper 专用）
   */
  createCombinationContent (item: VFXItem<Mesh | undefined>, meshesToAdd: Mesh[], subType: GizmoSubType, iconTextures?: Map<string, Texture>) {
    const options = {
      size: this.size,
      renderMode: this.renderMode,
    };

    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    this.contents = createMeshFromSubType(engine, subType, this.boundingMap, iconTextures, options) as Map<Mesh, Transform>;
    for (const mesh of this.contents.keys()) {
      meshesToAdd.push(mesh);
    }
    this.targetItem = item;
  }

  override onItemUpdate () {

  }

  updateRenderData () {
    if (this.subType === GizmoSubType.particleEmitter) { // 粒子发射器
      if (this.targetItem && this.content) {
        this.mat = this.targetItem.transform.getWorldMatrix();
        this.content.material.setMatrix('u_model', this.mat);
      }
      if (this.spriteMesh) {
        this.spriteMesh.updateItem((this.targetItem as SpriteVFXItem).content);
      } else if (this.wireframeMesh && this.targetItem) {
        const particle = this.targetItem.content;

        if (particle) {
          updateWireframeMesh(particle.particleMesh.mesh as Mesh, this.wireframeMesh, WireframeGeometryType.quad);
          this.wireframeMesh.worldMatrix = particle.particleMesh.mesh.worldMatrix;
        }
      }
    } else if (this.subType === GizmoSubType.modelWireframe) { // 模型线框
      if (this.wireframeMesh && this.targetItem) {
        const meshes = this.targetItem.content.mriMeshs as Mesh[];
        const wireframeMesh = this.wireframeMesh;

        if (meshes?.length > 0) {
          meshes.forEach(mesh => updateWireframeMesh(mesh, wireframeMesh, WireframeGeometryType.triangle));
        }
      }
    } else { // 几何体模型
      if (this.targetItem) {
        if (this.contents) { // 组合几何体
          // const targetTransform = this.targetItem.transform.clone();

          const worldPos: vec3 = [0, 0, 0];
          const worldQuat: vec4 = [0, 0, 0, 0];
          const worldSca: vec3 = [1, 1, 1];

          this.targetItem.transform.assignWorldTRS(worldPos, worldQuat);

          const targetTransform = new Transform({
            position: worldPos,
            quat: worldQuat,
            scale: worldSca,
            valid: true,
          });

          // 移动\旋转\缩放gizmo去除近大远小
          if (this.subType === GizmoSubType.rotation || this.subType === GizmoSubType.scale || this.subType === GizmoSubType.translation) {
            const camera = this.composition!.camera;
            const cameraPos = camera.position || [0, 0, 0];
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(...newPos);
          }

          this.mat = targetTransform.getWorldMatrix();
          const center = targetTransform.position;

          for (const [mesh, transform] of this.contents) {
            let worldMat4 = [] as unknown as mat4;

            transform.parentTransform = targetTransform;
            const position: vec3 = [0, 0, 0];

            transform.assignWorldTRS(position);
            // 物体和中心点在屏幕空间上投影的距离
            let distanceToCneter = 100;
            let theta = 1;

            if (this.subType === GizmoSubType.viewHelper) {
              // 正交投影只需要计算物体在XY平面上的投影与中心点的距离
              if (mesh.name === 'sprite') {
                distanceToCneter = Math.pow(vecSquareDistance(vec3ToVec2(position), vec3ToVec2(center)), 0.5);
                theta = (this.boundingMap.get('posX') as GizmoItemBoundingSphere).radius;
              }
              // 将物体挂到相机的transform上
              const fov = 30; // 指定fov角度
              const screenWidth = this.composition!.renderer.getWidth();
              const screenHeight = this.composition!.renderer.getHeight();
              const distance = 16; // 指定物体与相机的距离
              const width = 2 * Math.tan(fov * Math.PI / 360) * distance;
              const aspect = screenWidth / screenHeight;
              const height = width / aspect;
              const cameraModelMat4 = this.composition!.camera.getInverseViewMatrix();
              const padding = this.size.padding || 1; // 指定viewHelper与屏幕右上角的边距
              let localMat = [] as unknown as mat4;

              localMat = transform.getWorldMatrix();
              const worldTransform: Transform = new Transform({
                valid: true,
              });

              worldTransform.cloneFromMatrix(localMat);
              worldTransform.setPosition((position[0] + width / 2) - padding, (position[1] + height / 2) - padding, position[2]);
              localMat = worldTransform.getWorldMatrix();
              worldMat4 = mat4MulMat4(cameraModelMat4, localMat);
              // 正交投影到屏幕上
              const proMat5 = computeOrthographicOffCenter(-width / 2, width / 2, -height / 2, height / 2, -distance, distance);

              mesh.material.setMatrix('_MatrixP', proMat5);
            } else {
              if (this.subType === GizmoSubType.rotation) {
                const cameraPos = this.composition!.camera.position || [0, 0, 0];

                mesh.material.setVector3('u_cameraPos', cameraPos);
                mesh.material.setVector3('u_center', center);
              }
              worldMat4 = transform.getWorldMatrix();
              // TODO 计算物体和中心点在屏幕空间上投影的距离 distanceToCneter
            }
            mesh.material.setMatrix('u_model', worldMat4);

            // 使用distanceToCneter处理坐标轴旋转到中心点附近时的遮挡问题
            if (distanceToCneter < theta) {
              if (distanceToCneter < theta * 0.5) {
                mesh.material.setVector2('u_alpha', [0, 0]);
              } else {
                mesh.material.setVector2('u_alpha', [(2 / theta) * distanceToCneter - 1, 0]);
              }
            }
          }
        }
        if (this.content) { // 基础几何体
          const worldPos: vec3 = [0, 0, 0];
          const worldQuat: vec4 = [0, 0, 0, 0];
          const worldSca: vec3 = [1, 1, 1];

          this.targetItem.transform.assignWorldTRS(worldPos, worldQuat);

          const targetTransform = new Transform({
            position: worldPos,
            quat: worldQuat,
            scale: worldSca,
            valid: true,
          });

          if (this.subType === GizmoSubType.light || this.subType === GizmoSubType.camera) {
            const camera = this.composition!.camera;
            const cameraPos = camera.position || [0, 0, 0];
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(...newPos);
          }

          this.mat = targetTransform.getWorldMatrix();

          this.content.material.setMatrix('u_model', targetTransform.getWorldMatrix());
        }
      }
    }
  }

  /**
   * 射线检测算法
   * @returns 包含射线检测算法回调方法的参数
   */
  override getHitTestParams (): void | HitTestCustomParams {
    const boundingMap = this.boundingMap;

    if (boundingMap.size > 0) {
      const boundingKeys = boundingMap.keys();
      let worldMat4 = [] as unknown as mat4;

      worldMat4 = this.transform.getWorldMatrix();

      if (this.targetItem) {
        //const targetTransform = this.targetItem.transform.clone();
        const worldPos: vec3 = [0, 0, 0];
        const worldQuat: vec4 = [0, 0, 0, 0];
        const worldSca: vec3 = [1, 1, 1];

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

          targetTransform.setPosition(...newPos);
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
        collect (ray: Ray, pointInCanvas: vec2): vec3[] | void {
          const hitPositions = [];

          self.hitBounding = undefined;
          for (const key of boundingKeys) {
            const bounding = boundingMap.get(key);
            let center: vec3 = [0, 0, 0];
            const worldCenter: vec3 = [0, 0, 0];

            if (bounding?.type === BoundingType.box || bounding?.type === BoundingType.sphere) {
              center = bounding?.center ? bounding.center.slice() as vec3 : [0, 0, 0];
              vec3MulMat4(worldCenter, center, worldMat4);
            }
            let position;

            switch (bounding?.type) {
              case BoundingType.box: // 立方体包围盒
                bounding;
                position = intersectRayBox([], ray.center, ray.direction, worldCenter, bounding?.size);

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
                  let localMat4 = [] as unknown as mat4;

                  localTransform.cloneFromMatrix(worldMat4);
                  const pos = localTransform.position;
                  const padding = self.size.padding || 1; // 指定viewHelper与屏幕右上角的边距

                  localTransform.setPosition((pos[0] + width / 2) - padding, (pos[1] + height / 2) - padding, pos[2]);
                  localMat4 = localTransform.getWorldMatrix();
                  const modelMat4 = mat4MulMat4(cameraModelMat4, localMat4);

                  vec3MulMat4(worldCenter, center, modelMat4);

                  // 包围球中心点正交投影到屏幕上
                  const screenCenter: vec4 = [0, 0, 0, 0];
                  const vpMat4 = mat4MulMat4(proMat4, viewMat4);
                  const mvpMat4 = mat4MulMat4(vpMat4, modelMat4);

                  vec4MulMat4(screenCenter, [...center, 1.0] as vec4, mvpMat4);
                  const screenCenterX = screenCenter[0] / screenCenter[3];
                  const screenCenterY = screenCenter[1] / screenCenter[3];

                  // 包围球上的点正交投影到屏幕上
                  const radius = bounding.radius;
                  const point: vec3 = [0, 0, 0];
                  const up = [
                    localMat4[1],
                    localMat4[5],
                    localMat4[9],
                  ];

                  vecMulScalar(point, vecNormalize(up), radius);
                  vecAdd(point, center, point);

                  const screenPoint: vec4 = [0, 0, 0, 0];

                  vec4MulMat4(screenPoint, [...point, 1.0] as vec4, mvpMat4);
                  const screenPointX = screenPoint[0] / screenPoint[3];
                  const screenPointY = screenPoint[1] / screenPoint[3];

                  // 计算正交投影到屏幕上的包围球的半径
                  const vecRadius: vec2 = [0, 0];

                  vecSub(vecRadius, [screenCenterX, screenCenterY], [screenPointX, screenPointY]);
                  const screenRadius = Math.hypot(...vecRadius);

                  if (Math.pow(vecSquareDistance(pointInCanvas, [screenCenterX, screenCenterY]), 0.5) < screenRadius * 1.2) {
                    position = worldCenter;
                  }
                } else {
                  bounding;
                  position = intersectRaySphere([], ray.center, ray.direction, worldCenter, bounding?.radius);
                }

                break;
              case BoundingType.triangle: {// 三角数组包围盒
                const { triangles, backfaceCulling } = bounding;
                const tmpPositions = [];
                let tmpPosition;

                for (let j = 0; j < triangles.length; j++) {
                  const triangle = triangles[j];
                  const worldTriangle: Triangle = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

                  // 坐标转换为世界坐标
                  for (let i = 0; i < 3; i++) {
                    const worldPosition: vec3 = [0, 0, 0];

                    vec3MulMat4(worldPosition, triangle[i], worldMat4);
                    worldTriangle[i] = worldPosition;
                  }

                  tmpPosition = intersectRayTriangle([], ray.center, ray.direction, worldTriangle, backfaceCulling);
                  if (tmpPosition) {
                    tmpPositions.push(tmpPosition);
                  }
                }
                // 仅保存距离相机最近的点
                if (tmpPositions.length > 0) {
                  let lastDistance: number;

                  tmpPositions.forEach(item => {
                    const distance = vecSquareDistance(ray.center, item);

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

                position = intersectRayLine([], pointInCanvas, points, width / 2, worldMat4, self.composition!.camera);

                break;
              }
              default:
                break;
            }
            if (position) {
              hitPositions.push(position);
              //  缓存距离相机最近的 BoundingKey
              if (self.hitBounding) {
                const distance = vecSquareDistance(ray.center, position);
                const lastDistance = vecSquareDistance(ray.center, self.hitBounding.position);

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
