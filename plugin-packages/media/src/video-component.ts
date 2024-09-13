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

  override onStart (): void {
    super.onStart();
  }

  override fromData (data: VideoItemProps): void {
    super.fromData(data);

    const { interaction, options, listIndex = 0 } = data;
    const { video, startColor = [1, 1, 1, 1], playbackRate = 1, volume = 1 } = options;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }

    this.video = (video as unknown as VideoAssets).data;
    this.setPlaybackRate(playbackRate);
    this.setVolume(volume);
    const endBehavior = this.item.endBehavior;

    // 如果元素设置为 destroy
    if (endBehavior === spec.EndBehavior.destroy) {
      this.video.loop = false;
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

    if (Math.abs(time - duration) <= 0.01) {

      if (endBehavior === spec.EndBehavior.freeze) {

        this.setPlaybackRate(0);
      } else if (endBehavior === spec.EndBehavior.restart) {
        this.setVisible(false);
        // 重播
        this.pauseVideo();
        this.setCurrentTime(0);
      }
    }
  }

  getDuration (): number {
    return this.video ? this.video.duration : 0;
  }

  getCurrentTime (): number {
    return this.video ? this.video.currentTime : 0;
  }

  setCurrentTime (time: number) {
    if (this.video) {
      this.pauseVideo();
      this.video.currentTime = time;
      setTimeout(() => {
        this.playVideo();
      }, 100);
    }
  }

  setLoop (loop: boolean) {
    if (this.video) {
      this.video.loop = loop;
    }
  }

  setMuted (muted: boolean) {
    const { video } = this;

    if (video && video.muted !== muted) {

      video.muted = muted;
    }
  }

  setVolume (volume: number) {
    const { video } = this;

    if (video && video.volume !== volume) {
      video.volume = volume;
    }
  }

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
