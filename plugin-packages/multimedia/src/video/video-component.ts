import type { DataAsset, Engine, GeometryFromShape, Texture2DSourceOptionsVideo } from '@galacean/effects';
import { MaskableGraphic, Texture, TextureSourceType, effectsClass, math, spec } from '@galacean/effects';

/**
 * 用于创建 videoItem 的数据类型, 经过处理后的 spec.VideoContent
 */
export interface VideoItemProps extends Omit<spec.VideoComponentData, 'renderer' | 'mask' | 'options'> {
  listIndex?: number,
  options: Omit<spec.VideoContentOptions, 'video'> & { video?: spec.DataPath },
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

  private initialVideoSettings?: {
    volume: number,
    muted: boolean,
    playbackRate?: number,
    loop?: boolean,
  } = { volume: 1, muted: false };

  /**
   * 是否由用户手动控制播放速率（覆盖合成的播放速率）
   */
  private manualPlaybackRate = false;

  private videoPlaybackRate = 1;

  /**
   * 是否由用户手动控制循环播放（覆盖合成的结束行为）
   */
  private manualLoop = false;

  /**
   * 视频完整覆盖合成周期时，让浏览器原生循环跨过合成重播边界。
   */
  private nativeCompositionLoop = false;
  private replayFramePrepared = false;
  private preparingReplayFrame = false;
  private replayMuted?: boolean;
  private firstFrameTexture?: Texture;

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

  private seekVersion = 0;
  private removeSeekListener?: () => void;
  private textureVersion = 0;

  /**
   * 待执行的 seek 目标时间，延迟到 onUpdate 中处理以避免竞态。
   * 值为 null 表示没有待执行的 seek。
   */
  private pendingSeekTime: number | null = null;

  /**
   * 是否正在处理 gotoAndStop 的 seek
   * 用于跳过 pause 事件触发的 pauseVideoElement，等 seek 完成后再暂停
   */
  private isGotoAndStopSeeking = false;

  /**
   * 是否刚收到 goto 事件，等待后续 play/pause 事件来区分场景
   */
  private isWaitingForGotoResult = false;

  /**
   * 当前正在执行的 play() Promise，用于串行化 play 调用，避免上的竞态
   */
  private playPromise: Promise<void> | null = null;

  /**
   * 存储事件监听器的移除函数，用于销毁时清理
   */
  private eventDisposers: (() => void)[] = [];

