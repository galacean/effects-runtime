import type { Geometry, Engine, VFXItem, SkinProps } from '@galacean/effects';
import { glContext, Texture, TextureSourceType } from '@galacean/effects';
import { Matrix4 } from './math';
import { PObjectType } from './common';
import { PObject } from './object';
import { Float16ArrayWrapper } from '../utility/plugin-helper';

const forceTextureSkinning = false;

/**
 * 纹理数据模式，包含浮点和半精度浮点
 */
export enum TextureDataMode {
  none = 0,
  float,
  half_float,
}

/**
 * 蒙皮类，支持蒙皮动画
 */
export class PSkin extends PObject {
  /**
   * 场景树父元素
   */
  rootBoneItem?: VFXItem;
  /**
   * 骨骼索引
   */
  skeleton = 0;
  /**
   * 关节索引
   */
  jointItem: VFXItem[] = [];
  /**
   * 逆绑定矩阵
   */
  inverseBindMatrices: Matrix4[] = [];
  /**
   * 动画矩阵
   */
  animationMatrices: Matrix4[] = [];
  /**
   * 纹理数据模式
   */
  textureDataMode = TextureDataMode.none;
  /**
   * 最大骨骼数目
   */
  maxJointCount = 0;

  /**
   * 创建蒙皮对象
   * @param props - 蒙皮相关数据
   * @param engine - 引擎对象
   * @param rootBoneItem - 场景树父元素
   */
  create (props: SkinProps, engine: Engine, rootBoneItem: VFXItem, maxJointCount: number) {
    this.name = props.rootBoneName ?? 'Unnamed skin';
    this.type = PObjectType.skin;
    //
    this.rootBoneItem = rootBoneItem;
    this.skeleton = -1;
    this.jointItem = this.getJointItems(props, rootBoneItem);
    this.maxJointCount = Math.max(maxJointCount, this.jointItem.length);
    this.animationMatrices = [];
    //
    this.inverseBindMatrices = [];
    //
    this.textureDataMode = this.getTextureDataMode(this.maxJointCount, engine);
    const matList = props.inverseBindMatrices;

    if (matList !== undefined && matList.length > 0) {
      if (matList.length % 16 !== 0 || matList.length !== this.jointItem.length * 16) {
        throw new Error(`Invalid array length, invert bind matrices ${matList.length}, joint array ${this.jointItem.length}.`);
      }

      const matrixCount = matList.length / 16;

      for (let i = 0; i < matrixCount; i++) {
        const mat = Matrix4.fromArray(matList, i * 16);

        this.inverseBindMatrices.push(mat);
      }
    }
  }

  /**
   * 更新蒙皮矩阵
   */
  updateSkinMatrices () {
    this.animationMatrices = [];

    for (let i = 0; i < this.jointItem.length; i++) {
      const node = this.jointItem[i];

      // let parent = node?.transform.parentTransform;
      // while(parent !== undefined){
      //   const pos = parent.position;
      //   parent.setPosition(pos[0], pos[1], pos[2]);
      //   parent = parent.parentTransform;
      // }

      const mat4 = node.transform.getWorldMatrix();

      this.animationMatrices.push(mat4.clone());
    }

    if (this.animationMatrices.length === this.inverseBindMatrices.length) {
      this.animationMatrices.forEach((mat, index) => {
        mat.multiply(this.inverseBindMatrices[index]);
      });
    } else {
      this.animationMatrices = this.inverseBindMatrices;
      console.error('Some error occured, replace skin animation matrices by invert bind matrices.');
    }
  }

  /**
   * 计算 Mesh 的动画矩阵
   * @param worldMatrix - 世界矩阵
   * @param matrixList - 矩阵列表
   * @param normalMatList - 法线矩阵列表
   */
  computeMeshAnimMatrices (worldMatrix: Matrix4, matrixList: Float32Array, normalMatList: Float32Array) {
    const inverseWorldMatrix = worldMatrix.clone().invert();
    const tempMatrix = new Matrix4();

    this.animationMatrices.forEach((mat, i) => {
      const localMatrix = tempMatrix.multiplyMatrices(inverseWorldMatrix, mat);

      localMatrix.elements.forEach((x, j) => matrixList[i * 16 + j] = x);
      //
      const normalMat = localMatrix.clone().invert().transpose();

      normalMat.elements.forEach((x, j) => normalMatList[i * 16 + j] = x);
    });
  }

