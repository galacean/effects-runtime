import type { Mesh, Renderer, Texture, Engine, math, CameraOptionsEx } from '@galacean/effects';
import { Transform, spec, addItem, removeItem, PLAYER_OPTIONS_ENV_EDITOR } from '@galacean/effects';
import { PMesh } from './mesh';
import type { PCamera } from './camera';
import { PCameraManager } from './camera';
import { PLight, PLightManager } from './light';
import { Vector3, Matrix4, Box3 } from './math';
import { PSkybox } from './skybox';
import { PTransform, PGlobalState, PObjectType } from './common';
import type { CompositionCache } from './cache';
import type { PEntity } from './object';
import { WebGLHelper } from '../utility/plugin-helper';
import { TwoStatesSet } from '../utility/ts-helper';

type Box3 = math.Box3;
type Vector2 = math.Vector2;

export interface PSceneOptions {
  componentName: string,
  renderer: Renderer,
  sceneCache: CompositionCache,
  wireframeOnly?: boolean,
  runtimeEnv?: string,
  compatibleMode?: string,
  visBoundingBox?: boolean,
  enableDynamicSort?: boolean,
  renderMode3D?: spec.RenderMode3D,
  renderMode3DUVGridSize?: number,
  renderSkybox: boolean,
  lightItemCount: number,
}

export interface PSceneStates {
  deltaSeconds: number,
  //
  camera: PCamera,
  cameraPosition: Vector3,
  viewMatrix: Matrix4,
  projectionMatrix: Matrix4,
  viewProjectionMatrix: Matrix4,
  winSize: Vector2,
  sceneRadius: number,
  // for shadow
  shadowMapSizeInv?: Vector2,
  lightViewMatrix?: Matrix4,
  lightProjectionMatrix?: Matrix4,
  lightViewProjectionMatrix?: Matrix4,
  //
  lightList: PLight[],
  maxLightCount: number,
  skybox?: PSkybox,
}

export class PSceneManager {
  compName: string;
  itemList: PEntity[];
  meshList: PMesh[];
  lightManager: PLightManager;
  cameraManager: PCameraManager;
  /**
   * 是否动态排序 Mesh 渲染优先级
   * 默认 false，需要和 Tiny 对齐时为 true
   */
  enableDynamicSort: boolean;
  brdfLUT?: Texture;
  skybox?: PSkybox;
  //
  tickCount: number;
  lastTickSecond: number;
  /**
   * 当前场景包围盒缓存，在阴影渲染中使用
   */
  sceneAABBCache: Box3;
  /**
   * 场景前帧和当前帧渲染的 Mesh 集合
   */
  renderedMeshSet: TwoStatesSet<Mesh>;
  maxLightCount = 16;
  sceneStates: PSceneStates;

  private renderer?: Renderer;
  private sceneCache?: CompositionCache;
  private parentId2Mesh: Map<string, PMesh>;
  private renderSkybox = false;

  private engine: Engine;

  constructor (engine: Engine) {
    this.compName = 'SceneManger';
    this.itemList = [];
    this.meshList = [];
    this.engine = engine;
    this.lightManager = new PLightManager();
    this.cameraManager = new PCameraManager();
    this.parentId2Mesh = new Map();
    //
    this.enableDynamicSort = false;
    this.tickCount = 0;
    this.lastTickSecond = -1;
    //
    this.sceneAABBCache = new Box3();
    this.renderedMeshSet = new TwoStatesSet();
  }

  initial (opts: PSceneOptions) {
    this.clean();
    this.compName = opts.componentName;
    this.renderer = opts.renderer;
    this.engine = opts.renderer.engine;
    this.sceneCache = opts.sceneCache;
    this.enableDynamicSort = opts.enableDynamicSort === true;
    this.renderSkybox = opts.renderSkybox;
    this.maxLightCount = opts.lightItemCount;
    this.cameraManager.initial(this.renderer.getWidth(), this.renderer.getHeight());
    this.brdfLUT = this.sceneCache.getBrdfLutTexture();
    this.initGlobalState(opts);

    if (this.maxLightCount > 8) {
      console.warn(`Too many light items: ${this.maxLightCount} light(s)`);
    }
  }

