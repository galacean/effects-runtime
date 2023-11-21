import type {
  RenderFrame,
  spec,
  Mesh,
  Material,
  RenderPass,
  SemanticMap,
  Renderer,
  Engine,
} from '@galacean/effects';
import { glContext, RenderPassAttachmentStorageType } from '@galacean/effects';
import { Vector3, Matrix4, Vector2, Box3 } from '../math';
import type { PShadowType } from './common';
import { PObjectType, PLightType, PMaterialType } from './common';
import type { PMesh, PPrimitive } from './mesh';
import { PMaterialBase } from './material';
import type { PLight } from './light';
import type { PSceneManager, PSceneStates } from './scene';
import { FBOOptions } from '../utility/ri-helper';
import { WebGLHelper } from '../utility/plugin-helper';
import { TwoStatesSet } from '../utility/ts-helper';
import { MathUtils } from '../math/utilities';

export interface PMaterialShadowBaseOptions {
  name: string,
  shadowType: PShadowType,
}

export class PMaterialShadowBase extends PMaterialBase {
  shadowType!: PShadowType;

  create (options: PMaterialShadowBaseOptions) {
    this.type = PObjectType.material;
    this.materialType = PMaterialType.shadowBase;
    //
    this.name = options.name;
    this.shadowType = options.shadowType;
  }

  override getShaderFeatures (): string[] {
    // empty
    return [];
  }

  override updateUniforms (material: Material) {
    // empty
  }
}

export class PMaterialShadowBaseTest extends PMaterialBase {
  shadowType!: PShadowType;

  create (options: PMaterialShadowBaseOptions) {
    this.type = PObjectType.material;
    this.materialType = PMaterialType.shadowBase;
    //
    this.name = options.name;
    this.shadowType = options.shadowType;
  }

  override getShaderFeatures (): string[] {
    // empty
    return [];
  }

  override updateUniforms (material: Material) {
    // empty
  }

}

export interface PMaterialShadowFilterOptions {
  name: string,
  blurScale: Vector2,
}

export class PMaterialShadowFilter extends PMaterialBase {
  blurScale!: Vector2;

  create (options: PMaterialShadowFilterOptions) {
    this.type = PObjectType.material;
    this.materialType = PMaterialType.shadowFilter;
    this.depthTestHint = false;
    //
    this.name = options.name;
    this.blurScale = options.blurScale;
  }

  override getShaderFeatures (): string[] {
    // empty
    return [];
  }

  override updateUniforms (material: Material) {
    material.setVector2('u_BlurScale', this.blurScale.toArray() as spec.vec2);
  }
}

/**
 * 阴影初始化选项，包括控制选项和纹理选项
 */
export interface PShadowInitOptions {
  /**
   * 控制相关的参数
   */
  enable?: boolean, // default = true
  quality?: 'low' | 'medium' | 'high',
  softness?: number,
  /**
   * 纹理相关的参数
   */
  width?: number,
  height?: number,
  type?: GLenum,
  format?: GLenum,
  filter?: GLenum,
}

/**
 * 阴影运行时选项，包括 light 的变换矩阵和柔软度
 */
export interface PShadowRuntimeOptions {
  viewProjectionMatrix: Matrix4,
  softness: number,
}

export class PShadowManager {
  /**
   * 是否启用阴影效果，会根据硬件等情况进行设置
   */
  enable: boolean;
  /**
   * 阴影质量参数，一般都用 medium
   */
  quality: 'low' | 'medium' | 'high';
  /**
   * 阴影柔软度，范围[0, 2]
   */
  softness: number;
  /**
   * 阴影纹理相关参数
   */
  width: number;
  height: number;
  type: GLenum;
  format: GLenum;
  filter: GLenum;
  /**
   * shadow map 渲染时 FBO
   */
  baseFBOOpts: FBOOptions;
  /**
   * shadow map 滤波时 FBO
   */
  filterFBOOpts: FBOOptions;
  /**
   * 是否激活运行时阴影
   */
  runtimeEnable: boolean;
  /**
   * 启用阴影效果的 Mesh 列表，来自场景中的 Mesh 列表
   */
  meshList: PMesh[];
  /**
   * 当前帧启用阴影效果的 Primitive 列表，来自上面的 Mesh 列表
   */
  primitiveList: PPrimitive[];
  viewAABB: Box3;
  sceneAABB: Box3;
  shadowAABB: Box3;
  //
  shadowLight?: PLight;
  lightView: Matrix4;
  lightProjection: Matrix4;
  lightViewProjection: Matrix4;
  //
  renderer?: Renderer;
  sceneManager!: PSceneManager;
  //
  xFilterMaterial: PMaterialShadowFilter;
  yFilterMaterial: PMaterialShadowFilter;
  //
  basePass?: RenderPass;
  xFilterPass?: RenderPass;
  yFilterPass?: RenderPass;
  /**
   * Primitive 与 RenderPass 的前一帧与当前帧状态缓存
   */
  meshCacheSet: TwoStatesSet<Mesh>;
  renderPassCacheSet: TwoStatesSet<RenderPass>;
  engine: Engine;