  /**
   * 更新父元素
   * @param parentItem - 场景树父元素
   */
  updateParentItem (parentItem: VFXItem) {
    this.rootBoneItem = parentItem;
  }

  /**
   * 获取关节点数
   * @returns
   */
  getJointCount (): number {
    return this.jointItem.length;
  }

  /**
   * 是否纹理数据模式
   * @returns
   */
  isTextureDataMode (): boolean {
    return this.textureDataMode !== TextureDataMode.none;
  }

  /**
   * 销毁
   */
  override dispose (): void {
    this.rootBoneItem = undefined;
    this.jointItem = [];
    this.inverseBindMatrices = [];
    this.animationMatrices = [];
  }

  private getTextureDataMode (jointCount: number, engine: Engine): TextureDataMode {
    const uniformsRequiredForMostFeatures = 25;
    const detail = engine.gpuCapability.detail;
    const availableJointUniforms = detail.maxVertexUniforms - uniformsRequiredForMostFeatures;
    const uniformsRequiredPerJoint = 8;

    if (forceTextureSkinning || jointCount > Math.floor(availableJointUniforms / uniformsRequiredPerJoint)) {
      // 优先使用float，half_float在iOS 13.6上有精度问题
      if (detail.floatTexture) {
        return TextureDataMode.float;
      } else if (detail.halfFloatTexture) {
        return TextureDataMode.half_float;
      } else {
        throw new Error(`Too many joint count ${jointCount}, half float texture not support.`);
      }
    } else {
      return TextureDataMode.none;
    }
  }

  private getJointItems (props: SkinProps, rootBoneItem: VFXItem) {
    const name2Item = this.genNodeName(rootBoneItem);

    const jointItems: VFXItem[] = [];

    props.boneNames?.forEach(boneName => {
      const node = name2Item[boneName];

      if (!node) {
        throw new Error(`Can't find node of bone name ${boneName}.`);
      }
      jointItems.push(node);
    });

    return jointItems;
  }

  private genNodeName (node: VFXItem) {
    const name2Item: Record<string, VFXItem> = {};
    const nameList: string[] = [];

    name2Item[''] = node;
    for (const child of node.children) {
      this.genNodeNameDFS(child, nameList, name2Item);
    }

    return name2Item;
  }

  private genNodeNameDFS (node: VFXItem, nameList: string[], name2Item: Record<string, VFXItem>) {
    nameList.push(node.name);
    name2Item[nameList.join('/')] = node;
    for (const child of node.children) {
      this.genNodeNameDFS(child, nameList, name2Item);
    }
    nameList.pop();
  }
}

/**
 * Morph 动画类
 * 保存了动画状态相关的数据，包括 weights 数组数据
 * 增加了状态数据的检查，保证数据的正确性
 * Morph 动画非常消耗内存，谨慎使用。
 */
export class PMorph extends PObject {
  /**
   * weights 数组的长度，shader 中和更新的时候会用到
   * 范围要在 `[0, 8]` 之间，否则会报错。
   */
  morphWeightsLength = 0;
  /**
   * weights 数组的具体数据，来自动画控制器的每帧更新
   * 数组的长度必须和 morphWeightsLength 相同，否则会出错。
   */
  morphWeightsArray: number[] = [];
  /**
   * 是否有 Position 相关的 Morph 动画，shader 中需要知道
   */
  hasPositionMorph = false;
  /**
   * 是否有 Normal 相关的 Morph 动画，shader 中需要知道
   */
  hasNormalMorph = false;
  /**
   * 是否有 Tangent 相关的 Morph 动画，shader 中需要知道
   */
  hasTangentMorph = false;

