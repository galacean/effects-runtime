import { HitTestType, VFXItem, spec, PLAYER_OPTIONS_ENV_EDITOR, assertExist, math } from '@galacean/effects';
import type { HitTestTriangleParams, Engine, Composition, VFXItemProps, BoundingBoxTriangle } from '@galacean/effects';
import type { AnimationStateListener, SkeletonData } from '@esotericsoftware/spine-core';
import { AnimationState, AnimationStateData, Physics, Skeleton } from '@esotericsoftware/spine-core';
import { SlotGroup } from './slot-group';
import type { SpineResource } from './spine-loader';
import { createSkeletonData, getAnimationDuration } from './utils';
import type { SpineMesh } from './spine-mesh';

const { Vector2, Vector3 } = math;

export interface BoundsData {
  x: number,
  y: number,
  width: number,
  height: number,
}

export type SpineContent = SlotGroup | undefined;

export class SpineVFXItem extends VFXItem<SpineContent> {
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

  startSize: number;
  /**
   * 根据相机计算的缩放比例
   */
  scaleFactor: number;
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
  spineDataCache?: SpineResource;
  engine: Engine;

  override _contentVisible = true;

  constructor (props: VFXItemProps, composition: Composition) {
    super(props, composition);
    const engine = this.composition?.renderer.engine;

    assertExist(engine);

    this.engine = engine;
  }

  override get type () {
    return spec.ItemType.spine;
  }

  override onConstructed (options: spec.SpineItem) {
    this.initContent(options.content.options, this.composition?.loaderData.spineDatas);
    // @ts-expect-error
    this.startSize = options.content.options.startSize;
    // @ts-expect-error
    this.renderer = options.content.renderer;
  }

  initContent (spineOptions: spec.PluginSpineOption, spineDatas: SpineResource[]) {
    const index = spineOptions.spine;

    if (isNaN(index)) {
      return;
    }
    const skin = spineOptions.activeSkin || 'default';
    const { atlas, skeletonFile, skeletonType, skinList, animationList } = spineDatas[index];
    const activeAnimation = typeof spineOptions.activeAnimation === 'string' ? [spineOptions.activeAnimation] : spineOptions.activeAnimation;

    this.skeletonData = createSkeletonData(atlas, skeletonFile, skeletonType);
    this.animationStateData = new AnimationStateData(this.skeletonData);
    this.animationStateData.defaultMix = spineOptions.mixDuration || 0;
    this.spineDataCache = spineDatas[index];
    this.skinList = skinList.slice();
    this.animationList = animationList.slice();
    this.skeleton = new Skeleton(this.skeletonData);
    this.setSkin(skin);
    this.state = new AnimationState(this.animationStateData);
    if (activeAnimation.length === 1) {
      // 兼容旧JSON，根据时长计算速度
      if (isNaN(spineOptions.speed as number)) {
        const speed = Number((getAnimationDuration(this.skeletonData, activeAnimation[0]) / this.duration).toFixed(2));

        this.setAnimation(activeAnimation[0], speed);
      } else {
        this.setAnimation(activeAnimation[0], spineOptions.speed);
      }

    } else {
      this.setAnimationList(activeAnimation, spineOptions.speed);
    }
    this.pma = atlas.pages[0].pma;
  }

  override doCreateContent (): SpineContent {
    if (this.skeleton) {
      return new SlotGroup(this.skeleton.drawOrder, {
        listIndex: this.listIndex,
        meshName: this.name,
        transform: this.transform,
        pma: this.pma,
        renderer: this.renderer,
        engine: this.engine,
      });
    }
  }

  override onLifetimeBegin () {
    // 编辑器环境下添加元素未添加资源
    if (!(this.state && this.skeleton)) {
      return;
    }
    this.skeleton.setToSetupPose();
    this.skeleton.update(0);
    this.skeleton.updateWorldTransform(Physics.update);
    this.resize();
    this.updateState(0);
  }

  override onItemUpdate (dt: number, lifetime: number) {
    const slotGroup = this.content;

    if (!slotGroup) {
      return;
    }
    const visible = this.contentVisible;

    slotGroup.meshGroups.map((mesh: SpineMesh) => {
      mesh.mesh.setVisible(visible);
    });
    if (visible) {
      this.updateState(dt / 1000);
    }
  }

