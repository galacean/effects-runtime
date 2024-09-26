import type { Texture, Engine, VideoAssets, Texture2DSourceOptionsVideo } from '@galacean/effects-core';
import { spec, math, BaseRenderComponent, effectsClass, glContext } from '@galacean/effects-core';
/**
 * 用于创建 videoItem 的数据类型, 经过处理后的 spec.VideoContent
 */
export interface VideoItemProps extends Omit<spec.VideoComponentData, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

let seed = 0;

@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends BaseRenderComponent {

  video?: HTMLVideoElement;

  private threshold = 0.03;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MVideo' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
  }

  override setTexture (texture: Texture): void {
    const oldTexture = this.renderer.texture;

    const composition = this.item.composition;

    if (!composition) { return; }

    composition.textures.forEach((cachedTexture, index) => {
      if (cachedTexture === oldTexture) {
        this.item.composition!.textures[index] = texture;
      }
    });
    this.engine.removeTexture(oldTexture);
    this.renderer.texture = texture;
    this.material.setTexture('uSampler0', texture);
    this.video = (texture.source as Texture2DSourceOptionsVideo).video;
  }

  override fromData (data: VideoItemProps): void {
    super.fromData(data);
    const { interaction, options, listIndex = 0 } = data;
    const { video, startColor = [1, 1, 1, 1], playbackRate = 1, volume = 1, muted = false } = options;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }
    this.video = (video as unknown as VideoAssets).data;
    this.setPlaybackRate(playbackRate);
    this.setVolume(volume);
    this.setMuted(muted);
    const endBehavior = this.item.endBehavior;

    // 如果元素设置为 destroy
    if (endBehavior === spec.EndBehavior.destroy) {
      this.setLoop(false);
    }

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!(renderer.occlusion),
      transparentOcclusion: !!(renderer.transparentOcclusion) || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

    this.interaction = interaction;
    this.pauseVideo();

    this.setItem();

    this.material.setVector4('_Color', new math.Vector4().setFromArray(startColor));
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    const { time, duration, endBehavior } = this.item;

    if (time > 0) {
      this.setVisible(true);
      this.playVideo();
    }

    if (time === 0 && this.item.composition?.rootItem.endBehavior === spec.EndBehavior.freeze) {
      this.pauseVideo();
      this.setCurrentTime(0);
    }
    if (Math.abs(time - duration) < this.threshold) {
      if (endBehavior === spec.EndBehavior.freeze) {
        this.pauseVideo();
      } else if (endBehavior === spec.EndBehavior.restart) {
        this.setVisible(false);
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
   * 设置阈值（由于视频是单独的 update， 有时并不能完全对其 GE 的 update）
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
    const { video } = this;

    if (video && video.muted !== muted) {

      video.muted = muted;
    }
  }

  /**
   * 设置视频音量
   * @param volume 视频音量
   */
  setVolume (volume: number) {
    const { video } = this;

    if (video && video.volume !== volume) {
      video.volume = volume;
    }
  }

  /**
   * 设置视频播放速率
   * @param rate 视频播放速率
   */
  setPlaybackRate (rate: number) {
    const { video } = this;

    if (!video || video.playbackRate === rate) {
      return;
    }
    video.playbackRate = rate;
  }

  private playVideo (): void {
    if (this.video) {
      this.video.play().catch(error => {
        this.engine.renderErrors.add(error);
      });
    }
  }

  private pauseVideo (): void {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  override onDisable (): void {
    super.onDisable();

    this.setCurrentTime(0);
    this.video?.pause();
  }

  override onEnable (): void {
    super.onEnable();

    this.playVideo();
  }
}
