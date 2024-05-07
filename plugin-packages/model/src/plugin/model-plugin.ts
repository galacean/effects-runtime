import type {
  Scene,
  SceneLoadOptions,
  Composition,
  RenderFrame,
  VFXItemProps,
  Engine,
  Component,
  Renderer,
} from '@galacean/effects';
import {
  VFXItem,
  AbstractPlugin,
  spec,
  ItemBehaviour,
  PLAYER_OPTIONS_ENV_EDITOR,
  effectsClass,
  GLSLVersion,
} from '@galacean/effects';
import { CompositionCache } from '../runtime/cache';
import { PluginHelper } from '../utility/plugin-helper';
import { PTransform, PSceneManager, PCoordinate, PBRShaderGUID, UnlitShaderGUID } from '../runtime';
import { DEG2RAD, Matrix4, Vector3 } from '../runtime/math';
import { VFX_ITEM_TYPE_3D } from './const';
import { ModelCameraComponent, ModelLightComponent } from './model-item';
import { fetchPBRShaderCode, fetchUnlitShaderCode } from '../utility';

/**
 * Model 插件类，负责支持播放器中的 3D 功能
 */
export class ModelPlugin extends AbstractPlugin {
  /**
   * 插件名称
   */
  override name = 'model';
  /**
   * 合成缓存器
   */
  cache: CompositionCache;
  /**
   * 场景参数
   */
  sceneParams: Record<string, any>;

  /**
   * 整个 load 阶段都不会创建 GL 相关的对象，只创建 JS 对象
   * @param scene - 场景
   * @param options - 加载选项
   */
  static override async prepareResource (scene: Scene, options: SceneLoadOptions): Promise<void> {
    if (options.pluginData !== undefined) {
      const keyList = [
        'compatibleMode',
        'renderSkybox',
        'visBoundingBox',
        'autoAdjustScene',
        'enableDynamicSort',
        'renderMode3D',
        'renderMode3DUVGridSize',
      ];
      const pluginData = options.pluginData;

      keyList.forEach(key => scene.storage[key] = pluginData[key]);
    }
    //
    const runtimeEnv = options.env ?? '';

    scene.storage['runtimeEnv'] = runtimeEnv;
    const compatibleMode = options.pluginData?.['compatibleMode'] ?? 'gltf';

    //
    PluginHelper.preprocessScene(scene, runtimeEnv, compatibleMode);
    await CompositionCache.loadStaticResources();
  }

  static override precompile (compositions: spec.Composition[], renderer: Renderer): Promise<void> {
    const isWebGL2 = renderer.engine.gpuCapability.level === 2;
    const pbrShaderCode = fetchPBRShaderCode(isWebGL2);
    const unlitShaderCode = fetchUnlitShaderCode(isWebGL2);
    const pbrShaderData: spec.ShaderData = {
      id: PBRShaderGUID,
      name: 'PBR Shader',
      dataType: spec.DataType.Shader,
      fragment: pbrShaderCode.fragmentShaderCode,
      vertex: pbrShaderCode.vertexShaderCode,
      // @ts-expect-error
      glslVersion: isWebGL2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
    };
    const unlitShaderData: spec.ShaderData = {
      id: UnlitShaderGUID,
      name: 'Unlit Shader',
      dataType: spec.DataType.Shader,
      fragment: unlitShaderCode.fragmentShaderCode,
      vertex: unlitShaderCode.vertexShaderCode,
      // @ts-expect-error
      glslVersion: isWebGL2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
    };

    renderer.engine.addEffectsObjectData(pbrShaderData);
    renderer.engine.addEffectsObjectData(unlitShaderData);

    return Promise.resolve();
  }

  /**
   * 创建 3D 场景管理器和缓存器
   * @param composition - 合成
   * @param scene - 场景
   */
  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    this.sceneParams = scene.storage;

    const engine = composition.renderer.engine;

    this.cache = new CompositionCache(engine);
    this.cache.setup(false);
    // FIXME: 先注释元素参数的配置
    //PluginHelper.setupItem3DOptions(scene, this.cache, composition);
  }

  /**
   * 每次播放都会执行，包括重播，所以这里执行“小的销毁”和新的初始化
   * @param composition - 合成
   * @param renderFrame - 渲染帧
   */
  override onCompositionReset (composition: Composition, renderFrame: RenderFrame) {
    const props = {
      id: 'ModelPluginItem',
      name: 'ModelPluginItem',
      duration: 9999999,
      endBehavior: spec.END_BEHAVIOR_FORWARD,
    } as VFXItemProps;
    const item = new VFXItem(composition.getEngine(), props);

    composition.addItem(item);
    //
    const comp = item.addComponent(ModelPluginComponent);

    comp.fromData({ cache: this.cache });
    comp.initial(this.sceneParams);
  }

  /**
   * 合成销毁，同时销毁 3D 场景对象和缓存
   * @param composition - 合成
   */
  override onCompositionDestroyed (composition: Composition) {
    this.cache.dispose();
    // @ts-expect-error
    this.cache = null;
    // @ts-expect-error
    this.sceneParams = null;
  }
}

export interface ModelPluginOptions {
  cache: CompositionCache,
}

/**
 * 插件组件类，实现特定的插件功能
 * @since 2.0.0
 * @internal
 */
