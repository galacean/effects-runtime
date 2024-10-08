import type { AnimationStateListener, SkeletonData, TextureAtlas } from '@esotericsoftware/spine-core';
import { AnimationState, AnimationStateData, Physics, Skeleton } from '@esotericsoftware/spine-core';
import type {
  Asset,
  BoundingBoxTriangle, Engine, HitTestTriangleParams, Renderer, Texture,
} from '@galacean/effects';
import {
  effectsClass, HitTestType, math, PLAYER_OPTIONS_ENV_EDITOR, RendererComponent, serialize,
  spec,
} from '@galacean/effects';
import { SlotGroup } from './slot-group';
import {
  createSkeletonData, getAnimationDuration, getAnimationList, getSkeletonFromBuffer,
  getSkinList, readAtlasData,
} from './utils';

const { Vector2, Vector3 } = math;

export interface BoundsData {
  x: number,
  y: number,
  width: number,
  height: number,
}

export interface SpineBaseData {
  atlas: TextureAtlas,
  skeletonData: SkeletonData,
}

export interface SpineResource {
  atlas: {
    bins: Asset<ArrayBuffer>,
    source: [start: number, length?: number],
  },
  skeleton: {
    bins: Asset<ArrayBuffer>,
    source: [start: number, length?: number],
  },
  images: Texture[],
  skeletonType: spec.skeletonFileType,
  // 编辑器缓存资源
  cache?: SpineBaseData,
  // 编辑器资源缓存ID
  editorResourceID?: string,
}

export interface SpineDataCache extends SpineBaseData {
  skinList?: string[],
  animationList?: string[],
  // 编辑器资源缓存ID
  editorResourceID?: string,
}

/**
 * @since 2.0.0
 */
@effectsClass('SpineComponent')
export class SpineComponent extends RendererComponent {
  startSize: number;
  /**
   * 根据相机计算的缩放比例
   */
  scaleFactor: number;
  /**
   * 大小计算规则：
   * 1 : 相机逆投影 + 固定画布大小
   * 0 ：除以包围盒大小
   */
  resizeRule: number;
  /**
   * 当前骨架对应的皮肤列表
   */
  skinList: string[];
  /**
   * 当前骨架对应的动画列表
   */
  animationList: string[];
  /**
   * png 是否预乘 alpha
   */
  pma: boolean;
  /**
   * renderer 数据
   */
  renderer: {};
  options: spec.PluginSpineOption;

  private content: SlotGroup | null;
  private skeleton: Skeleton;
  private state: AnimationState;
  private animationStateData: AnimationStateData;
  private activeAnimation: string[];
  private skeletonData: SkeletonData;
  /**
   * aabb 包围盒与 skeleton 原点的距离
   */
  private offset = new Vector2();
  /**
   * aabb 包围盒的宽度与高度
   */
  private size = new Vector2();

  @serialize()
  resource: SpineResource;
  @serialize()
  cache: SpineDataCache;

  constructor (engine: Engine) {
    super(engine);
  }

  // TODO 发包后修改
  // override fromData (data: spec.SpineComponent<TextureAtlas, SkeletonData>)
  override fromData (data: spec.SpineComponent) {
    super.fromData(data);
    this.options = data.options;
    this.item.getHitTestParams = this.getHitTestParams.bind(this);
    // 兼容编辑器逻辑
    if (!this.resource || !Object.keys(this.resource).length) {
      return;
    }
    const { images: textures, skeletonType, atlas: atlasOptions, skeleton: skeletonOptions, editorResourceID } = this.resource;

    // 编辑器缓存解析资源，不再解析
    if (this.cache) {
      return;
    }
    const [start, bufferLength] = atlasOptions.source;
    const atlasBuffer = bufferLength ? new Uint8Array(atlasOptions.bins.data, start, bufferLength) : new Uint8Array(atlasOptions.bins.data, start);
    const atlas = readAtlasData(atlasBuffer, textures);

    const skBuffer = skeletonOptions.bins.data;
    const [skelStart, skelBufferLength] = skeletonOptions.source;
    const skeletonBuffer = skelBufferLength ? skBuffer.slice(skelStart, skelStart + skelBufferLength) : skBuffer.slice(skelStart);
    const skeletonFile = getSkeletonFromBuffer(skeletonBuffer, skeletonType);
    const skeletonData = createSkeletonData(atlas, skeletonFile, skeletonType);

    this.cache = {
      atlas, skeletonData,
    };
    if (editorResourceID) {
      this.cache.editorResourceID = editorResourceID;
    }
  }

