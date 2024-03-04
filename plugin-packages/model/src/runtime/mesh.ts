import type { Texture, Geometry, Engine, math } from '@galacean/effects';
import {
  spec,
  Mesh,
  DestroyOptions,
  Material,
} from '@galacean/effects';
import type {
  ModelItemMesh,
  ModelMaterialOptions,
  ModelMeshOptions,
  ModelItemBounding,
  ModelPrimitiveOptions,
} from '../index';
import {
  PObjectType,
  PMaterialType,
  PShadowType,
  PGlobalState,
  PFaceSideMode,
} from './common';
import { PEntity } from './object';
import type { PMaterial } from './material';
import {
  PMaterialPBR,
  PMaterialUnlit,
  createPluginMaterial,
} from './material';
import { Matrix4, Vector3, Box3, Vector2 } from './math';
import { PSkin, PAnimTexture, PMorph, TextureDataMode } from './animation';
import type { PSceneStates } from './scene';
import type { PSkybox } from './skybox';
import type { PMaterialShadowBase, PShadowRuntimeOptions } from './shadow';
import { PMaterialShadowBaseTest } from './shadow';
import { GeometryBoxProxy, HitTestingProxy } from '../utility/plugin-helper';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import { BoxMesh } from '../utility/ri-helper';
import { RayBoxTesting } from '../utility/hit-test-helper';
import type { ModelTreeVFXItem, ModelTreeNode } from '../plugin';

type Box3 = math.Box3;

/**
 * 3D Mesh 类，负责 Mesh 相关的骨骼动画和 PBR 渲染
 */
export class PMesh extends PEntity {
  /**
   * 3D 元素父节点
   */
  parentIndex = -1;
  /**
   * 元素的父节点
   */
  parentItem?: ModelTreeVFXItem;
  /**
   * 元素的父节点 Id
   */
  parentItemId?: string;
  /**
   * 蒙皮
   */
  skin?: PSkin;
  /**
   * morph 动画状态数据，主要是 weights 数组
   */
  morph?: PMorph;
  /**
   * primitive 对象数组
   */
  primitives: PPrimitive[] = [];
  /**
   * 是否隐藏，默认是隐藏
   */
  hide = true;
  /**
   * 优先级
   */
  priority = 0;
  /**
   * 包围盒
   */
  boundingBox: Box3 = new Box3();
  /**
   * 是否显示包围盒
   */
  visBoundingBox = false;
  /**
   * 包围盒 Mesh
   */
  boundingBoxMesh?: BoxMesh;
  /**
   * 是否调用 Build
   */
  isBuilt = false;
  /**
   * 是否销毁
   */
  isDisposed = false;

  /**
   * 构造函数，创建 Mesh 对象，并与所属的 VFX 元素和父元素相关联
   * @param engine 引擎
   * @param itemMesh Mesh 参数
   * @param ownerItem 所属 VFX 元素
   * @param parentItem 父 VFX 元素
   */
  constructor (private engine: Engine, itemMesh: ModelItemMesh, ownerItem?: ModelVFXItem, parentItem?: ModelTreeVFXItem) {
    super();
    const proxy = new EffectsMeshProxy(itemMesh, parentItem);

    this.name = proxy.getName();
    this.type = PObjectType.mesh;
    this.visible = false;
    this.ownerItem = ownerItem;
    //
    this.parentIndex = proxy.getParentIndex();
    this.parentItem = proxy.parentItem;
    this.parentItemId = proxy.getParentId();
    this.skin = proxy.getSkinObj(engine);
    this.morph = proxy.getMorphObj();
    this.hide = proxy.isHide();
    this.priority = ownerItem?.listIndex || 0;
    //
    this.primitives = [];
    proxy.getPrimitives().forEach(primOpts => {
      const primObj = new PPrimitive(this.engine);

      primObj.create(primOpts, this);
      this.primitives.push(primObj);
    });

    if (this.primitives.length <= 0) {
      console.warn(`No primitive inside mesh item ${proxy.getName()}`);
    }

    this.boundingBox = this.getItemBoundingBox(itemMesh.content.interaction);

    if (PGlobalState.getInstance().visBoundingBox) {
      this.boundingBoxMesh = new BoxMesh(this.engine, this.priority);
    }
  }

  /**
   * 创建 Core 层相关的 Mesh、Geometry 和 Material 对象
   * @param lightCount 场景中灯光数目
   * @param uniformSemantics 着色器 Uniform 数据
   * @param skybox 天空盒
   * @returns
   */
  build (lightCount: number, uniformSemantics: { [k: string]: any }, skybox?: PSkybox) {
    if (this.isBuilt) {
      return;
    }

    this.isBuilt = true;
    this.primitives.forEach(prim => {
      prim.build(lightCount, uniformSemantics, skybox);
    });
  }

  /**
   * 更新变换数据和蒙皮数据
   * @param deltaSeconds 更新间隔
   * @returns
   */
  override tick (deltaSeconds: number) {
    if (!this.visible) { return; }

    if (this.ownerItem !== undefined) {
      this.transform.setMatrix(this.ownerItem.transform.getWorldMatrix());
    }

    if (this.skin !== undefined) {
      this.skin.updateSkinMatrices();
    }
  }

