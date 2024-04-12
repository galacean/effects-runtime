import type { GeometryDrawMode, Mesh, Texture, VFXItem, VFXItemProps, spec } from '@galacean/effects';
import { ItemBehaviour, RendererComponent, Transform, assertExist, glContext, math } from '@galacean/effects';
import type { GizmoVFXItemOptions } from './define';
import { GizmoSubType } from './define';
import { iconTextures, type EditorGizmoPlugin } from './gizmo-loader';
import type { GizmoItemBoundingSphere, GizmoVFXItem } from './gizmo-vfx-item';
import { WireframeGeometryType, createModeWireframe, updateWireframeMesh } from './wireframe';
import { computeOrthographicOffCenter } from './math-utils';
import { moveToPointWidthFixDistance } from './util';
import { createMeshFromSubType } from './mesh';
import { createMeshFromShape } from './shape';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;

const { Vector2, Vector3, Matrix4, Quaternion } = math;
const constants = glContext;

export class GizmoComponent extends ItemBehaviour {
  gizmoPlugin: EditorGizmoPlugin;
  targetItem: VFXItem<any>;
  needCreateModelContent: boolean;

  color: spec.vec3;
  renderMode!: GeometryDrawMode;
  depthTest?: boolean;
  mat = Matrix4.fromIdentity();
  wireframeMeshes: Mesh[] = [];