  constructor () {
    this.enable = false;
    this.quality = 'medium';
    this.softness = 1.5;
    //
    this.width = 1024;
    this.height = 1024;
    this.type = glContext.HALF_FLOAT;
    this.format = glContext.RGBA;
    this.filter = glContext.LINEAR;
    /**
     * 创建Shadow Map渲染时的FBO参数
     */
    this.baseFBOOpts = this.getBaseFBOOptions();
    this.filterFBOOpts = this.getFilterFBOOptions();
    //
    this.runtimeEnable = false;
    this.meshList = [];
    this.primitiveList = [];
    //
    this.viewAABB = new Box3();
    this.sceneAABB = new Box3();
    this.shadowAABB = new Box3();
    this.lightView = new Matrix4();
    this.lightProjection = new Matrix4();
    this.lightViewProjection = new Matrix4();
    //
    this.xFilterMaterial = new PMaterialShadowFilter();
    this.yFilterMaterial = new PMaterialShadowFilter();
    //
    this.meshCacheSet = new TwoStatesSet();
    this.renderPassCacheSet = new TwoStatesSet();
  }

  initial (sceneManager: PSceneManager, options?: PShadowInitOptions) {
    this.runtimeEnable = false;
    this.meshList = [];
    this.primitiveList = [];
    this.shadowLight = undefined;
    this.meshCacheSet.clear();
    this.renderPassCacheSet.clear();
    //
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.getRenderer();
    this.engine = this.renderer.engine;
    /**
     * 处理外部传入的阴影选项
     */
    this.enable = options?.enable ?? true;
    this.quality = options?.quality ?? 'medium';
    this.softness = this.getSoftness(options);
    //
    [this.width, this.height] = this.getTextureSize(options);
    this.type = this.getTextureType(options);
    this.format = this.getTextureFormat(options);
    this.filter = this.getTextureFilter(options);

    if (!this.enable) {
      // 没有启用，直接返回
      return;
    }

    if (!this.isSupportTextureOptions()) {
      // 不支持纹理参数
      return;
    }

    this.shadowLight = this.getShadowLight(sceneManager);
    if (this.shadowLight === undefined) {
      // 没有启用阴影效果的灯光
      return;
    }

    // 找到有启用阴影效果的Mesh
    sceneManager.meshList.forEach(mesh => {
      let primitiveCount = 0;

      mesh.primitives.forEach(prim => {
        if (prim.isEnableShadow()) {
          primitiveCount += 1;
        }
      });

      if (primitiveCount > 0) {
        this.meshList.push(mesh);
      }
    });

    if (this.meshList.length <= 0) {
      // 没有启用阴影效果的Mesh
      return;
    }

    this.runtimeEnable = true;
    this.xFilterMaterial.create({ name: 'ShadowXFilterPass', blurScale: new Vector2(this.softness / this.width, 0) });
    this.yFilterMaterial.create({ name: 'ShadowYFilterPass', blurScale: new Vector2(0, this.softness / this.height) });
    this.xFilterMaterial.build([]);
    this.yFilterMaterial.build([]);
  }

