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
  private threshold = 0.03;
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

  // 事件处理器引用，用于正确移除事件监听
  private handleGoto?: (option: { time: number }) => void;
  private handlePause?: () => void;
  private handlePlay?: (option: { time: number }) => void;

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

    const composition = this.item.composition;

    if (!composition) {
      return;
    }

    this.handleGoto = (option: { time: number }) => {
      this.setCurrentTime(this.item.time);
    };
    this.handlePause = () => {
      this.pauseVideo();
    };
    this.handlePlay = (option: { time: number }) => {
      if (this.item.time < 0) {return;}
      this.playVideo();
    };

    composition.on('goto', this.handleGoto);
    composition.on('pause', this.handlePause);
    composition.on('play', this.handlePlay);
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
    const { time: videoTime, duration: videoDuration, endBehavior: videoEndBehavior, composition } = this.item;

    assertExist(composition);
    const { endBehavior: rootEndBehavior, duration: rootDuration } = composition.rootItem;

    // 判断是否处于"结束状态"：
    // - 视频时间为 0（未开始）
    // - 合成时间已达最大时长（播放完毕）
    // - 视频时间接近或等于其总时长（考虑容差阈值）
    const isEnd = (videoTime === 0 || composition.time === rootDuration || Math.abs(videoTime - videoDuration) <= this.threshold);

    // 如果视频时间大于等于 0，且未到结束状态，并且尚未触发播放，则开始播放视频
    if (videoTime >= 0 && !isEnd && !this.played && this.isVideoActive) {
      this.playVideo();
    }

    // 当视频播放时间接近或超过其总时长时，根据其结束行为进行处理
    if (videoTime + this.threshold >= videoDuration) {
      if (videoEndBehavior === spec.EndBehavior.freeze) {
        if (!this.video?.paused) {
          this.pauseVideo();
        }
      }
    }
    // 判断整个合成是否接近播放完成
    // composition.time + threshold >= rootDuration 表示即将结束
    if (composition.time + this.threshold >= rootDuration) {
      if (rootEndBehavior === spec.EndBehavior.freeze) {
        if (!this.video?.paused) {
          this.pauseVideo();
        }
      } else if (rootEndBehavior === spec.EndBehavior.restart) {
        this.setCurrentTime(0);
      }
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
  playVideo (): void {
    if (this.played) {
      return;
    }
    if (this.video) {
      this.played = true;
      this.isPlayLoading = true;
      this.pendingPause = false;
      this.video.play().
        then(() => {
          this.isPlayLoading = false;
          // 如果在 play pending 期间被请求了 pause，则立即暂停并复位 played
          if (!this.played || this.pendingPause) {
            this.pendingPause = false;
            this.played = false;
            this.video?.pause();
          }
        })
        .catch(error => {
          // 复位状态
          this.isPlayLoading = false;
          this.played = false;
          this.pendingPause = false;
          if (error.name !== 'AbortError') { this.engine.renderErrors.add(error); }
        });
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

    // 清理播放状态
    this.played = false;
    this.isPlayLoading = false;
    this.pendingPause = false;
    this.isVideoActive = false;

    // 清理video资源
    if (this.video) {
      // 暂停视频
      this.video.pause();

      // 移除video源，帮助垃圾回收
      this.video.removeAttribute('src');
      this.video.load();

      // 清理video引用
      this.video = undefined;
    }

    // 清理事件监听
    const composition = this.item?.composition;

    if (composition) {
      if (this.handleGoto) {
        composition.off('goto', this.handleGoto);
      }
      if (this.handlePause) {
        composition.off('pause', this.handlePause);
      }
      if (this.handlePlay) {
        composition.off('play', this.handlePlay);
      }
    }
    // 清理处理器引用
    this.handleGoto = undefined;
    this.handlePause = undefined;
    this.handlePlay = undefined;
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
    this.playVideo();
  }
}
