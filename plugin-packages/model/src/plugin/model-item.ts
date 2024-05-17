import type {
  Engine,
  HitTestBoxParams,
  HitTestCustomParams,
  HitTestSphereParams,
  Renderer,
} from '@galacean/effects';
import { HitTestType, ItemBehaviour, RendererComponent, effectsClass, spec } from '@galacean/effects';
import type {
  ModelCameraComponentData,
  ModelItemBounding,
  ModelLightComponentData,
  ModelMeshComponentData,
  ModelSkyboxComponentData,
} from '../index';
import { VFX_ITEM_TYPE_3D } from '../index';
import type { PSceneManager } from '../runtime';
import { PCamera, PLight, PMesh, PSkybox } from '../runtime';
import type { Euler, Ray, Vector2 } from '../runtime/math';
import { Vector3 } from '../runtime/math';
import { RayIntersectsBoxWithRotation } from '../utility';
import { getSceneManager } from './model-plugin';

/**
 * 插件 Mesh 组件类，支持 3D Mesh 渲染能力
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.MeshComponent)
export class ModelMeshComponent extends RendererComponent {
  /**
   * 内部 Mesh 对象
   */
  content: PMesh;
  /**
   * 参数
   */
  data?: ModelMeshComponentData;
  /**
   * 包围盒
   */
  bounding?: ModelItemBounding;
  /**
   * 场景管理器
   */
  sceneManager?: PSceneManager;

  /**
   * 构造函数，只保存传入参数，不在这里创建内部对象
   * @param engine - 引擎
   * @param data - Mesh 参数
   */
  constructor (engine: Engine, data?: ModelMeshComponentData) {
    super(engine);
    if (data) {
      this.fromData(data);
    }
  }

  /**
   * 组件开始，需要创建内部对象，更新父元素信息和添加到场景管理器中
   */
  override start (): void {
    this.createContent();
    this.item.type = VFX_ITEM_TYPE_3D;
    this.priority = this.item.listIndex;
    this.sceneManager = getSceneManager(this);
    this.sceneManager?.addItem(this.content);
    if (this.item.parentId && this.item.parent) {
      this.content.updateParentInfo(this.item.parentId, this.item.parent);
    }
    this.setVisible(true);
    this.item.getHitTestParams = this.getHitTestParams;
  }

  /**
   * 组件更新，更新内部对象状态
   * @param dt - 更新间隔
   */
  override update (dt: number): void {
    if (this.sceneManager) {
      this.content.build(this.sceneManager);
    }

    this.content.update();
  }

  /**
   * 组件渲染，需要检查可见性
   * @param renderer - 渲染器
   * @returns
   */
  override render (renderer: Renderer) {
    if (!this.getVisible() || !this.sceneManager) {
      return;
    }

    this.content.render(this.sceneManager, renderer);
  }

  /**
   * 组件销毁，需要重场景管理器中删除
   */
  override onDestroy (): void {
    this.sceneManager?.removeItem(this.content);
    this.sceneManager = undefined;
    this.content.dispose();
  }

  /**
   * 反序列化，记录传入参数
   * @param data - 组件参数
   */
  override fromData (data: ModelMeshComponentData): void {
    super.fromData(data);
    this.data = data;
  }

  /**
   * 创建内部对象
   */
  createContent () {
    if (this.data) {
      const bounding = this.data.interaction;

      this.bounding = bounding && JSON.parse(JSON.stringify(bounding));

      this.content = new PMesh(this.engine, this.item.name, this.data, this, this.item.parentId);
    }
  }

  /**
   * 设置当前 Mesh 的可见性。
   * @param visible - true：可见，false：不可见
   */
  setVisible (visible: boolean) {
    this.content?.onVisibleChanged(visible);
  }

  /**
   * 获取当前 Mesh 的可见性。
   */
  getVisible (): boolean {
    return this.content?.visible ?? false;
  }

  /**
   * 获取点击测试参数，根据元素包围盒进行相交测试，Mesh 对象会进行更加精确的点击测试
   * @param force - 是否强制进行点击测试
   * @returns 点击测试参数
   */
  getHitTestParams = (force?: boolean): HitTestBoxParams | HitTestSphereParams | HitTestCustomParams | undefined => {
    this.computeBoundingBox();
    const bounding = this.bounding;

    if (bounding && (force || Number.isInteger(bounding.behavior))) {
      const type = bounding.type;

      if (type === spec.ModelBoundingType.box) {
        if (this.content instanceof PMesh) {
          const mesh = this.content;
          const customHitTest: HitTestCustomParams = {
            behavior: bounding.behavior as number,
            type: HitTestType.custom,
            collect: function (ray: Ray, pointInCanvas: Vector2) {
              const result = mesh.hitTesting(ray.origin, ray.direction);

              return result;
            },
          };

          return customHitTest;
        } else {
          const worldMatrixData = this.transform.getWorldMatrix();
          const customHitTest: HitTestCustomParams = {
            behavior: bounding.behavior as number,
            type: HitTestType.custom,
            collect: function (ray: Ray, pointInCanvas: Vector2) {
              const result = RayIntersectsBoxWithRotation(ray, worldMatrixData, bounding);

              return result;
            },
          };

          return customHitTest;
        }
      } else if (type === spec.ModelBoundingType.sphere) {
        const pos = new Vector3();

        this.transform.assignWorldTRS(pos);
        const center = new Vector3();

        if (bounding.center) {
          center.setFromArray(bounding.center);
        }

        center.add(pos);

        return {
          type: type as unknown as HitTestType.sphere,
          behavior: bounding.behavior as number,
          radius: bounding.radius || 0,
          center,
        };
      }
    }
  };

  /**
   * 计算元素包围盒，只针对 Mesh 对象
   * @returns 包围盒
   */
  computeBoundingBox (): ModelItemBounding | undefined {
    if (this.content && this.content instanceof PMesh) {
      const worldMatrix = this.transform.getWorldMatrix();
      const bbox = this.content.computeBoundingBox(worldMatrix);
      const center = bbox.getCenter(new Vector3());
      const size = bbox.getSize(new Vector3());

      this.bounding = {
        behavior: this.bounding?.behavior,
        type: spec.ModelBoundingType.box,
        center: [center.x, center.y, center.z],
        size: [size.x, size.y, size.z],
      };

      return this.bounding;
    } else {
      return;
    }
  }
}

