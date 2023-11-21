import type { Geometry, Engine } from '@galacean/effects';
import { glContext, Texture, TextureSourceType } from '@galacean/effects';
import type {
  ModelSkinOptions,
  ModelAnimTrackOptions,
  ModelAnimationOptions,
  ModelTreeOptions,
} from '../index';
import { Matrix4 } from '../math';
import { PObjectType } from './common';
import { PObject } from './object';
import type { InterpolationSampler } from './anim-sampler';
import { createAnimationSampler } from './anim-sampler';
import { Float16ArrayWrapper } from '../utility/plugin-helper';
import type { PSceneManager } from './scene';
import type { ModelTreeVFXItem } from '../plugin';

const forceTextureSkinning = false;

export enum TextureDataMode {
  none = 0,
  float,
  half_float,
}

export class PSkin extends PObject {
  parentItem?: ModelTreeVFXItem;
  skeleton = 0;
  jointList: number[] = [];
  inverseBindMatrices: Matrix4[] = [];
  animationMatrices: Matrix4[] = [];
  textureDataMode = TextureDataMode.none;

  create (options: ModelSkinOptions, engine: Engine, parentItem?: ModelTreeVFXItem) {
    this.name = this.genName(options.name ?? 'Unnamed skin');
    this.type = PObjectType.skin;
    //
    this.parentItem = parentItem;
    this.skeleton = options.skeleton ?? -1;
    this.jointList = options.joints;
    this.animationMatrices = [];
    //
    this.inverseBindMatrices = [];

    //
    this.textureDataMode = this.getTextureDataMode(this.getJointCount(), engine);
    const matList = options.inverseBindMatrices;

    if (matList !== undefined && matList.length > 0) {
      if (matList.length % 16 !== 0 || matList.length !== this.jointList.length * 16) {
        throw new Error(`Invalid array length, inverse bind matrices ${matList.length}, joint array ${this.jointList.length}`);
      }

      const matrixCount = matList.length / 16;

      for (let i = 0; i < matrixCount; i++) {
        const mat = new Matrix4();

        Matrix4.unpack(matList, i * 16, mat);
        this.inverseBindMatrices.push(mat);
      }
    }
  }

  updateSkinMatrices () {
    this.animationMatrices = [];
    if (this.parentItem !== undefined) {
      const parentTree = this.parentItem.content;

      for (let i = 0; i < this.jointList.length; i++) {
        const joint = this.jointList[i];
        const node = parentTree.getNodeById(joint);

        // let parent = node?.transform.parentTransform;
        // while(parent !== undefined){
        //   const pos = parent.position;
        //   parent.setPosition(pos[0], pos[1], pos[2]);
        //   parent = parent.parentTransform;
        // }
        if (node === undefined) {
          console.error(`Can't find joint ${joint} in node tree ${this.parentItem}.`);

          break;
        }
        const mat4 = node.transform.getWorldMatrix();
        const newMat4 = Matrix4.fromArray(mat4);

        this.animationMatrices.push(newMat4);
      }
    }

    if (this.animationMatrices.length === this.inverseBindMatrices.length) {
      this.animationMatrices.forEach((mat, index) => {
        mat.multiply(this.inverseBindMatrices[index]);
      });
    } else {
      this.animationMatrices = this.inverseBindMatrices;
      console.error('Some error occured, replace skin animation matrices by inverse bind matrices');
    }
  }

  computeMeshAnimMatrices (worldMatrix: Matrix4, matrixList: Float32Array, normalMatList: Float32Array) {
    const inverseWorldMatrix = worldMatrix.clone().inverse();
    const tempMatrix = new Matrix4();

    this.animationMatrices.forEach((mat, i) => {
      const localMatrix = Matrix4.multiply(inverseWorldMatrix, mat, tempMatrix);

      localMatrix.data.forEach((x, j) => matrixList[i * 16 + j] = x);
      //
      const normalMat = localMatrix.clone().inverse().transpose();

      normalMat.data.forEach((x, j) => normalMatList[i * 16 + j] = x);
    });
  }

  updateParentItem (parentItem: ModelTreeVFXItem) {
    this.parentItem = parentItem;
  }

  getJointCount (): number {
    return this.jointList.length;
  }

  isTextureDataMode (): boolean {
    return this.textureDataMode !== TextureDataMode.none;
  }

