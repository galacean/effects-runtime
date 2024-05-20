import type { GeometryDrawMode, HitTestCustomParams, Mesh, Texture, VFXItem, VFXItemContent } from '@galacean/effects';
import { HitTestType, ItemBehaviour, RendererComponent, Transform, assertExist, effectsClass, glContext, math, spec } from '@galacean/effects';
import type { GizmoVFXItemOptions } from './define';
import { GizmoSubType } from './define';
import { iconTextures, type EditorGizmoPlugin } from './gizmo-loader';
import type { GizmoItemBounding, Ray, TriangleLike } from './gizmo-vfx-item';
import { BoundingType, type GizmoItemBoundingSphere } from './gizmo-vfx-item';
import { computeOrthographicOffCenter } from './math-utils';
import { createMeshFromSubType } from './mesh';
import { intersectRayLine } from './raycast';
import { createMeshFromShape } from './shape';
import { moveToPointWidthFixDistance } from './util';
import { WireframeGeometryType, createModeWireframe, updateWireframeMesh } from './wireframe';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;

const { Vector2, Vector3, Matrix4, Quaternion } = math;
const constants = glContext;

@effectsClass('GizmoComponent')
export class GizmoComponent extends ItemBehaviour {
  gizmoPlugin: EditorGizmoPlugin;
  targetItem: VFXItem<any>;
  needCreateModelContent: boolean;
  target: string;
  subType: GizmoSubType;
  size: any;
  contents?: Map<Mesh, Transform>;
  boundingMap: Map<string, GizmoItemBounding> = new Map();
  hitBounding?: { key: string, position: Vector3 };
  wireframeMesh: Mesh;

  color: spec.vec3;
  renderMode!: GeometryDrawMode;
  depthTest?: boolean;
  mat = Matrix4.fromIdentity();
  wireframeMeshes: Mesh[] = [];

  override start (): void {
    this.item.getHitTestParams = this.getHitTestParams;
    for (const item of this.item.composition!.items) {
      if (item.id === this.target) {
        this.targetItem = item;
      }
    }
    const targetItem = this.targetItem;

    if (!targetItem) {

      return;
    }
    const composition = this.item.composition!;

    for (const plugin of composition.pluginSystem.plugins) {
      if (plugin.name === 'editor-gizmo') {
        this.gizmoPlugin = plugin as EditorGizmoPlugin;
      }
    }
    const gizmoPlugin = this.gizmoPlugin;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (targetItem.type === '7' || !gizmoPlugin) {
      return;
    }
    const gizmoVFXItemList: VFXItem<VFXItemContent>[] = composition.loaderData.gizmoTarget[targetItem.id];

    if (gizmoVFXItemList && gizmoVFXItemList.length > 0) {
      for (const gizmoVFXItem of gizmoVFXItemList) {
        const gizmoSubType = gizmoVFXItem.getComponent(GizmoComponent)!.subType;

        switch (gizmoSubType) {
          case GizmoSubType.particleEmitter:
            this.createParticleContent(targetItem, gizmoPlugin.meshToAdd);

            break;
          case GizmoSubType.modelWireframe:
            this.needCreateModelContent = true;
            // gizmoVFXItem.createModelContent(targetItem, gizmoPlugin.meshToAdd);

            break;
          case GizmoSubType.box:
          case GizmoSubType.sphere:
          case GizmoSubType.cylinder:
          case GizmoSubType.cone:
          case GizmoSubType.torus:
          case GizmoSubType.sprite:
          case GizmoSubType.frustum:
          case GizmoSubType.directionLight:
          case GizmoSubType.pointLight:
          case GizmoSubType.spotLight:
          case GizmoSubType.floorGrid:
            this.createBasicContent(targetItem, gizmoPlugin.meshToAdd, gizmoSubType);

            break;
          case GizmoSubType.camera:
          case GizmoSubType.light:
            this.createBasicContent(targetItem, gizmoPlugin.meshToAdd, gizmoSubType, iconTextures);

            break;
          case GizmoSubType.rotation:
          case GizmoSubType.scale:
          case GizmoSubType.translation:
            this.createCombinationContent(targetItem, gizmoPlugin.meshToAdd, gizmoSubType);

            break;
          case GizmoSubType.viewHelper:
            this.createCombinationContent(targetItem, gizmoPlugin.meshToAdd, gizmoSubType, iconTextures);

            break;
          case GizmoSubType.boundingBox:
            this.createBoundingBoxContent(targetItem, gizmoPlugin.meshToAdd);

            break;
          default:
            break;
        }
      }
    }
    composition.loaderData.gizmoItems.push(this.item);
  }