/**
 * 插件天空盒组件类，支持 3D 天空盒渲染能力
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.SkyboxComponent)
export class ModelSkyboxComponent extends RendererComponent {
  /**
   * 内部天空盒对象
   */
  content: PSkybox;
  /**
   * 天空盒参数
   */
  data?: ModelSkyboxComponentData;
  /**
   * 场景管理器
   */
  sceneManager?: PSceneManager;

  /**
   * 构造函数，只保存传入参数，不在这里创建内部对象
   * @param engine - 引擎
   * @param data - Mesh 参数
   */
  constructor (engine: Engine, data?: ModelSkyboxComponentData) {
    super(engine);
    if (data) {
      this.fromData(data);
    }
  }

  /**
   * 组件开始，需要创建内部对象和添加到场景管理器中
   */
  override start (): void {
    this.createContent();
    this.item.type = VFX_ITEM_TYPE_3D;
    this.priority = this.item.listIndex;
    this.sceneManager = getSceneManager(this);
    this.sceneManager?.addItem(this.content);
    this.setVisible(true);
  }

  /**
   * 组件渲染，需要检查可见性
   * @param renderer - 渲染器
   * @returns
   */
  override render (renderer: Renderer) {
    if (!this.getVisible() || !this.sceneManager) {
      return;
    }

    this.content.render(this.sceneManager, renderer);
  }

  /**
   * 组件销毁，需要重场景管理器中删除
   */
  override onDestroy (): void {
    this.sceneManager?.removeItem(this.content);
    this.sceneManager = undefined;
    this.content.dispose();
  }

  /**
   * 反序列化，记录传入参数
   * @param data - 组件参数
   */
  override fromData (data: ModelSkyboxComponentData): void {
    super.fromData(data);
    this.data = data;
  }

  /**
   * 创建内部对象
   */
  createContent () {
    if (this.data) {
      const skyboxData = this.data;

      this.content = new PSkybox(this.item.name, skyboxData, this);
    }
  }

  /**
   * 设置当前可见性。
   * @param visible - true：可见，false：不可见
   */
  setVisible (visible: boolean) {
    this.content?.onVisibleChanged(visible);
  }

  /**
   * 获取当前可见性。
   */
  getVisible (): boolean {
    return this.content?.visible ?? false;
  }
}