  /**
   * 通过 Geometry 数据创建 Morph 动画相关状态，并进行必要的正确性检查
   * @param geometry - Mesh 的几何体，是否包含 Morph 动画都是可以的
   * @returns 是否创建成功
   */
  create (geometry: Geometry): boolean {
    this.name = this.genName('Morph target');
    this.type = PObjectType.morph;

    // 统计各个属性的在Morph中的数目
    const positionCount = this.getAttributeMorphCount(PMorph.positionNameList, geometry);
    const normalCount = this.getAttributeMorphCount(PMorph.normalNameList, geometry);
    const tangentCount = this.getAttributeMorphCount(PMorph.tangentNameList, geometry);
    const countList: number[] = [positionCount, normalCount, tangentCount];

    // 这里是拿到所有数目中非零的最小值，如果没有非零值，那就是直接是零
    this.morphWeightsLength = 0;
    countList.forEach(count => {
      if (count > 0) {
        if (this.morphWeightsLength === 0) {
          this.morphWeightsLength = count;
        } else {
          this.morphWeightsLength = Math.min(this.morphWeightsLength, count);
        }
      }
    });

    if (this.morphWeightsLength > 0) {
      // 有Morph动画，申请weights数据，判断各个属性是否有相关动画
      this.morphWeightsArray = Array(this.morphWeightsLength).fill(0);
      this.hasPositionMorph = positionCount == this.morphWeightsLength;
      this.hasNormalMorph = normalCount == this.morphWeightsLength;
      this.hasTangentMorph = tangentCount == this.morphWeightsLength;
    }

    /**
     * 这里是做正确性检查，特别是各个属性之间数目需要对上，否则就报错。
     * 还要注意最大数目不能超过5，否则也直接报错。
     * 后续考虑是否做个兼容，目前还是严格报错比较好。
     */

    if (positionCount > 0 && positionCount != this.morphWeightsLength) {
      console.error(`Position morph count mismatch: ${this.morphWeightsLength}, ${positionCount}.`);

      return false;
    }

    if (normalCount > 0 && normalCount != this.morphWeightsLength) {
      console.error(`Normal morph count mismatch: ${this.morphWeightsLength}, ${normalCount}.`);

      return false;
    }

    if (tangentCount > 0 && tangentCount != this.morphWeightsLength) {
      console.error(`Tangent morph count mismatch: ${this.morphWeightsLength}, ${tangentCount}.`);

      return false;
    }

    if (this.morphWeightsLength > 5) {
      console.error(`Tangent morph count should not greater than 5, current ${this.morphWeightsLength}.`);

      return false;
    }

    return true;
  }

  /**
   * 初始化 Morph target 的权重数组
   * @param weights - glTF Mesh 的权重数组，长度必须严格一致
   */
  initWeights (weights: number[]) {
    if (this.morphWeightsArray.length === 0) {
      return;
    }

    const morphWeights = this.morphWeightsArray;

    weights.forEach((val, index) => {
      if (index < morphWeights.length) {
        morphWeights[index] = val;
      }
    });
  }

  updateWeights (weights: number[]) {
    if (weights.length != this.morphWeightsArray.length) {
      console.error(`Length of morph weights mismatch: input ${weights.length}, internel ${this.morphWeightsArray.length}.`);

      return;
    }

    weights.forEach((value, index) => this.morphWeightsArray[index] = value);
  }

  /**
   * 当前状态是否有 Morph 动画：
   * 需要判断 weights 数组长度，以及 Position、Normal 和 Tangent 是否有动画
   * @returns 返回是否有 Morph 动画
   */
  hasMorph (): boolean {
    return this.morphWeightsLength > 0 && (this.hasPositionMorph || this.hasNormalMorph || this.hasTangentMorph);
  }

  /**
   * 两个 Morph 动画状态是否相等：
   * 这里只比较初始状态是否一样，不考虑 weights 数组的情况，提供给 Mesh 进行 Geometry 检查使用
   * @param morph - Morph 动画状态对象
   * @returns 返回两个 Morph 动画状态是否相等
   */
  equals (morph: PMorph): boolean {
    return this.morphWeightsLength === morph.morphWeightsLength
      && this.hasPositionMorph === morph.hasPositionMorph
      && this.hasNormalMorph === morph.hasNormalMorph
      && this.hasTangentMorph === morph.hasTangentMorph;
  }

  getMorphWeightsArray (): number[] {
    return this.morphWeightsArray;
  }

