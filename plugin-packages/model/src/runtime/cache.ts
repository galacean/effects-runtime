import type { Mesh, Geometry, TextureSourceOptions, RenderPass, spec, Engine } from '@galacean/effects';
import { Texture } from '@galacean/effects';
import type { ModelSkyboxOptions } from '../index';
import type { FBOOptions } from '../utility/ri-helper';
import type { PMaterialBase } from './material';
import type { PSkyboxParams } from './skybox';
import { PSkyboxCreator } from './skybox';
import { WebGLHelper, MeshHelper, PluginHelper } from '../utility/plugin-helper';

// 负责管理插件的WebGL相关资源加载和创建
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

  static async loadStaticResources () {
    if (this.brdfLutTexOptions !== undefined) {
      // 避免重复创建
      return;
    }

    this.brdfLutTexOptions = await PSkyboxCreator.getBrdfLutTextureOptions();
  }

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

  getTexture (name: string): Texture | undefined {
    return this.textureCache.get(name);
  }

  setTexture (name: string, tex: Texture) {
    this.textureCache.set(name, tex);
  }

  getOrCreateTexture (name: string, options: TextureSourceOptions): Texture {
    const tex = this.textureCache.get(name);

    if (tex !== undefined) {
      return tex;
    }
    const newTex = Texture.create(this.engine, options);

    this.textureCache.set(name, newTex);

    return newTex;
  }

  deleteTexture (name: string): boolean {
    const tex = this.textureCache.get(name);

    if (tex !== undefined) {
      tex.dispose();
    }

    return this.textureCache.delete(name);
  }

  getOrCreateGeometry (name: string, geomJson: spec.GeometryOptionsJSON, bins: ArrayBuffer[]): Geometry {
    const cachedGeom = this.geometryCache.get(name);

    if (cachedGeom !== undefined) {
      return cachedGeom;
    }

    const geom = PluginHelper.createGeometry(this.engine, geomJson, bins);

    this.geometryCache.set(name, geom);

    return geom;
  }

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

  getRenderPasses (): RenderPass[] {
    const resList: RenderPass[] = [];

    this.renderPassCache.forEach(pass => {
      resList.push(pass);
    });

    return resList;
  }

  getBrdfLutTexture (): Texture | undefined {
    return this.brdfLutTexture;
  }

  getSkyboxOptions (): ModelSkyboxOptions | undefined {
    return CompositionCache.skyboxOptions;
  }
}