  override update (dt: number): void {
    this.updateRenderData();
  }

  override lateUpdate (dt: number): void {
    if (this.needCreateModelContent) {
      this.createModelContent(this.targetItem, this.gizmoPlugin.meshToAdd);
      this.needCreateModelContent = false;
    }
  }

  updateRenderData () {
    const item = this.item;
    const gizmoSubType = this.subType;

    if (gizmoSubType === GizmoSubType.particleEmitter) { // 粒子发射器
      if (this.targetItem && item.content) {
        this.mat = this.targetItem.transform.getWorldMatrix();
        //@ts-expect-error
        item.content.material.setMatrix('u_model', this.mat);
      }
      if (this.wireframeMesh && this.targetItem) {
        const particle = this.targetItem.content;

        if (particle) {
          updateWireframeMesh(particle.particleMesh.mesh as Mesh, this.wireframeMesh, WireframeGeometryType.quad);
          this.wireframeMesh.worldMatrix = particle.particleMesh.mesh.worldMatrix;
        }
      }
    } else if (gizmoSubType === GizmoSubType.modelWireframe) { // 模型线框
      if (this.wireframeMesh && this.targetItem) {
        // @ts-expect-error
        const meshes = this.targetItem.getComponent(RendererComponent)?.content.mriMeshs as Mesh[];
        const wireframeMeshes = this.wireframeMeshes;

        if (meshes?.length > 0) {
          for (let i = 0; i < meshes.length; i++) {
            updateWireframeMesh(meshes[i], wireframeMeshes[i], WireframeGeometryType.triangle);
          }
        }
      }
    } else { // 几何体模型
      if (this.targetItem) {
        if (this.contents) { // 组合几何体
          // const targetTransform = this.targetItem.transform.clone();

          const worldPos = new Vector3();
          const worldQuat = new Quaternion();
          const worldScale = new Vector3(1, 1, 1);

          this.targetItem.transform.assignWorldTRS(worldPos, worldQuat);

          const targetTransform = new Transform({
            position: worldPos,
            quat: worldQuat,
            scale: worldScale,
            valid: true,
          });

          // 移动\旋转\缩放gizmo去除近大远小
          if (gizmoSubType === GizmoSubType.rotation || gizmoSubType === GizmoSubType.scale || gizmoSubType === GizmoSubType.translation) {
            const camera = item.composition!.camera;
            const cameraPos = camera.position || new Vector3();
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(newPos.x, newPos.y, newPos.z);
          }

          this.mat = targetTransform.getWorldMatrix();
          const center = targetTransform.position;

          for (const [mesh, transform] of this.contents) {
            let worldMat4: Matrix4;

            transform.parentTransform = targetTransform;
            const position = new Vector3();

            transform.assignWorldTRS(position);
            // 物体和中心点在屏幕空间上投影的距离
            let distanceToCneter = 100;
            let theta = 1;

            if (gizmoSubType === GizmoSubType.viewHelper) {
              // 正交投影只需要计算物体在XY平面上的投影与中心点的距离
              if (mesh.name === 'sprite') {
                distanceToCneter = position.toVector2().distance(center.toVector2());
                theta = (this.boundingMap.get('posX') as GizmoItemBoundingSphere).radius;
              }
              // 将物体挂到相机的transform上
              const fov = 30; // 指定fov角度
              const screenWidth = item.composition!.renderer.getWidth();
              const screenHeight = item.composition!.renderer.getHeight();
              const distance = 16; // 指定物体与相机的距离
              const width = 2 * Math.tan(fov * Math.PI / 360) * distance;
              const aspect = screenWidth / screenHeight;
              const height = width / aspect;
              const cameraModelMat4 = item.composition!.camera.getInverseViewMatrix();
              const padding = this.size.padding || 1; // 指定viewHelper与屏幕右上角的边距
              let localMat: Matrix4;

              localMat = transform.getWorldMatrix();
              const worldTransform: Transform = new Transform({
                valid: true,
              });

              worldTransform.cloneFromMatrix(localMat);
              worldTransform.setPosition((position.x + width / 2) - padding, (position.y + height / 2) - padding, position.z);
              localMat = worldTransform.getWorldMatrix();
              worldMat4 = cameraModelMat4.clone().multiply(localMat);
              // 正交投影到屏幕上
              const proMat5 = computeOrthographicOffCenter(-width / 2, width / 2, -height / 2, height / 2, -distance, distance);

              mesh.material.setMatrix('_MatrixP', proMat5);
            } else {
              if (gizmoSubType === GizmoSubType.rotation) {
                const cameraPos = item.composition!.camera.position || [0, 0, 0];

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
                mesh.material.setVector2('u_alpha', new Vector2(0, 0));
              } else {
                mesh.material.setVector2('u_alpha', new Vector2((2 / theta) * distanceToCneter - 1, 0));
              }
            }
          }
        }
        if (item.content) { // 基础几何体
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

          if (gizmoSubType === GizmoSubType.light || gizmoSubType === GizmoSubType.camera) {
            const camera = item.composition!.camera;
            const cameraPos = camera.position || new Vector3(0, 0, 0);
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(newPos.x, newPos.y, newPos.z);
          }

          this.mat = targetTransform.getWorldMatrix();

          //@ts-expect-error
          item.content.material.setMatrix('u_model', targetTransform.getWorldMatrix());
        }
      }
    }
  }