  /**
   * 根据可见性状态，将内部相关的 Core 层 Mesh 添加到渲染对象集合中
   * @param renderObjectSet 渲染对象集合
   */
  override addToRenderObjectSet (renderObjectSet: Set<Mesh>) {
    if (this.visible) {
      this.primitives.forEach(prim => {
        renderObjectSet.add(prim.effectsMesh);
      });

      if (this.visBoundingBox && this.boundingBoxMesh !== undefined) {
        renderObjectSet.add(this.boundingBoxMesh.mesh);
      }
    }
  }

  /**
   * 销毁，需要主动释放蒙皮、morph 和 Mesh 等相关的对象
   * @returns
   */
  override dispose () {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    // @ts-expect-error
    this.engine = null;
    this.parentItem = undefined;
    this.skin?.dispose();
    this.skin = undefined;
    this.morph?.dispose();
    this.morph = undefined;
    this.primitives.forEach(prim => {
      prim.dispose();
    });
    this.primitives = [];
    this.boundingBoxMesh?.dispose();
    this.boundingBoxMesh = undefined;
  }

  /**
   * 更新 Morph 动画权重
   * 每帧都会更新 Morph 动画权重，需要小心检查 Morph 动画参数
   * 对于数组长度对不上的情况，直接报错
   *
   * @param weightsArray - Morph 动画的权重数组
   */
  updateMorphWeights (weightsArray: Float32Array) {
    if (this.morph === undefined || !this.morph.hasMorph()) {
      return;
    }

    const updatedArray = this.morph.morphWeightsArray;

    if (updatedArray === undefined) {
      return;
    }

    if (updatedArray.length != weightsArray.length) {
      throw new Error('weight array length mismatch');
    }

    for (let i = 0; i < updatedArray.length; i++) {
      updatedArray[i] = weightsArray[i];
    }
  }

  /**
   * 更新父 VFX 元素
   * @param parentItem 父 VFX 元素
   */
  updateParentItem (parentItem: ModelTreeVFXItem) {
    this.parentItem = parentItem;
    if (this.skin !== undefined) {
      this.skin.updateParentItem(parentItem);
    }
  }

  /**
   * 更新着色器 Uniform 数据，根据当前场景状态
   * @param sceneStates 场景状态
   */
  override updateUniformsForScene (sceneStates: PSceneStates) {
    const worldMatrix = this.matrix;
    const normalMatrix = worldMatrix.clone().invert().transpose();

    this.primitives.forEach(prim => {
      prim.updateUniformsForScene(worldMatrix, normalMatrix, sceneStates);
    });

    if (sceneStates.deltaSeconds === 0 && this.boundingBoxMesh !== undefined) {
      this.computeBoundingBox(worldMatrix);
      const lineColor = new Vector3(1, 1, 1);
      const minPos = this.boundingBox.min;
      const maxPos = this.boundingBox.max;
      const positions = new Float32Array([
        minPos.x, minPos.y, minPos.z,
        maxPos.x, minPos.y, minPos.z,
        maxPos.x, maxPos.y, minPos.z,
        minPos.x, maxPos.y, minPos.z,

        minPos.x, minPos.y, maxPos.z,
        maxPos.x, minPos.y, maxPos.z,
        maxPos.x, maxPos.y, maxPos.z,
        minPos.x, maxPos.y, maxPos.z,
      ]);

      this.boundingBoxMesh.update(worldMatrix, sceneStates.viewProjectionMatrix, positions, lineColor);
    }
  }

  updateUniformForShadow (shadowOptions: PShadowRuntimeOptions) {
    this.primitives.forEach(prim => {
      prim.updateUniformForShadow(shadowOptions);
    });
  }

  /**
   * 点击测试，对于编辑器模式会进行精准的点击测试，否则就和内部的包围盒进行测试
   * @param rayOrigin 射线原点
   * @param rayDirection 射线方向
   * @returns 交点列表
   */
  hitTesting (rayOrigin: Vector3, rayDirection: Vector3): Vector3[] {
    const worldMatrix = this.matrix;
    const invWorldMatrix = worldMatrix.clone().invert();
    const newOrigin = invWorldMatrix.transformPoint(rayOrigin, new Vector3());
    const newDirection = invWorldMatrix.transformNormal(rayDirection, new Vector3());

    const bounding = this.boundingBox;
    const boxt = RayBoxTesting(newOrigin, newDirection, bounding.min, bounding.max);

    if (boxt === undefined) {
      return [];
    }

    let mint: number | undefined;

    if (PGlobalState.getInstance().isEditorEnv) {
      this.primitives.forEach(prim => {
        const primt = prim.hitTesting(newOrigin, newDirection, worldMatrix, invWorldMatrix);

        if (primt !== undefined) {
          if (mint === undefined || mint > primt) {
            mint = primt;
          }
        }
      });
    } else {
      mint = boxt;
    }

    if (mint === undefined) {
      return [];
    }

    newDirection.multiply(mint);
    newOrigin.add(newDirection);
    worldMatrix.transformPoint(newOrigin);

    return [newOrigin];
  }