  build () {
    if (!this.isEnable()) {
      return;
    }

    const sceneCache = this.sceneManager.getSceneCache();

    this.basePass = sceneCache.getShadowBasePass(this.basePassName, 900, [], this.baseFBOOpts);
    //
    const xFilterMesh = sceneCache.getFilterMesh(this.xFilterMeshName, this.xFilterMaterial, { u_FilterSampler: 'Shadow0Color' });
    const yFilterMesh = sceneCache.getFilterMesh(this.yFilterMeshName, this.yFilterMaterial, { u_FilterSampler: 'Shadow1Color' });

    this.xFilterMaterial.updateUniforms(xFilterMesh.material);
    this.yFilterMaterial.updateUniforms(yFilterMesh.material);
    //
    this.xFilterPass = sceneCache.getShadowFilterPass(this.xFilterPassName, 901, [xFilterMesh], this.filterFBOOpts);
    this.yFilterPass = sceneCache.getShadowFilterPass(this.yFilterPassName, 902, [yFilterMesh], this.filterFBOOpts);
    //
    // render pass渲染完成后的回调样例
    // this.yFilterPass.delegate.didEndRenderPass = function(renderPass: RenderPass, state: RenderingData): void {
    //   const texture = yFilterPass.attachments[0].texture;
    //   const gl = renderer.internal.gl;
    //   gl.bindTexture(texture.internal.target, texture.internal.glHandle);
    //   gl.texParameteri(texture.internal.target, gl.TEXTURE_MIN_FILTER, glContext.LINEAR_MIPMAP_LINEAR);
    //   gl.generateMipmap(texture.internal.target);
    // };
  }

  tick (sceneStates: PSceneStates) {
    if (!this.isEnable()) {
      // 没有启用就忽略
      return;
    }

    this.primitiveList = this.getCurrentPrimitiveList();
    if (this.primitiveList.length <= 0) {
      // 没有阴影相关的 RI Mesh 进入渲染，也忽略
      return;
    }

    this.updateAABBInfo();
    this.updateLightViewProjection();
    this.updateShadowUniforms();

    sceneStates.shadowMapSizeInv = new Vector2(1 / this.width, 1 / this.height);
    sceneStates.lightViewMatrix = this.lightView;
    sceneStates.lightProjectionMatrix = this.lightProjection;
    sceneStates.lightViewProjectionMatrix = this.lightViewProjection;
  }

  /**
   * 更新当前阴影物体的包围盒数据
   * TODO: 需要注意动画物体的包围盒更新
   */
  private updateAABBInfo () {
    this.sceneAABB.makeEmpty();
    this.primitiveList.forEach(prim => {
      // TODO: 需要考虑动画的问题
      const aabb = prim.getWorldBoundingBox();

      this.sceneAABB.expandByBox(aabb);
    });

    this.viewAABB.makeEmpty();
    const camera = this.sceneManager.activeCamera;

    camera.computeViewAABB(this.viewAABB);

    this.shadowAABB.makeEmpty();
    this.shadowAABB.expandByBox(this.viewAABB);
    if (!this.sceneAABB.isEmpty()) {
      this.shadowAABB.intersect(this.sceneAABB);
    }
  }

  private updateLightViewProjection () {
    if (this.shadowLight === undefined) { return; }

    if (this.shadowLight.lightType === PLightType.directional) {
      this.updateDirectionalLightViewProjection(this.shadowLight);
    } else if (this.shadowLight.lightType === PLightType.spot) {
      this.updateSpotLightViewProjection(this.shadowLight);
    } else {
      console.warn(`Invalid light type for casting shadow: ${this.shadowLight}`);
    }
  }

  private updateDirectionalLightViewProjection (lightObj: PLight) {
    if (!lightObj.isDirectional()) {
      this.lightViewProjection.setIdentity();

      return;
    }

    const shadowAABB = this.shadowAABB;
    const viewPosition = shadowAABB.getCenter(new Vector3());
    const lightDirection = lightObj.getWorldDirection();
    const viewTarget = viewPosition.clone().addVector(lightDirection);
    const viewUp = Vector3.computeUpVector(lightDirection, new Vector3());
    const viewMatrix = new Matrix4().lookAt(viewPosition, viewTarget, viewUp);

    const tempAABB = shadowAABB.clone().transform(viewMatrix);
    const tempCenter = tempAABB.getCenter(new Vector3());
    const halfSize = tempAABB.getSize(new Vector3()).multiplyScalar(0.5);

    halfSize.x = Math.max(halfSize.x, halfSize.y);
    halfSize.y = Math.max(halfSize.x, halfSize.y);
    const tempMin = halfSize.clone().multiplyScalar(-1.001).addVector(tempCenter);
    const tempMax = halfSize.clone().multiplyScalar(1.001).addVector(tempCenter);
    const projectMatrix = new Matrix4().orth2d(
      tempMin.x, tempMax.x,
      tempMin.y, tempMax.y,
      tempMin.z, tempMax.z
    );

    this.lightView.copyFrom(viewMatrix);
    this.lightProjection.copyFrom(projectMatrix);

    return Matrix4.multiply(projectMatrix, viewMatrix, this.lightViewProjection);
  }