  override start (): void {
    for (const item of this.item.composition!.items) {
      if (item.id === (this.item as GizmoVFXItem).target) {
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
    const gizmoVFXItemList: GizmoVFXItem[] = composition.loaderData.gizmoTarget[targetItem.id];

    if (gizmoVFXItemList && gizmoVFXItemList.length > 0) {
      for (const gizmoVFXItem of gizmoVFXItemList) {
        switch (gizmoVFXItem.subType) {
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
            this.createBasicContent(targetItem, gizmoPlugin.meshToAdd, gizmoVFXItem.subType);

            break;
          case GizmoSubType.camera:
          case GizmoSubType.light:
            this.createBasicContent(targetItem, gizmoPlugin.meshToAdd, gizmoVFXItem.subType, iconTextures);

            break;
          case GizmoSubType.rotation:
          case GizmoSubType.scale:
          case GizmoSubType.translation:
            this.createCombinationContent(targetItem, gizmoPlugin.meshToAdd, gizmoVFXItem.subType);

            break;
          case GizmoSubType.viewHelper:
            this.createCombinationContent(targetItem, gizmoPlugin.meshToAdd, gizmoVFXItem.subType, iconTextures);

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
    const item = this.item as GizmoVFXItem;

    if (item.subType === GizmoSubType.particleEmitter) { // 粒子发射器
      if (this.targetItem && item.content) {
        this.mat = this.targetItem.transform.getWorldMatrix();
        item.content.material.setMatrix('u_model', this.mat);
      }
      if (item.wireframeMesh && this.targetItem) {
        const particle = this.targetItem.content;

        if (particle) {
          updateWireframeMesh(particle.particleMesh.mesh as Mesh, item.wireframeMesh, WireframeGeometryType.quad);
          item.wireframeMesh.worldMatrix = particle.particleMesh.mesh.worldMatrix;
        }
      }
    } else if (item.subType === GizmoSubType.modelWireframe) { // 模型线框
      if (item.wireframeMesh && this.targetItem) {
        // @ts-expect-error
        const meshes = this.targetItem.getComponent(RendererComponent)?.content.mriMeshs as Mesh[];
        const wireframeMeshes = this.wireframeMeshes;

        if (meshes?.length > 0) {
          for (let i = 0;i < meshes.length;i++) {
            updateWireframeMesh(meshes[i], wireframeMeshes[i], WireframeGeometryType.triangle);
          }
        }
      }
    } else { // 几何体模型
      if (this.targetItem) {
        if (item.contents) { // 组合几何体
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
          if (item.subType === GizmoSubType.rotation || item.subType === GizmoSubType.scale || item.subType === GizmoSubType.translation) {
            const camera = item.composition!.camera;
            const cameraPos = camera.position || new Vector3();
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(newPos.x, newPos.y, newPos.z);
          }

          this.mat = targetTransform.getWorldMatrix();
          const center = targetTransform.position;

          for (const [mesh, transform] of item.contents) {
            let worldMat4: Matrix4;

            transform.parentTransform = targetTransform;
            const position = new Vector3();

            transform.assignWorldTRS(position);
            // 物体和中心点在屏幕空间上投影的距离
            let distanceToCneter = 100;
            let theta = 1;

            if (item.subType === GizmoSubType.viewHelper) {
              // 正交投影只需要计算物体在XY平面上的投影与中心点的距离
              if (mesh.name === 'sprite') {
                distanceToCneter = position.toVector2().distance(center.toVector2());
                theta = (item.boundingMap.get('posX') as GizmoItemBoundingSphere).radius;
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
              const padding = item.size.padding || 1; // 指定viewHelper与屏幕右上角的边距
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
              if (item.subType === GizmoSubType.rotation) {
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

          if (item.subType === GizmoSubType.light || item.subType === GizmoSubType.camera) {
            const camera = item.composition!.camera;
            const cameraPos = camera.position || new Vector3(0, 0, 0);
            const itemPos = targetTransform.position;
            const newPos = moveToPointWidthFixDistance(cameraPos, itemPos);

            targetTransform.setPosition(newPos.x, newPos.y, newPos.z);
          }

          this.mat = targetTransform.getWorldMatrix();

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
    const item = this.item as GizmoVFXItem;

    switch (item.subType) {
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
    const item = this.item as GizmoVFXItem;

    switch (item.subType) {
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
        const mesh = (this.item as GizmoVFXItem).wireframeMesh = createModeWireframe(engine, m, this.color);

        this.wireframeMeshes.push(mesh);
        meshesToAdd.push(mesh);
      });
    }
  }

  createParticleContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const shape = (item as any).props.content.shape;
    const engine = (this.item as GizmoVFXItem).composition?.renderer.engine;

    assertExist(engine);

    this.targetItem = item;
    if (shape && shape.type) {
      const mesh = (this.item as GizmoVFXItem)._content = createMeshFromShape(engine, shape, { color: this.color });

      meshesToAdd.push(mesh);
    }
  }

  /**
   * 创建 BoundingBox 几何体模型
   * @param item - VFXItem
   * @param meshesToAdd - 插件缓存的 Mesh 数组
   */
  createBoundingBoxContent (item: VFXItem<any>, meshesToAdd: Mesh[]) {
    const gizmoItem = this.item as GizmoVFXItem;
    const shape = {
      shape: 'Box',
      width: gizmoItem.size.width,
      height: gizmoItem.size.height,
      depth: gizmoItem.size.depth,
      center: gizmoItem.size.center,
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
    const gizmoItem = this.item as GizmoVFXItem;
    const options = {
      size: gizmoItem.size,
      color: this.color,
      renderMode: this.renderMode,
      depthTest: this.depthTest,
    };
    const engine = gizmoItem.composition?.renderer.engine;

    assertExist(engine);

    const mesh = gizmoItem._content = createMeshFromSubType(engine, subType, gizmoItem.boundingMap, iconTextures, options) as Mesh;

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
    const gizmoItem = this.item as GizmoVFXItem;
    const options = {
      size: gizmoItem.size,
      renderMode: this.renderMode,
    };

    const engine = gizmoItem.composition?.renderer.engine;

    assertExist(engine);

    gizmoItem.contents = createMeshFromSubType(engine, subType, gizmoItem.boundingMap, iconTextures, options) as Map<Mesh, Transform>;
    for (const mesh of gizmoItem.contents.keys()) {
      meshesToAdd.push(mesh);
    }
    this.targetItem = item;
  }

  override fromData (data: any): void {
    super.fromData(data);

    const item = this.item as GizmoVFXItem;
    const options = data as VFXItemProps;

    item.duration = 999;
    const opt = options.content.options as GizmoVFXItemOptions;

    item.target = opt.target;
    item.subType = opt.subType;
    this.renderMode = opt.renderMode || this.getDefaultRenderMode();
    item.size = opt.size || this.getDefaultSize();
    this.depthTest = opt.depthTest;
    const c = (opt.color || [255, 255, 255]);

    this.color = [c[0] / 255, c[1] / 255, c[2] / 255];
    //@ts-expect-error
    if (options.content) { item.transform = new Transform(options.content.transform); }
  }
}
