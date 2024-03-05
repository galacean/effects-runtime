import type { Mesh, Geometry, TextureSourceOptions, RenderPass, spec, Engine } from '@galacean/effects';
import { Texture } from '@galacean/effects';
import type { ModelSkyboxOptions } from '../index';
import type { FBOOptions } from '../utility/ri-helper';
import type { PMaterialBase } from './material';
import type { PSkyboxParams } from './skybox';
import { PSkyboxCreator } from './skybox';
import { WebGLHelper, MeshHelper, PluginHelper } from '../utility/plugin-helper';

/**
 * 合成缓存类，负责管理插件 WebGL 相关资源加载和创建
 */
export class CompositionCache {
  private loadSkybox = false;
  // 天空盒依赖的贴图资源
  private brdfLutTexture?: Texture;
  //
  private meshCache: Map<string, Mesh>;
  private textureCache: Map<string, Texture>;
  private geometryCache: Map<string, Geometry>;
  private renderPassCache: Map<string, RenderPass>;
  //
  private static brdfLutTexOptions?: TextureSourceOptions;
  private static skyboxOptions?: ModelSkyboxOptions;

  /**
   * 加载静态的纹理数据
   * @returns
   */
  static async loadStaticResources () {
    if (this.brdfLutTexOptions !== undefined) {
      // 避免重复创建
      return;
    }

    this.brdfLutTexOptions = await PSkyboxCreator.getBrdfLutTextureOptions();
  }

  /**
   * 创建天空盒数据，如果传入的 params 为空，会使用内置的天空盒参数
   * @param engine - 引擎
   * @param params - 天空盒参数
   * @returns 天空盒数据
   */
  static async genSkyboxOptions (engine: Engine, params?: PSkyboxParams): Promise<ModelSkyboxOptions> {
    let newParams = params;

    if (newParams === undefined) {
      newParams = PSkyboxCreator.getSkyboxParams();
    }

    CompositionCache.skyboxOptions = await PSkyboxCreator.createSkyboxOptions(engine, newParams);

    return CompositionCache.skyboxOptions;
  }

  constructor (private engine: Engine) {
    this.meshCache = new Map();
    this.textureCache = new Map();
    this.geometryCache = new Map();
    this.renderPassCache = new Map();
  }

  /**
   * 记录是否加载天空盒，缓存天空盒相关的查询纹理
   * @param loadSkybox - 是否加载天空盒
   */
  setup (loadSkybox: boolean) {
    this.loadSkybox = loadSkybox;

    if (this.brdfLutTexture === undefined || this.brdfLutTexture.isDestroyed) {
      if (CompositionCache.brdfLutTexOptions === undefined) {
        throw new Error('Please load brdfLutTexOptions at first');
      }
      //
      const brdfLutTextureName = 'brdfLutTexture';

      this.brdfLutTexture = Texture.create(this.engine, CompositionCache.brdfLutTexOptions);
      this.deleteTexture(brdfLutTextureName);
      this.setTexture(brdfLutTextureName, this.brdfLutTexture);
    }
  }

  /**
   * 获取缓存的纹理对象
   * @param name - 名称
   * @returns 纹理对象
   */
  getTexture (name: string): Texture | undefined {
    return this.textureCache.get(name);
  }

  /**
   * 设置纹理对象缓存
   * @param name - 名称
   * @param tex - 纹理对象
   */
  setTexture (name: string, tex: Texture) {
    this.textureCache.set(name, tex);
  }

  /**
   * 获取或者创建纹理对象
   * @param name - 名称
   * @param options - 纹理参数
   * @returns 纹理对象
   */
  getOrCreateTexture (name: string, options: TextureSourceOptions): Texture {
    const tex = this.textureCache.get(name);

    if (tex !== undefined) {
      return tex;
    }
    const newTex = Texture.create(this.engine, options);

    this.textureCache.set(name, newTex);

    return newTex;
  }