  override onItemRemoved () {
    const slotGroup = this.content;

    if (slotGroup) {
      slotGroup.meshGroups.map(mesh => {
        mesh.dispose();
      });
    }
  }

  override onEnd () {
    if (this.endBehavior === spec.END_BEHAVIOR_DESTROY && this.state) {
      this.state.clearListeners();
      this.state.clearTracks();
    }
  }

  override handleVisibleChanged (hide: boolean) {
    if (!this.content) {
      return;
    }
    this.content.meshGroups.map((mesh: SpineMesh) => {
      mesh.mesh.setVisible(hide);
    });
  }

  /**
   * 返回当前 AABB 包围盒对应的三角形顶点数组
   * @returns
   */
  override getBoundingBox (): BoundingBoxTriangle {
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

  override getHitTestParams (force?: boolean): HitTestTriangleParams | void {
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

  updateState (dt: number) {
    if (!(this.state && this.skeleton)) {
      return;
    }
    this.state.update(dt);
    this.state.apply(this.skeleton);
    this.skeleton.update(dt);
    this.skeleton.updateWorldTransform(Physics.update);
    this.content?.update();
  }

  setAnimation (animation: string, speed?: number) {
    if (!this.skeleton || !this.state) {
      throw new Error('Set animation before skeleton create');
    }
    if (!this.animationList.length) {
      throw new Error('animationList is empty, check your spine file');
    }
    const loop = this.endBehavior === spec.ItemEndBehavior.loop;
    const listener = this.state.tracks[0]?.listener;

    if (listener) {
      listener.end = () => { };
    }
    this.state.clearTracks();
    this.skeleton.setToSetupPose();
    if (!this.animationList.includes(animation)) {
      console.warn(`animation ${JSON.stringify(animation)} not exists in animationList: ${this.animationList}, set to ${this.animationList[0]}`);

      this.state.setAnimation(0, this.animationList[0], loop);
      this.activeAnimation = [this.animationList[0]];
    } else {
      this.state.setAnimation(0, animation, loop);
      this.activeAnimation = [animation];
    }
    if (!isNaN(speed as number)) {
      this.setSpeed(speed as number);
    }
  }

  setAnimationList (animationList: string[], speed?: number) {
    if (!this.skeleton || !this.state) {
      throw new Error('Set animation before skeleton create');
    }
    if (!this.animationList.length) {
      throw new Error('animationList is empty, please check your setting');
    }
    if (animationList.length === 1) {
      this.setAnimation(animationList[0], speed);

      return;
    }
    const listener = this.state.tracks[0]?.listener;

    if (listener) {
      listener.end = () => { };
    }
    this.state.clearTracks();
    this.skeleton.setToSetupPose();
    for (const animation of animationList) {
      const trackEntry = this.state.addAnimation(0, animation, false);

      if (this.endBehavior === spec.ItemEndBehavior.loop) {
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
    if (!isNaN(speed as number)) {
      this.setSpeed(speed as number);
    }
  }

  /**
   * 设置 Spine 播放的速度
   * @param speed - 速度
   */
  override setSpeed (speed: number) {
    if (!this.state) {
      return;
    }

    this.state.timeScale = speed;
  }

  /**
   * 获取 Spine 播放的速度
   * @returns
   */
  override getSpeed () {
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
    if (!this.state || this.state.tracks[0]) {
      return;
    }
    this.state.tracks[0]!.mixDuration = mixDuration;
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
      throw new Error('Set skin before skeleton create');
    }
    if (!skin || !this.skinList.includes(skin)) {
      throw new Error(`skin ${skin} not exists in skinList: ${this.skinList}`);
    }
    this.skeleton.setSkinByName(skin);
    this.skeleton.setToSetupPose();
  }

  // 根据初始包围盒对元素进行缩放 宽度缩放到1
  // 将缩放比例设置到当前scale
  resize () {
    const res = this.getBounds();

    if (!res) {
      return;
    }
    const { width } = res;
    const scale = this.transform.scale;
    const scaleFactor = 1 / width;

    this.scaleFactor = scaleFactor;
    this.transform.setScale(this.startSize * scaleFactor, this.startSize * scaleFactor, scale.z);
  }

  override setScale (sx: number, sy: number, sz: number) {
    const { x, y, z } = this.transform.scale;

    this.transform.setScale(x * sx, y * sy, z * sz);
  }

  getBounds (): BoundsData | undefined {
    if (!(this.state && this.skeleton && this.contentVisible)) {
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