/**
 * 插件灯光组件类，支持 3D 灯光能力
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.LightComponent)
export class ModelLightComponent extends ItemBehaviour {
  /**
   * 内部灯光对象
   */
  content: PLight;
  /**
   * 参数
   */
  data?: ModelLightComponentData;

  /**
   * 构造函数，只保存传入参数，不在这里创建内部对象
   * @param engine - 引擎
   * @param data - Mesh 参数
   */
  constructor (engine: Engine, data?: ModelLightComponentData) {
    super(engine);
    if (data) {
      this.fromData(data);
    }
  }

  /**
   * 组件开始，需要创建内部对象和添加到场景管理器中
   */
  override start (): void {
    this.createContent();
    this.item.type = VFX_ITEM_TYPE_3D;
    const scene = getSceneManager(this);

    scene?.addItem(this.content);
    this.setVisible(true);
  }

  /**
   * 组件更新，更新内部对象状态
   * @param dt - 更新间隔
   */
  override update (dt: number): void {
    this.content.update();
  }

  /**
   * 组件销毁
   */
  override onDestroy (): void {
    this.content.dispose();
  }

  /**
   * 反序列化，记录传入参数
   * @param data - 组件参数
   */
  override fromData (data: ModelLightComponentData): void {
    super.fromData(data);

    this.data = data;
  }

  /**
   * 创建内部对象
   */
  createContent () {
    if (this.data) {
      const lightData = this.data;

      this.content = new PLight(this.item.name, lightData, this);
    }
  }

  /**
   * 设置当前可见性。
   * @param visible - true：可见，false：不可见
   */
  setVisible (visible: boolean) {
    this.content?.onVisibleChanged(visible);
  }

  /**
   * 获取当前 Mesh 的可见性。
   */
  getVisible (): boolean {
    return this.content?.visible ?? false;
  }
}

/**
 * 插件相机组件类，支持 3D 相机能力
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.CameraComponent)
export class ModelCameraComponent extends ItemBehaviour {
  /**
   * 内部相机对象
   */
  content: PCamera;
  /**
   * 参数
   */
  data?: ModelCameraComponentData;
  /**
   * 构造函数，只保存传入参数，不在这里创建内部对象
   * @param engine - 引擎
   * @param data - Mesh 参数
   */
  constructor (engine: Engine, data?: ModelCameraComponentData) {
    super(engine);
    if (data) {
      this.fromData(data);
    }
  }

  /**
   * 组件开始，需要创建内部对象和添加到场景管理器中
   */
  override start (): void {
    this.createContent();
    this.item.type = VFX_ITEM_TYPE_3D;
    const scene = getSceneManager(this);

    scene?.addItem(this.content);
    this.updateMainCamera();
  }

  /**
   * 组件更新，更新内部对象状态
   * @param dt - 更新间隔
   */
  override update (dt: number): void {
    this.content.update();
    this.updateMainCamera();
  }

  /**
   * 组件销毁
   */
  override onDestroy (): void {
    this.content.dispose();
  }

  /**
   * 反序列化，记录传入参数
   * @param data - 组件参数
   */
  override fromData (data: ModelCameraComponentData): void {
    super.fromData(data);

    this.data = data;
  }

  /**
   * 创建内部对象
   */
  createContent () {
    if (this.data) {
      const cameraData = this.data;

      const width = this.engine.renderer.getWidth();
      const height = this.engine.renderer.getHeight();

      this.content = new PCamera(this.item.name, width, height, cameraData, this);
    }
  }

  /**
   * 更新合成主相机，更加当前相机元素状态
   */
  updateMainCamera () {
    this.content.matrix = this.transform.getWorldMatrix();
    const composition = this.item.composition;

    if (composition) {
      composition.camera.position = this.transform.position.clone();
      composition.camera.setQuat(this.transform.quat);
      composition.camera.near = this.content.nearPlane;
      composition.camera.far = this.content.farPlane;
      composition.camera.fov = this.content.fov;
    }
  }

  /**
   * 设置变换
   * @param position - 位置
   * @param rotation - 旋转
   */
  setTransform (position?: Vector3, rotation?: Euler): void {
    this.updateMainCamera();
  }
}