  /**
   * 根据名称删除纹理对象
   * @param name - 名称
   * @returns 是否删除成功
   */
  deleteTexture (name: string): boolean {
    const tex = this.textureCache.get(name);

    if (tex !== undefined) {
      tex.dispose();
    }

    return this.textureCache.delete(name);
  }

  /**
   * 获取或者创建几何体
   * @param name - 名称
   * @param geomJson - 几何体参数
   * @param bins - 几何体数据
   * @returns 几何体
   */
  getOrCreateGeometry (name: string, geomJson: spec.GeometryOptionsJSON, bins: ArrayBuffer[]): Geometry {
    const cachedGeom = this.geometryCache.get(name);

    if (cachedGeom !== undefined) {
      return cachedGeom;
    }

    const geom = PluginHelper.createGeometry(this.engine, geomJson, bins);

    this.geometryCache.set(name, geom);

    return geom;
  }

  /**
   * 获取滤波 Mesh
   * @param name - 名称
   * @param material - 材质
   * @param uniformSemantics - Uniform 语义信息
   * @returns
   */
  getFilterMesh (name: string, material: PMaterialBase, uniformSemantics: Record<string, any>): Mesh {
    const cachedMesh = this.meshCache.get(name);

    if (cachedMesh !== undefined) {
      return cachedMesh;
    }

    const mesh = MeshHelper.createFilterMesh(this.engine, name, material, uniformSemantics);

    this.meshCache.set(name, mesh);

    return mesh;
  }

  getShadowBasePass (name: string, priority: number, meshList: Mesh[], fboOptions: FBOOptions): RenderPass {
    return this.getRenderPass(name, priority, meshList, fboOptions);
  }

  getShadowFilterPass (name: string, priority: number, meshList: Mesh[], fboOptions: FBOOptions): RenderPass {
    return this.getRenderPass(name, priority, meshList, fboOptions);
  }

  /**
   * 获取渲染 Pass
   * @param name - 名称
   * @param priority - 优先级
   * @param meshList - Mesh 列表
   * @param fboOptions - FBO 参数
   * @returns
   */
  getRenderPass (name: string, priority: number, meshList: Mesh[], fboOptions: FBOOptions): RenderPass {
    const cachedPass = this.renderPassCache.get(name);

    if (cachedPass !== undefined) {
      cachedPass.setMeshes([]);
      meshList.forEach(mesh => { cachedPass.addMesh(mesh); });

      return cachedPass;
    } else {
      const renderer = this.engine.renderer;
      const renderPass = WebGLHelper.createRenderPass(renderer, name, priority, meshList, fboOptions);

      this.renderPassCache.set(name, renderPass);

      return renderPass;
    }
  }

  /**
   * 销毁缓存，释放所有缓存的对象
   */
  dispose () {
    // @ts-expect-error
    this.engine = null;
    this.brdfLutTexture = undefined;
    this.meshCache.forEach(mesh => {
      WebGLHelper.deleteMesh(mesh);
    });
    this.meshCache.clear();
    //
    this.textureCache.forEach(texture => {
      WebGLHelper.deleteTexture(texture);
    });
    this.textureCache.clear();
    //
    this.geometryCache.forEach(geometry => {
      WebGLHelper.deleteGeometry(geometry);
    });
    this.geometryCache.clear();
    //
    this.renderPassCache.forEach(pass => {
      WebGLHelper.deleteRenderPass(pass);
    });
    this.renderPassCache.clear();
  }

  /**
   * 获取所有的渲染 Pass
   * @returns
   */
  getRenderPasses (): RenderPass[] {
    const resList: RenderPass[] = [];

    this.renderPassCache.forEach(pass => {
      resList.push(pass);
    });

    return resList;
  }

  /**
   * 获取纹理对象，用户 IBL 渲染
   * @returns
   */
  getBrdfLutTexture (): Texture | undefined {
    return this.brdfLutTexture;
  }

  /**
   * 获取天空盒参数
   * @returns
   */
  getSkyboxOptions (): ModelSkyboxOptions | undefined {
    return CompositionCache.skyboxOptions;
  }
}