  override dispose (): void {
    this.parentItem = undefined;
    this.jointList = [];
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
        throw new Error(`Too many joint count ${jointCount}, half float texture not support`);
      }
    } else {
      return TextureDataMode.none;
    }
  }
}

/**
 * Morph 动画状态：
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
  morphWeightsArray?: Float32Array;
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
   *
   * @param geometry - Mesh 的几何对象，是否包含 Morph 动画都是可以的
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
      this.morphWeightsArray = new Float32Array(this.morphWeightsLength);
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
      console.error(`Position morph count mismatch: ${this.morphWeightsLength}, ${positionCount}`);

      return false;
    }

    if (normalCount > 0 && normalCount != this.morphWeightsLength) {
      console.error(`Normal morph count mismatch: ${this.morphWeightsLength}, ${normalCount}`);

      return false;
    }

    if (tangentCount > 0 && tangentCount != this.morphWeightsLength) {
      console.error(`Tangent morph count mismatch: ${this.morphWeightsLength}, ${tangentCount}`);

      return false;
    }

    if (this.morphWeightsLength > 5) {
      console.error(`Tangent morph count should not greater than 5, current ${this.morphWeightsLength}`);

      return false;
    }

    return true;
  }

  override dispose (): void {
    this.morphWeightsArray = undefined;
  }

  /**
   * 初始化 Morph target 的权重数组
   *
   * @param weights - glTF Mesh 的权重数组，长度必须严格一致
   */
  initWeights (weights: number[]) {
    if (this.morphWeightsArray === undefined) {
      return;
    }

    const morphWeights = this.morphWeightsArray;

    weights.forEach((val, index) => {
      if (index < morphWeights.length) {
        morphWeights[index] = val;
      }
    });
  }

  /**
   * 当前状态是否有 Morph 动画：
   * 需要判断 weights 数组长度，以及 Position、Normal 和 Tangent 是否有动画
   *
   * @returns 返回是否有 Morph 动画
   */
  hasMorph (): boolean {
    return this.morphWeightsLength > 0 && (this.hasPositionMorph || this.hasNormalMorph || this.hasTangentMorph);
  }

  /**
   * 两个 Morph 动画状态是否相等：
   * 这里只比较初始状态是否一样，不考虑 weights 数组的情况，提供给 Mesh 进行 Geometry 检查使用
   *
   * @param morph - Morph 动画状态对象
   * @returns 返回两个 Morph 动画状态是否相等
   */
  equals (morph: PMorph): boolean {
    return this.morphWeightsLength === morph.morphWeightsLength
      && this.hasPositionMorph === morph.hasPositionMorph
      && this.hasNormalMorph === morph.hasNormalMorph
      && this.hasTangentMorph === morph.hasTangentMorph;
  }

  getMorphWeightsArray (): Float32Array {
    return this.morphWeightsArray as Float32Array;
  }

  /**
   * 统计 Geometry 中 Attribute 名称个数：
   * 主要用于统计 Morph 动画中新增的 Attribute 名称的个数，会作为最终的 weights 数组长度使用
   *
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
    'a_Target_Position0',
    'a_Target_Position1',
    'a_Target_Position2',
    'a_Target_Position3',
    'a_Target_Position4',
    'a_Target_Position5',
    'a_Target_Position6',
    'a_Target_Position7',
  ];

  /**
   * Morph 动画中 Normal 相关的 Attribute 名称
   */
  private static normalNameList = [
    'a_Target_Normal0',
    'a_Target_Normal1',
    'a_Target_Normal2',
    'a_Target_Normal3',
    'a_Target_Normal4',
    'a_Target_Normal5',
    'a_Target_Normal6',
    'a_Target_Normal7',
  ];

  /**
   * Morph 动画中 Tangent 相关的 Attribute 名称
   */
  private static tangentNameList = [
    'a_Target_Tangent0',
    'a_Target_Tangent1',
    'a_Target_Tangent2',
    'a_Target_Tangent3',
    'a_Target_Tangent4',
    'a_Target_Tangent5',
    'a_Target_Tangent6',
    'a_Target_Tangent7',
  ];
}

export enum PAnimInterpType {
  linear = 0,
  step,
  cubicSpline,
}

export enum PAnimPathType {
  translation = 0,
  rotation,
  scale,
  weights,
}