  private updateSpotLightViewProjection (lightObj: PLight) {
    if (!lightObj.isSpot()) {
      this.lightViewProjection.setIdentity();

      return;
    }
    //
    const viewPosition = lightObj.getWorldPosition();
    const lightDirection = lightObj.direction.clone();
    const dirOffset = lightDirection.clone().multiplyScalar(10);
    const viewTarget = viewPosition.clone().addVector(dirOffset);
    const viewUp = Vector3.computeUpVector(lightDirection, new Vector3());
    const viewMatrix = new Matrix4().lookAt(viewPosition, viewTarget, viewUp);
    // estimate real fovy
    const shadowAABB = this.shadowAABB;
    const tempAABB = shadowAABB.clone().transform(viewMatrix);
    const tempPoints = [
      new Vector3(tempAABB.min.x, tempAABB.min.y, tempAABB.min.z),
      new Vector3(tempAABB.min.x, tempAABB.min.y, tempAABB.max.z),
      new Vector3(tempAABB.min.x, tempAABB.max.y, tempAABB.min.z),
      new Vector3(tempAABB.min.x, tempAABB.max.y, tempAABB.max.z),
      //
      new Vector3(tempAABB.max.x, tempAABB.min.y, tempAABB.min.z),
      new Vector3(tempAABB.max.x, tempAABB.min.y, tempAABB.max.z),
      new Vector3(tempAABB.max.x, tempAABB.max.y, tempAABB.min.z),
      new Vector3(tempAABB.max.x, tempAABB.max.y, tempAABB.max.z),
    ];
    let minCosTheta = 1;
    let nearPlane = 10000;
    let farPlane = -10000;

    tempPoints.map(p => {
      if (p.z <= 0) {
        const np = new Vector3(0, p.y, p.z).normalize();

        minCosTheta = Math.min(minCosTheta, -np.z);
        nearPlane = Math.min(nearPlane, -p.z);
        farPlane = Math.max(farPlane, -p.z);
      }
    });
    const minTheta = Math.acos(minCosTheta);
    const fovy = Math.min(minTheta, lightObj.outerConeAngle) * 2;
    const projectMatrix = new Matrix4().perspective(fovy, 1, nearPlane, farPlane, false);

    return Matrix4.multiply(projectMatrix, viewMatrix, this.lightViewProjection);
  }

  private getShadowOptions (): PShadowRuntimeOptions {
    return {
      viewProjectionMatrix: this.lightViewProjection,
      softness: this.softness,
    };
  }

  private updateShadowUniforms () {
    const shadowOpts = this.getShadowOptions();

    this.primitiveList.forEach(prim => {
      prim.updateUniformForShadow(shadowOpts);
    });
  }

  private getShadowLight (sceneManager: PSceneManager): PLight | undefined {
    // TODO: How to select shadow light
    const lightList = sceneManager.lightManager.lightList;

    for (let i = 0; i < lightList.length; i++) {
      const light = lightList[i];

      if (light.lightType === PLightType.directional || light.lightType === PLightType.spot) {
        return light;
      }
    }
  }

  /**
   * 统计场景中启用阴影的 Primitive 数目
   *
   * @param sceneManager - Model 场景的场景管理器
   * @returns 启用阴影的 Primitve 数目
   */
  private getShadowPrimitiveCount (sceneManager: PSceneManager): number {
    let primitiveCount = 0;

    sceneManager.meshList.forEach(mesh => {
      mesh.primitives.forEach(prim => {
        if (prim.isEnableShadow()) {
          primitiveCount += 1;
        }
      });
    });

    return primitiveCount;
  }