@effectsClass(spec.DataType.ModelPluginComponent)
export class ModelPluginComponent extends ItemBehaviour {
  private runtimeEnv = PLAYER_OPTIONS_ENV_EDITOR;
  private compatibleMode = 'gltf';
  private renderSkybox = true;
  private visBoundingBox = false;
  private autoAdjustScene = false;
  /**
   * 渲染插件是否启用动态排序功能
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
   * 合成缓存器
   */
  cache: CompositionCache;
  /**
   * 场景管理器
   */
  scene: PSceneManager;

  /**
   * 构造函数，创建场景管理器
   * @param engine - 引擎
   * @param options - Mesh 参数
   */
  constructor (engine: Engine, options?: ModelPluginOptions) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  /**
   * 组件后更新，合成相机和场景管理器更新
   * @param dt - 更新间隔
   */
  override lateUpdate (dt: number): void {
    const composition = this.item.composition as Composition;

    if (this.autoAdjustScene && this.scene.tickCount == 1) {
      // 自动计算场景中的相机位置
      // 更加相机的具体参数，计算出合适的相机观察位置
      // 但只会在第一帧进行更新，主要是用于测试使用
      const cameraObject = composition.camera;
      const cameraTransform = new PTransform().fromMatrix4(cameraObject.getViewMatrix());
      const cameraCoordinate = new PCoordinate().fromPTransform(cameraTransform);
      const cameraDirection = cameraCoordinate.zAxis.clone();
      const cameraFov = cameraObject.fov ?? 45;
      const cameraAspect = cameraObject.aspect ?? 1.0;
      //
      const sceneAABB = this.scene.getSceneAABB();
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
          const component = item.getComponent(ModelCameraComponent);

          if (component?.content) {
            const worldMatrix = item.transform.parentTransform?.getWorldMatrix() || Matrix4.IDENTITY.clone();
            const invWorldMatrix = worldMatrix.invert();
            const newPosition = invWorldMatrix.transformPoint(position);

            component.setTransform(newPosition);

            // 正式版本不会走到这个流程，只在测试时使用
            console.info(`Scene AABB [${sceneAABB.min.toArray()}], [${sceneAABB.max.toArray()}]`);
            console.info(`Update camera position [${newPosition.toArray()}]`);
          }
        }
      });
    }

    this.updateSceneCamera(composition);
    this.scene.tick(dt);
  }

  /**
   * 组件销毁，同时销毁场景管理器和缓存器
   */
  override onDestroy (): void {
    this.scene.dispose();
    // @ts-expect-error
    this.scene = null;
    // @ts-expect-error
    this.cache = null;
  }

  /**
   * 反序列化，创建场景管理器
   * @param date - 组件参数
   */
  override fromData (data: any): void {
    super.fromData(data);
    //
    const options = data as ModelPluginOptions;

    this.cache = options.cache;
    this.scene = new PSceneManager(this.engine);
  }

  /**
   * 组件初始化，初始化场景管理器并更新合成相机
   * @param sceneParams - 场景参数
   */
  initial (sceneParams: Record<string, any>) {
    this.runtimeEnv = sceneParams['runtimeEnv'] ?? this.runtimeEnv;
    this.compatibleMode = sceneParams['compatibleMode'] ?? this.compatibleMode;
    this.renderSkybox = sceneParams['renderSkybox'] ?? this.renderSkybox;
    this.visBoundingBox = sceneParams['visBoundingBox'] ?? this.visBoundingBox;
    this.autoAdjustScene = sceneParams['autoAdjustScene'] ?? this.autoAdjustScene;
    this.enableDynamicSort = sceneParams['enableDynamicSort'] ?? this.enableDynamicSort;
    this.renderMode3D = sceneParams['renderMode3D'] ?? this.renderMode3D;
    this.renderMode3DUVGridSize = sceneParams['renderMode3DUVGridSize'] ?? this.renderMode3DUVGridSize;

    const component = this.item.composition as Composition;

    this.scene.initial({
      componentName: `${component.id}`,
      renderer: this.engine.renderer,
      sceneCache: this.cache,
      runtimeEnv: this.runtimeEnv,
      compatibleMode: this.compatibleMode,
      visBoundingBox: this.visBoundingBox,
      enableDynamicSort: this.enableDynamicSort,
      renderMode3D: this.renderMode3D,
      renderMode3DUVGridSize: this.renderMode3DUVGridSize,
      renderSkybox: this.renderSkybox,
      lightItemCount: this.getLightItemCount(),
    });
    this.updateSceneCamera(component);
  }

  /**
   * 更新 SceneManager 中渲染用的相机，相机参数来自 composition.camera
   *
   * @param composition - 当前合成对象
   * @param sceneManager - 当前合成对象绑定的 SceneManager
   */
  private updateSceneCamera (composition: Composition) {
    this.scene.updateDefaultCamera(composition.camera.getOptions());
  }

  private getLightItemCount (): number {
    let lightItemCount = 0;
    const items = this.item.composition?.items ?? [];

    items.forEach(item => {
      if (item.getComponent(ModelLightComponent)) {
        lightItemCount++;
      }
    });

    return lightItemCount;
  }
}

/**
 * 获取场景管理器，从合成中查找
 * @param component
 * @returns
 */
export function getSceneManager (component?: Component): PSceneManager | undefined {
  const composition = component?.item?.composition;
  const pluginItem = composition?.getItemByName('ModelPluginItem');
  const pluginComp = pluginItem?.getComponent(ModelPluginComponent);

  return pluginComp?.scene;
}