export class PAnimTrack {
  node: number;
  timeArray: Float32Array;
  dataArray: Float32Array;
  path = PAnimPathType.translation;
  interp = PAnimInterpType.linear;
  component: number;
  //
  private sampler?: InterpolationSampler;

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
        console.error(`Invalid weights component: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}`);
      } else if (this.timeArray.length * this.component != this.dataArray.length) {
        console.error(`Invalid weights array length: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}`);
      }
    } else {
      // should never happened
      console.error(`Invalid path status: ${path}`);
    }

    if (this.timeArray.length * this.component > this.dataArray.length) {
      throw new Error(`Data length mismatch: ${this.timeArray.length}, ${this.component}, ${this.dataArray.length}`);
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

  dispose () {
    // @ts-expect-error
    this.timeArray = undefined;
    // @ts-expect-error
    this.dataArray = undefined;
    this.sampler?.dispose();
    this.sampler = undefined;
  }

  tick (time: number, treeItem: ModelTreeVFXItem, sceneManager?: PSceneManager) {
    const node = treeItem.content.getNodeById(this.node);

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

export class PAnimTexture {
  private isHalfFloat = true;
  //
  private width = 0;
  private height = 0;
  private buffer?: Float16ArrayWrapper;
  private texture?: Texture;

  constructor (private engine: Engine) {}

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

  dispose () {
    // @ts-expect-error
    this.engine = null;
    this.buffer = undefined;
    this.texture?.dispose();
  }

  getSize () {
    return this.width * this.height;
  }

  getTexture () {
    return this.texture as Texture;
  }

}

export class PAnimation extends PObject {
  private time = 0;
  private duration = 0;
  private tracks: PAnimTrack[] = [];

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

  tick (time: number, treeItem: ModelTreeVFXItem, sceneManager?: PSceneManager) {
    this.time = time;
    // TODO: 这里时间事件定义不明确，先兼容原先实现
    const newTime = this.time % this.duration;

    this.tracks.forEach(track => {
      track.tick(newTime, treeItem, sceneManager);
    });
  }

  override dispose () {
    this.tracks.forEach(track => {
      track.dispose();
    });
    this.tracks = [];
  }
}

export class PAnimationManager extends PObject {
  private ownerItem: ModelTreeVFXItem;
  private animation = 0;
  private speed = 0;
  private delay = 0;
  private time = 0;
  private animations: PAnimation[] = [];
  private sceneManager: PSceneManager;

  constructor (treeOptions: ModelTreeOptions, ownerItem: ModelTreeVFXItem) {
    super();
    this.name = this.genName(ownerItem.name ?? 'Unnamed tree');
    this.type = PObjectType.animationManager;
    //
    this.ownerItem = ownerItem;
    this.animation = treeOptions.animation ?? -1;
    this.speed = 1.0;
    this.delay = ownerItem.delay ?? 0;
    this.animations = [];
    if (treeOptions.animations !== undefined) {
      treeOptions.animations.forEach(animOpts => {
        const anim = this.createAnimation(animOpts);

        this.animations.push(anim);
      });
    }

    // get scene manager from composition
    const composition = ownerItem.composition;

    if (composition !== null && composition !== undefined) {
      this.sceneManager = composition.loaderData.sceneManager;
    }
  }

  createAnimation (animationOpts: ModelAnimationOptions) {
    const animation = new PAnimation();

    animation.create(animationOpts);

    return animation;
  }

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

  getTreeItem () {
    return this.ownerItem;
  }
}

export class PAnimationSystem {
  private managers: PAnimationManager[] = [];

  constructor (private engine: Engine) {}

  create (treeItems: ModelTreeVFXItem[]) {
    this.managers = [];
    treeItems.forEach(tree => {
      const mgr = new PAnimationManager(tree.options, tree);

      this.managers.push(mgr);
    });
  }

  insert (animationManager: PAnimationManager) {
    this.managers.push(animationManager);
  }

  delete (animationManager: PAnimationManager) {
    let findIndex = -1;

    this.managers.forEach((mgr, index) => {
      if (mgr === animationManager) {
        findIndex = index;
      }
    });
    if (findIndex >= 0) {
      this.managers.splice(findIndex, 1);
    }
  }

  dispose () {
    this.managers.forEach(mgr => {
      mgr.dispose();
    });
    this.managers = [];
  }
}

