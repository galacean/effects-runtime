import type { Texture, Engine, math, VFXItem, Renderer, Geometry } from '@galacean/effects';
import { spec, Material, GLSLVersion } from '@galacean/effects';
import type { ModelMeshComponentData, ModelItemBounding } from '../index';
import { PObjectType, PMaterialType, PGlobalState } from './common';
import { PEntity } from './object';
import type { PMaterial } from './material';
import { PMaterialPBR, PMaterialUnlit, createPluginMaterial } from './material';
import { Matrix4, Vector3, Box3, Vector2 } from './math';
import { PSkin, PAnimTexture, PMorph, TextureDataMode } from './animation';
import type { PSceneManager, PSceneStates } from './scene';
import type { PSkybox } from './skybox';
import { GeometryBoxProxy, HitTestingProxy } from '../utility/plugin-helper';
import { BoxMesh } from '../utility/ri-helper';
import { RayBoxTesting } from '../utility/hit-test-helper';
import type { ModelTreeNode } from '../plugin';
import { ModelTreeComponent } from '../plugin';
import type { ModelMeshComponent } from '../plugin/model-item';

type Box3 = math.Box3;

/**
 * Mesh 类，负责 Mesh 相关的骨骼动画和 PBR 渲染
 */
export class PMesh extends PEntity {
  /**
   * 所属的 Mesh 组件
   */
  owner?: ModelMeshComponent;
  /**
   * 父节点索引
   */
  parentIndex = -1;
  /**
   * 父元素
   */
  parentItem?: VFXItem;
  /**
   * 父元素索引
   */
  parentItemId?: string;
  rootBoneItem?: VFXItem;
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
  subMeshes: PSubMesh[] = [];
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
   * 构造函数，创建 Mesh 对象，并与所属组件和父元素相关联
   * @param engine - 引擎
   * @param name - 名称
   * @param meshData - Mesh 参数
   * @param owner - 所属的 Mesh 组件
   * @param parentId - 父元素索引
   * @param parent - 父元素
   */
  constructor (
    private engine: Engine,
    name: string,
    meshData: ModelMeshComponentData,
    owner?: ModelMeshComponent,
    parentId?: string,
    parent?: VFXItem,
  ) {
    super();
    const proxy = new EffectsMeshProxy(meshData, parent);

    this.name = name;
    this.type = PObjectType.mesh;
    this.visible = false;
    this.owner = owner;
    //
    this.parentIndex = proxy.getParentIndex();
    this.parentItem = proxy.parentItem;
    this.parentItemId = parentId;
    this.rootBoneItem = meshData.rootBone as unknown as VFXItem;
    this.skin = proxy.getSkinObj(engine);
    this.morph = proxy.getMorphObj();
    this.hide = proxy.isHide();
    this.priority = owner?.item?.renderOrder || 0;
    //
    this.subMeshes = [];
    const geometry = proxy.getGeometry() as unknown as Geometry;
    const materials = owner?.materials ?? [];

    materials.forEach(material => {
      const subMesh = new PSubMesh(this.engine);

      subMesh.create(geometry, material, this);
      this.subMeshes.push(subMesh);
    });

    if (this.subMeshes.length <= 0) {
      console.warn(`No primitive inside mesh item ${name}.`);
    }

    this.boundingBox = this.getItemBoundingBox(meshData.interaction);
  }

  /**
   * 创建 GE 的 Mesh、Geometry 和 Material 对象
   * @param scene - 场景管理器
   * @returns
   */
  build (scene: PSceneManager) {
    if (this.isBuilt) {
      return;
    }

    this.isBuilt = true;
    this.subMeshes.forEach(prim => {
      prim.build(scene.maxLightCount, scene.skybox);
    });

    if (PGlobalState.getInstance().visBoundingBox) {
      this.boundingBoxMesh = new BoxMesh(this.engine, this.priority);
    }
  }

  /**
   * 更新变换数据和蒙皮数据
   */
  override update () {
    if (this.owner !== undefined) {
      this.transform.fromEffectsTransform(this.owner.transform);

      if (this.morph && this.morph.hasMorph() && this.owner.morphWeights.length > 0) {
        this.morph.updateWeights(this.owner.morphWeights);
      }
    }
  }