  override onStart () {
    super.onStart();
    if (!this.cache) {
      return;
    }
    this.initContent(this.cache.atlas, this.cache.skeletonData, this.options);
    // @ts-expect-error
    this.startSize = this.options.startSize;
    // @ts-expect-error
    this.renderer = this.options.renderer;

    if (!(this.state && this.skeleton)) {
      return;
    }
    this.state.apply(this.skeleton);
    this.onUpdate(0);
    this.resize();
  }

  override onUpdate (dt: number) {
    if (!(this.state && this.skeleton)) {
      return;
    }
    this.state.update(dt / 1000);
    this.state.apply(this.skeleton);
    this.skeleton.update(dt / 1000);
    this.skeleton.updateWorldTransform(Physics.update);
    if (this.content) {
      this.content.update();
    }
  }

  override render (renderer: Renderer) {
    this.content?.render(renderer);
  }

  override onDestroy () {
    if (this.item.endBehavior === spec.EndBehavior.destroy && this.state) {
      this.state.clearListeners();
      this.state.clearTracks();
    }
  }

  private initContent (atlas: TextureAtlas, skeletonData: SkeletonData, spineOptions: spec.PluginSpineOption) {
    const activeAnimation = typeof spineOptions.activeAnimation === 'string' ? [spineOptions.activeAnimation] : spineOptions.activeAnimation;

    this.skeleton = new Skeleton(skeletonData);
    this.skeletonData = skeletonData;
    this.animationStateData = new AnimationStateData(this.skeletonData);
    this.animationStateData.defaultMix = spineOptions.mixDuration || 0;
    this.skinList = getSkinList(skeletonData);
    this.animationList = getAnimationList(skeletonData);
    this.resizeRule = spineOptions.resizeRule;
    this.setSkin(spineOptions.activeSkin || (this.skinList.length ? this.skinList[0] : 'default'));
    this.state = new AnimationState(this.animationStateData);

    if (activeAnimation.length === 1) {
      // 兼容旧JSON，根据时长计算速度
      if (isNaN(spineOptions.speed as number)) {
        const speed = Number((getAnimationDuration(this.skeletonData, activeAnimation[0]) / this.item.duration).toFixed(2));

        this.setAnimation(activeAnimation[0], speed);
      } else {
        this.setAnimation(activeAnimation[0], spineOptions.speed);
      }

    } else {
      this.setAnimationList(activeAnimation, spineOptions.speed);
    }

    this.cache = {
      ...this.cache,
      skinList: this.skinList,
      animationList: this.animationList,
    };
    this.pma = atlas.pages[0].pma;
    this._priority = this.item.renderOrder;
    this.content = new SlotGroup(this.skeleton.drawOrder, {
      listIndex: this.item.renderOrder,
      meshName: this.name,
      transform: this.transform,
      pma: this.pma,
      renderer: this.renderer,
      engine: this.engine,
    });
  }

  /**
   * 返回当前 AABB 包围盒对应的三角形顶点数组
   * @returns
   */
  getBoundingBox (): BoundingBoxTriangle {
    const bounds = this.getBounds();
    const res: BoundingBoxTriangle = {
      type: HitTestType.triangle,
      area: [],
    };

    if (!bounds) {
      return res;
    }
    const { x, y, width, height } = bounds;
    const wm = this.transform.getWorldMatrix();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const p0 = new Vector3(centerX - width / 2, centerY - height / 2, 0);
    const p1 = new Vector3(centerX + width / 2, centerY - height / 2, 0);
    const p2 = new Vector3(centerX + width / 2, centerY + height / 2, 0);
    const p3 = new Vector3(centerX - width / 2, centerY + height / 2, 0);

    wm.projectPoint(p0);
    wm.projectPoint(p1);
    wm.projectPoint(p2);
    wm.projectPoint(p3);

    res.area = [
      { p0, p1, p2 },
      { p0: p0, p1: p2, p2: p3 },
    ];

    return res;
  }