  /**
   * 计算包围盒，根据传入的世界矩阵
   * @param worldMatrix 世界矩阵
   * @returns
   */
  computeBoundingBox (worldMatrix: Matrix4): Box3 {
    const box = this.boundingBox.makeEmpty();
    const inverseWorldMatrix = worldMatrix.clone().invert();

    this.primitives.forEach(prim => {
      const subbox = prim.computeBoundingBox(inverseWorldMatrix);

      box.union(subbox);
    });

    return box;
  }

  private getItemBoundingBox (inBounding?: ModelItemBounding) {
    if (inBounding === undefined) {
      return new Box3();
    }

    if (inBounding.type === spec.ModelBoundingType.box) {
      const center = inBounding.center ?? [0, 0, 0];
      const size = inBounding.size ?? [0, 0, 0];
      const c = Vector3.fromArray(center);
      const hs = Vector3.fromArray(size).multiply(0.5);
      const minVector = c.clone().subtract(hs);
      const maxVector = c.clone().add(hs);

      return new Box3(minVector, maxVector);
    } else {
      const center = inBounding.center ?? [0, 0, 0];
      const halfRadius = (inBounding.radius ?? 0) * 0.5;
      const c = Vector3.fromArray(center);
      const minVector = c.clone().subtract(halfRadius);
      const maxVector = c.clone().add(halfRadius);

      return new Box3(minVector, maxVector);
    }
  }

  /**
   * 获取父节点 id
   * @returns
   */
  getParentId (): string | undefined {
    return this.parentItemId;
  }

  /**
   * 是否有蒙皮
   */
  get hasSkin (): boolean {
    return this.skin !== undefined;
  }

  /**
   * 获取 Core 层 Mesh 数组
   */
  get mriMeshs (): Mesh[] {
    return this.primitives.map(prim => {
      return prim.effectsMesh;
    });
  }

}

/**
 * 3D Primitive 类，负责 Sub Mesh相关的功能，支持骨骼动画和 PBR 渲染
 */
export class PPrimitive {
  /**
   * 宿主 Mesh，包含了当前 Primitive
   */
  private parent?: PMesh;
  private skin?: PSkin; // from owner mesh
  /**
   * Morph 动画状态数据，来自 Mesh 对象，这里不创建不删除
   */
  private morph?: PMorph;
  private geometry!: PGeometry;
  private material!: PMaterial;
  //
  private jointMatrixList?: Float32Array;
  private jointNormalMatList?: Float32Array;
  private jointMatrixTexture?: PAnimTexture;
  private jointNormalMatTexture?: PAnimTexture;
  /**
   * 名称
   */
  name = '';
  /**
   * Core 层 Mesh
   */
  effectsMesh!: Mesh;
  /**
   * 渲染优先级
   */
  effectsPriority = 0;
  /**
   * 包围盒
   */
  boundingBox = new Box3();
  /**
   * 是否压缩，模式不压缩
   */
  isCompressed = false;
  //
  shadowType = PShadowType.none;
  shadowMesh?: Mesh;
  shadowMaterial?: PMaterialShadowBase;

  constructor (private engine: Engine) {

  }

  /**
   * 创建 Primitive 对象
   * @param options Primitive 参数
   * @param parent 父 Mesh 对象
   */
  create (options: ModelPrimitiveOptions, parent: PMesh) {
    this.parent = parent;
    this.skin = parent.skin;
    this.morph = parent.morph;
    this.setGeometry(options.geometry);
    this.setMaterial(options.material);
    this.name = parent.name;
    this.effectsPriority = parent.priority;
    this.geometry.setHide(parent.hide);

    if (this.skin !== undefined) {
      const jointCount = this.skin.getJointCount();

      this.jointMatrixList = new Float32Array(jointCount * 16);
      this.jointNormalMatList = new Float32Array(jointCount * 16);
      if (this.skin.isTextureDataMode()) {
        const isHalfFloat = this.skin.textureDataMode === TextureDataMode.half_float;

        this.jointMatrixTexture = new PAnimTexture(this.engine);
        this.jointNormalMatTexture = new PAnimTexture(this.engine);
        this.jointMatrixTexture.create(jointCount, isHalfFloat, 'jointMatrixTexture');
        this.jointNormalMatTexture.create(jointCount, isHalfFloat, 'jointNormalMatTexture');
      }
    } else {
      if (this.geometry.hasWeights() || this.geometry.hasJoints()) {
        // 最近出现发布后模型动画没播出来问题，
        // 是因为导出后 skin 属性丢失导致，所以增加这个检查
        console.warn('Geometry has weight and/or joint array, but the skin is missing.');
      }
    }

    this.isCompressed = this.geometry.isCompressed();

    this.shadowType = PShadowType.none;
    if (this.material instanceof PMaterialPBR && this.material.enableShadow) {
      this.shadowType = PShadowType.expVariance;
    }

    //if (PGlobalState.getInstance().isTiny3dMode) {
    //  if (this._material.isAdditive || this._material.isTranslucent()) { this.mriPriority += 10000; }
    //}
  }