  /**
   * 渲染 Mesh 对象，需要将内部相关数据传给渲染器
   * @param scene - 场景
   * @param renderer - 渲染器
   */
  override render (scene: PSceneManager, renderer: Renderer) {
    this.skin?.updateSkinMatrices();
    this.updateMaterial(scene);

    this.subMeshes.forEach((subMesh, index) => {
      renderer.drawGeometry(
        subMesh.getEffectsGeometry(),
        subMesh.getEffectsMaterial(),
        index
      );
    });

    if (this.visBoundingBox && this.boundingBoxMesh !== undefined) {
      const mesh = this.boundingBoxMesh.mesh;

      renderer.drawGeometry(mesh.geometry, mesh.material);
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

    super.dispose();

    this.owner = undefined;
    this.isDisposed = true;
    // @ts-expect-error
    this.engine = null;
    this.parentItem = undefined;
    this.skin?.dispose();
    this.skin = undefined;
    this.morph?.dispose();
    this.morph = undefined;
    this.subMeshes.forEach(prim => {
      prim.dispose();
    });
    this.subMeshes = [];
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
      throw new Error('Weight array length mismatch.');
    }

    for (let i = 0; i < updatedArray.length; i++) {
      updatedArray[i] = weightsArray[i];
    }
  }

  /**
   * 更新父 VFX 元素
   * @param parentId - 父元素索引
   * @param parentItem - 父 VFX 元素
   */
  updateParentInfo (parentId: string, parentItem: VFXItem) {
    this.parentItemId = parentId;
    this.parentItem = parentItem;
    if (this.skin !== undefined) {
      this.skin.updateParentItem(parentItem);
    }
  }