  /**
   * 统计 Geometry 中 Attribute 名称个数：
   * 主要用于统计 Morph 动画中新增的 Attribute 名称的个数，会作为最终的 weights 数组长度使用
   * @param attributeNameList - Attribute 名数组列表，只与 Morph Target 中的属性有关
   * @param geometry - Geometry 对象，是否有 Morph 动画都可以
   * @returns 存在的 Attribute 名称数目
   */
  getAttributeMorphCount (attributeNameList: string[], geometry: Geometry): number {
    for (let i = 0; i < attributeNameList.length; i++) {
      const val = attributeNameList[i];

      if (geometry.getAttributeData(val) === undefined) {
        return i;
      }
    }

    // 所有名称都找到了，所以要返回数组的长度
    return attributeNameList.length;
  }

  /**
   * Morph 动画中 Position 相关的 Attribute 名称
   */
  private static positionNameList = [
    'aTargetPosition0',
    'aTargetPosition1',
    'aTargetPosition2',
    'aTargetPosition3',
    'aTargetPosition4',
    'aTargetPosition5',
    'aTargetPosition6',
    'aTargetPosition7',
  ];

  /**
   * Morph 动画中 Normal 相关的 Attribute 名称
   */
  private static normalNameList = [
    'aTargetNormal0',
    'aTargetNormal1',
    'aTargetNormal2',
    'aTargetNormal3',
    'aTargetNormal4',
    'aTargetNormal5',
    'aTargetNormal6',
    'aTargetNormal7',
  ];

  /**
   * Morph 动画中 Tangent 相关的 Attribute 名称
   */
  private static tangentNameList = [
    'aTargetTangent0',
    'aTargetTangent1',
    'aTargetTangent2',
    'aTargetTangent3',
    'aTargetTangent4',
    'aTargetTangent5',
    'aTargetTangent6',
    'aTargetTangent7',
  ];
}

/**
 * 动画插值类型
 */
export enum PAnimInterpType {
  linear = 0,
  step,
  cubicSpline,
}

/**
 * 动画路径类型
 */
export enum PAnimPathType {
  translation = 0,
  rotation,
  scale,
  weights,
}

/**
 * 动画纹理类
 */
export class PAnimTexture {
  private isHalfFloat = true;
  //
  private width = 0;
  private height = 0;
  private buffer?: Float16ArrayWrapper;
  private texture?: Texture;

  constructor (private engine: Engine) {}

  /**
   * 创建动画纹理对象
   * @param jointCount - 骨骼数目
   * @param isHalfFloat - 是否半浮点精度
   * @param name - 名称
   */
  create (jointCount: number, isHalfFloat: boolean, name: string) {
    this.width = 4;
    this.height = jointCount;
    this.isHalfFloat = isHalfFloat;

    if (this.isHalfFloat) {
      this.buffer = new Float16ArrayWrapper(this.getSize() * 4);
    }

    const data = this.buffer?.data ?? new Float32Array(this.getSize() * 4);
    const type = this.isHalfFloat ? glContext.HALF_FLOAT : glContext.FLOAT;

    this.texture = Texture.create(
      this.engine,
      {
        name,
        data: {
          width: this.width,
          height: this.height,
          data,
        },
        target: glContext.TEXTURE_2D,
        format: glContext.RGBA,
        type,
        wrapS: glContext.CLAMP_TO_EDGE,
        wrapT: glContext.CLAMP_TO_EDGE,
        minFilter: glContext.NEAREST,
        magFilter: glContext.NEAREST,
      });
  }

  /**
   * 更新动画数据
   * @param buffer - 新的动画数据
   */
  update (buffer: Float32Array) {
    if (this.buffer !== undefined) {
      this.buffer.set(buffer, 0);
    }

    if (this.texture !== undefined) {
      this.texture.updateSource({
        sourceType: TextureSourceType.data,
        data: {
          width: this.width,
          height: this.height,
          data: this.buffer?.data ?? buffer,
        },
        target: glContext.TEXTURE_2D,
      });
    }

  }

  /**
   * 销毁
   */
  dispose () {
    // @ts-expect-error
    this.engine = null;
    this.buffer = undefined;
    this.texture?.dispose();
  }

  /**
   * 获取纹理大小
   * @returns
   */
  getSize () {
    return this.width * this.height;
  }

  /**
   * 获取纹理对象
   * @returns
   */
  getTexture () {
    return this.texture as Texture;
  }

}