  /**
   * 创建 Core 层 Mesh、Geometry 和 Material 对象，用于后面的渲染
   * 部分着色器 Uniform 数据来自 uniformSemantics
   * @param lightCount 灯光数目
   * @param uniformSemantics Uniform 数据集
   * @param skybox 天空盒
   */
  build (lightCount: number, uniformSemantics: { [k: string]: any }, skybox?: PSkybox) {
    const globalState = PGlobalState.getInstance();
    const featureList = this.getFeatureList(lightCount, true, skybox);

    this.material.build(featureList);
    const newSemantics = this.isEnableShadow() ? uniformSemantics : {};

    newSemantics['u_ViewProjectionMatrix'] = 'VIEWPROJECTION';
    //newSemantics["uView"] = 'VIEWINVERSE';
    newSemantics['u_ModelMatrix'] = 'MODEL';
    newSemantics['uEditorTransform'] = 'EDITOR_TRANSFORM';
    const material = Material.create(
      this.engine,
      {
        shader: {
          vertex: this.material.vertexShaderCode,
          fragment: this.material.fragmentShaderCode,
          shared: globalState.shaderShared,
        },
        uniformSemantics: newSemantics,
      }
    );

    this.material.setMaterialStates(material);

    const mesh = Mesh.create(
      this.engine,
      {
        name: this.name,
        material,
        geometry: this.getEffectsGeometry(),
        priority: this.effectsPriority,
      }
    );

    if (this.effectsMesh !== undefined) {
      this.effectsMesh.dispose();
    }

    this.effectsMesh = mesh;

    if (this.isEnableShadow()) {
      this.shadowMaterial = new PMaterialShadowBaseTest();
      this.shadowMaterial.create({
        name: this.name + '_ShadowMaterial',
        shadowType: this.shadowType,
      });
      const shadowFeatureList = this.getFeatureList(lightCount, false, skybox);

      this.shadowMaterial.build(shadowFeatureList);
      //
      const shadowVertexShader = this.shadowMaterial.vertexShaderCode;
      const shaodwFragmentShader = this.shadowMaterial.fragmentShaderCode;
      const shadowMaterial = Material.create(
        this.engine,
        {
          shader: {
            vertex: shadowVertexShader,
            fragment: shaodwFragmentShader,
            shared: globalState.shaderShared,
          },
        }
      );

      this.shadowMaterial.setMaterialStates(shadowMaterial);
      const shadowMesh = Mesh.create(
        this.engine,
        {
          name: this.name + '_shadow',
          material: shadowMaterial,
          geometry: this.getEffectsGeometry(),
          priority: this.effectsPriority,
        }
      );

      if (this.shadowMesh !== undefined) {
        this.shadowMesh.dispose();
      }

      this.shadowMesh = shadowMesh;
    }
  }

  private getFeatureList (lightCount: number, pbrPass: boolean, skybox?: PSkybox): string[] {
    const featureList: string[] = [];

    if (this.geometry.hasNormals()) {
      featureList.push('HAS_NORMALS 1');
    }
    if (this.geometry.hasTangents()) {
      featureList.push('HAS_TANGENTS 1');
    }
    if (this.geometry.hasUVCoords(1)) {
      featureList.push('HAS_UV_SET1 1');
    }
    if (this.geometry.hasUVCoords(2)) {
      featureList.push('HAS_UV_SET2 1');
    }

    if (this.morph !== undefined && this.morph.hasMorph()) {
      // 存在 Morph 动画，需要配置 Morph 动画相关的 Shader 宏定义
      // USE_MORPHING 是总开关，WEIGHT_COUNT 是 weights 数组长度（Shader）
      featureList.push('USE_MORPHING');
      featureList.push(`WEIGHT_COUNT ${this.morph.morphWeightsLength}`);
      for (let i = 0; i < this.morph.morphWeightsLength; i++) {
        if (this.morph.hasPositionMorph) {
          featureList.push(`HAS_TARGET_POSITION${i}`);
        }
        if (this.morph.hasNormalMorph) {
          featureList.push(`HAS_TARGET_NORMAL${i}`);
        }
        if (this.morph.hasTangentMorph) {
          featureList.push(`HAS_TARGET_TANGENT${i}`);
        }
      }
    }

    if (this.skin !== undefined) {
      featureList.push('USE_SKINNING 1');
      featureList.push(`JOINT_COUNT ${this.skin.getJointCount()}`);
      featureList.push('HAS_JOINT_SET1 1');
      featureList.push('HAS_WEIGHT_SET1 1');
      if (this.skin.textureDataMode) { featureList.push('USE_SKINNING_TEXTURE 1'); }
    }

    if (this.isEnableShadow()) {
      if (this.shadowType === PShadowType.standard) {
        // standard
        featureList.push('SHADOWMAP_STANDARD 1');
      } else if (this.shadowType === PShadowType.variance) {
        // variance
        featureList.push('SHADOWMAP_VSM 1');
      } else {
        // expVariance
        featureList.push('SHADOWMAP_EVSM 1');
        featureList.push('SHADOWMAP_EVSM_PCF 1');
      }

      if (pbrPass) {
        featureList.push('USE_SHADOW_MAPPING 1');
      }
    }

    if (this.material.materialType !== PMaterialType.unlit) {
      let hasLight = false;

      if (lightCount > 0 && this.geometry.hasNormals()) {
        hasLight = true;
        featureList.push('USE_PUNCTUAL 1');
        featureList.push(`LIGHT_COUNT ${lightCount}`);
      }

      if (skybox !== undefined && skybox.available) {
        hasLight = true;
        featureList.push('USE_IBL 1');
        featureList.push('USE_TEX_LOD 1');
        if (skybox.hasDiffuseImage) {
          // do nothing
        } else {
          featureList.push('IRRADIANCE_COEFFICIENTS 1');
        }
      }

      // if(!hasLight){
      //   featureList.push('MATERIAL_UNLIT 1');
      // }
    }

    // 渲染中间结果输出，用于渲染效果调试，支持 pbr 和 unlit
    const renderMode = PGlobalState.getInstance().renderMode3D;
    const outputDefine = this.getRenderMode3DDefine(renderMode);

    if (outputDefine !== undefined) {
      featureList.push('DEBUG_OUTPUT 1');
      featureList.push(`${outputDefine} 1`);
    }

    return featureList;
  }