  /**
   * 根据当前场景状态更新内部材质数据
   * @param scene - 场景管理器
   */
  updateMaterial (scene: PSceneManager) {
    const worldMatrix = this.matrix;
    const normalMatrix = worldMatrix.clone().invert().transpose();
    const sceneStates = scene.sceneStates;

    this.subMeshes.forEach(prim => {
      prim.updateMaterial(worldMatrix, normalMatrix, sceneStates);
    });

    if (this.boundingBoxMesh !== undefined) {
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

  /**
   * 点击测试，对于编辑器模式会进行精准的点击测试，否则就和内部的包围盒进行测试
   * @param rayOrigin - 射线原点
   * @param rayDirection - 射线方向
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
      this.subMeshes.forEach(prim => {
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
   * @param worldMatrix - 世界矩阵
   * @returns
   */
  computeBoundingBox (worldMatrix: Matrix4): Box3 {
    const box = this.boundingBox.makeEmpty();
    const inverseWorldMatrix = worldMatrix.clone().invert();

    this.subMeshes.forEach(prim => {
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

}

/**
 * PSubMesh 类，负责 Sub Mesh相关的功能，支持骨骼动画和 PBR 渲染
 */
export class PSubMesh {
  /**
   * 宿主 Mesh，包含了当前 Primitive
   */
  private parent?: PMesh;
  private skin?: PSkin; // from owner mesh
  /**
   * Morph 动画状态数据，来自 Mesh 对象，这里不创建不删除
   */
  private morph?: PMorph;
  private geometry: PGeometry;
  private material: PMaterial;
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

  constructor (private engine: Engine) {

  }

  /**
   * 创建 Primitive 对象
   * @param data - Primitive 参数
   * @param parent - 所属 Mesh 对象
   */
  create (geometry: Geometry, material: Material, parent: PMesh) {
    this.parent = parent;
    this.skin = parent.skin;
    this.morph = parent.morph;
    this.setGeometry(geometry);
    this.setMaterial(material);
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

    //if (PGlobalState.getInstance().isTiny3dMode) {
    //  if (this._material.isAdditive || this._material.isTranslucent()) { this.mriPriority += 10000; }
    //}
  }

  /**
   * 创建 GE Mesh、Geometry 和 Material 对象，用于后面的渲染
   * @param lightCount - 灯光数目
   * @param skybox - 天空盒
   */
  build (lightCount: number, skybox?: PSkybox) {
    const globalState = PGlobalState.getInstance();
    const primitiveMacroList = this.getMacroList(lightCount, true, skybox);
    const materialMacroList = this.material.getMacroList(primitiveMacroList);

    let material: Material;
    const isWebGL2 = PGlobalState.getInstance().isWebGL2;

    if (this.material.effectMaterial) {
      material = this.material.effectMaterial;

      materialMacroList.forEach(macro => {
        const { name, value } = macro;

        material.enableMacro(name, value);
      });

      this.material.setMaterialStates(material);
    } else {
      material = Material.create(
        this.engine,
        {
          shader: {
            vertex: this.material.vertexShaderCode,
            fragment: this.material.fragmentShaderCode,
            shared: globalState.shaderShared,
            glslVersion: isWebGL2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
          },
        }
      );
      this.material.setMaterialStates(material);
    }
  }

  // TODO: 待移除？
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

    if (this.material.materialType !== PMaterialType.unlit) {
      // let hasLight = false;

      if (lightCount > 0 && this.geometry.hasNormals()) {
        // hasLight = true;
        featureList.push('USE_PUNCTUAL 1');
        featureList.push(`LIGHT_COUNT ${lightCount}`);
      }

      if (skybox !== undefined && skybox.available) {
        // hasLight = true;
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

  private getMacroList (lightCount: number, pbrPass: boolean, skybox?: PSkybox): MacroInfo[] {
    const macroList: MacroInfo[] = [];

    if (this.geometry.hasNormals()) {
      macroList.push({ name: 'HAS_NORMALS' });
    }
    if (this.geometry.hasTangents()) {
      macroList.push({ name: 'HAS_TANGENTS' });
    }
    if (this.geometry.hasUVCoords(1)) {
      macroList.push({ name: 'HAS_UV_SET1' });
    }
    if (this.geometry.hasUVCoords(2)) {
      macroList.push({ name: 'HAS_UV_SET2' });
    }

    if (this.morph !== undefined && this.morph.hasMorph()) {
      // 存在 Morph 动画，需要配置 Morph 动画相关的 Shader 宏定义
      // USE_MORPHING 是总开关，WEIGHT_COUNT 是 weights 数组长度（Shader）
      macroList.push({ name: 'USE_MORPHING' });
      macroList.push({ name: 'WEIGHT_COUNT', value: this.morph.morphWeightsLength });
      for (let i = 0; i < this.morph.morphWeightsLength; i++) {
        if (this.morph.hasPositionMorph) {
          macroList.push({ name: `HAS_TARGET_POSITION${i}` });
        }
        if (this.morph.hasNormalMorph) {
          macroList.push({ name: `HAS_TARGET_NORMAL${i}` });
        }
        if (this.morph.hasTangentMorph) {
          macroList.push({ name: `HAS_TARGET_TANGENT${i}` });
        }
      }
    }

    if (this.skin !== undefined) {
      macroList.push({ name: 'USE_SKINNING' });
      macroList.push({ name: 'JOINT_COUNT', value: this.skin.getJointCount() });
      macroList.push({ name: 'HAS_JOINT_SET1' });
      macroList.push({ name: 'HAS_WEIGHT_SET1' });
      if (this.skin.textureDataMode) {
        macroList.push({ name: 'USE_SKINNING_TEXTURE' });
      }
    }

    if (this.material.materialType !== PMaterialType.unlit) {
      if (lightCount > 0 && this.geometry.hasNormals()) {
        macroList.push({ name: 'USE_PUNCTUAL' });
        macroList.push({ name: 'LIGHT_COUNT', value: lightCount });
      }

      if (skybox !== undefined && skybox.available) {
        macroList.push({ name: 'USE_IBL' });
        macroList.push({ name: 'USE_TEX_LOD' });
        if (skybox.hasDiffuseImage) {
          // do nothing
        } else {
          macroList.push({ name: 'IRRADIANCE_COEFFICIENTS' });
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
      macroList.push({ name: 'DEBUG_OUTPUT' });
      macroList.push({ name: outputDefine });
    }

    return macroList;
  }

  /**
   * 销毁，需要释放创建的 GE 对象
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
  }

  /**
   * 更新内部 GE 材质着色器 Uniform 数据，根据场景状态
   * @param worldMatrix - 世界矩阵
   * @param nomralMatrix - 法线矩阵
   * @param sceneStates - 场景状态
   */
  updateMaterial (worldMatrix: Matrix4, nomralMatrix: Matrix4, sceneStates: PSceneStates) {
    this.updateUniformsByAnimation(worldMatrix, nomralMatrix);
    this.updateUniformsByScene(sceneStates);
    this.material.updateUniforms(this.getEffectsMaterial());
  }

  /**
   * 点击测试，先进行简单的包围合测试，然后再计算精准的点击测试，这个测试非常耗时不要在移动端上使用
   * @param newOrigin - 射线原点
   * @param newDirection - 射线方向
   * @param worldMatrix - 世界矩阵
   * @param invWorldMatrix - 逆世界矩阵
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
    const doubleSided = this.material.isBothSide();

    proxy.create(this.geometry.geometry, doubleSided, bindMatrices);

    return proxy.getHitPoint(newOrigin, newDirection);
  }

  /**
   * 计算包围盒
   * @param inverseWorldMatrix - 逆世界矩阵
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
   * 渲染输出模式转成着色器中的宏定义
   * @param mode - 渲染输出模式
   * @returns 返回相应的宏定义
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
    const material = this.getEffectsMaterial();

    material.setMatrix('effects_ObjectToWorld', worldMatrix);
    material.setMatrix('_NormalMatrix', normalMatrix);
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
        material.setTexture('_jointMatrixSampler', jointMatrixTexture.getTexture());
        material.setTexture('_jointNormalMatrixSampler', jointNormalMatTexture.getTexture());
      } else {
        const jointMatrixNumbers: number[] = [];
        const jointNormalMatNumbers: number[] = [];

        jointMatrixList.forEach(val => jointMatrixNumbers.push(val));
        jointNormalMatList.forEach(val => jointNormalMatNumbers.push(val));
        material.setMatrixNumberArray('_jointMatrix', jointMatrixNumbers);
        material.setMatrixNumberArray('_jointNormalMatrix', jointNormalMatNumbers);
      }
    }

    // Morph 相关的数据更新，仅需要更新 weights 数组
    const morph = this.morph;

    if (morph !== undefined && morph.hasMorph()) {
      const morphWeights = morph.morphWeightsArray.slice();

      material.setFloats('_morphWeights', morphWeights);
    }
  }

  private updateUniformsByScene (sceneStates: PSceneStates) {
    const material = this.getEffectsMaterial();

    material.setMatrix('effects_MatrixVP', sceneStates.viewProjectionMatrix);
    material.setVector3('_Camera', sceneStates.cameraPosition);
    //
    if (!this.isUnlitMaterial()) {
      const { maxLightCount, lightList } = sceneStates;

      for (let i = 0; i < maxLightCount; i++) {
        if (i < lightList.length) {
          const light = lightList[i];
          const intensity = light.visible ? light.intensity : 0;

          material.setVector3(`_Lights[${i}].direction`, light.getWorldDirection());
          material.setFloat(`_Lights[${i}].range`, light.range);
          material.setVector3(`_Lights[${i}].color`, light.color);
          material.setFloat(`_Lights[${i}].intensity`, intensity);
          material.setVector3(`_Lights[${i}].position`, light.getWorldPosition());
          material.setFloat(`_Lights[${i}].innerConeCos`, Math.cos(light.innerConeAngle));
          material.setFloat(`_Lights[${i}].outerConeCos`, Math.cos(light.outerConeAngle));
          material.setInt(`_Lights[${i}].type`, light.lightType);
          material.setVector2(`_Lights[${i}].padding`, light.padding);
        } else {
          material.setVector3(`_Lights[${i}].direction`, Vector3.ZERO);
          material.setFloat(`_Lights[${i}].range`, 0);
          material.setVector3(`_Lights[${i}].color`, Vector3.ZERO);
          material.setFloat(`_Lights[${i}].intensity`, 0);
          material.setVector3(`_Lights[${i}].position`, Vector3.ZERO);
          material.setFloat(`_Lights[${i}].innerConeCos`, 0);
          material.setFloat(`_Lights[${i}].outerConeCos`, 0);
          material.setInt(`_Lights[${i}].type`, 99999);
          material.setVector2(`_Lights[${i}].padding`, Vector2.ZERO);
        }
      }

      const skybox = sceneStates.skybox;

      if (skybox !== undefined && skybox.available) {
        material.setVector2('_IblIntensity', new Vector2(skybox.currentIntensity, skybox.currentReflectionsIntensity));
        material.setTexture('_brdfLUT', skybox.brdfLUT as Texture);
        if (skybox.diffuseImage !== undefined) {
          material.setTexture('_DiffuseEnvSampler', skybox.diffuseImage);
        } else {
          const coeffs = skybox.irradianceCoeffs as number[][];
          const aliasName = ['l00', 'l1m1', 'l10', 'l11', 'l2m2', 'l2m1', 'l20', 'l21', 'l22'];

          aliasName.forEach((n, i) => {
            material.setVector3(`_shCoefficients.${n}`, Vector3.fromArray(coeffs[i] as spec.vec3));
          });
        }
        material.setInt('_MipCount', skybox.specularMipCount - 1);
        material.setTexture('_SpecularEnvSampler', skybox.specularImage);
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
   * 获取 GE 几何体
   * @returns
   */
  getEffectsGeometry (): Geometry {
    return this.geometry.geometry;
  }

  /**
   * 设置几何体
   * @param val - 插件或 GE 几何体
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
   * @param val - 插件材质对象或材质参数
   */
  setMaterial (val: PMaterial | Material) {
    if (val instanceof PMaterialUnlit) {
      this.material = val;
    } else if (val instanceof PMaterialPBR) {
      this.material = val;
    } else {
      this.material = createPluginMaterial(val);
    }
  }

  /**
   * 获取 GE 材质
   * @returns
   */
  getEffectsMaterial (): Material {
    return this.material.effectMaterial;
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
   * 创建 3D 几何体，根据 GE 几何体
   * @param geometry - GE 几何体
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
   * @param name - 属性名
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
   * @param hide - 隐藏值
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
    const positionAttrib = this.geometry.getAttributeData('aPos');

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
    return this.hasAttribute('aPos');
  }

  /**
   * 是否有法线属性
   * @returns
   */
  hasNormals (): boolean {
    return this.hasAttribute('aNormal');
  }

  /**
   * 是否有切线属性
   * @returns
   */
  hasTangents (): boolean {
    return this.hasAttribute('aTangent');
  }

  /**
   * 是否有纹理坐标属性
   * @param index - 纹理坐标索引
   * @returns
   */
  hasUVCoords (index: number): boolean {
    if (index === 1) {
      return this.hasAttribute('aUV');
    } else {
      return this.hasAttribute(`aUV${index}`);
    }
  }

  /**
   * 是否有颜色属性
   * @returns
   */
  hasColors (): boolean {
    return this.hasAttribute('aColor');
  }

  /**
   * 是否有关节点属性
   * @returns
   */
  hasJoints (): boolean {
    return this.hasAttribute('aJoints');
  }

  /**
   * 是否有权重属性
   * @returns
   */
  hasWeights (): boolean {
    return this.hasAttribute('aWeights');
  }
}

class EffectsMeshProxy {
  data: ModelMeshComponentData;
  geometry: Geometry;
  rootBoneItem: VFXItem;
  morphObj: PMorph;

  constructor (
    public itemData: ModelMeshComponentData,
    public parentItem?: VFXItem,
  ) {
    this.data = itemData;
    this.geometry = itemData.geometry as unknown as Geometry;
    this.rootBoneItem = itemData.rootBone as unknown as VFXItem;

    const morphObj = new PMorph();

    if (morphObj.create(this.geometry)) {
      // 设置初始权重数组
      if (itemData.morph?.weights) {
        morphObj.initWeights(itemData.morph?.weights);
      }

      this.morphObj = morphObj;
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

  isHide (): boolean {
    return this.data.hide === true;
  }

  getParentNode (): ModelTreeNode | undefined {
    const nodeIndex = this.getParentIndex();
    const parentTree = this.parentItem?.getComponent(ModelTreeComponent);

    if (parentTree !== undefined && nodeIndex >= 0) {
      return parentTree.content.getNodeById(nodeIndex);
    }

    return undefined;
  }

  getParentIndex (): number {
    return -1;
  }

  getGeometry () {
    return this.data.geometry;
  }

  getMaterials () {
    return this.data.materials;
  }

  getMaterialCount () {
    return this.data.materials.length;
  }

  hasSkin (): boolean {
    const skin = this.geometry.getSkinProps();

    return !!(skin.rootBoneName && skin.boneNames && skin.inverseBindMatrices && this.rootBoneItem);
  }

  getSkinOpts () {
    return this.geometry.getSkinProps();
  }

  getSkinObj (engine: Engine): PSkin | undefined {
    const skin = this.getSkinOpts();

    if (skin.rootBoneName && skin.boneNames && skin.inverseBindMatrices && this.rootBoneItem) {
      const skinObj = new PSkin();

      skinObj.create(skin, engine, this.rootBoneItem);

      return skinObj;
    }

    return undefined;
  }
}

export interface MacroInfo {
  name: string,
  value?: boolean | number,
}

interface GeometryExt extends Geometry {
  newDrawCount?: number,
}