  /**
   * 更新阴影渲染时 Pass 中渲染的对象，注意阴影有 3 个渲染 Pass
   * 开始时 Frame 中没有阴影 Pass，会先添加阴影 Pass
   *
   * @param frame - RI 帧对象
   */
  updateRenderPass (frame: RenderFrame): void {
    // 更新 Base pass 中 Mesh 信息
    if (this.basePass !== undefined) {
      const basePass = this.basePass;

      this.meshCacheSet.forward();
      this.primitiveList.forEach(primitive => {
        if (primitive.isEnableShadow() && primitive.shadowMesh !== undefined) {
          this.meshCacheSet.now.add(primitive.shadowMesh);
        }
      });
      this.meshCacheSet.forRemovedItem(mesh => {
        basePass.removeMesh(mesh);
      });
      this.meshCacheSet.forAddedItem(mesh => {
        basePass.addMesh(mesh);
      });
    }

    // 更新 frame render pass
    this.renderPassCacheSet.forward();
    if (this.hasRenderObject()) {
      if (this.basePass !== undefined) {
        this.renderPassCacheSet.now.add(this.basePass);
      }
      if (this.xFilterPass !== undefined) {
        this.renderPassCacheSet.now.add(this.xFilterPass);
      }
      if (this.yFilterPass !== undefined) {
        this.renderPassCacheSet.now.add(this.yFilterPass);
      }
    }

    // 删除旧的Pass
    let deleteLastRenderPass = false;

    this.renderPassCacheSet.forRemovedItem(pass => {
      frame.removeRenderPass(pass);
      deleteLastRenderPass = true;
    });
    // 添加新增Pass
    let addNowRenderPass = false;

    this.renderPassCacheSet.forAddedItem(pass => {
      frame.addRenderPass(pass);
      addNowRenderPass = true;
    });

    // 这里是懒惰添加和删除，减少每帧增删的操作
    if (addNowRenderPass) {
      this.updateFrameSemantics(frame.semantics, true);
    } else if (deleteLastRenderPass) {
      this.updateFrameSemantics(frame.semantics, false);
    }
  }

  updateFrameSemantics (map: SemanticMap, addSemantic: boolean) {
    if (addSemantic) {
      if (this.basePass !== undefined) {
        map.setSemantic('Shadow0Color', () => ((this.basePass as RenderPass).attachments[0]).texture);
      }
      if (this.xFilterPass !== undefined) {
        map.setSemantic('Shadow1Color', () => ((this.xFilterPass as RenderPass).attachments[0]).texture);
      }
      if (this.yFilterPass !== undefined) {
        map.setSemantic('ShadowNColor', () => ((this.yFilterPass as RenderPass).attachments[0]).texture);
      }
    } else {
      map.setSemantic('Shadow0Color', undefined);
      map.setSemantic('Shadow1Color', undefined);
      map.setSemantic('ShadowNColor', undefined);
    }
  }

  /**
   * 是否启用了阴影效果
   * 是否有需要启用阴影效果的物体，以及当前硬件是否支持启用阴影效果
   * @return 是否启用
   */
  isEnable (): boolean {
    return this.enable && this.runtimeEnable;
  }

  /**
   * 是否有需要渲染的对象，需要先启用阴影
   * @return 是否有渲染对象
   */
  hasRenderObject (): boolean {
    return this.isEnable() && this.primitiveList.length > 0;
  }

  /**
   * 在当前 PMesh 列表中，查找需要在阴影 Pass 中渲染的 Primitive
   *
   * @returns 当前阴影 Pass 要渲染的 Primitive 列表
   */
  getCurrentPrimitiveList (): PPrimitive[] {
    const primitiveList: PPrimitive[] = [];

    this.meshList.forEach(mesh => {
      if (mesh.visible) {
        mesh.primitives.forEach(prim => {
          if (prim.isEnableShadow() && prim.shadowMesh !== undefined) {
            primitiveList.push(prim);
          }
        });
      }
    });

    return primitiveList;
  }

  isSupportTextureOptions (): boolean {
    if (this.type === glContext.FLOAT) {
      return WebGLHelper.isSupportFloatTexture(this.engine);
    } else if (this.type === glContext.HALF_FLOAT) {
      return WebGLHelper.isSupportHalfFloatTexture(this.engine);
    } else {
      return true;
    }
  }

  /**
   * 根据当前阴影参数生成 BasePass 的 FBO 对象
   *
   * @returns BasePass 的 FBO 对象
   */
  getBaseFBOOptions (): FBOOptions {
    const shadowMapSize = new Vector2(this.width, this.height);
    const shadowColorAttachment = {
      texture: {
        format: this.format,
        type: this.type,
        minFilter: this.filter,
        magFilter: this.filter,
      },
    };
    const shadowDepthAttachment = { storageType: RenderPassAttachmentStorageType.depth_16_opaque };

    return new FBOOptions({
      resolution: shadowMapSize,
      colorAttachments: [shadowColorAttachment],
      depthAttachment: shadowDepthAttachment,
    });
  }

