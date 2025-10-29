import * as spec from '@galacean/effects-specification';
import type { Database, SceneData } from './asset-loader';
import { AssetLoader } from './asset-loader';
import type { EffectsObject } from './effects-object';
import type { Material } from './material';
import type { GPUCapability, Geometry, Mesh, RenderPass, Renderer, ShaderLibrary } from './render';
import type { Scene, SceneRenderLevel } from './scene';
import type { Texture } from './texture';
import { TextureLoadAction, generateTransparentTexture, generateWhiteTexture } from './texture';
import type { Disposable } from './utils';
import { addItem, getPixelRatio, isPlainObject, logger, removeItem } from './utils';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';
import type { Composition } from './composition';
import type { AssetManager } from './asset-manager';
import { AssetService } from './asset-service';
import { Ticker } from './ticker';
import { EventSystem } from './plugins/interact/event-system';
import type { GLType } from './gl/create-gl-context';
import { HELP_LINK } from './constants';
import type { Region } from './plugins/interact/click-handler';
import { EventEmitter } from './events';

export interface EngineOptions extends WebGLContextAttributes {
  name?: string,
  glType?: GLType,
  fps?: number,
  env?: string,
  manualRender?: boolean,
  pixelRatio?: number,
  notifyTouch?: boolean,
  interactive?: boolean,
}

type EngineEvent = {
  contextlost: [eventData: { engine: Engine, e: Event }],
  contextrestored: [engine: Engine],
  rendererror: [e: Event | Error],
  resize: [Engine],
};

/**
 * Engine 基类，负责维护所有 GPU 资源的管理及销毁
 */
export class Engine extends EventEmitter<EngineEvent> implements Disposable {
  name = 'NewEngine';
  speed = 1;
  displayAspect: number;
  displayScale = 1;
  offscreenMode = false;
  /**
   * 渲染器
   */
  renderer: Renderer;
  /**
   * 渲染等级
   */
  renderLevel?: SceneRenderLevel;
  whiteTexture: Texture;
  transparentTexture: Texture;
  /**
   * GPU 能力
   */
  gpuCapability: GPUCapability;
  jsonSceneData: SceneData;
  objectInstance: Record<string, EffectsObject>;
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  /**
   * 渲染过程中错误队列
   */
  renderErrors: Set<Error> = new Set();
  compositions: Composition[] = [];
  assetManagers: AssetManager[] = [];
  assetService: AssetService;
  eventSystem: EventSystem;
  env = '';
  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  ticker: Ticker | null = null;
  canvas: HTMLCanvasElement;
  /**
   * 引擎的像素比
   */
  pixelRatio: number;
  // TODO Use composition click event to instead
  onClick?: (eventData: Region) => void;

  protected _disposed = false;
  protected textures: Texture[] = [];
  protected materials: Material[] = [];
  protected geometries: Geometry[] = [];
  protected meshes: Mesh[] = [];
  protected renderPasses: RenderPass[] = [];

  private assetLoader: AssetLoader;

  get disposed (): boolean {
    return this._disposed;
  }

  /**
   *
   */
  constructor (canvas: HTMLCanvasElement, options?: EngineOptions) {
    super();
    this.canvas = canvas;
    this.env = options?.env ?? '';
    this.name = options?.name ?? this.name;
    this.pixelRatio = options?.pixelRatio ?? getPixelRatio();
    this.jsonSceneData = {};
    this.objectInstance = {};
    this.whiteTexture = generateWhiteTexture(this);
    this.transparentTexture = generateTransparentTexture(this);

    if (!options?.manualRender) {
      this.ticker = new Ticker(options?.fps);
      this.runRenderLoop(this.render.bind(this));
    }

    this.eventSystem = new EventSystem(this, options?.notifyTouch ?? false);
    this.eventSystem.enabled = options?.interactive ?? false;
    this.eventSystem.bindListeners(this.canvas);

    this.assetLoader = new AssetLoader(this);
    this.assetService = new AssetService(this);
  }

  /**
   * 创建 Engine 对象。
   */
  static create: (canvas: HTMLCanvasElement, options?: EngineOptions) => Engine;