  /**
   * 将 Core 层 Mesh 添加到渲染对象集合中
   * @param renderObjectSet 渲染对象集合
   */
  addToRenderObjectSet (renderObjectSet: Set<Mesh>) {
    renderObjectSet.add(this.effectsMesh);
  }

  /**
   * 销毁，需要释放创建的 Core 层对象
   */
  dispose () {
    // @ts-expect-error
    this.engine = null;
    this.parent = undefined;
    this.skin = undefined;
    this.morph = undefined;
    this.geometry.dispose();
    this.material.dispose();
    //
    this.jointMatrixList = undefined;
    this.jointNormalMatList = undefined;
    this.jointMatrixTexture?.dispose();
    this.jointMatrixTexture = undefined;
    this.jointNormalMatTexture?.dispose();
    this.jointNormalMatTexture = undefined;
    this.effectsMesh.dispose({
      geometries: DestroyOptions.keep,
      material: DestroyOptions.keep,
    });
    // @ts-expect-error
    this.effectsMesh = undefined;
    this.shadowMesh?.dispose({
      geometries: DestroyOptions.keep,
      material: DestroyOptions.keep,
    });
    this.shadowMesh = undefined;
    this.shadowMaterial?.dispose();
    this.shadowMaterial = undefined;
  }

  /**
   * 更新着色器 Uniform 数据，根据场景状态
   * @param worldMatrix 世界矩阵
   * @param nomralMatrix 法线矩阵
   * @param sceneStates 场景状态
   */
  updateUniformsForScene (worldMatrix: Matrix4, nomralMatrix: Matrix4, sceneStates: PSceneStates) {
    this.updateUniformsByAnimation(worldMatrix, nomralMatrix);
    this.updateUniformsByScene(sceneStates);
    this.material.updateUniforms(this.getModelMaterial());
  }

  updateUniformForShadow (shadowOpts: PShadowRuntimeOptions) {
    const shadowMriMaterial = this.getShadowModelMaterial();

    if (shadowMriMaterial !== undefined) {
      shadowMriMaterial.setMatrix('u_ViewProjectionMatrix', shadowOpts.viewProjectionMatrix);
      if (this.shadowMaterial !== undefined) {
        this.shadowMaterial.updateUniforms(shadowMriMaterial);
      }
    }
  }

  /**
   * 点击测试，先进行简单的包围合测试，然后再计算精准的点击测试，这个测试非常耗时不要在移动端上使用
   * @param newOrigin 射线原点
   * @param newDirection 射线方向
   * @param worldMatrix 世界矩阵
   * @param invWorldMatrix 逆世界矩阵
   * @returns 射线的 t 参数
   */
  hitTesting (newOrigin: Vector3, newDirection: Vector3, worldMatrix: Matrix4, invWorldMatrix: Matrix4) {
    const bounding = this.boundingBox;
    const boxt = RayBoxTesting(newOrigin, newDirection, bounding.min, bounding.max);
    const bindMatrices: Matrix4[] = [];

    if (boxt === undefined) {
      return;
    }

    if (this.skin !== undefined) {
      const animMatrices = this.skin.animationMatrices;

      animMatrices.forEach(mat => {
        bindMatrices.push(new Matrix4().multiplyMatrices(invWorldMatrix, mat));
      });
    }

    const proxy = new HitTestingProxy();
    const doubleSided = this.material.faceSideMode === PFaceSideMode.both;

    proxy.create(this.geometry.geometry, doubleSided, bindMatrices);

    return proxy.getHitPoint(newOrigin, newDirection);
  }

  /**
   * 计算包围盒
   * @param inverseWorldMatrix 逆世界坐标
   * @returns
   */
  computeBoundingBox (inverseWorldMatrix: Matrix4): Box3 {
    if (this.skin === undefined && !this.boundingBox.isEmpty()) {
      // 包围盒缓存了，直接返回计算的结果
      return this.boundingBox;
    }

    // 重新计算包围盒
    const bindMatrices: Matrix4[] = [];

    if (this.skin !== undefined) {
      const animMatrices = this.skin.animationMatrices;

      animMatrices.forEach(mat => {
        bindMatrices.push(new Matrix4().multiplyMatrices(inverseWorldMatrix, mat));
      });
    }

    const proxy = new GeometryBoxProxy();

    proxy.create(this.geometry.geometry, bindMatrices);

    return proxy.getBoundingBox(this.boundingBox);
  }

