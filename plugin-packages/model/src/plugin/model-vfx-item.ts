import type {
  HitTestBoxParams,
  HitTestCustomParams,
  HitTestSphereParams,
  Composition,
  Engine,
  math,
} from '@galacean/effects';
import { HitTestType, VFXItem, spec, TimelineComponent, Item } from '@galacean/effects';
import type {
  ModelItemBounding,
  ModelItemCamera,
  ModelItemLight,
  ModelItemMesh,
  ModelItemSkybox,
  ModelSkyboxOptions,
} from '../index';
import { PCamera, PLight, PSkybox } from '../runtime';
import { PMesh } from '../runtime';
import { Vector3 } from '../runtime/math';
import type { CompositionCache } from '../runtime/cache';
import { VFX_ITEM_TYPE_3D } from './const';
import { CheckerHelper, RayIntersectsBoxWithRotation } from '../utility';
import { ModelTreeVFXItem } from './model-tree-vfx-item';

type Vector2 = math.Vector2;
type Euler = math.Euler;
type Ray = math.Ray;

/**
 * Model 元素联合类型：网格、相机、灯光和天空盒
 */
export type ModelItem = PMesh | PCamera | PLight | PSkybox;

/**
 * Model 元素参数联合类型：网格、相机、灯光和天空盒
 */
export type ModelItemOptions = ModelItemMesh | ModelItemCamera | ModelItemLight | ModelItemSkybox;

/**
 * Model 插件 VFX 元素
 */
export class ModelVFXItem extends VFXItem<ModelItem> {
  /**
   * 元素参数
   */
  options?: ModelItemOptions;
  /**
   * 元素包围盒
   */
  bounding?: ModelItemBounding;
  /**
   * 时间轴组件
   */
  timeline?: TimelineComponent;

  /**
   * 获取元素类型，始终是 VFX_ITEM_TYPE_3D
   */
  override get type () {
    return VFX_ITEM_TYPE_3D;
  }

  override set type (v) {
    // empty
  }

  /**
   * 创建元素，需要为相机和灯光元素创建时间轴组件
   * @param options 元素参数
   */
  override onConstructed (options: ModelItemOptions) {
    this.options = options;
    this.duration = options.duration;
    this.delay = options.delay ?? 0;
    const bounding = (options as ModelItemMesh).content.interaction;

    this.bounding = bounding && JSON.parse(JSON.stringify(bounding));

    if (
      Item.is<spec.CameraItem>(options, spec.ItemType.camera) ||
      Item.is<spec.ModelLightItem>(options, spec.ItemType.light)
    ) {
      this.timeline = new TimelineComponent(options.content, this);
      this.timeline.getRenderData(0, true);
    }

    if (Item.is<spec.ModelSkyboxItem<'json'>>(options, spec.ItemType.skybox)) {
      // 从cache中创建天空盒
      this.overwriteSkyboxFromCache(options.content.options);
    }
  }

  /**
   * 元素可见性变化
   * @param visible 是否可见
   */
  override handleVisibleChanged (visible: boolean): void {
    if (this.content !== undefined) {
      this.content.onVisibleChanged(visible);
    }
  }

  /**
   * 创建元素内容，按照具体类型创建具体对象
   * @param composition 合成
   * @returns 创建的对象
   */
  override doCreateContent (composition: Composition) {
    switch (this.options?.type) {
      case 'mesh': {
        const meshOptions = this.options.content.options;

        CheckerHelper.assertModelMeshOptions(meshOptions as spec.ModelMeshOptions<any>);
        const engine = this.composition?.getEngine() as Engine;

        return new PMesh(engine, this.options as spec.ModelMeshItem<'studio'>, this);
      }
      case 'camera': {
        const cameraOptions = this.options.content.options;

        CheckerHelper.assertModelCameraOptions(cameraOptions as spec.ModelCameraOptions);
        const { width, height } = composition;

        return new PCamera(this.options as spec.ModelCameraItem, width, height, this);
      }
      case 'light': {
        const lightOptions = this.options.content.options;

        CheckerHelper.assertModelLightOptions(lightOptions as spec.ModelLightOptions);

        return new PLight(this.options as spec.ModelLightItem, this);
      }
      case 'skybox': {
        const skyboxOptions = this.options.content.options;

        CheckerHelper.assertModelSkyboxOptions(skyboxOptions as spec.SkyboxOptions<'studio'>);

        return new PSkybox(this.options as spec.ModelSkyboxItem<any>, this);
      }
      default: {
        // should never happen
        throw new Error(`Invalid model item type, options: ${this.options}`);
      }
    }
  }

