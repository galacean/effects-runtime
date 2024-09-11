import type { Texture, Engine, VideoAssets } from '@galacean/effects-core';
import { spec, math, BaseRenderComponent, effectsClass, glContext } from '@galacean/effects-core';
/**
 * 用于创建 videoItem 的数据类型, 经过处理后的 spec.VideoContent
 */
export interface VideoItemProps extends Omit<spec.VideoContent, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.VideoRendererOptions, 'texture'>,
}

let seed = 0;

@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends BaseRenderComponent {

  video?: HTMLVideoElement;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MVideo' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
    this.setItem();
  }

  override fromData (data: VideoItemProps): void {
    super.fromData(data);

    const { interaction, options, listIndex = 0 } = data;
    const { video, startColor = [1, 1, 1, 1] } = options;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }

    this.video = (video as VideoAssets).data;
    const endbehavior = this.item.endBehavior;

    // 如果元素设置为 destroy
    if (endbehavior === spec.EndBehavior.destroy) {
      this.video.loop = false;
    }

    this.interaction = interaction;

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

    this.setItem();

    this.material.setVector4('_Color', new math.Vector4().setFromArray(startColor));
  }

  getDuration (): number {
    return this.video ? this.video.duration : 0;
  }

  setLoop (loop: boolean) {
    if (this.video) {
      this.video.loop = loop;
    }
  }

  setMuted (muted: boolean) {
    if (this.video) {
      this.video.muted = muted;
    }
  }

  setVolume (volume: number) {
    if (this.video) {
      this.video.volume = volume;
    }
  }

  setPlaybackRate (rate: number) {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }
}