  /**
   * 渲染输出模式转成 Shader 中的宏定义
   *
   * @param mode - 渲染输出模式
   * @returns none 模式返回 undefined，其他模式返回相应宏定义
   */
  getRenderMode3DDefine (mode: spec.RenderMode3D): string | undefined {
    switch (mode) {
      case spec.RenderMode3D.uv:
        return 'DEBUG_UV';
      case spec.RenderMode3D.normal:
        return 'DEBUG_NORMAL';
      case spec.RenderMode3D.basecolor:
        return 'DEBUG_BASECOLOR';
      case spec.RenderMode3D.alpha:
        return 'DEBUG_ALPHA';
      case spec.RenderMode3D.metallic:
        return 'DEBUG_METALLIC';
      case spec.RenderMode3D.roughness:
        return 'DEBUG_ROUGHNESS';
      case spec.RenderMode3D.ao:
        return 'DEBUG_OCCLUSION';
      case spec.RenderMode3D.emissive:
        return 'DEBUG_EMISSIVE';
    }
  }

  private updateUniformsByAnimation (worldMatrix: Matrix4, normalMatrix: Matrix4) {
    const material = this.getModelMaterial();
    const shadowMaterial = this.getShadowModelMaterial();

    material.setMatrix('u_ModelMatrix', worldMatrix);
    material.setMatrix('u_NormalMatrix', normalMatrix);
    if (shadowMaterial !== undefined) {
      shadowMaterial.setMatrix('u_ModelMatrix', worldMatrix);
      shadowMaterial.setMatrix('u_NormalMatrix', normalMatrix);
    }
    //
    const skin = this.skin;

    if (skin !== undefined) {
      const jointMatrixList = this.jointMatrixList as Float32Array;
      const jointNormalMatList = this.jointNormalMatList as Float32Array;

      skin.computeMeshAnimMatrices(worldMatrix, jointMatrixList, jointNormalMatList);
      if (skin.textureDataMode) {
        const jointMatrixTexture = this.jointMatrixTexture as PAnimTexture;
        const jointNormalMatTexture = this.jointNormalMatTexture as PAnimTexture;

        jointMatrixTexture.update(jointMatrixList);
        jointNormalMatTexture.update(jointNormalMatList);
        material.setTexture('u_jointMatrixSampler', jointMatrixTexture.getTexture());
        material.setTexture('u_jointNormalMatrixSampler', jointNormalMatTexture.getTexture());
      } else {
        const jointMatrixNumbers: number[] = [];
        const jointNormalMatNumbers: number[] = [];

        jointMatrixList.forEach(val => jointMatrixNumbers.push(val));
        jointNormalMatList.forEach(val => jointNormalMatNumbers.push(val));
        material.setMatrixNumberArray('u_jointMatrix', jointMatrixNumbers);
        material.setMatrixNumberArray('u_jointNormalMatrix', jointNormalMatNumbers);
        if (shadowMaterial !== undefined) {
          shadowMaterial.setMatrixNumberArray('u_jointMatrix', jointMatrixNumbers);
          shadowMaterial.setMatrixNumberArray('u_jointNormalMatrix', jointNormalMatNumbers);
        }
      }
    }

    // Morph 相关的数据更新，仅需要更新 weights 数组
    const morph = this.morph;

    if (morph !== undefined && morph.hasMorph()) {
      const morphWeights = morph.morphWeightsArray as Float32Array;
      const morphWeightNumbers: number[] = [];

      morphWeights.forEach(val => morphWeightNumbers.push(val));
      material.setFloats('u_morphWeights', morphWeightNumbers);
      if (shadowMaterial !== undefined) {
        shadowMaterial.setFloats('u_morphWeights', morphWeightNumbers);
      }
    }
  }

