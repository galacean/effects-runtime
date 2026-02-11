import type { Asset, Engine, GeometryFromShape, Renderer, Texture2DSourceOptionsVideo } from '@galacean/effects';
import { MaskableGraphic, Texture, assertExist, effectsClass, math, spec } from '@galacean/effects';

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

/** 时间容差阈值（秒）*/
const TIME_THRESHOLD = 0.03;

/**
 * Video component class
 */
@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends MaskableGraphic {
  video?: HTMLVideoElement;

  /**
   * 播放标志位
   */
  private played = false;
  private pendingPause = false;
  /**
   * 解决 video 暂停报错问题
   *
   * video.play(); // <-- This is asynchronous!
   *
   * video.pause();
   *
   * @see https://developer.chrome.com/blog/play-request-was-interrupted
   */
  private isPlayLoading = false;

  /**
   * 视频元素是否激活
   */
  isVideoActive = false;

  /**
   * 是否为透明视频
   */
  protected transparent = false;

  /**
   * 事件处理函数引用，用于解绑
   */
  private gotoHandler?: (option: { time: number }) => void;
  private pauseHandler?: () => void;
  private playHandler?: (option: { time: number }) => void;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MVideo' + seed++;
  }

  override setTexture (input: Texture): void;
  override async setTexture (input: string): Promise<void>;
  override async setTexture (input: Texture | string): Promise<void> {
    const oldTexture = this.renderer.texture;
    const composition = this.item.composition;
    let texture: Texture;

    if (typeof input === 'string') {
      texture = await Texture.fromVideo(input, this.item.engine);
    } else {
      texture = input;
    }

    if (!composition) { return; }

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

    this.gotoHandler = () => {
      this.setCurrentTime(this.item.time);
    };
    this.pauseHandler = () => {
      this.pauseVideo();
    };
    this.playHandler = () => {
      if (this.item.time < 0) { return; }
      void this.playVideo();
    };

    this.item.composition?.on('goto', this.gotoHandler);
    this.item.composition?.on('pause', this.pauseHandler);
    this.item.composition?.on('play', this.playHandler);
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
        this.setPlaybackRate(playbackRate);
        this.setVolume(volume);
        this.setMuted(muted);
        const endBehavior = this.item.defination.endBehavior;

        // 如果元素设置为 destroy
        if (endBehavior === spec.EndBehavior.destroy || endBehavior === spec.EndBehavior.freeze) {
          this.setLoop(false);
        } else if (endBehavior === spec.EndBehavior.restart) {
          this.setLoop(true);
        }
      }
    }

    this.interaction = interaction;
    this.pauseVideo();

    if (this.transparent) {
      this.material.enableMacro('TRANSPARENT_VIDEO', this.transparent);
    }

    this.material.setColor('_Color', new math.Color().setFromArray(startColor));
  }

  override render (renderer: Renderer): void {
    super.render(renderer);
    this.renderer.texture.uploadCurrentVideoFrame();
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    const { time: videoTime, duration: videoDuration, composition } = this.item;

    assertExist(composition);

    this.tryStartPlaying(videoTime, videoDuration, composition);
    this.handleVideoEndBehavior(videoTime, videoDuration);
    this.handleCompositionEndBehavior(composition);
  }

  /**
   * 尝试开始播放视频
   */
  private tryStartPlaying (
    videoTime: number,
    videoDuration: number,
    composition: NonNullable<typeof this.item.composition>,
  ): void {
    const { duration: rootDuration } = composition.rootItem;

    // 判断是否处于"结束状态"：
    // - 视频时间为 0（未开始）
    // - 合成时间已达最大时长（播放完毕）
    // - 视频时间接近或等于其总时长（考虑容差阈值）
    const isEnd = videoTime === 0 ||
      composition.time === rootDuration ||
      Math.abs(videoTime - videoDuration) <= TIME_THRESHOLD;

    // 如果视频时间大于等于 0，且未到结束状态，并且尚未触发播放，则开始播放视频
    if (videoTime >= 0 && !isEnd && !this.played && this.isVideoActive) {
      void this.playVideo();
    }
  }

  /**
   * 处理视频元素的结束行为
   */
  private handleVideoEndBehavior (videoTime: number, videoDuration: number): void {
    const { endBehavior: videoEndBehavior } = this.item;

    // 当视频播放时间接近或超过其总时长时，根据其结束行为进行处理
    if (videoTime + TIME_THRESHOLD >= videoDuration) {
      if (videoEndBehavior === spec.EndBehavior.freeze && !this.video?.paused) {
        this.pauseVideo();
      }
    }
  }

  /**
   * 处理合成的结束行为
   */
  private handleCompositionEndBehavior (
    composition: NonNullable<typeof this.item.composition>,
  ): void {
    const { endBehavior: rootEndBehavior, duration: rootDuration } = composition.rootItem;

    // 判断整个合成是否接近播放完成
    if (composition.time + TIME_THRESHOLD < rootDuration) {
      return;
    }

    if (rootEndBehavior === spec.EndBehavior.freeze && !this.video?.paused) {
      this.pauseVideo();
    } else if (rootEndBehavior === spec.EndBehavior.restart) {
      this.setCurrentTime(0);
    }
  }
  /**
   * 获取当前视频时长
   * @returns 视频时长
   */
  getDuration (): number {
    return this.video ? this.video.duration : 0;
  }

  /**
   * 获取当前视频播放时刻
   * @returns 当前视频播放时刻
   */
  getCurrentTime (): number {
    return this.video ? this.video.currentTime : 0;
  }

  /**
   * 设置当前视频播放时刻
   * @param time 视频播放时刻
   */
  setCurrentTime (time: number) {
    if (this.video) {
      this.video.currentTime = time;
    }
  }

  /**
   * 设置视频是否循环播放
   * @param loop 是否循环播放
   */
  setLoop (loop: boolean) {
    if (this.video) {
      this.video.loop = loop;
    }
  }

  /**
   * 设置视频是否静音
   * @param muted 是否静音
   */
  setMuted (muted: boolean) {
    if (this.video && this.video.muted !== muted) {
      this.video.muted = muted;
    }
  }

  /**
   * 设置视频音量
   * @param volume 视频音量
   */
  setVolume (volume: number) {
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

    this.transparent = transparent;
    if (transparent) {
      this.material.enableMacro('TRANSPARENT_VIDEO', true);
    } else {
      this.material.disableMacro('TRANSPARENT_VIDEO');
    }
  }

  /**
   * 设置视频播放速率
   * @param rate 视频播放速率
   */
  setPlaybackRate (rate: number) {
    if (!this.video || this.video.playbackRate === rate) {
      return;
    }
    this.video.playbackRate = rate;
  }

  /**
   * 播放视频
   * @since 2.3.0
   */
  async playVideo (): Promise<void> {
    if (this.played || !this.video) {
      return;
    }

    this.played = true;
    this.isPlayLoading = true;
    this.pendingPause = false;

    try {
      await this.video.play();
      this.isPlayLoading = false;

      // 如果在 play pending 期间被请求了 pause，则立即暂停并复位 played
      if (!this.played || this.pendingPause) {
        this.pendingPause = false;
        this.played = false;
        this.video?.pause();
      }
    } catch (error) {
      // 复位状态
      this.isPlayLoading = false;
      this.played = false;
      this.pendingPause = false;

      if (error instanceof Error && error.name !== 'AbortError') {
        this.engine.renderErrors.add(error);
      }
    }
  }

  /**
   * 暂停视频
   * @since 2.3.0
   */
  pauseVideo (): void {
    if (this.played) {
      this.played = false;
    }
    if (!this.video) { return; }

    if (this.isPlayLoading) {
      this.pendingPause = true;

      return;
    }
    this.video.pause();
  }

  override onDestroy (): void {
    super.onDestroy();

    // 移除事件监听，避免内存泄漏
    if (this.gotoHandler) {
      this.item.composition?.off('goto', this.gotoHandler);
    }
    if (this.pauseHandler) {
      this.item.composition?.off('pause', this.pauseHandler);
    }
    if (this.playHandler) {
      this.item.composition?.off('play', this.playHandler);
    }

    this.played = false;
    this.isPlayLoading = false;
    this.pendingPause = false;

    // 完整释放视频资源
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
      this.video = undefined;
    }
  }

  override onDisable (): void {
    super.onDisable();

    this.isVideoActive = false;
    this.pauseVideo();
  }

  override onEnable (): void {
    super.onEnable();
    this.isVideoActive = true;
    this.played = false;
    // 重播时确保视频同步到当前时间
    if (this.video && this.item.composition) {
      this.setCurrentTime(this.item.time);
    }
    void this.playVideo();
  }
}