  getHitTestParams (force?: boolean): HitTestTriangleParams | void {
    const box = this.getBoundingBox();
    const env = this.engine.renderer?.env;

    if (!box.area.length) {
      return;
    }

    // 包围盒的碰撞检测 只在编辑器用
    if (force && env === PLAYER_OPTIONS_ENV_EDITOR) {
      return {
        type: HitTestType.triangle,
        triangles: box.area,
        backfaceCulling: false,
        behavior: spec.InteractBehavior.NOTIFY,
      };
    }
  }

  /**
   * 设置单个动画
   * @param animation - 动画名
   * @param speed - 播放速度
   */
  setAnimation (animation: string, speed?: number) {
    if (!this.skeleton || !this.state) {
      throw new Error('Set animation before skeleton create.');
    }
    if (!this.animationList.length) {
      throw new Error('animationList is empty, check your spine file.');
    }
    const loop = this.item.endBehavior === spec.EndBehavior.restart;
    const listener = this.state.tracks[0]?.listener;

    if (listener) {
      listener.end = () => { };
    }
    this.state.setEmptyAnimation(0);
    if (!this.animationList.includes(animation)) {
      console.warn(`Animation ${JSON.stringify(animation)} not exists in animationList: ${this.animationList}, set to ${this.animationList[0]}.`);

      this.state.setAnimation(0, this.animationList[0], loop);
      this.activeAnimation = [this.animationList[0]];
    } else {
      this.state.setAnimation(0, animation, loop);
      this.activeAnimation = [animation];
    }

    if (speed !== undefined && !Number.isNaN(speed)) {
      this.setSpeed(speed);
    }
  }

  /**
   * 设置播放一组动画
   * @param animationList - 动画名列表
   * @param speed - 播放速度
   */
  setAnimationList (animationList: string[], speed?: number) {
    if (!this.skeleton || !this.state) {
      throw new Error('Set animation before skeleton create.');
    }
    if (!this.animationList.length) {
      throw new Error('animationList is empty, please check your setting.');
    }
    if (animationList.length === 1) {
      this.setAnimation(animationList[0], speed);

      return;
    }
    const listener = this.state.tracks[0]?.listener;

    if (listener) {
      listener.end = () => { };
    }
    this.state.setEmptyAnimation(0);
    for (const animation of animationList) {
      const trackEntry = this.state.addAnimation(0, animation, false);

      if (this.item.endBehavior === spec.EndBehavior.restart) {
        const listener: AnimationStateListener = {
          end: () => {
            const trackEntry = this.state.addAnimation(0, animation, false);

            trackEntry.listener = listener;
          },
        };

        trackEntry.listener = listener;
      }
    }
    this.activeAnimation = animationList;
    if (speed !== undefined && !isNaN(speed)) {
      this.setSpeed(speed);
    }
  }

  /**
   * 设置播放一组动画，循环播放最后一个
   * @param animationList - 动画名列表
   * @param speed - 播放速度
   * @since 1.6.0
   */
  setAnimationListLoopEnd (animationList: string[], speed?: number) {
    if (!this.skeleton || !this.state) {
      throw new Error('Set animation before skeleton create.');
    }
    if (!this.animationList.length) {
      throw new Error('animationList is empty, please check your setting.');
    }
    if (animationList.length === 1) {
      this.setAnimation(animationList[0], speed);

      return;
    }
    const listener = this.state.tracks[0]?.listener;

    if (listener) {
      listener.end = () => { };
    }
    this.state.setEmptyAnimation(0);
    for (let i = 0; i < animationList.length - 1; i++) {
      const animation = animationList[i];
      const trackEntry = this.state.setAnimation(0, animation, false);

      if (i === animationList.length - 2) {
        trackEntry.listener = {
          complete: () => {
            this.state.setAnimation(0, animationList[animationList.length - 1], true);
          },
        };
      }

    }
    if (!isNaN(speed as number)) {
      this.setSpeed(speed as number);
    }
  }