  private overwriteSkyboxFromCache (options: ModelSkyboxOptions) {
    const cache = this.composition?.loaderData.cache as CompositionCache;
    const newOpts = cache.getSkyboxOptions();

    if (newOpts === undefined) { return; }

    if (
      options.specularImage !== undefined &&
      (
        options.diffuseImage !== undefined ||
        options.irradianceCoeffs !== undefined
      )
    ) {
      return;
    }

    options.diffuseImage = newOpts.diffuseImage;
    options.irradianceCoeffs = newOpts.irradianceCoeffs;
    options.specularImage = newOpts.specularImage;
    options.specularImageSize = newOpts.specularImageSize;
    options.specularMipCount = newOpts.specularMipCount;
  }

  /**
   * 计算元素包围盒，只针对 Mesh 对象
   * @returns 包围盒
   */
  computeBoundingBox (): ModelItemBounding | undefined {
    if (this._content === undefined) { return; }
    if (this._content instanceof PMesh) {
      const worldMatrix = this.transform.getWorldMatrix();
      const bbox = this._content.computeBoundingBox(worldMatrix);
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

  /**
   * 更新变换，对于相机元素需要更新到合成的相机
   */
  updateTransform () {
    const itemContent = this._content;

    if (itemContent !== undefined) {
      const parentMat4 = this.transform.getWorldMatrix();

      itemContent.matrix = parentMat4;
      if (itemContent instanceof PCamera && this.composition) {
        this.composition.camera.position = this.transform.position.clone();
        // FIXME: 可能存在相机朝向相反的问题
        this.composition.camera.setQuat(this.transform.quat);
        this.composition.camera.near = itemContent.nearPlane;
        this.composition.camera.far = itemContent.farPlane;
        this.composition.camera.fov = itemContent.fovy;
      }
    }
  }

  /**
   * 设置变换，需要更新到时间轴组件中
   * @param position 位置
   * @param rotation 旋转
   */
  setTransform (position?: Vector3, rotation?: Euler): void {
    if (position !== undefined) {
      this.transform.setPosition(position.x, position.y, position.z);
      this.timeline?.updatePosition(position.x, position.y, position.z);
    }
    if (rotation !== undefined) {
      this.transform.setRotation(rotation.x, rotation.y, rotation.z);
      this.timeline?.updateRotation(rotation.x, rotation.y, rotation.z);
    }
    this.updateTransform();
  }

  /**
   * 元素生命周期开始，需要更新 Mesh 对象父元素和同时可见性改变
   * @param composition 合成
   * @param content 元素内容
   * @returns
   */
  override onLifetimeBegin (composition: Composition, content: ModelItem) {
    if (this.content === undefined) {
      return;
    }

    if (this.content instanceof PMesh && this.parent instanceof ModelTreeVFXItem) {
      this.content.updateParentItem(this.parent);
    }

    this.content.onVisibleChanged(true);
  }

  /**
   * 元素更新，需要更新时间轴组件
   * @param dt 时间间隔
   * @param lifetime 生命时间
   */
  override onItemUpdate (dt: number, lifetime: number) {
    const time = (this.timeInms - this.delayInms) * 0.001;

    this.timeline?.getRenderData(time, true);

    this.updateTransform();
  }

  /**
   * 元素删除，需要通知删除和销毁元素内容
   * @param composition 合成
   * @param content 元素内容
   */
  override onItemRemoved (composition: Composition, content?: ModelItem) {
    if (this.content !== undefined) {
      this.content.onEntityRemoved();
      this.content.dispose();
    }
  }

  /**
   * 获取点击测试参数，根据元素包围盒进行相交测试，Mesh 对象会进行更加精确的点击测试
   * @param force 是否强制进行点击测试
   * @returns 点击测试参数
   */
  override getHitTestParams (force?: boolean): HitTestBoxParams | HitTestSphereParams | HitTestCustomParams | undefined {
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
  }
}