  clearResources () {
    this.jsonSceneData = {};
    this.objectInstance = {};
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.jsonSceneData[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.jsonSceneData[uuid];
  }

  addInstance (effectsObject: EffectsObject) {
    this.objectInstance[effectsObject.getInstanceId()] = effectsObject;
  }

  /**
   * @ignore
   */
  findObject<T>(guid: spec.DataPath): T {
    // 编辑器可能传 Class 对象，这边判断处理一下直接返回原对象。
    if (!(isPlainObject(guid))) {
      return guid as T;
    }

    if (this.objectInstance[guid.id]) {
      return this.objectInstance[guid.id] as T;
    }

    const result = this.assetLoader.loadGUID<T>(guid);

    return result;
  }

  removeInstance (id: string) {
    delete this.objectInstance[id];
  }

  addPackageDatas (scene: Scene) {
    const { jsonScene, textureOptions = [] } = scene;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins = [], miscs = [], compositions,
    } = jsonScene;

    for (const compositionData of compositions) {
      this.addEffectsObjectData(compositionData as unknown as spec.EffectsObjectData);
    }
    for (const vfxItemData of items) {
      if (!passRenderLevel(vfxItemData.renderLevel, scene.renderLevel)) {
        vfxItemData.components = [];
        vfxItemData.type = spec.ItemType.null;
      }
      this.addEffectsObjectData(vfxItemData);
    }
    for (const materialData of materials) {
      this.addEffectsObjectData(materialData);
    }
    for (const shaderData of shaders) {
      this.addEffectsObjectData(shaderData);
    }
    for (const geometryData of geometries) {
      this.addEffectsObjectData(geometryData);
    }
    for (const componentData of components) {
      this.addEffectsObjectData(componentData);
    }
    for (const animationData of animations) {
      this.addEffectsObjectData(animationData);
    }
    for (const miscData of miscs) {
      this.addEffectsObjectData(miscData);
    }
    for (let i = 0; i < bins.length; i++) {
      const binaryData = bins[i];
      const binaryBuffer = scene.bins[i];

      if (binaryData.dataType === spec.DataType.BinaryAsset) {
        //@ts-expect-error
        binaryData.buffer = binaryBuffer;
        if (binaryData.id) {
          this.addEffectsObjectData(binaryData);
        }
      } else {
        const effectsPackage = new EffectsPackage();

        effectsPackage.deserializeFromBinary(new Uint8Array(binaryBuffer));
        for (const effectsObjectData of effectsPackage.exportObjectDatas) {
          this.addEffectsObjectData(effectsObjectData);
        }
      }
    }
    for (const textureData of textureOptions) {
      this.addEffectsObjectData(textureData as spec.EffectsObjectData);
    }
  }

  runRenderLoop (renderFunction: (dt: number) => void): void {
    this.ticker?.add(renderFunction);
  }

  render (dt: number): void {
    const { renderErrors } = this;

    if (renderErrors.size > 0) {
      this.emit('rendererror', renderErrors.values().next().value);
      // 有渲染错误时暂停播放
      this.ticker?.pause();
    }
    dt = Math.min(dt, 33) * this.speed;
    const comps = this.compositions;
    let skipRender = false;

    comps.sort((a, b) => a.getIndex() - b.getIndex());

    for (let i = 0; i < comps.length; i++) {
      const composition = comps[i];

      if (composition.textureOffloaded) {
        skipRender = true;
        logger.error(`Composition ${composition.name} texture offloaded, skip render.`);
        continue;
      }
      composition.update(dt);
    }

    if (skipRender) {
      this.emit('rendererror', new Error('Play when texture offloaded.'));

      return this.ticker?.pause();
    }
    this.renderer.setFramebuffer(null);
    this.renderer.clear({
      stencilAction: TextureLoadAction.clear,
      clearStencil: 0,
      depthAction: TextureLoadAction.clear,
      clearDepth: 1,
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    });
    for (let i = 0; i < comps.length; i++) {
      !comps[i].renderFrame.isDestroyed && this.renderer.renderRenderFrame(comps[i].renderFrame);
    }
  }