  /**
   * 根据当前阴影参数生成 FilterPass 的 FBO 对象
   *
   * @returns FilterPass 的 FBO 对象
   */
  getFilterFBOOptions (): FBOOptions {
    const shadowMapSize = new Vector2(this.width, this.height);
    const shadowColorAttachment = {
      texture: {
        format: this.format,
        type: this.type,
        minFilter: this.filter,
        magFilter: this.filter,
      },
    };

    return new FBOOptions({
      resolution: shadowMapSize,
      colorAttachments: [shadowColorAttachment],
    });
  }

  /**
   * 返回 softness 值，并检查是否在指定范围内
   *
   * @param options - 阴影相关的初始化参数
   * @returns 阴影柔软度值
   */
  getSoftness (options?: PShadowInitOptions): number {
    const softness = options?.softness ?? 1.5;

    if (softness >= 0 && softness <= 2) {
      return softness;
    } else {
      console.error(`Invalid softness value from shadow init options, ${softness}`);

      return MathUtils.clamp(softness, 0, 2);
    }
  }

  /**
   * 返回贴图大小，并检查是否在指定范围内
   *
   * @param options - 阴影相关的初始化参数
   * @returns 阴影贴图大小
   */
  getTextureSize (options?: PShadowInitOptions): [number, number] {
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;

    if (width === height && width > 0 && width <= 4096) {
      return [width, height];
    } else {
      console.error(`Invalid texture size from shadow init options, ${width}x${height}`);

      return [1024, 1024];
    }
  }

  /**
   * 返回纹理类型，并检查是否指定类型
   *
   * @param options - 阴影相关的初始化参数
   * @returns 纹理类型
   */
  getTextureType (options?: PShadowInitOptions): GLenum {
    const typ = options?.type ?? glContext.HALF_FLOAT;

    if (typ === glContext.UNSIGNED_BYTE || typ === glContext.HALF_FLOAT || typ === glContext.FLOAT) {
      return typ;
    } else {
      console.error(`Invalid texture type from shadow init options, ${typ}`);

      return glContext.HALF_FLOAT;
    }
  }

  /**
   * 返回纹理格式，并检查是否指定格式
   *
   * @param options - 阴影相关的初始化参数
   * @returns 纹理格式
   */
  getTextureFormat (options?: PShadowInitOptions): GLenum {
    const format = options?.format ?? glContext.RGBA;

    if (format === glContext.RGBA) {
      return format;
    } else {
      console.error(`Invalid texture format from shadow init options, ${format}`);

      return glContext.RGBA;
    }
  }

  /**
   * 返回纹理滤波格式，并检查是否指定滤波格式
   *
   * @param options - 阴影相关的初始化参数
   * @returns 纹理滤波格式
   */
  getTextureFilter (options?: PShadowInitOptions): GLenum {
    const filter = options?.filter ?? glContext.LINEAR;

    if (filter === glContext.NEAREST || filter === glContext.LINEAR) {
      return filter;
    } else {
      console.error(`Invalid texture filter from shadow init options, ${filter}`);

      return glContext.LINEAR;
    }
  }

  get mainPassUniformSemantics () {
    return { u_ShadowSampler: 'ShadowNColor' };
  }

  get basePassName (): string {
    return this.sceneManager.compName + '_ShadowBasePass';
  }

  get xFilterPassName (): string {
    return this.sceneManager.compName + '_ShadowXFilterPass';
  }

  get yFilterPassName (): string {
    return this.sceneManager.compName + '_ShadowYFilterPass';
  }

  get xFilterMeshName (): string {
    return this.sceneManager.compName + '_ShadowXFilterMesh';
  }

  get yFilterMeshName (): string {
    return this.sceneManager.compName + '_ShadowYFilterMesh';
  }

  get shadowPassList (): RenderPass[] {
    const res: RenderPass[] = [];

    if (this.basePass !== undefined) { res.push(this.basePass); }
    if (this.xFilterPass !== undefined) { res.push(this.xFilterPass); }
    if (this.yFilterPass !== undefined) { res.push(this.yFilterPass); }

    return res;
  }
}

