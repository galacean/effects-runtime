import type {
  Scene,
  SceneLoadOptions,
  Composition,
  RenderFrame,
  VFXItem,
} from '@galacean/effects';
import { AbstractPlugin, PLAYER_OPTIONS_ENV_EDITOR, spec } from '@galacean/effects';
import { PCamera, PSceneManager } from '../runtime';
import { ModelVFXItem } from './model-vfx-item';
import { CompositionCache } from '../runtime/cache';
import { VFX_ITEM_TYPE_3D } from './const';
import { PluginHelper } from '../utility/plugin-helper';
import { Vector3, DEG2RAD } from '../runtime/math';
import { PCoordinate, PObjectType, PTransform } from '../runtime/common';

/**
 * Model 插件类，负责支持播放器中的 3D 功能
 */
export class ModelPlugin extends AbstractPlugin {
  /**
   * 插件名称
   */
  override name = 'model';
  /**
   * 更新间隔时间
   */
  deltaTime = 0;

  private runtimeEnv = PLAYER_OPTIONS_ENV_EDITOR;
  private compatibleMode = 'gltf';
  private renderSkybox = true;
  private visBoundingBox = false;
  private autoAdjustScene = false;
  /**
   * 渲染元素时是否启用动态排序功能
   * 支持在渲染的时候对透明 Mesh 进行动态排序
   */
  private enableDynamicSort = false;
  /**
   * 3D 渲染模式，支持可视化渲染中间结果
   * none 表示正常的渲染结果
   */
  private renderMode3D = spec.RenderMode3D.none;
  /**
   * UV 渲染模式中，指定棋盘格的大小，相对于大小为 1 的纹理
   * 取值范围(0, 1)
   */
  private renderMode3DUVGridSize = 1 / 16;

  /**
   * 整个 load 阶段都不会创建 GL 相关的对象，只创建 JS 对象
   * @param scene - 场景
   * @param options - 加载选项
   */
  static override async prepareResource (scene: Scene, options: SceneLoadOptions): Promise<void> {
    const runtimeEnv = options.env ?? '';
    let compatibleMode = 'gltf';
    let autoAdjustScene = false;

    if (options.pluginData !== undefined) {
      const keyList = [
        'compatibleMode', 'renderSkybox', 'visBoundingBox', 'autoAdjustScene',
        'enableDynamicSort', 'renderMode3D', 'renderMode3DUVGridSize',
      ];
      const pluginData = options.pluginData;

      keyList.forEach(key => scene.storage[key] = pluginData[key]);
      scene.storage['runtimeEnv'] = runtimeEnv;
      //
      compatibleMode = options.pluginData['compatibleMode'] ?? compatibleMode;
      autoAdjustScene = options.pluginData['autoAdjustScene'] ?? autoAdjustScene;
    }
    //
    PluginHelper.preprocessEffectsScene(scene, runtimeEnv, compatibleMode, autoAdjustScene);
    //
    await CompositionCache.loadStaticResources();
  }

  /**
   * 创建 3D 场景管理器
   * @param composition - 合成
   * @param scene - 场景
   */
  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    this.runtimeEnv = scene.storage['runtimeEnv'] ?? this.runtimeEnv;
    this.compatibleMode = scene.storage['compatibleMode'] ?? this.compatibleMode;
    this.renderSkybox = scene.storage['renderSkybox'] ?? this.renderSkybox;
    this.visBoundingBox = scene.storage['visBoundingBox'] ?? this.visBoundingBox;
    this.autoAdjustScene = scene.storage['autoAdjustScene'] ?? this.autoAdjustScene;
    this.enableDynamicSort = scene.storage['enableDynamicSort'] ?? this.enableDynamicSort;
    this.renderMode3D = scene.storage['renderMode3D'] ?? this.renderMode3D;
    this.renderMode3DUVGridSize = scene.storage['renderMode3DUVGridSize'] ?? this.renderMode3DUVGridSize;

