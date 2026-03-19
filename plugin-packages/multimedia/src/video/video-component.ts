import type { Asset, Engine, GeometryFromShape, Texture2DSourceOptionsVideo } from '@galacean/effects';
import { MaskableGraphic, Texture, effectsClass, math, spec } from '@galacean/effects';

/**
 * 用于创建 videoItem 的数据类型, 经过处理后的 spec.VideoContent
 */
export interface VideoItemProps extends Omit<spec.VideoComponentData, 'renderer' | 'mask'> {
  listIndex?: number,
  renderer: {
    shape?: GeometryFromShape,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
  mask?: spec.MaskOptions,
}

let seed = 0;

/**
 * Video component class
 * 视频播放状态由以下两个维度的结束行为组合决定：
 * - 合成结束行为（rootEndBehavior）：destroy / freeze / restart / forward
 * - 视频结束行为（videoEndBehavior）：destroy / freeze / restart
 */
@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends MaskableGraphic {
  video?: HTMLVideoElement;

  /**
   * 视频元素是否激活
   */
  isVideoActive = false;

  /**
   * 是否为透明视频
   */
  protected transparent = false;

  /**
   * 视频是否已加载完成
   */
  private videoLoaded = false;

  /**
   * 是否由用户手动控制播放速率（覆盖合成的播放速率）
   */
  private manualPlaybackRate = false;

  /**
   * 是否由用户手动控制循环播放（覆盖合成的结束行为）
   */
  private manualLoop = false;

  /**
   * 是否由用户手动暂停视频
   */
  private manualPause = false;

  /**
   * 视频是否已开始播放
   */
  private playTriggered = false;

  /**
   * 上一次的视频时间，用于检测重播
   */
  private lastVideoTime = -1;

  /**
   * 视频是否已经销毁（用于 destroy 结束行为，确保只重置一次）
   */
  private videoDestroyed = false;

  /**
   * 视频是否处于 seek 中
   * seek 期间禁止上传帧，避免 destroy 后 seek 回 0 期间渲染旧帧
   */
  private videoSeeking = false;

  /**
   * 待执行的 seek 目标时间，延迟到 onUpdate 中处理以避免竞态。
   * 值为 null 表示没有待执行的 seek。
   */
  private pendingSeekTime: number | null = null;

  /**
   * 当前正在执行的 play() Promise，用于串行化 play 调用，避免上的竞态
   */
  private playPromise: Promise<void> | null = null;

  /**
   * 存储事件监听器的移除函数，用于销毁时清理
   */
  private eventDisposers: (() => void)[] = [];

  private static readonly threshold = 0.01;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MVideo' + seed++;
  }

  override setTexture (input: Texture): void;
  override async setTexture (input: string): Promise<void>;
  override async setTexture (input: Texture | string): Promise<void> {
    const oldTexture = this.renderer.texture;
    const composition = this.item.composition;

    if (!composition) { return; }

    let texture: Texture;

    if (typeof input === 'string') {
      texture = await Texture.fromVideo(input, this.item.engine);
    } else {
      texture = input;
    }

    composition.textures.forEach((cachedTexture, index) => {
      if (cachedTexture === oldTexture) {
        composition.textures[index] = texture;
      }
    });

    this.engine.removeTexture(oldTexture);
    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
    this.video = (texture.source as Texture2DSourceOptionsVideo).video;
  }

  override onAwake (): void {
    super.onAwake();

    const composition = this.item.composition;

    if (!composition) { return; }

    this.eventDisposers.push(
      composition.on('goto', () => this.handleGoto()),
      composition.on('play', () => this.handleCompositionPlay()),
      composition.on('pause', () => this.pauseVideoElement()),
      composition.on('end', () => this.handleCompositionEnd()),
    );
  }

  override fromData (data: VideoItemProps): void {
    super.fromData(data);

    const { interaction, options } = data;
    const {
      video,
      startColor = [1, 1, 1, 1],
      playbackRate = 1,
      volume = 1,
      muted = false,
      transparent = false,
    } = options;

    this.transparent = transparent;

    if (video) {
      const videoAsset = this.engine.findObject<Asset<HTMLVideoElement>>(video);

      if (videoAsset) {
        this.video = videoAsset.data;
        this.video.playbackRate = playbackRate;
        this.setVolume(volume);
        this.setMuted(muted);
        const endBehavior = this.item.definition.endBehavior;

        if (endBehavior === spec.EndBehavior.destroy || endBehavior === spec.EndBehavior.freeze) {
          this.video.loop = false;
        } else if (endBehavior === spec.EndBehavior.restart) {
          this.video.loop = true;
        }

        this.videoLoaded = this.video.readyState >= 2;
      }
    }

    this.interaction = interaction;

    if (this.transparent) {
      this.material.enableMacro('TRANSPARENT_VIDEO', this.transparent);
    }

    this.material.setColor('_Color', new math.Color().setFromArray(startColor));
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);