  private initGlobalState (opts: PSceneOptions) {
    const capbility = this.engine.gpuCapability;
    const globalState = PGlobalState.getInstance();

    globalState.reset();
    globalState.isWebGL2 = capbility.level === 2;
    //globalState.shaderShared = composition.env === PLAYER_OPTIONS_ENV_EDITOR;
    globalState.runtimeEnv = opts.runtimeEnv ?? PLAYER_OPTIONS_ENV_EDITOR;
    globalState.compatibleMode = opts.compatibleMode ?? 'gltf';
    globalState.visBoundingBox = opts.visBoundingBox ?? false;
    globalState.renderMode3D = opts.renderMode3D ?? spec.RenderMode3D.none;
    globalState.renderMode3DUVGridSize = opts.renderMode3DUVGridSize ?? 1 / 16;
  }

  private clean () {
    this.dispose();
    //
    this.compName = '';
    this.renderer = undefined;
    this.sceneCache = undefined;
    this.itemList = [];
    this.meshList = [];

    this.lightManager = new PLightManager();
    this.cameraManager = new PCameraManager();
    this.parentId2Mesh = new Map();
    this.brdfLUT = undefined;
    this.skybox = undefined;
    this.lastTickSecond = -1;
    //
    this.tickCount = 0;
    this.renderedMeshSet = new TwoStatesSet();
  }

  dispose () {
    this.itemList.forEach(item => item.dispose());
    this.itemList = [];
    this.meshList.forEach(mesh => mesh.dispose());
    this.meshList = [];
    this.lightManager.dispose();
    this.cameraManager.dispose();
    this.brdfLUT = undefined;
    this.skybox?.dispose();
    this.skybox = undefined;
    this.renderedMeshSet.clear();
    //
    this.renderer = undefined;
    this.sceneCache = undefined;
    // @ts-expect-error
    this.engine = undefined;
    this.parentId2Mesh.clear();
  }

  addItem (item: PMesh | PCamera | PLight | PSkybox) {
    if (item instanceof PMesh) {
      const mesh = item;

      if (mesh.parentItemId !== undefined) {
        this.parentId2Mesh.set(mesh.parentItemId, mesh);
      }

      addItem(this.meshList, mesh);
    } else if (item instanceof PSkybox) {
      const skybox = item;

      skybox.setup(this.brdfLUT);
      if (!this.renderSkybox) {
        // renderable会控制天空盒是否作为背景渲染，来自用户(编辑器)的输入
        // this.renderSkybox是播放时候的控制参数。
        // -- 如果是false，会强制天空不渲染。
        // -- 如果是true，会按照用户设置来渲染天空盒。
        skybox.renderable = false;
      }
      this.skybox = skybox;
    } else if (item instanceof PLight) {
      this.lightManager.insertLight(item);
    } else {
      this.cameraManager.insertCamera(item);
    }

    addItem(this.itemList, item);
  }

  removeItem (item: PMesh | PCamera | PLight | PSkybox) {
    if (item instanceof PMesh) {
      const mesh = item;

      if (mesh.parentItemId !== undefined) {
        this.parentId2Mesh.delete(mesh.parentItemId);
      }

      removeItem(this.meshList, mesh);
    } else if (item instanceof PSkybox) {
      this.skybox = undefined;
    } else if (item instanceof PLight) {
      this.lightManager.remove(item);
    } else {
      this.cameraManager.remove(item);
    }

    removeItem(this.itemList, item);
  }

  updateDefaultCamera (camera: CameraOptionsEx) {
    const effectsTransfrom = new Transform({
      ...camera,
      valid: true,
    });

    const newTransform = new PTransform().fromEffectsTransform(effectsTransfrom);

    this.cameraManager.updateDefaultCamera(
      camera.fov,
      camera.aspect,
      camera.near,
      camera.far,
      newTransform.getPosition(),
      newTransform.getRotation(),
      camera.clipMode,
    );
  }

  tick (deltaTime: number) {
    const deltaSeconds = deltaTime;
    const camera = this.activeCamera;
    const viewMatrix = camera.viewMatrix;
    const projectionMatrix = camera.projectionMatrix;
    const viewProjectionMatrix = projectionMatrix.clone().multiply(viewMatrix);

    this.sceneStates = {
      deltaSeconds: deltaSeconds,
      //
      camera: camera,
      cameraPosition: camera.getEye(),
      viewMatrix: viewMatrix,
      projectionMatrix: projectionMatrix,
      viewProjectionMatrix: viewProjectionMatrix,
      winSize: camera.getSize(),
      sceneRadius: 1.0,
      //
      lightList: this.lightManager.lightList,
      maxLightCount: this.maxLightCount,
      skybox: this.skybox,
    };

    // if (this.enableDynamicSort) {
    //   this.dynamicSortMeshes(states);
    // }

    this.tickCount += 1;
    this.lastTickSecond += deltaSeconds;
  }

