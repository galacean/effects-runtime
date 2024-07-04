import type { Geometry, Engine, VFXItem, SkinProps } from '@galacean/effects';
import { glContext, Texture, TextureSourceType } from '@galacean/effects';
import type {
  ModelAnimTrackOptions,
  ModelAnimationOptions,
  ModelTreeOptions,
} from '../index';
import { Matrix4 } from './math';
import { PObjectType } from './common';
import { PObject } from './object';
import type { InterpolationSampler } from './anim-sampler';
import { createAnimationSampler } from './anim-sampler';
import { Float16ArrayWrapper } from '../utility/plugin-helper';
import type { PSceneManager } from './scene';
import { ModelTreeComponent } from '../plugin';

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
   * 创建蒙皮对象
   * @param props - 蒙皮相关数据
   * @param engine - 引擎对象
   * @param rootBoneItem - 场景树父元素
   */
  create (props: SkinProps, engine: Engine, rootBoneItem: VFXItem) {
    this.name = props.rootBoneName ?? 'Unnamed skin';
    this.type = PObjectType.skin;
    //
    this.rootBoneItem = rootBoneItem;
    this.skeleton = -1;
    this.jointItem = this.getJointItems(props, rootBoneItem);
    this.animationMatrices = [];
    //
    this.inverseBindMatrices = [];
    //
    this.textureDataMode = this.getTextureDataMode(this.getJointCount(), engine);
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
 * 动画轨道类
 */
export class PAnimTrack {
  /**
   * 节点索引
   */
  node: number;
  /**
   * 时间数组
   */
  timeArray: Float32Array;
  /**
   * 数据数组
   */
  dataArray: Float32Array;
  /**
   * 路径类型
   */
  path = PAnimPathType.translation;
  /**
   * 插值类型
   */
  interp = PAnimInterpType.linear;
  /**
   * 分量
   */
  component: number;
  //
  private sampler?: InterpolationSampler;

  /**
   * 创建动画轨道对象
   * @param options - 动画轨道参数
   */
  constructor (options: ModelAnimTrackOptions) {
    const { node, input, output, path, interpolation } = options;

    this.node = node;
    this.timeArray = input;
    this.dataArray = output;
    //
    if (path === 'translation') {
      this.path = PAnimPathType.translation;
      this.component = 3;
    } else if (path === 'rotation') {
      this.path = PAnimPathType.rotation;
      this.component = 4;
    } else if (path === 'scale') {
      this.path = PAnimPathType.scale;
      this.component = 3;
    } else if (path === 'weights') {
      this.path = PAnimPathType.weights;
      this.component = this.dataArray.length / this.timeArray.length;
      // special checker for weights animation
      if (this.component <= 0) {
        console.error(`Invalid weights component: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}.`);
      } else if (this.timeArray.length * this.component != this.dataArray.length) {
        console.error(`Invalid weights array length: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}.`);
      }
    } else {
      // should never happened
      console.error(`Invalid path status: ${path}.`);
    }

    if (this.timeArray.length * this.component > this.dataArray.length) {
      throw new Error(`Data length mismatch: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}.`);
    }

    if (interpolation === 'LINEAR') {
      this.interp = PAnimInterpType.linear;
    } else if (interpolation === 'STEP') {
      this.interp = PAnimInterpType.step;
    } else {
      this.interp = PAnimInterpType.cubicSpline;
    }

    this.sampler = createAnimationSampler(
      this.getInterpInfo(), this.timeArray, this.dataArray, this.component, this.getPathInfo()
    );
  }

  /**
   * 销毁
   */
  dispose () {
    // @ts-expect-error
    this.timeArray = undefined;
    // @ts-expect-error
    this.dataArray = undefined;
    this.sampler?.dispose();
    this.sampler = undefined;
  }

  /**
   * 更新节点动画数据
   * @param time - 当前播放时间
   * @param treeItem - 节点树元素
   * @param sceneManager - 3D 场景管理器
   */
  tick (time: number, treeItem: VFXItem, sceneManager?: PSceneManager) {
    const treeComponent = treeItem.getComponent(ModelTreeComponent);
    const node = treeComponent?.content?.getNodeById(this.node);

    if (this.sampler !== undefined && node !== undefined) {
      const result = this.sampler.evaluate(time);

      switch (this.path) {
        case PAnimPathType.translation:
          node.transform.setPosition(result[0], result[1], result[2]);

          break;
        case PAnimPathType.rotation:
          node.transform.setQuaternion(result[0], result[1], result[2], result[3]);

          break;
        case PAnimPathType.scale:
          node.transform.setScale(result[0], result[1], result[2]);

          break;
        case PAnimPathType.weights:
          {
            /**
             * 先生成Mesh的父节点id，然后通过id查询Mesh对象
             * 最后更新Mesh对象权重数据
             */
            const parentId = this.genParentId(treeItem.id, this.node);
            const mesh = sceneManager?.queryMesh(parentId);

            if (mesh !== undefined) {
              mesh.updateMorphWeights(result);
            }

          }

          break;
      }
    } else {
      if (this.sampler !== undefined) {
        console.error('AnimTrack: error', this.sampler, node);
      }
    }
  }

  /**
   * 获取动画结束时间
   * @returns
   */
  getEndTime (): number {
    const index = this.timeArray.length - 1;

    return this.timeArray[index];
  }

  /**
   * 生成 Mesh 元素的父节点
   *
   * @param parentId - 父节点 id 名称
   * @param nodeIndex - Mesh 节点索引
   *
   * @returns 生成的 Mesh 节点名称
   */
  private genParentId (parentId: string, nodeIndex: number): string {
    return `${parentId}^${nodeIndex}`;
  }

  private getPathInfo (): string {
    if (this.path === PAnimPathType.scale) {
      return 'scale';
    } else if (this.path === PAnimPathType.rotation) {
      return 'rotation';
    } else {
      return 'translation';
    }
  }

  private getInterpInfo (): string {
    if (this.interp === PAnimInterpType.cubicSpline) {
      return 'CUBICSPLINE';
    } else if (this.interp === PAnimInterpType.step) {
      return 'STEP';
    } else {
      return 'LINEAR';
    }
  }
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

/**
 * 动画类，负责动画数据创建、更新和销毁
 */
export class PAnimation extends PObject {
  private time = 0;
  private duration = 0;
  private tracks: PAnimTrack[] = [];

  /**
   * 创建动画对象
   * @param options - 动画参数
   */
  create (options: ModelAnimationOptions) {
    this.name = this.genName(options.name ?? 'Unnamed animation');
    this.type = PObjectType.animation;
    //
    this.time = 0;
    this.duration = 0;
    //
    this.tracks = [];
    options.tracks.forEach(inTrack => {
      const track = new PAnimTrack(inTrack);

      this.tracks.push(track);
      this.duration = Math.max(this.duration, track.getEndTime());
    });
  }

  /**
   * 动画更新
   * @param time - 当前时间
   * @param treeItem - 场景树元素
   * @param sceneManager - 3D 场景管理器
   */
  tick (time: number, treeItem: VFXItem, sceneManager?: PSceneManager) {
    this.time = time;
    // TODO: 这里时间事件定义不明确，先兼容原先实现
    const newTime = this.time % this.duration;

    this.tracks.forEach(track => {
      track.tick(newTime, treeItem, sceneManager);
    });
  }

  /**
   * 销毁
   */
  override dispose () {
    this.tracks.forEach(track => {
      track.dispose();
    });
    this.tracks = [];
  }
}

/**
 * 动画管理类，负责管理动画对象
 */
export class PAnimationManager extends PObject {
  private ownerItem: VFXItem;
  private animation = 0;
  private speed = 0;
  private delay = 0;
  private time = 0;
  private animations: PAnimation[] = [];
  private sceneManager?: PSceneManager;

  /**
   * 创建动画管理器
   * @param treeOptions - 场景树参数
   * @param ownerItem - 场景树所属元素
   */
  constructor (treeOptions: ModelTreeOptions, ownerItem: VFXItem) {
    super();
    this.name = this.genName(ownerItem.name ?? 'Unnamed tree');
    this.type = PObjectType.animationManager;
    //
    this.ownerItem = ownerItem;
    this.animation = treeOptions.animation ?? -1;
    this.speed = 1.0;
    this.delay = ownerItem.start ?? 0;
    this.animations = [];
    if (treeOptions.animations !== undefined) {
      treeOptions.animations.forEach(animOpts => {
        const anim = this.createAnimation(animOpts);

        this.animations.push(anim);
      });
    }
  }

  /**
   * 设置场景管理器
   * @param sceneManager - 场景管理器
   */
  setSceneManager (sceneManager: PSceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * 创建动画对象
   * @param animationOpts - 动画参数
   * @returns 动画对象
   */
  createAnimation (animationOpts: ModelAnimationOptions) {
    const animation = new PAnimation();

    animation.create(animationOpts);

    return animation;
  }

  /**
   * 动画更新
   * @param deltaSeconds - 更新间隔
   */
  tick (deltaSeconds: number) {
    const newDeltaSeconds = deltaSeconds * this.speed * 0.001;

    this.time += newDeltaSeconds;
    // TODO: 需要合并到TreeItem中，通过lifetime进行计算
    const itemTime = this.time - this.delay;

    if (itemTime >= 0) {
      if (this.animation >= 0 && this.animation < this.animations.length) {
        const anim = this.animations[this.animation];

        anim.tick(itemTime, this.ownerItem, this.sceneManager);
      } else if (this.animation == -88888888) {
        this.animations.forEach(anim => {
          anim.tick(itemTime, this.ownerItem, this.sceneManager);
        });
      }
    }
  }

  /**
   * 销毁
   */
  override dispose () {
    // @ts-expect-error
    this.ownerItem = null;
    this.animations.forEach(anim => {
      anim.dispose();
    });
    this.animations = [];
    // @ts-expect-error
    this.sceneManager = null;
  }

  /**
   * 获取场景树元素
   * @returns
   */
  getTreeItem () {
    return this.ownerItem;
  }
}