    if (!this.video || !this.videoLoaded) {
      return;
    }

    // 处理延迟 seek（避免与 forwardTime 同步调用产生竞态）
    if (this.processPendingSeek()) {
      return;
    }

    // 检测当前是否为重播状态
    this.detectCompositionRestart();

    // 根据结束行为决定视频状态
    if (this.shouldFreezeVideo()) {
      this.freezeVideo();

      return;
    }

    if (this.shouldStartVideo()) {
      this.startVideo();
    }

    this.updatePlaybackRate();
    this.ensureLoopFlag();
    this.handleDestroyBehavior();

    // 上传当前视频帧
    if (!this.videoSeeking) {
      this.renderer.texture.uploadCurrentVideoFrame();
    }
  }

  override onDestroy (): void {
    this.eventDisposers.forEach(dispose => dispose());
    this.eventDisposers = [];
    super.onDestroy();
    this.playTriggered = false;
    this.playPromise = null;
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
  }

  override onDisable (): void {
    super.onDisable();
    this.isVideoActive = false;
  }

  override onEnable (): void {
    super.onEnable();
    this.isVideoActive = true;
  }

  /**
   * 处理 goto 事件：重置播放状态，记录待 seek 时间
   */
  private handleGoto (): void {
    this.playTriggered = false;
    this.manualPause = false;
    this.pendingSeekTime = this.item.time;
  }

  /**
   * 处理合成 play 事件（合成开始/重播/恢复时触发）
   */
  private handleCompositionPlay (): void {
    // 合成未结束时（暂停后恢复），不需要重置视频状态
    if (!this.checkCompositionEnded()) {
      return;
    }

    this.playTriggered = false;
    this.manualPause = false;
    const videoEndBehavior = this.item.defination.endBehavior;

    if (videoEndBehavior === spec.EndBehavior.freeze && this.video) {
      this.pendingSeekTime = 0;
    } else if (videoEndBehavior === spec.EndBehavior.destroy) {
      this.videoDestroyed = false;
    }
  }

  /**
   * 根据合成结束行为决定视频的后续处理
   */
  private handleCompositionEnd (): void {
    const rootEndBehavior = this.item.composition?.rootItem.endBehavior;

    if (rootEndBehavior === spec.EndBehavior.restart) {
      // 合成 restart：所有视频都需要 seek 回 0，和合成时间对齐
      if (!this.videoSeeking) {
        this.pendingSeekTime = 0;
      }
      this.playTriggered = false;

      return;
    }

    if (rootEndBehavior === spec.EndBehavior.forward) {
      // forward：合成时间继续往前走，视频也继续播
      return;
    }

    // freeze / destroy：合成真正结束，暂停视频
    this.playTriggered = false;
    this.pauseVideoElement();
  }

  /**
   * 视频是否已播放到末尾
   */
  private checkVideoEnded (): boolean {
    const videoEndBehavior = this.item.endBehavior;

    // restart 行为的视频永远不会"结束"（由浏览器原生 loop 处理）
    if (videoEndBehavior === spec.EndBehavior.restart) {
      return false;
    }

    return this.video!.currentTime + VideoComponent.threshold >= this.video!.duration;
  }

  /**
   * 合成是否已到达结束时间
   */
  private checkCompositionEnded (): boolean {
    const composition = this.item.composition;

    if (!composition) {
      return false;
    }

    return composition.time + VideoComponent.threshold >= composition.rootItem.duration;
  }

  /**
   * 是否应该冻结视频（暂停在当前帧）
   */
  private shouldFreezeVideo (): boolean {
    const isVideoEnded = this.checkVideoEnded();
    const isCompositionEnded = this.checkCompositionEnded();

    const videoEndBehavior = this.item.endBehavior;
    const rootEndBehavior = this.item.composition?.rootItem.endBehavior;

    // 合成结束且合成行为是 freeze 时冻结视频
    const isCompositionFrozen = isCompositionEnded && rootEndBehavior === spec.EndBehavior.freeze;

    // 合成结束且视频行为是 freeze，除合成 restart 外均冻结视频
    const isCompositionEndedForVideo = rootEndBehavior !== spec.EndBehavior.restart && isCompositionEnded;
    const isVideoFrozen = (isVideoEnded || isCompositionEndedForVideo) && videoEndBehavior === spec.EndBehavior.freeze;

    return isVideoFrozen || isCompositionFrozen;
  }

  /**
   * 是否应该启动视频播放
   */
  private shouldStartVideo (): boolean {
    if (this.playTriggered || this.manualPause || this.checkVideoEnded()) {
      return false;
    }

    const composition = this.item.composition;

    if (!composition) {
      return false;
    }

    return this.video!.currentTime > 0 || composition.time > 0;
  }

  /**
   * 处理延迟 seek，返回 true 表示本帧已处理 seek，应跳过后续逻辑
   */
  private processPendingSeek (): boolean {
    if (this.pendingSeekTime === null) {
      return false;
    }
    const seekTime = this.pendingSeekTime;

    this.pendingSeekTime = null;
    this.performSeek(seekTime);

    return true;
  }

  /**
   * 检测合成是否发生了 restart（item.time 从大跳小），并重置相关状态
   */
  private detectCompositionRestart (): void {
    const videoTime = this.item.time;

    if (this.lastVideoTime > 0 && videoTime < this.lastVideoTime) {
      this.playTriggered = false;
      this.videoDestroyed = false;
      this.manualPause = false;
      this.lastVideoTime = -1;

      const rootEndBehavior = this.item.composition?.rootItem.endBehavior;
      const videoEndBehavior = this.item.endBehavior;

      // 视频 restart 时，浏览器 loop 处理；合成 restart 时，前面函数已经 seek 回 0
      if (rootEndBehavior !== spec.EndBehavior.restart && videoEndBehavior !== spec.EndBehavior.restart) {
        this.pendingSeekTime = 0;
      }
    }

    this.lastVideoTime = videoTime;
  }

  /**
   * 冻结视频：停止播放，保持当前帧
   */
  private freezeVideo (): void {
    this.playTriggered = false;
    if (!this.video!.paused) {
      this.pauseVideoElement();
    }
  }

  /**
   * 确保 restart 行为的视频设置了 loop 标志
   * 手动模式下不自动设置，保持用户设置的值
   */
  private ensureLoopFlag (): void {
    if (this.manualLoop) {
      return;
    }

    if (this.item.endBehavior === spec.EndBehavior.restart && !this.video!.loop) {
      this.video!.loop = true;
    }
  }

  /**
   * 处理 destroy 结束行为：视频播放到末尾后，seek 回 0 并清空纹理
   * 确保合成 restart 时视频已在第 0 帧，不会闪最后一帧
   */
  private handleDestroyBehavior (): void {
    if (this.videoDestroyed || this.videoSeeking) {
      return;
    }

    const isVideoEnded = this.checkVideoEnded();

    if (isVideoEnded && this.item.endBehavior === spec.EndBehavior.destroy) {
      this.videoDestroyed = true;
      this.playTriggered = false;
      this.lastVideoTime = -1;
      this.performSeek(0, true);
    }
  }

  /**
   * 开始播放视频
   */
  private startVideo (): void {
    if (!this.video || (this.playTriggered && !this.video.paused)) {
      return;
    }
    this.playTriggered = true;
    this.safePlay();
  }

  /**
   * 安全地调用 video.play()，串行化调用
   */
  private safePlay (): void {
    if (!this.video) {
      return;
    }

    const doPlay = () => {
      if (!this.video) {
        return;
      }

      const promise = this.video.play();

      this.playPromise = promise;

      void promise
        .then(() => {
          if (this.playPromise === promise) {
            this.playPromise = null;
          }
          this.updatePlaybackRate();
        })
        .catch(error => {
          if (this.playPromise === promise) {
            this.playPromise = null;
          }
          if (error.name === 'AbortError') {
            this.playTriggered = false;
            this.engine.renderErrors.add(error);
          }
        });
    };

    if (this.playPromise) {
      void this.playPromise.then(() => doPlay());
    } else {
      doPlay();
    }
  }

  /**
   * 暂停底层视频元素
   */
  private pauseVideoElement (): void {
    if (!this.video || this.video.paused) {
      return;
    }
    this.video.pause();
    if (this.playPromise) {
      void this.playPromise.then(() => {
        if (this.video && !this.video.paused) {
          this.video.pause();
        }
      });
    }
  }

  /**
   * seek 期间设置 videoSeeking=true，阻止 uploadCurrentVideoFrame 上传旧帧
   * @param time 目标时间
   * @param clearTexture 是否在 seek 期间清空纹理，避免旧帧残留（仅视频 destroy 行为 seek 回 0 时使用）
   */
  private performSeek (time: number, clearTexture = false): void {
    const wasPlaying = !this.video!.paused;

    if (wasPlaying) {
      this.video!.pause();
    }
    this.videoSeeking = true;
    if (clearTexture) {
      this.material.setTexture('_MainTex', this.engine.transparentTexture);
    }
    this.video!.addEventListener('seeked', () => {
      this.videoSeeking = false;
      if (clearTexture) {
        this.material.setTexture('_MainTex', this.renderer.texture);
      }
      if (this.video) {
        this.renderer.texture.uploadCurrentVideoFrame();
        // 如果视频之前在播放，seek 完成后恢复播放
        if (wasPlaying && !this.manualPause) {
          this.safePlay();
        }
      }
    }, { once: true });
    this.video!.currentTime = time;
  }

  /**
   * 更新视频播放速率
   * 手动模式下保持用户设置的速率不变，自动模式下根据 engine.speed * composition.speed 计算
   */
  private updatePlaybackRate (): void {
    // 手动模式下不自动更新速率
    if (this.manualPlaybackRate) {
      return;
    }

    if (!this.video) {
      return;
    }

    const composition = this.item.composition;

    if (!composition) {
      return;
    }

    const playbackRate = this.engine.speed * composition.speed;

    if (this.video.playbackRate !== playbackRate) {
      this.video.playbackRate = playbackRate;
    }
  }

  /**
   * 获取当前视频时长
   */
  getDuration (): number {
    return this.video ? this.video.duration : 0;
  }

  /**
   * 获取当前视频播放时刻
   */
  getCurrentTime (): number {
    return this.video ? this.video.currentTime : 0;
  }

  /**
   * 设置当前视频播放时刻
   * @param time 目标时间，会被限制在 [0, duration] 范围内
   */
  setCurrentTime (time: number) {
    if (!this.video) {
      return;
    }

    const duration = this.video.duration;

    // 如果 duration 无效（如视频未加载），直接使用原值
    if (!duration || !isFinite(duration)) {
      this.pendingSeekTime = Math.max(0, time);

      return;
    }

    this.pendingSeekTime = Math.max(0, Math.min(time, duration));
  }

  /**
   * 设置视频是否循环播放，调用后会覆盖合成的结束行为，改为由用户手动控制循环。
   * 调用 {@link resetLoop} 可恢复为由合成结束行为自动控制。
   */
  setLoop (loop: boolean) {
    this.manualLoop = true;
    if (this.video) {
      this.video.loop = loop;
    }
  }

  /**
   * 重置循环播放为合成自动控制模式
   */
  resetLoop () {
    this.manualLoop = false;
  }

  /**
   * 设置视频是否静音
   */
  setMuted (muted: boolean) {
    if (this.video && this.video.muted !== muted) {
      this.video.muted = muted;
    }
  }

  /**
   * 设置视频音量
   */
  setVolume (volume: number) {
    if (this.video && this.video.volume !== volume) {
      this.video.volume = volume;
    }
  }

  /**
   * 设置当前视频是否为透明视频
   */
  setTransparent (transparent: boolean): void {
    if (this.transparent === transparent) {
      return;
    }
    if (transparent) {
      this.material.enableMacro('TRANSPARENT_VIDEO', true);
    } else {
      this.material.disableMacro('TRANSPARENT_VIDEO');
    }
    this.transparent = transparent;
  }

  /**
   * 设置视频播放速率，调用后会覆盖合成的速率，改为由用户手动控制速率。
   * 调用 {@link resetPlaybackRate} 可恢复为由合成速率自动控制。
   */
  setPlaybackRate (rate: number) {
    this.manualPlaybackRate = true;
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }

  /**
   * 重置播放速率为合成自动控制模式
   */
  resetPlaybackRate () {
    this.manualPlaybackRate = false;
  }

  /**
   * 播放视频，同时取消手动暂停状态
   */
  playVideo (): void {
    this.manualPause = false;
    this.startVideo();
  }

  /**
   * 手动暂停视频
   */
  pauseVideo (): void {
    this.manualPause = true;
    this.pauseVideoElement();
  }
}