  /**
   * 动态调整 Mesh 渲染优先级
   * 主要是为了和 Tiny 渲染对齐，正常渲染不进行调整
   *
   * @param states - 场景中的状态数据
   */
  dynamicSortMeshes (states: PSceneStates) {
    const meshList: Mesh[] = [];
    const priorityList: number[] = [];
    const meshSet = this.renderedMeshSet.now;

    meshSet.forEach(mesh => {
      meshList.push(mesh);
      priorityList.push(mesh.priority);
    });
    priorityList.sort((a, b) => a - b);

    // 按照 Tiny 排序算法，对 Mesh 对象进行排序
    // 将透明和不透明物体拆开，从而渲染正确
    const viewMatrix = states.viewMatrix;

    meshList.sort((a: Mesh, b: Mesh) => {
      const atransparent = WebGLHelper.isTransparentMesh(a);
      const btransparent = WebGLHelper.isTransparentMesh(b);

      if (atransparent && btransparent) {
        const aposition = Vector3.fromArray(a.worldMatrix.elements, 12);
        const bposition = Vector3.fromArray(b.worldMatrix.elements, 12);
        const anewPos = viewMatrix.transformPoint(aposition);
        const bnewPos = viewMatrix.transformPoint(bposition);

        return anewPos.z - bnewPos.z;
      } else if (atransparent) {
        return 1;
      } else if (btransparent) {
        return -1;
      } else {
        return 0;
      }
    });

    // 重新赋值渲染优先级
    for (let i = 0; i < meshList.length; i++) {
      const mesh = meshList[i];
      const priority = priorityList[i];

      mesh.priority = priority;
    }
  }

  /**
   * 查询场景中的 Mesh
   * 通过 parentId 查询 Mesh 对象，可能找不到 Mesh 对象
   *
   * @param parentId - Item 中定义的 parentId
   * @returns 查询到的 PMesh，或者是没找到。如果 Mesh 不可见，也是没找到。
   */
  queryMesh (parentId: string): PMesh | undefined {
    const mesh = this.parentId2Mesh.get(parentId);

    if (mesh === undefined || !mesh.visible) {
      return;
    }

    return mesh;
  }

  getSceneAABB (box?: Box3): Box3 {
    const sceneBox = box ?? new Box3();

    this.itemList.forEach(item => {
      if (item.type === PObjectType.mesh) {
        const mesh = item as PMesh;

        if (mesh.owner) {
          const transform = mesh.owner.item.getWorldTransform();
          const worldMatrix = transform.getWorldMatrix();
          const meshBox = mesh.computeBoundingBox(worldMatrix);

          meshBox.applyMatrix4(worldMatrix);
          sceneBox.union(meshBox);
        } else {
          sceneBox.union(mesh.computeBoundingBox(Matrix4.fromIdentity()));
        }
      }
    });

    return sceneBox;
  }

  printDebugInfo () {
    console.info('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
    console.info('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
    this.meshList.forEach((mesh, index) => {
      console.info('Mesh: ', index, mesh);
    });
    this.cameraManager.getCameraList().forEach((cam, index) => {
      console.info('Camera: ', index, cam);
    });
    console.info('Default Camera: ', this.cameraManager.getDefaultCamera());
    this.lightManager.lightList.forEach((light, index) => {
      console.info('Light: ', index, light);
    });
    console.info('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
    console.info('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
  }

  getRenderer (): Renderer {
    return this.renderer as Renderer;
  }

  getSceneCache (): CompositionCache {
    return this.sceneCache as CompositionCache;
  }

  get activeCamera (): PCamera {
    return this.cameraManager.getActiveCamera();
  }

  get lightCount (): number {
    return this.lightManager.lightCount;
  }

  get shaderLightCount (): number {
    return Math.min(10, this.lightManager.lightCount);
  }
}