  private updateUniformsByScene (sceneStates: PSceneStates) {
    const material = this.getModelMaterial();

    material.setMatrix('u_ViewProjectionMatrix', sceneStates.viewProjectionMatrix);
    material.setVector3('u_Camera', sceneStates.cameraPosition);
    if (this.isEnableShadow()) {
      // shadow map 先不支持
      // const matrix = sceneStates.lightViewProjectionMatrix?.data ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      // const viewMat = sceneStates.lightViewMatrix?.data ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      // const projMat = sceneStates.lightProjectionMatrix?.data ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      // const shadowMapSizeInv = sceneStates.shadowMapSizeInv ?? new Vector2(1 / 512, 1 / 512);

      // material.setMatrix('u_LightViewProjectionMatrix', matrix);
      // //material.setUniformValue('u_LightViewMatrix', viewMat);
      // //material.setUniformValue('u_LightProjectionMatrix', projMat);
      // material.setUniformValue('u_DeltaSceneSize', sceneStates.sceneRadius * 0.001);
      // material.setUniformValue('u_ShadowMapSizeInv', shadowMapSizeInv.toArray());
    }
    //
    if (!this.isUnlitMaterial()) {
      const { maxLightCount, lightList } = sceneStates;

      for (let i = 0; i < maxLightCount; i++) {
        if (i < lightList.length) {
          const light = lightList[i];
          const intensity = light.visible ? light.intensity : 0;

          material.setVector3(`u_Lights[${i}].direction`, light.getWorldDirection());
          material.setFloat(`u_Lights[${i}].range`, light.range);
          material.setVector3(`u_Lights[${i}].color`, light.color);
          material.setFloat(`u_Lights[${i}].intensity`, intensity);
          material.setVector3(`u_Lights[${i}].position`, light.getWorldPosition());
          material.setFloat(`u_Lights[${i}].innerConeCos`, Math.cos(light.innerConeAngle));
          material.setFloat(`u_Lights[${i}].outerConeCos`, Math.cos(light.outerConeAngle));
          material.setInt(`u_Lights[${i}].type`, light.lightType);
          material.setVector2(`u_Lights[${i}].padding`, light.padding);
        } else {
          material.setVector3(`u_Lights[${i}].direction`, Vector3.ZERO);
          material.setFloat(`u_Lights[${i}].range`, 0);
          material.setVector3(`u_Lights[${i}].color`, Vector3.ZERO);
          material.setFloat(`u_Lights[${i}].intensity`, 0);
          material.setVector3(`u_Lights[${i}].position`, Vector3.ZERO);
          material.setFloat(`u_Lights[${i}].innerConeCos`, 0);
          material.setFloat(`u_Lights[${i}].outerConeCos`, 0);
          material.setInt(`u_Lights[${i}].type`, 99999);
          material.setVector2(`u_Lights[${i}].padding`, Vector2.ZERO);
        }
      }

      const skybox = sceneStates.skybox;

      if (skybox !== undefined && skybox.available) {
        material.setVector2('u_IblIntensity', new Vector2(skybox.currentIntensity, skybox.currentReflectionsIntensity));
        material.setTexture('u_brdfLUT', skybox.brdfLUT as Texture);
        if (skybox.diffuseImage !== undefined) {
          material.setTexture('u_DiffuseEnvSampler', skybox.diffuseImage);
        } else {
          const coeffs = skybox.irradianceCoeffs as number[][];
          const aliasName = ['l00', 'l1m1', 'l10', 'l11', 'l2m2', 'l2m1', 'l20', 'l21', 'l22'];

          aliasName.forEach((n, i) => {
            material.setVector3(`u_shCoefficients.${n}`, Vector3.fromArray(coeffs[i] as spec.vec3));
          });
        }
        material.setInt('u_MipCount', skybox.specularMipCount ?? 1);
        material.setTexture('u_SpecularEnvSampler', skybox.specularImage);
      }
    }
  }

  /**
   * 是否有蒙皮
   * @returns
   */
  hasSkin (): boolean {
    return this.skin !== undefined;
  }

  /**
   * 获取 Core 层几何体
   * @returns
   */
  getEffectsGeometry (): Geometry {
    return this.geometry.geometry;
  }

  /**
   * 设置几何
   * @param val 3D 或 Core 层几何体
   */
  setGeometry (val: PGeometry | Geometry) {
    if (val instanceof PGeometry) {
      this.geometry = val;
    } else {
      this.geometry = new PGeometry(val);
    }
  }

  /**
   * 设置材质
   * @param val 3D 材质或材质参数
   */
  setMaterial (val: PMaterial | ModelMaterialOptions) {
    if (val instanceof PMaterialUnlit) {
      this.material = val;
    } else if (val instanceof PMaterialPBR) {
      this.material = val;
    } else {
      this.material = createPluginMaterial(val);
    }
  }

  /**
   * 获取 Core 层材质
   * @returns
   */
  getModelMaterial (): Material {
    return this.effectsMesh.material;
  }

  getShadowModelMaterial (): Material | undefined {
    return this.shadowMesh?.material;
  }

  isEnableShadow (): boolean {
    return this.shadowType !== PShadowType.none && this.material.materialType !== PMaterialType.unlit;
  }

  /**
   * 是否无光照材质
   * @returns
   */
  isUnlitMaterial (): boolean {
    return this.material.materialType === PMaterialType.unlit;
  }

  /**
   * 是否有 Morph 动画：
   * 需要注意 Morph 对象存在，但还是没有 Morph 动画的情况
   *
   * @returns 返回是否有 Morph 动画
   */
  hasMorph (): boolean {
    if (this.morph === undefined) {
      return false;
    }

    return this.morph.hasMorph();
  }

  /**
   * 获取世界坐标下的包围盒
   * @returns
   */
  getWorldBoundingBox (): Box3 {
    if (this.parent === undefined) {
      if (this.boundingBox.isEmpty()) {
        this.computeBoundingBox(Matrix4.fromIdentity());
      }

      return this.boundingBox;
    } else {
      const matrix = this.parent.matrix;

      if (this.boundingBox.isEmpty()) {
        this.computeBoundingBox(matrix.clone().invert());
      }

      return this.boundingBox.clone().applyMatrix4(matrix);
    }
  }
}

/**
 * 3D 几何类
 */
export class PGeometry {
  /**
   * 属性名称数组
   */
  attributeNames: string[];

  /**
   * 创建 3D 几何体，根据 Core 层几何体
   * @param geometry
   */
  constructor (public geometry: Geometry) {
    this.attributeNames = geometry.getAttributeNames();
  }

  /**
   * 销毁
   */
  dispose () {
    // @ts-expect-error
    this.geometry = undefined;
    this.attributeNames = [];
  }