  /**
   * 将渲染器重新和父容器大小对齐
   */
  resize () {
    const { parentElement } = this.canvas;
    let containerWidth;
    let containerHeight;
    let canvasWidth;
    let canvasHeight;

    if (parentElement) {
      const size = this.getTargetSize(parentElement);

      containerWidth = size[0];
      containerHeight = size[1];
      canvasWidth = size[2];
      canvasHeight = size[3];
    } else {
      containerWidth = canvasWidth = this.canvas.width;
      containerHeight = canvasHeight = this.canvas.height;
    }
    const aspect = containerWidth / containerHeight;

    if (containerWidth && containerHeight) {
      const documentWidth = document.documentElement.clientWidth;

      if (canvasWidth > documentWidth * 2) {
        logger.error(`DPI overflowed, width ${canvasWidth} is more than 2x document width ${documentWidth}, see ${HELP_LINK['DPI overflowed']}.`);
      }
      const maxSize = this.env ? this.gpuCapability.detail.maxTextureSize : 2048;

      if ((canvasWidth > maxSize || canvasHeight > maxSize)) {
        logger.error(`Container size overflowed ${canvasWidth}x${canvasHeight}, see ${HELP_LINK['Container size overflowed']}.`);
        if (aspect > 1) {
          canvasWidth = Math.round(maxSize);
          canvasHeight = Math.round(maxSize / aspect);
        } else {
          canvasHeight = Math.round(maxSize);
          canvasWidth = Math.round(maxSize * aspect);
        }
      }

      this.canvas.style.width = containerWidth + 'px';
      this.canvas.style.height = containerHeight + 'px';
      logger.info(`Resize engine ${this.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);

      this.setSize(canvasWidth, canvasHeight);
    }
  }

  setSize (width: number, height: number) {
    // ios 14.1 -ios 14.3 resize canvas will cause memory leak
    this.renderer.resize(width, height);
    this.compositions?.forEach(comp => {
      comp.camera.aspect = width / height;
      comp.camera.pixelHeight = this.renderer.getHeight();
      comp.camera.pixelWidth = this.renderer.getWidth();
    });
    this.emit('resize', this);
  }

  private getTargetSize (parentEle: HTMLElement) {
    if (parentEle === undefined || parentEle === null) {
      throw new Error(`Container is not an HTMLElement, see ${HELP_LINK['Container is not an HTMLElement']}.`);
    }
    const displayAspect = this.displayAspect;
    // 小程序环境没有 getComputedStyle
    const computedStyle = window.getComputedStyle?.(parentEle);
    let targetWidth;
    let targetHeight;
    let finalWidth = 0;
    let finalHeight = 0;

    if (computedStyle) {
      finalWidth = parseInt(computedStyle.width, 10);
      finalHeight = parseInt(computedStyle.height, 10);
    } else {
      finalWidth = parentEle.clientWidth;
      finalHeight = parentEle.clientHeight;
    }

    if (displayAspect) {
      const parentAspect = finalWidth / finalHeight;

      if (parentAspect > displayAspect) {
        targetHeight = finalHeight * this.displayScale;
        targetWidth = targetHeight * displayAspect;
      } else {
        targetWidth = finalWidth * this.displayScale;
        targetHeight = targetWidth / displayAspect;
      }
    } else {
      targetWidth = finalWidth;
      targetHeight = finalHeight;
    }
    const ratio = this.pixelRatio;
    let containerWidth = targetWidth;
    let containerHeight = targetHeight;

    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
    if (targetHeight < 1 || targetHeight < 1) {
      if (this.offscreenMode) {
        targetWidth = targetHeight = containerWidth = containerHeight = 1;
      } else {
        throw new Error(`Invalid container size ${targetWidth}x${targetHeight}, see ${HELP_LINK['Invalid container size']}.`);
      }
    }

    return [containerWidth, containerHeight, targetWidth, targetHeight];
  }

  addTexture (tex: Texture) {
    if (this.disposed) {
      return;
    }
    addItem(this.textures, tex);
  }

  removeTexture (tex: Texture) {
    if (this.disposed) {
      return;
    }
    removeItem(this.textures, tex);
  }

  addMaterial (mat: Material) {
    if (this.disposed) {
      return;
    }
    addItem(this.materials, mat);
  }

  removeMaterial (mat: Material) {
    if (this.disposed) {
      return;
    }
    removeItem(this.materials, mat);
  }

  addGeometry (geo: Geometry) {
    if (this.disposed) {
      return;
    }
    addItem(this.geometries, geo);
  }

  removeGeometry (geo: Geometry) {
    if (this.disposed) {
      return;
    }
    removeItem(this.geometries, geo);
  }

  addMesh (mesh: Mesh) {
    if (this.disposed) {
      return;
    }
    addItem(this.meshes, mesh);
  }

  removeMesh (mesh: Mesh) {
    if (this.disposed) {
      return;
    }
    removeItem(this.meshes, mesh);
  }

  addRenderPass (pass: RenderPass) {
    if (this.disposed) {
      return;
    }
    addItem(this.renderPasses, pass);
  }

  removeRenderPass (pass: RenderPass) {
    if (this.disposed) {
      return;
    }
    removeItem(this.renderPasses, pass);
  }

  addComposition (composition: Composition) {
    if (this.disposed) {
      return;
    }
    addItem(this.compositions, composition);
  }

  removeComposition (composition: Composition) {
    if (this.disposed) {
      return;
    }
    removeItem(this.compositions, composition);
  }

  getShaderLibrary (): ShaderLibrary {
    return this.renderer.getShaderLibrary() as ShaderLibrary;
  }

  /**
   * 销毁所有缓存的资源
   */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this._disposed = true;

    const info: string[] = [];

    if (this.renderPasses.length > 0) {
      info.push(`Pass ${this.renderPasses.length}`);
    }
    if (this.meshes.length > 0) {
      info.push(`Mesh ${this.meshes.length}`);
    }
    if (this.geometries.length > 0) {
      info.push(`Geom ${this.geometries.length}`);
    }
    if (this.textures.length > 0) {
      info.push(`Tex ${this.textures.length}`);
    }

    if (info.length > 0) {
      logger.warn(`Release GPU memory: ${info.join(', ')}.`);
    }

    this.ticker?.stop();
    this.eventSystem?.dispose();
    this.assetService?.dispose();

    this.renderPasses.forEach(pass => pass.dispose());
    this.meshes.forEach(mesh => mesh.dispose());
    this.geometries.forEach(geo => geo.dispose());
    this.materials.forEach(mat => mat.dispose());
    this.textures.forEach(tex => tex.dispose());
    this.assetManagers.forEach(assetManager => assetManager.dispose());
    this.compositions.forEach(comp => comp.dispose());

    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.meshes = [];
    this.renderPasses = [];
    this.compositions = [];
  }
}