    const engine = composition.renderer.engine;

    // Composition生命周期内，只会执行一次
    composition.loaderData.sceneManager = new PSceneManager(engine);
    const cache = new CompositionCache(engine);

    cache.setup(false);
    composition.loaderData.cache = cache;
    PluginHelper.setupItem3DOptions(scene, cache, composition);
  }

  /**
   * 在重置前，从渲染帧中删除自己添加的 pass
   * @param composition - 合成
   * @param renderFrame - 渲染帧
   */
  override onCompositionWillReset (composition: Composition, renderFrame: RenderFrame) {
    //
    const cache = this.getCache(composition);
    const renderPasses = cache.getRenderPasses();

    renderPasses.forEach(pass => {
      renderFrame.removeRenderPass(pass);
    });

    // 删除Default Render Pass中添加的Mesh
    const sceneManager = this.getSceneManager(composition);

    sceneManager.removeAllMeshesFromDefaultPass(renderFrame);
  }

  /**
   * 每次播放都会执行，包括重播，所以这里执行“小的销毁”和新的初始化
   * @param composition - 合成
   * @param renderFrame - 渲染帧
   */
  override onCompositionReset (composition: Composition, renderFrame: RenderFrame) {
    const sceneManager = this.getSceneManager(composition);
    const sceneCache = this.getCache(composition);
    const lightItemCount = this.getLightItemCount(composition);

    sceneManager.initial({
      componentName: `${composition.id}`,
      renderer: composition.renderer,
      sceneCache: sceneCache,
      runtimeEnv: this.runtimeEnv,
      compatibleMode: this.compatibleMode,
      visBoundingBox: this.visBoundingBox,
      enableDynamicSort: this.enableDynamicSort,
      renderMode3D: this.renderMode3D,
      renderMode3DUVGridSize: this.renderMode3DUVGridSize,
      renderSkybox: this.renderSkybox,
      lightItemCount: lightItemCount,
    });
    this.updateSceneCamera(composition, sceneManager);
  }

  /**
   * 合成销毁，同时销毁 3D 场景对象和缓存
   * @param composition - 合成
   */
  override onCompositionDestroyed (composition: Composition) {
    // 最终的销毁，销毁后特效就结束了
    this.disposeSceneManager(composition);
    this.disposeCache(composition);
  }

  /**
   * 更新时间间隔
   * @param composition - 合成
   * @param dt - 时间间隔
   */
  override onCompositionUpdate (composition: Composition, dt: number) {
    this.deltaTime = dt;
  }

  /**
   * 元素生命周期开始，将 3D 元素添加到 3D 场景管理器中
   * @param composition - 合成
   * @param item - 元素
   */
  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<any>) {
    if (item.type === VFX_ITEM_TYPE_3D) {
      const sceneManager = this.getSceneManager(composition);

      sceneManager.addItem(item as ModelVFXItem);
    }
  }

  /**
   * 删除元素时，同时删除 3D 场景管理器中的元素
   * @param composition - 合成
   * @param item - 元素
   */
  override onCompositionItemRemoved (composition: Composition, item: VFXItem<any>) {
    if (item.type === VFX_ITEM_TYPE_3D) {
      const sceneManager = this.getSceneManager(composition);

      sceneManager.removeItem(item as ModelVFXItem);
    }
  }

  /**
   * 更新 3D 管理器和将需要渲染的对象添加到渲染帧中
   * @param composition - 合成
   * @param frame - 渲染帧
   * @returns
   */
  override prepareRenderFrame (composition: Composition, frame: RenderFrame): boolean {
    const sceneManager = this.getSceneManager(composition);

    if (this.autoAdjustScene && sceneManager.tickCount == 1) {
      // 自动计算场景中的相机位置
      // 更加相机的具体参数，计算出合适的相机观察位置
      // 但只会在第一帧进行更新，主要是用于测试使用
      // this.autoAdjustScene = false;
      const cameraObject = composition.camera;
      const cameraTransform = new PTransform().fromMatrix4(cameraObject.getViewMatrix());
      const cameraCoordinate = new PCoordinate().fromPTransform(cameraTransform);
      const cameraDirection = cameraCoordinate.zAxis.clone();
      const cameraFov = cameraObject.fov ?? 45;
      const cameraAspect = cameraObject.aspect ?? 1.0;
      //
      const sceneAABB = sceneManager.getSceneAABB();
      const newAABB = sceneAABB.clone().applyMatrix4(cameraTransform.getMatrix());
      const newSize = newAABB.getSize(new Vector3()).multiply(0.5);
      const newWidth = newSize.x;
      const newHeight = newSize.y;
      const finalHeight = newHeight * Math.max(newWidth / newHeight / cameraAspect, 1.0);
      const center = sceneAABB.getCenter(new Vector3());
      const offset = finalHeight / Math.tan(cameraFov * 0.5 * DEG2RAD);
      const position = center.clone().add(cameraDirection.clone().multiply(offset + newSize.z));

      // 更新相机的位置，主要是composition的camera数据，以及camera item数据
      composition.camera.position = position;
      composition.items?.forEach(item => {
        if (item.type === VFX_ITEM_TYPE_3D) {
          const item3D = item as ModelVFXItem;

          if (item3D.content instanceof PCamera) {
            // @ts-expect-error
            const worldMatrix = item3D.transform.parentTransform.getWorldMatrix();
            const invWorldMatrix = worldMatrix.invert();
            const newPosition = invWorldMatrix.transformPoint(position);

            item3D.setTransform(newPosition);

            // 正式版本不会走到这个流程，只在测试时使用
            console.info(`Scene AABB [${sceneAABB.min.toArray()}], [${sceneAABB.max.toArray()}]`);
            console.info(`Update camera position [${newPosition.toArray()}]`);
          }
        }
      });
    }

    this.updateSceneCamera(composition, sceneManager);
    sceneManager.tick(this.deltaTime);
    sceneManager.updateDefaultRenderPass(frame);

    return true;
  }

  /**
   * 这里可以添加渲染时 Pass
   * @param composition - 合成
   * @param frame - 渲染帧
   */
  override postProcessFrame (composition: Composition, frame: RenderFrame): void {
    const sceneManager = this.getSceneManager(composition);
    const shadowManager = sceneManager.shadowManager;

    shadowManager.updateRenderPass(frame);
  }

  private getLightItemCount (composition: Composition): number {
    let lightItemCount = 0;
    const items = composition.items;

    items.forEach(item => {
      if (item instanceof ModelVFXItem) {
        if (item.content?.type === PObjectType.light || item.options?.type === 'light') {
          lightItemCount++;
        }
      }
    });

    return lightItemCount;
  }

  /**
   * 更新 SceneManager 中渲染用的相机，相机参数来自 composition.camera
   * @param composition - 当前合成对象
   * @param sceneManager - 当前合成对象绑定的 SceneManager
   */
  private updateSceneCamera (composition: Composition, sceneManager: PSceneManager) {
    sceneManager.updateDefaultCamera(composition.camera.getOptions());
  }

  private getSceneManager (composition: Composition): PSceneManager {
    return composition.loaderData.sceneManager as PSceneManager;
  }

  private getCache (composition: Composition): CompositionCache {
    return composition.loaderData.cache as CompositionCache;
  }

  private disposeCache (composition: Composition) {
    const loaderData = composition.loaderData;
    const cache = loaderData.cache as CompositionCache;

    cache.dispose();
    delete loaderData['cache'];
  }

  private disposeSceneManager (composition: Composition) {
    const loaderData = composition.loaderData;
    const sceneManager = loaderData.sceneManager as PSceneManager;

    sceneManager.dispose();
    delete loaderData['sceneManager'];
  }
}
