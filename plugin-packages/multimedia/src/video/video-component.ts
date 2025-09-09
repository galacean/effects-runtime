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
 *
 */
@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends MaskableGraphic {
  video?: HTMLVideoElement;

  private threshold = 0.03;
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
    this.item.composition?.on('goto', (option: { time: number }) => {
      if (option.time > 0) {
        const { endBehavior, start, duration } = this.item;

        if (endBehavior === spec.EndBehavior.freeze || endBehavior === spec.EndBehavior.restart) {
          this.setCurrentTime((option.time - start) % duration);
        } else {
          if (option.time >= duration) {
            this.onDisable();
          } else {
            this.setCurrentTime(option.time - start);
          }
        }
      }
    });
    this.item.composition?.on('pause', () => {
      this.pauseVideo();
    });
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
    const { time, duration, endBehavior, composition, start } = this.item;

    assertExist(composition);
    const { endBehavior: rootEndBehavior, duration: rootDuration } = composition.rootItem;

    const isEnd = (time === 0 || time === (rootDuration - start) || Math.abs(rootDuration - duration - time) < 1e-10)
      || Math.abs(time - duration) < this.threshold;

    if (time > 0 && !isEnd) {
      this.setVisible(true);
      this.playVideo();
    }

    if ((time === 0 || time === (rootDuration - start) || Math.abs(rootDuration - duration - time) < 1e-10)) {
      if (rootEndBehavior === spec.EndBehavior.freeze) {
        if (!this.video?.paused) {
          this.pauseVideo();
          this.setCurrentTime(time);
        }
      } else {
        this.setCurrentTime(time);
      }
    }
    if (Math.abs(time - duration) < this.threshold) {
      if (endBehavior === spec.EndBehavior.freeze) {
        this.pauseVideo();
      } else if (endBehavior === spec.EndBehavior.restart) {
        // 重播
        this.pauseVideo();
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
   * 设置阈值（由于视频是单独的 update，有时并不能完全对其 GE 的 update）
   * @param threshold 阈值
   */
  setThreshold (threshold: number) {
    this.threshold = threshold;
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
    this.played = false;
    this.isPlayLoading = false;
    this.pendingPause = false;
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
  }

  override onDisable (): void {
    super.onDisable();

    this.isVideoActive = false;
    this.pauseVideo();
    const endBehavior = this.item?.endBehavior;

    if (endBehavior === spec.EndBehavior.restart) {
      this.setCurrentTime(0);
    }

  }

  override onEnable (): void {
    super.onEnable();
    this.isVideoActive = true;
    this.playVideo();
  }
}