  /**
   * 设置 Spine 播放的速度
   * @param speed - 速度
   */
  setSpeed (speed: number) {
    if (!this.state) {
      return;
    }

    this.state.timeScale = speed;
  }

  /**
   * 获取 Spine 播放的速度
   * @returns
   */
  getSpeed () {
    return this.state.timeScale || 1;
  }

  /**
   * 获取正在播放的动作列表
   * @returns
   */
  getActiveAnimation (): string[] {
    return this.activeAnimation;
  }

  /**
   * 获取当前 Spine 中的 AnimationState
   * @returns
   * @since 1.6.0
   */
  getAnimationState (): AnimationState {
    return this.state;
  }

  /**
   * 设置指定动画之间的融合时间，请在 `player.play` 之前进行设置
   * @param fromName - 淡出动作
   * @param toName - 淡入动作
   * @param duration - 融合时间
   */
  setMixDuration (fromName: string, toName: string, duration: number) {
    if (!this.animationStateData) {
      return;
    }
    this.animationStateData.setMix(fromName, toName, duration);
  }

  /**
   * 修改所有动作之间的融合时间，请在 `player.play` 之前进行设置
   * @param mixDuration - 融合时间
   */
  setDefaultMixDuration (mixDuration: number) {
    if (!this.state) {
      return;
    }
    this.animationStateData.defaultMix = mixDuration;
    if (this.state.tracks[0]) {
      this.state.tracks[0].mixDuration = mixDuration;
    }
  }

  /**
   * 动画循环时，移除最后一个动作切换到第一个动作的融合效果，请在 `player.play` 之前进行设置
   */
  deleteMixForLoop () {
    const last = this.activeAnimation[this.activeAnimation.length - 1];
    const first = this.activeAnimation[0];

    this.animationStateData.setMix(last, first, 0);
  }

  /**
   * 设置皮肤
   * @param skin - 要设置的皮肤
   */
  setSkin (skin: string) {
    if (!this.skeleton) {
      throw new Error('Set skin before skeleton create.');
    }
    if (!skin || (skin !== 'default' && !this.skinList.includes(skin))) {
      throw new Error(`skin ${skin} not exists in skinList: ${this.skinList}.`);
    }
    this.skeleton.setSkinByName(skin);
    this.skeleton.setToSetupPose();
  }

  // 根据初始包围盒对元素进行缩放 宽度缩放到1
  // 将缩放比例设置到当前scale
  resize () {
    const res = this.getBounds();

    if (!res || !this.item.composition) {
      return;
    }
    const { width } = res;
    const scale = this.transform.scale;
    let scaleFactor;

    if (this.resizeRule) {
      const camera = this.item.composition.camera;
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = camera.getInverseVPRatio(z);

      if (camera.clipMode === spec.CameraClipMode.portrait) {
        scaleFactor = rx / 1500;
      } else {
        scaleFactor = ry / 3248;
      }
    } else {
      scaleFactor = 1 / width;
    }
    this.scaleFactor = scaleFactor;
    this.transform.setScale(this.startSize * scaleFactor, this.startSize * scaleFactor, scale.z);
  }

  // 转换当前大小为旧缩放规则下的大小
  convertSizeToOldRule (): number {
    const res = this.getBounds();

    if (!res || !this.item.composition || !this.resizeRule) {
      return 1;
    }
    const { width } = res;
    const scaleFactor = this.scaleFactor;

    return this.startSize * scaleFactor * width;
  }

  getBounds (): BoundsData | undefined {
    if (!(this.state && this.skeleton)) {
      return;
    }
    this.skeleton.updateWorldTransform(Physics.update);
    this.skeleton.getBounds(this.offset, this.size);

    return {
      x: this.offset.x,
      y: this.offset.y,
      width: this.size.x,
      height: this.size.y,
    };
  }

}