  /**
   * 获取默认绘制模式
   * @returns 绘制模式常量
   */
  getDefaultRenderMode (): GeometryDrawMode {
    let result: GeometryDrawMode;
    const gizmoSubType = this.subType;

    switch (gizmoSubType) {
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
    const gizmoSubType = this.subType;

    switch (gizmoSubType) {
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
    const modelComponent = item.getComponent(RendererComponent)!;
    // @ts-expect-error
    const ms = modelComponent.content.mriMeshs as Mesh[];
    const engine = item.composition?.renderer.engine;

    assertExist(engine);

    if (ms) {
      this.targetItem = item;
      this.wireframeMeshes = [];
      ms.forEach(m => {
        const mesh = this.wireframeMesh = createModeWireframe(engine, m, this.color);

        this.wireframeMeshes.push(mesh);
        meshesToAdd.push(mesh);
      });
    }
  }

  createParticleContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const shape = (item as any).props.content.shape;
    const engine = this.item.composition?.renderer.engine;

    assertExist(engine);

    this.targetItem = item;
    if (shape && shape.type) {
      const mesh = this.item._content = createMeshFromShape(engine, shape, { color: this.color });

      meshesToAdd.push(mesh);
    }
  }

  /**
   * 创建 BoundingBox 几何体模型
   * @param item - VFXItem
   * @param meshesToAdd - 插件缓存的 Mesh 数组
   */
  createBoundingBoxContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const gizmoItem = this.item;
    const shape = {
      shape: 'Box',
      width: this.size.width,
      height: this.size.height,
      depth: this.size.depth,
      center: this.size.center,
    };
    const engine = gizmoItem.composition?.renderer.engine;

    assertExist(engine);

    this.targetItem = item;
    if (shape) {
      const mesh = gizmoItem._content = createMeshFromShape(engine, shape, { color: this.color, depthTest: this.depthTest });

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
    const gizmoItem = this.item;
    const options = {
      size: this.size,
      color: this.color,
      renderMode: this.renderMode,
      depthTest: this.depthTest,
    };
    const engine = gizmoItem.composition?.renderer.engine;

    assertExist(engine);

    const mesh = gizmoItem._content = createMeshFromSubType(engine, subType, this.boundingMap, iconTextures, options) as Mesh;

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
    const gizmoItem = this.item;
    const options = {
      size: this.size,
      renderMode: this.renderMode,
    };

    const engine = gizmoItem.composition?.renderer.engine;

    assertExist(engine);

    this.contents = createMeshFromSubType(engine, subType, this.boundingMap, iconTextures, options) as Map<Mesh, Transform>;
    for (const mesh of this.contents.keys()) {
      meshesToAdd.push(mesh);
    }
    this.targetItem = item;
  }

  override fromData (data: any): void {
    super.fromData(data);
    const item = this.item;

    item.duration = 999;
    const opt = data.options as GizmoVFXItemOptions;

    this.target = opt.target;
    this.subType = opt.subType;
    this.renderMode = opt.renderMode || this.getDefaultRenderMode();
    this.size = opt.size || this.getDefaultSize();
    this.depthTest = opt.depthTest;
    const c = (opt.color || [255, 255, 255]);

    this.color = [c[0] / 255, c[1] / 255, c[2] / 255];
    if (data) { item.transform = new Transform(data.transform); }
  }

  /**
   * 射线检测算法
   * @returns 包含射线检测算法回调方法的参数
   */
  private getHitTestParams = (): void | HitTestCustomParams => {
    const item = this.item;
    const boundingMap = this.boundingMap;

    if (boundingMap.size > 0) {
      const boundingKeys = boundingMap.keys();
      let worldMat4: Matrix4;

      worldMat4 = this.transform.getWorldMatrix();
      const targetItem = this.targetItem;

      if (targetItem) {
        //const targetTransform = this.targetItem.transform.clone();
        const worldPos = new Vector3();
        const worldQuat = new Quaternion();
        const worldSca = new Vector3(1, 1, 1);

        targetItem.transform.assignWorldTRS(worldPos, worldQuat);

        const targetTransform = new Transform({
          position: worldPos,
          quat: worldQuat,
          scale: worldSca,
          valid: true,
        });

        const gizmoSubType = item.getComponent(GizmoComponent)?.subType;

        // 移动\旋转\缩放gizmo去除近大远小
        if (
          gizmoSubType === GizmoSubType.rotation ||
          gizmoSubType === GizmoSubType.scale ||
          gizmoSubType === GizmoSubType.translation ||
          gizmoSubType === GizmoSubType.camera ||
          gizmoSubType === GizmoSubType.light
        ) {
          const camera = item.composition!.camera;
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
      const self = item;

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
          const gizmoComponent = self.getComponent(GizmoComponent)!;

          gizmoComponent.hitBounding = undefined;
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
                if (gizmoComponent.subType === GizmoSubType.viewHelper) {
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
                  const padding = gizmoComponent.size.padding || 1; // 指定viewHelper与屏幕右上角的边距

                  localTransform.setPosition((pos.x + width / 2) - padding, (pos.y + height / 2) - padding, pos.z);
                  const localMat4 = localTransform.getWorldMatrix();
                  const modelMat4 = cameraModelMat4.clone().multiply(localMat4);

                  modelMat4.projectPoint(center, worldCenter);

                  // 包围球中心点正交投影到屏幕上
                  const vpMat4 = proMat4.clone().multiply(viewMat4);
                  const mvpMat4 = vpMat4.clone().multiply(modelMat4);
                  const screenCenter = mvpMat4.projectPoint(center, new Vector3());
                  // const screenCenterX = screenCenter.x;
                  // const screenCenterY = screenCenter.y;

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
                  // const screenPointX = screenPoint.x;
                  // const screenPointY = screenPoint.y;

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
              if (gizmoComponent.hitBounding) {
                const distance = ray.origin.distanceSquared(position);
                const lastDistance = ray.origin.distanceSquared(gizmoComponent.hitBounding.position);

                if (distance < lastDistance) {
                  gizmoComponent.hitBounding.key = key;
                  gizmoComponent.hitBounding.position = position;
                }
              } else {
                gizmoComponent.hitBounding = {
                  key,
                  position,
                };
              }
            }
          }
          if (hitPositions.length === 0) {
            gizmoComponent.hitBounding = undefined;
          }

          return hitPositions;
        },
        behavior: spec.InteractBehavior.NOTIFY,
      };
    }
  };
}