  private static readonly seekTolerance = 0.01;
  // 只允许媒体结束点略晚于合成末尾，不用作首帧位置或相位校准的容差。
  private static readonly replayEndTolerance = 0.1;
  private static readonly firstFrameWindow = 1 / 24;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MVideo' + seed++;
  }

  /**
   * 替换纹理；若包含视频，保留传入视频自身的播放进度，不继承旧视频的进度
   */
  override setTexture (input: Texture): void;
  /**
   * 通过 URL 替换视频纹理，保留新视频加载完成时的播放进度，不主动归零
   */
  override async setTexture (input: string): Promise<void>;
  override async setTexture (input: Texture | string): Promise<void> {
    return this.replaceTexture(input);
  }

  /**
   * 通过 URL 更换视频，绑定后将新视频的时间重置
   */
  async setVideo (url: string): Promise<void> {
    return this.replaceTexture(url, true);
  }

  private async replaceTexture (input: Texture | string, rewind = false): Promise<void> {
    const version = ++this.textureVersion;
    const composition = this.item?.composition;

    if (!composition) { return; }

    let texture: Texture;

    if (typeof input === 'string') {
      texture = await Texture.fromVideo(input, this.engine);
      if (version !== this.textureVersion || this.item?.composition !== composition) {
        const video = (texture.source as Texture2DSourceOptionsVideo).video;

        video.pause();
        video.removeAttribute('src');
        video.load();
        texture.dispose();

        return;
      }
    } else {
      texture = input;
    }

    const oldTexture = this.renderer.texture;
    const video = (texture.source as Texture2DSourceOptionsVideo).video;

    this.cancelVideoSeek();
    this.firstFrameTexture?.dispose();
    this.firstFrameTexture = undefined;
    if (this.video !== video) {
      this.video?.pause();
    }
    this.playPromise = null;
    this.playTriggered = false;
    this.videoDestroyed = false;
    this.nativeCompositionLoop = false;
    this.lastVideoTime = -1;
    this.replayFramePrepared = false;
    this.videoSeeking = false;
    this.isGotoAndStopSeeking = false;
    this.pendingSeekTime = null;

    composition.textures.forEach((cachedTexture, index) => {
      if (cachedTexture === oldTexture) {
        composition.textures[index] = texture;
      }
    });

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
    this.video = video;
    this.initializeVideo();
    if (rewind && video) {
      this.performSeek(0, video.currentTime !== 0);
    }
  }

  override onAwake (): void {
    super.onAwake();

    const composition = this.item.composition;

    if (!composition) { return; }

    this.eventDisposers.push(
      composition.on('goto', () => this.handleGoto()),
      composition.on('play', () => this.handleCompositionPlay()),
      composition.on('pause', () => this.handleCompositionPause()),
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

    this.initialVideoSettings = { ...this.initialVideoSettings, volume, muted };
    this.transparent = transparent;

    this.videoPlaybackRate = playbackRate;

    if (video) {
      const videoAsset = this.findObject<DataAsset<HTMLVideoElement>>(video);

      if (videoAsset) {
        this.video = videoAsset.data;
        this.initializeVideo();
      }
    }

    this.interaction = interaction;

    if (this.transparent) {
      this.material.enableMacro('TRANSPARENT_VIDEO', this.transparent);
    }

    this.material.setColor('_Color', new math.Color().setFromArray(startColor));
  }

  private initializeVideo (): void {
    if (!this.video) {
      return;
    }

    // Pitch correction can rewind decoded frames on iOS when the playback rate changes.
    this.video.preservesPitch = false;
    this.cacheFirstFrame();

    const settings = this.initialVideoSettings;

    if (!settings) {
      return;
    }

    this.video.volume = settings.volume;
    this.video.muted = settings.muted;
    const composition = this.item.composition;
    const playbackRate = settings.playbackRate ?? this.videoPlaybackRate;

    this.video.playbackRate = !this.manualPlaybackRate && composition
      ? playbackRate * this.engine.speed * composition.speed
      : playbackRate;
    const endBehavior = this.item.endBehavior;

    if (settings.loop !== undefined) {
      this.video.loop = settings.loop;
    } else if (endBehavior === spec.EndBehavior.destroy || endBehavior === spec.EndBehavior.freeze) {
      this.video.loop = false;
    } else if (endBehavior === spec.EndBehavior.restart) {
      this.video.loop = true;
    }

    // Consume pending playback settings only on the first video binding.
    this.initialVideoSettings = undefined;
  }

  private cacheFirstFrame (): void {
    const video = this.video;

    if (this.firstFrameTexture || !video || video.seeking || video.readyState < 2 ||
      !video.videoWidth || !video.videoHeight || video.currentTime > VideoComponent.firstFrameWindow ||
      this.item.composition?.sceneRoot.endBehavior !== spec.EndBehavior.restart) {
      return;
    }
    const image = document.createElement('canvas');

    image.width = video.videoWidth;
    image.height = video.videoHeight;
    const context = image.getContext('2d');

    if (!context) {
      return;
    }
    context.drawImage(video, 0, 0);
    const { flipY, premultiplyAlpha, minFilter, magFilter, wrapS, wrapT } = this.renderer.texture.source;

    this.firstFrameTexture = Texture.create(this.engine, {
      sourceType: TextureSourceType.image,
      image, flipY, premultiplyAlpha, minFilter, magFilter, wrapS, wrapT,
    });
    this.firstFrameTexture.initialize();
  }

  private showSeekFrame (time: number): void {
    if (time > VideoComponent.seekTolerance && this.isVideoActive && !this.videoDestroyed) {
      return;
    }
    const firstFrame = time <= VideoComponent.seekTolerance && this.isVideoActive && !this.videoDestroyed
      ? this.firstFrameTexture : undefined;

    this.material.setTexture('_MainTex', firstFrame ?? this.engine.assetServer.transparentTexture);
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);

    if (!this.video || this.video.readyState < 2) {
      return;
    }

    this.cacheFirstFrame();
    this.updatePlaybackRate();
    this.ensureLoopFlag();
    if (this.replayFramePrepared && !this.video.paused && this.video.currentTime > VideoComponent.firstFrameWindow) {
      this.replayFramePrepared = false;
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
      if (!this.videoSeeking) {
        this.renderer.texture.uploadCurrentVideoFrame();
      }

      return;
    }

    if (this.shouldStartVideo()) {
      this.startVideo();
    }

    this.handleDestroyBehavior();

    // 上传当前视频帧
    if (!this.videoSeeking) {
      this.renderer.texture.uploadCurrentVideoFrame();
    }
  }

  override onDestroy (): void {
    this.textureVersion++;
    this.cancelVideoSeek();
    this.firstFrameTexture?.dispose();
    this.firstFrameTexture = undefined;
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
    this.playTriggered = false;
    const composition = this.item.composition;
    const endTime = (this.item.definition.delay ?? 0) + this.item.duration;
    const reachedEnd = composition && composition.time + VideoComponent.firstFrameWindow >= endTime;

    if (!reachedEnd || !this.prepareReplayFrame()) {
      this.pauseVideoElement();
    }
  }

  override onEnable (): void {
    super.onEnable();
    this.isVideoActive = true;
    this.playTriggered = false;
    this.ensureLoopFlag();
    this.syncVideoToItemTime();
  }

  /**
   * 处理 goto 事件：重置播放状态，记录待 seek 时间
   */
  private handleGoto (): void {
    // 通过后续事件区分 gotoAndPlay 和 gotoAndStop
    this.isWaitingForGotoResult = true;
    this.playTriggered = false;
    this.manualPause = false;
    this.videoDestroyed = false;
    this.lastVideoTime = this.item.time;
    this.pendingSeekTime = this.getItemSeekTime();
  }

  /**
   * 处理合成 pause 事件
   * 如果刚收到 goto 事件且等待结果，说明是 gotoAndStop 场景
   */
  private handleCompositionPause (): void {
    // gotoAndStop 场景
    if (this.isWaitingForGotoResult) {
      this.isWaitingForGotoResult = false;
      if (this.video && this.video.readyState >= 2) {
        this.isGotoAndStopSeeking = true;
        this.performSeek(this.getItemSeekTime(), false, true);
      }

      return;
    }
    // 普通 pause 事件：暂停视频
    this.pauseVideoElement();
  }

  /**
   * 处理合成 play 事件（合成开始/重播/恢复时触发）
   */
  private handleCompositionPlay (): void {
    // 如果正在等待 goto 结果，说明是 gotoAndPlay 场景
    if (this.isWaitingForGotoResult) {
      this.isWaitingForGotoResult = false;
    }
    // 合成未结束时（暂停后恢复），恢复视频播放
    if (!this.checkCompositionEnded()) {
      // 如果正在 seeking，不恢复播放，等 seek 完成后再恢复
      if (this.canPlayCurrentItem() && this.video?.paused) {
        this.safePlay();
      }

      return;
    }

    this.playTriggered = false;
    this.manualPause = false;
    const videoEndBehavior = this.item.endBehavior;

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
    const rootEndBehavior = this.item.composition?.sceneRoot.endBehavior;

    if (rootEndBehavior === spec.EndBehavior.restart) {
      this.videoDestroyed = false;
      const nativeHeadReady = this.canPreserveNativeLoop() && this.renderer.texture.uploadCurrentVideoFrame(true);

      if (nativeHeadReady || this.canReusePreparedFrame()) {
        this.playTriggered = !this.video!.paused;
        this.material.setTexture('_MainTex', this.renderer.texture);

        return;
      }
      if (this.canWaitForNativeHead() && this.prepareReplayFrame()) {
        this.playTriggered = false;
        this.showSeekFrame(0);

        return;
      }
      this.pendingSeekTime = null;
      this.playTriggered = false;
      if (this.video) {
        this.performSeek(0, true);
      }

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
    if (videoEndBehavior === spec.EndBehavior.restart || (this.nativeCompositionLoop && this.video!.loop)) {
      return false;
    }

    return this.video!.ended || this.video!.currentTime >= this.video!.duration;
  }

  /**
   * 合成是否已到达结束时间
   */
  private checkCompositionEnded (): boolean {
    const composition = this.item.composition;

    if (!composition) {
      return false;
    }

    return composition.time >= composition.sceneRoot.duration;
  }

  /**
   * 是否应该冻结视频（暂停在当前帧）
   */
  private shouldFreezeVideo (): boolean {
    const isVideoEnded = this.checkVideoEnded();
    const isCompositionEnded = this.checkCompositionEnded();

    const videoEndBehavior = this.item.endBehavior;
    const rootEndBehavior = this.item.composition?.sceneRoot.endBehavior;

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
    return !this.playTriggered && this.canPlayCurrentItem();
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
   * 检测合成是否发生了 restart，并重置相关状态
   */
  private detectCompositionRestart (): void {
    const videoTime = this.item.time;

    if (this.lastVideoTime > 0 && videoTime < this.lastVideoTime) {
      const preserveNativeLoop = this.canPreserveNativeLoop();

      this.playTriggered = false;
      this.videoDestroyed = false;
      this.manualPause = false;
      this.lastVideoTime = -1;

      const rootEndBehavior = this.item.composition?.sceneRoot.endBehavior;
      const videoEndBehavior = this.item.endBehavior;

      if (preserveNativeLoop) {
        this.playTriggered = !this.video!.paused;
      } else if (rootEndBehavior !== spec.EndBehavior.restart && videoEndBehavior !== spec.EndBehavior.restart) {
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
   * 视频自身循环，以及完整覆盖合成周期的视频，都可使用原生 loop。
   * 手动模式下不自动设置，保持用户设置的值
   */
  private ensureLoopFlag (): void {
    if (!this.video) {
      return;
    }
    this.nativeCompositionLoop = this.canUseNativeCompositionLoop() && (!this.manualLoop || this.video.loop);
    if (this.preparingReplayFrame) {
      this.video.loop = true;

      return;
    }
    if (this.manualLoop) {
      return;
    }
    const loop = this.item.endBehavior === spec.EndBehavior.restart || this.nativeCompositionLoop;

    if (this.video.loop !== loop) {
      this.video.loop = loop;
    }
  }

  private canUseNativeCompositionLoop (): boolean {
    const composition = this.item.composition;
    const video = this.video;

    if (!composition || !video || composition.sceneRoot.endBehavior !== spec.EndBehavior.restart ||
      composition.startTime !== 0 || this.item.parent !== composition.sceneRoot || (this.item.definition.delay ?? 0) !== 0) {
      return false;
    }
    const duration = composition.sceneRoot.duration;
    const speed = this.engine.speed * composition.speed;
    const relativePlaybackRate = video.playbackRate / speed;

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(video.duration) || video.duration <= 0 ||
      !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(relativePlaybackRate) || relativePlaybackRate <= 0) {
      return false;
    }

    const mediaDuration = video.duration / relativePlaybackRate;

    const independentlyLooping = this.item.endBehavior === spec.EndBehavior.restart || (this.manualLoop && video.loop);

    return this.item.duration + VideoComponent.seekTolerance >= duration &&
      (independentlyLooping || mediaDuration + VideoComponent.seekTolerance >= duration) &&
      mediaDuration <= duration + VideoComponent.replayEndTolerance;
  }

  private canPreserveNativeLoop (): boolean {
    const video = this.video;
    const composition = this.item.composition;

    if (!this.nativeCompositionLoop || !video?.loop || !composition || this.manualPause ||
      this.videoSeeking || this.pendingSeekTime !== null) {
      return false;
    }

    // A composition restart may reuse native looping only when the head is already ready.
    return !video.seeking && video.readyState >= 2 && video.currentTime <= VideoComponent.seekTolerance;
  }

  private canReusePreparedFrame (): boolean {
    const video = this.video;
    const composition = this.item.composition;

    if (!this.replayFramePrepared || !video || !composition || this.videoSeeking || video.seeking ||
      video.readyState < 2 || this.pendingSeekTime !== null || this.item.parent !== composition.sceneRoot) {
      return false;
    }
    const speed = this.engine.speed * composition.speed;
    const relativePlaybackRate = video.playbackRate / speed;
    const localTime = Math.max(0, composition.time - (this.item.definition.delay ?? 0));

    return Number.isFinite(relativePlaybackRate) && relativePlaybackRate > 0 &&
      localTime <= VideoComponent.firstFrameWindow * Math.max(1, speed) &&
      video.currentTime <= VideoComponent.firstFrameWindow;
  }

  private canWaitForNativeHead (): boolean {
    const video = this.video;
    const composition = this.item.composition;

    if (!video || !composition) {
      return false;
    }
    const rate = video.playbackRate / (this.engine.speed * composition.speed);

    return Number.isFinite(rate) && rate > 0 && (video.currentTime <= VideoComponent.firstFrameWindow ||
      (video.duration - video.currentTime) / rate <= VideoComponent.replayEndTolerance);
  }

  /**
   * 利用不可见阶段等待浏览器原生回绕，收到开头画面后暂停，不写 currentTime。
   */
  private prepareReplayFrame (): boolean {
    const video = this.video;
    const composition = this.item.composition;

    if (!video || !composition || this.item.endBehavior !== spec.EndBehavior.destroy ||
      composition.sceneRoot.endBehavior !== spec.EndBehavior.restart || composition.startTime !== 0 ||
      this.item.parent !== composition.sceneRoot || this.pendingSeekTime !== null || this.manualPause || (this.manualLoop && !video.loop)) {
      return false;
    }
    if (this.preparingReplayFrame || this.replayFramePrepared) {
      return true;
    }
    if (this.videoSeeking || this.nativeCompositionLoop) {
      return false;
    }
    const speed = this.engine.speed * composition.speed;
    const relativePlaybackRate = video.playbackRate / speed;
    const endTime = (this.item.definition.delay ?? 0) + video.duration / relativePlaybackRate;

    if (!Number.isFinite(relativePlaybackRate) || relativePlaybackRate <= 0 || !Number.isFinite(endTime) ||
      endTime > composition.sceneRoot.duration + VideoComponent.replayEndTolerance) {
      return false;
    }
    this.cancelVideoSeek();
    const version = this.seekVersion;
    const texture = this.renderer.texture;
    const previousLoop = video.loop;
    let callbackId: number | null = null;
    let disposed = false;
    let uploading = false;
    const isCurrent = () => !disposed && version === this.seekVersion && this.video === video && this.renderer.texture === texture;

    this.preparingReplayFrame = true;
    this.videoSeeking = true;
    this.material.setTexture('_MainTex', this.engine.assetServer.transparentTexture);
    video.loop = true;
    this.replayMuted = video.muted;
    video.muted = true;

    const prepare = async (mediaTime: number) => {
      if (!isCurrent() || uploading || mediaTime > VideoComponent.firstFrameWindow || video.seeking || video.readyState < 2) {
        return;
      }
      uploading = true;
      video.pause();
      try {
        texture.initialize();
        const uploaded = await Promise.resolve(texture.uploadCurrentVideoFrame(true));

        if (!uploaded || !isCurrent() || video.seeking || video.readyState < 2) {
          return;
        }
        this.removeSeekListener?.();
        this.removeSeekListener = undefined;
        this.videoSeeking = false;
        this.replayFramePrepared = true;
        this.playTriggered = false;
        // Preparing a frame does not end the current cycle's destroyed state.
        if (!this.videoDestroyed && this.isVideoActive) {
          this.material.setTexture('_MainTex', texture);
        }
      } catch (error) {
        if (isCurrent()) {
          this.engine.renderErrors.add(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        uploading = false;
      }
    };
    const checkFrame = () => { void prepare(video.currentTime); };
    const requestFrame = () => {
      if (!isCurrent() || uploading || callbackId !== null || typeof video.requestVideoFrameCallback !== 'function') {
        return;
      }
      try {
        callbackId = video.requestVideoFrameCallback((_, metadata) => {
          callbackId = null;
          void prepare(metadata.mediaTime);
          requestFrame();
        });
      } catch {
        // 旧容器仍可通过原生媒体事件和引擎 update 检测回绕。
      }
    };

    video.addEventListener('seeked', checkFrame);
    video.addEventListener('timeupdate', checkFrame);
    const removeUpdateListener = this.engine.on('update', checkFrame);

    this.removeSeekListener = () => {
      disposed = true;
      video.removeEventListener('seeked', checkFrame);
      video.removeEventListener('timeupdate', checkFrame);
      removeUpdateListener();
      if (callbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        try { video.cancelVideoFrameCallback(callbackId); } catch { /* 版本检查仍可过滤过期回调。 */ }
      }
      this.preparingReplayFrame = false;
      video.loop = this.manualLoop ? video.loop : previousLoop;
      video.muted = this.replayMuted ?? video.muted;
      this.replayMuted = undefined;
    };
    requestFrame();
    checkFrame();
    if (!uploading && video.paused) {
      this.safePlay();
    }

    return true;
  }

  /**
   * 处理 destroy 结束行为：优先等待原生回绕准备首帧，无法自然衔接时再 seek。
   */
  private handleDestroyBehavior (): void {
    if (this.videoDestroyed || this.videoSeeking || (this.nativeCompositionLoop && this.video!.loop)) {
      return;
    }

    const isVideoEnded = this.checkVideoEnded();

    if (isVideoEnded && this.item.endBehavior === spec.EndBehavior.destroy) {
      this.videoDestroyed = true;
      this.playTriggered = false;
      if (this.prepareReplayFrame()) {
        return;
      }
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
    if (this.replayFramePrepared && !this.videoSeeking) {
      this.material.setTexture('_MainTex', this.renderer.texture);
    }
    this.playTriggered = true;
    this.safePlay();
  }

  /**
   * 安全地调用 video.play()，串行化调用
   */
  private safePlay (): void {
    const video = this.video;

    // 已有 play() 在执行中，不重复调用，避免 AbortError
    if (!video || this.playPromise) {
      return;
    }

    const promise = video.play();

    this.playPromise = promise;

    void promise
      .then(() => {
        if (this.playPromise !== promise || this.video !== video) {
          return;
        }
        this.updatePlaybackRate();
        this.playPromise = null;
      })
      .catch(error => {
        if (this.playPromise !== promise || this.video !== video) {
          return;
        }
        this.playPromise = null;
        if (error.name === 'AbortError') {
          this.playTriggered = false;

          return;
        }
        this.engine.renderErrors.add(error);
      });
  }

  /**
   * 暂停底层视频元素
   */
  private pauseVideoElement (): void {
    // gotoAndStop 场景：跳过暂停，等 seek 完成后再暂停
    if (this.isGotoAndStopSeeking) {
      return;
    }
    if (!this.video || this.video.paused) {
      return;
    }
    this.playPromise = null;
    this.playTriggered = false;
    this.video.pause();
  }

  /**
   * 作废上一次 seek 的监听和异步上传结果。
   */
  private cancelVideoSeek (): void {
    this.seekVersion++;
    this.removeSeekListener?.();
    this.removeSeekListener = undefined;
  }

  /**
   * 普通跳转保留当前画面，回到起点时显示缓存首帧，目标画面上传后再切换。
   * @param time 目标时间
   * @param clearTexture 是否即使时刻不变也强制执行 seek
   * @param isGotoAndStop 是否为 gotoAndStop 场景
   */
  private performSeek (time: number, clearTexture = false, isGotoAndStop = false): void {
    const video = this.video!;
    const texture = this.renderer.texture;

    time = this.getClampedSeekTime(time);
    const wasPlaying = !video.paused;
    const isNoopSeek = !clearTexture && !this.videoSeeking && !video.seeking &&
      Math.abs(video.currentTime - time) <= VideoComponent.seekTolerance;

    if (isNoopSeek) {
      this.isGotoAndStopSeeking = false;
      if (isGotoAndStop) {
        video.pause();
      } else if (wasPlaying && !this.manualPause) {
        this.safePlay();
      }

      return;
    }

    this.cancelVideoSeek();
    this.replayFramePrepared = false;
    const version = this.seekVersion;
    const isCurrentSeek = () => version === this.seekVersion && this.video === video && this.renderer.texture === texture;

    this.videoSeeking = true;
    this.isGotoAndStopSeeking = isGotoAndStop;
    this.showSeekFrame(time);

    const doSeek = () => {
      if (!isCurrentSeek()) {
        return;
      }

      const onSeeked = async () => {
        if (!isCurrentSeek() || video.seeking || video.readyState < 2) {
          return;
        }
        this.removeSeekListener?.();
        this.removeSeekListener = undefined;
        try {
          texture.initialize();
          const uploaded = await Promise.resolve(texture.uploadCurrentVideoFrame(true));

          if (!uploaded || !isCurrentSeek() || video.seeking || video.readyState < 2) {
            return;
          }
          this.cacheFirstFrame();
          if (!this.videoDestroyed && this.isVideoActive) {
            this.material.setTexture('_MainTex', texture);
          }
          this.videoSeeking = false;
          this.isGotoAndStopSeeking = false;
          if (time <= VideoComponent.seekTolerance && (this.videoDestroyed || !this.isVideoActive)) {
            this.replayFramePrepared = true;
            video.pause();
          }
          if (isGotoAndStop) {
            video.pause();
          } else if (wasPlaying && this.canPlayCurrentItem()) {
            this.safePlay();
          }
        } catch (error) {
          if (isCurrentSeek()) {
            this.engine.renderErrors.add(error instanceof Error ? error : new Error(String(error)));
          }
        }
      };

      video.addEventListener('seeked', onSeeked);
      this.removeSeekListener = () => video.removeEventListener('seeked', onSeeked);
      video.currentTime = time;
    };

    if (isGotoAndStop) {
      if (wasPlaying) {
        // 视频正在播放，直接 seek
        doSeek();
      } else {
        // 视频暂停，先 play() 再 seek
        video.play().then(() => {
          doSeek();
        }).catch(() => {
          // play 失败时也尝试 seek
          doSeek();
        });
      }
    } else {
      if (wasPlaying) {
        video.pause();
      }
      doSeek();
    }
  }

  /**
   * 更新视频播放速率
   * 手动模式下保持用户设置的速率不变，自动模式下将配置倍速乘以 engine.speed * composition.speed
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

    const playbackRate = this.videoPlaybackRate * this.engine.speed * composition.speed;

    if (this.video.playbackRate !== playbackRate) {
      this.video.playbackRate = playbackRate;
    }
  }

  /**
   * 当前 item 可播放的本地视频时间。
   * item.time 在 delay 前为负数，视频时间需要从 0 开始。
   */
  private getItemSeekTime (): number {
    return Math.max(0, this.getItemLocalTime());
  }

  /**
   * 获取 item 的本地时间。优先使用 timeline 写入的 item.time，
   * 未写入时使用合成时间和 item delay 做兜底。
   */
  private getItemLocalTime (): number {
    if (this.item.time >= 0) {
      return this.item.time;
    }

    const composition = this.item.composition;

    if (!composition) {
      return this.item.time;
    }

    return composition.time - (this.item.definition.delay ?? 0);
  }

  /**
   * 将 seek 目标限制到视频有效时间范围内。
   */
  private getClampedSeekTime (time: number): number {
    const seekTime = Math.max(0, time);
    const duration = this.video?.duration;

    if (!duration || !isFinite(duration)) {
      return seekTime;
    }

    return Math.min(seekTime, duration);
  }

  /**
   * 组件重新启用时将视频时间对齐到 item 本地时间，但不直接触发播放。
   */
  private syncVideoToItemTime (): void {
    if (!this.video || this.preparingReplayFrame || this.canPreserveNativeLoop() || this.canReusePreparedFrame()) {
      return;
    }
    if (this.lastVideoTime > 0 && this.canWaitForNativeHead() && this.prepareReplayFrame()) {
      return;
    }

    const seekTime = this.getItemSeekTime();
    const clampedSeekTime = this.getClampedSeekTime(seekTime);

    if (Math.abs(this.video.currentTime - clampedSeekTime) > VideoComponent.seekTolerance) {
      this.pendingSeekTime = clampedSeekTime;
    }
  }

  /**
   * 合成处于播放状态，item 已进入自己的时间区间，且视频允许自动播放。
   */
  private canPlayCurrentItem (): boolean {
    if (!this.video || !this.isVideoActive || this.item.composition?.getPaused() || this.getItemLocalTime() < 0) {
      return false;
    }

    if (this.manualPause || this.videoDestroyed || this.videoSeeking || this.pendingSeekTime !== null) {
      return false;
    }

    return !this.checkVideoEnded();
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
   * @param loop 是否循环播放
   */
  setLoop (loop: boolean) {
    if (!loop && this.preparingReplayFrame) {
      this.cancelVideoSeek();
      this.videoSeeking = false;
      this.pauseVideoElement();
    }
    this.manualLoop = true;
    if (this.initialVideoSettings) {
      this.initialVideoSettings.loop = loop;
    }
    if (this.video) {
      this.video.loop = loop;
      this.ensureLoopFlag();
    }
  }

  /**
   * 重置循环播放为合成自动控制模式
   */
  resetLoop () {
    this.manualLoop = false;
    if (this.initialVideoSettings) {
      this.initialVideoSettings.loop = undefined;
    }
    this.ensureLoopFlag();
  }

  /**
   * 设置视频是否静音
   * @param muted 是否静音
   */
  setMuted (muted: boolean) {
    if (this.initialVideoSettings) {
      this.initialVideoSettings.muted = muted;
    }
    if (this.preparingReplayFrame) {
      this.replayMuted = muted;

      return;
    }
    if (this.video && this.video.muted !== muted) {
      this.video.muted = muted;
    }
  }

  /**
   * 设置视频音量
   * @param volume 视频音量
   */
  setVolume (volume: number) {
    if (this.initialVideoSettings) {
      this.initialVideoSettings.volume = volume;
    }
    if (this.video && this.video.volume !== volume) {
      this.video.volume = volume;
    }
  }

  /**
   * 设置当前视频是否为透明视频
   * @param transparent 是否为透明视频
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
   * @param rate 视频播放速率
   */
  setPlaybackRate (rate: number) {
    this.manualPlaybackRate = true;
    if (this.initialVideoSettings) {
      this.initialVideoSettings.playbackRate = rate;
    }
    if (this.video && this.video.playbackRate !== rate) {
      this.video.playbackRate = rate;
    }
  }

  /**
   * 重置播放速率为合成自动控制模式
   */
  resetPlaybackRate () {
    this.manualPlaybackRate = false;
    if (this.initialVideoSettings) {
      this.initialVideoSettings.playbackRate = undefined;
    }
  }

  /**
   * 播放视频，同时取消手动暂停状态
   * @since 2.3.0
   */
  playVideo (): void {
    this.manualPause = false;
    this.startVideo();
  }

  /**
   * 手动暂停视频
   * @since 2.3.0
   */
  pauseVideo (): void {
    this.manualPause = true;
    this.pauseVideoElement();
  }
}
