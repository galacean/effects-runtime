import type {
  HitTestBoxParams,
  HitTestCustomParams,
  HitTestSphereParams,
  Engine,
  Renderer,
  Deserializer,
  SceneData,
  AnimationClipPlayable,
} from '@galacean/effects';
import { HitTestType, ItemBehaviour, RendererComponent, TimelineComponent, spec, VFXItem } from '@galacean/effects';
import { Vector3 } from '../runtime/math';
import type { Ray, Euler, Vector2 } from '../runtime/math';
import type {
  ModelItemBounding,
  ModelLightContent,
  ModelCameraContent,
  ModelMeshContent,
  ModelSkyboxContent,
} from '../index';
import {
  VFX_ITEM_TYPE_3D,
} from '../index';
import type { PSceneManager } from '../runtime';
import { PCamera, PLight, PMesh, PSkybox } from '../runtime';
import { CheckerHelper, RayIntersectsBoxWithRotation } from '../utility';
import { getSceneManager } from './model-plugin';

/**
 * @since 2.0.0
 * @internal
 */
export class ModelMeshComponent extends RendererComponent {
  content: PMesh;
  bounding?: ModelItemBounding;
  sceneManager?: PSceneManager;

  constructor (engine: Engine, options?: ModelMeshContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  override start (): void {
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

  override update (dt: number): void {
    if (this.sceneManager) {
      this.content.build(this.sceneManager);
    }

    this.content.update();
  }

  override render (renderer: Renderer) {
    if (!this.getVisible() || !this.sceneManager) {
      return;
    }

    this.content.render(this.sceneManager, renderer);
  }

  override onDestroy (): void {
    this.sceneManager?.removeItem(this.content);
    this.sceneManager = undefined;
    this.content.dispose();
  }

  override fromData (options: ModelMeshContent, deserializer?: Deserializer): void {
    super.fromData(options, deserializer);

    const bounding = options.interaction;

    this.bounding = bounding && JSON.parse(JSON.stringify(bounding));

    const meshOptions = options.options;

    CheckerHelper.assertModelMeshOptions(meshOptions);
    this.content = new PMesh(this.engine, this.item.name, options, this, this.item.parentId);
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
 * @since 2.0.0
 * @internal
 */
export class ModelSkyboxComponent extends RendererComponent {
  content: PSkybox;
  sceneManager?: PSceneManager;

  constructor (engine: Engine, options?: ModelSkyboxContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  override start (): void {
    this.item.type = VFX_ITEM_TYPE_3D;
    this.priority = this.item.listIndex;
    this.sceneManager = getSceneManager(this);
    this.sceneManager?.addItem(this.content);
    this.setVisible(true);
  }

  override render (renderer: Renderer) {
    if (!this.getVisible() || !this.sceneManager) {
      return;
    }

    this.content.render(this.sceneManager, renderer);
  }

  override onDestroy (): void {
    this.sceneManager?.removeItem(this.content);
    this.sceneManager = undefined;
    this.content.dispose();
  }

  override fromData (options: ModelSkyboxContent, deserializer?: Deserializer): void {
    super.fromData(options, deserializer);

    const skyboxOptions = options.options;

    CheckerHelper.assertModelSkyboxOptions(skyboxOptions);
    this.content = new PSkybox(this.item.name, skyboxOptions, this);
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
}

/**
 * @since 2.0.0
 * @internal
 */
export class ModelLightComponent extends ItemBehaviour {
  content: PLight;

  constructor (engine: Engine, options?: ModelLightContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  override start (): void {
    this.item.type = VFX_ITEM_TYPE_3D;
    const scene = getSceneManager(this);

    scene?.addItem(this.content);
    this.setVisible(true);
  }

  override update (dt: number): void {
    this.content.update();
  }

  override onDestroy (): void {
    this.content.dispose();
  }

  override fromData (options: ModelLightContent, deserializer?: Deserializer): void {
    super.fromData(options, deserializer);

    const lightOptions = options.options;

    CheckerHelper.assertModelLightOptions(lightOptions);
    this.content = new PLight(this.item.name, lightOptions, this);
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
}

/**
 * @since 2.0.0
 * @internal
 */
export class ModelCameraComponent extends ItemBehaviour {
  content: PCamera;
  timeline?: TimelineComponent;

  constructor (engine: Engine, options?: ModelCameraContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  override start (): void {
    this.item.type = VFX_ITEM_TYPE_3D;
    this.timeline = this.item.getComponent(TimelineComponent);
    const scene = getSceneManager(this);

    scene?.addItem(this.content);
  }

  override update (dt: number): void {
    this.content.update();
    this.updateMainCamera();
  }

  override onDestroy (): void {
    this.content.dispose();
  }

  override fromData (options: ModelCameraContent, deserializer?: Deserializer): void {
    super.fromData(options, deserializer);

    const cameraOptions = options.options;

    CheckerHelper.assertModelCameraOptions(cameraOptions);
    const width = this.engine.renderer.getWidth();
    const height = this.engine.renderer.getHeight();

    this.content = new PCamera(this.item.name, width, height, cameraOptions, this);
  }

  updateMainCamera () {
    this.content.matrix = this.transform.getWorldMatrix();
    const composition = this.item.composition;

    if (composition) {
      composition.camera.position = this.transform.position.clone();
      composition.camera.setQuat(this.transform.quat);
      composition.camera.near = this.content.nearPlane;
      composition.camera.far = this.content.farPlane;
      composition.camera.fov = this.content.fovy;
    }
  }

  setTransform (position?: Vector3, rotation?: Euler): void {
    const clip = this.timeline?.findTrack('AnimationTrack')?.findClip('AnimationTimelineClip');

    if (position !== undefined) {
      this.transform.setPosition(position.x, position.y, position.z);
      if (clip) {
        (clip.playable as AnimationClipPlayable).originalTransform.position = position.clone();
      }
    }
    if (rotation !== undefined) {
      this.transform.setRotation(rotation.x, rotation.y, rotation.z);
      if (clip) {
        (clip.playable as AnimationClipPlayable).originalTransform.rotation = rotation.clone();
      }
    }
    this.updateMainCamera();
  }
}