  /**
   * 是否有某个属性
   * @param name 属性名
   * @returns
   */
  hasAttribute (name: string): boolean {
    const index = this.attributeNames.findIndex(item => {
      return item === name;
    });

    return index !== -1;
  }

  /**
   * 设置隐藏，通过修改几何体中的渲染数目
   * @param hide
   */
  setHide (hide: boolean) {
    const geomExt = this.geometry as GeometryExt;

    if (geomExt.getDrawCount() === 0) {
      const indexArray = geomExt.getIndexData();

      if (indexArray !== undefined) {
        geomExt.setDrawCount(indexArray.length);
      }
    }
    if (hide) {
      if (geomExt.getDrawCount() >= 0) {
        geomExt.setDrawCount(-geomExt.getDrawCount());
      }
    } else {
      if (geomExt.getDrawCount() < 0) {
        geomExt.setDrawCount(-geomExt.getDrawCount());
      }
    }
  }

  /**
   * 是否压缩格式
   * @returns
   */
  isCompressed (): boolean {
    const positionAttrib = this.geometry.getAttributeData('a_Position');

    if (positionAttrib === undefined) {
      return false;
    }

    // FIXME: get attributes from geometry
    //return positionAttrib.normalize === true;
    return false;
  }

  /**
   * 是否有位置属性
   * @returns
   */
  hasPositions (): boolean {
    return this.hasAttribute('a_Position');
  }

  /**
   * 是否有法线属性
   * @returns
   */
  hasNormals (): boolean {
    return this.hasAttribute('a_Normal');
  }

  /**
   * 是否有切线属性
   * @returns
   */
  hasTangents (): boolean {
    return this.hasAttribute('a_Tangent');
  }

  /**
   * 是否有纹理坐标属性
   * @param index
   * @returns
   */
  hasUVCoords (index: number): boolean {
    return this.hasAttribute(`a_UV${index}`);
  }

  /**
   * 是否有颜色属性
   * @returns
   */
  hasColors (): boolean {
    return this.hasAttribute('a_Color');
  }

  /**
   * 是否有关节点属性
   * @returns
   */
  hasJoints (): boolean {
    return this.hasAttribute('a_Joint1');
  }

  /**
   * 是否有权重属性
   * @returns
   */
  hasWeights (): boolean {
    return this.hasAttribute('a_Weight1');
  }
}

class EffectsMeshProxy {
  options: ModelMeshOptions;
  morphObj: PMorph;

  constructor (
    public item: ModelItemMesh,
    public parentItem?: ModelTreeVFXItem,
  ) {
    this.options = item.content.options;

    // Morph 对象创建，需要为每个 Primitive 中 Geometry 对象创建 Morph
    // 并且要求创建的 Morph 对象状态是相同的，否则就报错
    let isSuccess = true;
    const morphObj = new PMorph();
    const meshOptions = item.content.options;
    const primitives = meshOptions.primitives;

    primitives.forEach((prim, idx) => {
      if (idx === 0) {
        morphObj.create(prim.geometry);
      } else {
        const tempMorph = new PMorph();

        if (!tempMorph.create(prim.geometry)) {
          isSuccess = false;
        } else {
          if (!morphObj.equals(tempMorph)) {
            isSuccess = false;
            console.error(`Morpth target mismatch between primtives: ${JSON.stringify(morphObj)}, ${JSON.stringify(tempMorph)}`);
          }
        }
      }
    });

    if (isSuccess) {
      // 设置初始权重数组
      if (meshOptions.weights !== undefined) {
        morphObj.initWeights(meshOptions.weights);
      }

      this.morphObj = morphObj;
    } else {
      this.morphObj = new PMorph();
    }

  }

  hasMorphTarget (): boolean {
    return this.morphObj.hasMorph();
  }

  /**
   * 返回 Morph 对象
   * 需要先判断是否有 Morph 动画，如果没有就直接返回 undefined
   *
   * @returns 缓存的 Morph 对象，或者 undefined
   */
  getMorphObj (): PMorph | undefined {
    if (!this.hasMorphTarget()) {
      return;
    }

    return this.morphObj;
  }

  getParentId (): string | undefined {
    return this.item.parentId;
  }

  getName (): string {
    return this.item.name;
  }

  isHide (): boolean {
    return this.options.hide === true;
  }

  getParentNode (): ModelTreeNode | undefined {
    const nodeIndex = this.getParentIndex();

    if (this.parentItem !== undefined && nodeIndex >= 0) {
      return this.parentItem.content.getNodeById(nodeIndex);
    }

    return undefined;
  }

  getParentIndex (): number {
    return this.options.parent ?? -1;
  }

  getPrimitives () {
    return this.options.primitives;
  }

  getPrimitiveCount (): number {
    return this.options.primitives.length;
  }

  hasSkin (): boolean {
    return this.options.skin !== undefined;
  }

  getSkinOpts () {
    return this.options.skin;
  }

  getSkinObj (engine: Engine): PSkin | undefined {
    const skin = this.getSkinOpts();

    if (skin !== undefined) {
      const skinObj = new PSkin();

      skinObj.create(skin, engine, this.parentItem);

      return skinObj;
    }

    return undefined;
  }
}

interface GeometryExt extends Geometry {
  newDrawCount?: number,
}
