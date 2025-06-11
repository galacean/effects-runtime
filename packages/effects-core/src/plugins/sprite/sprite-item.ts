import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import { BaseRenderComponent } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { TextureSourceType, type Texture2DSourceOptionsVideo } from '../../texture';
import type { Playable, PlayableGraph } from '../cal/playable-graph';
import { PlayableAsset } from '../cal/playable-graph';

/**
 * 图层元素基础属性, 经过处理后的 spec.SpriteContent.options
 */
export type SpriteItemOptions = {
  startColor: spec.vec4,
  renderLevel?: spec.RenderLevel,
};

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

let seed = 0;

@effectsClass(spec.DataType.SpriteColorPlayableAsset)
export class SpriteColorPlayableAsset extends PlayableAsset {
  data: ColorPlayableAssetData;

  override createPlayable (graph: PlayableGraph): Playable {
    const spriteColorPlayable = new ColorPlayable(graph);

    spriteColorPlayable.create(this.data);

    return spriteColorPlayable;
  }

  override fromData (data: ColorPlayableAssetData): void {
    this.data = data;
  }
}

@effectsClass(spec.DataType.SpriteComponent)
export class SpriteComponent extends BaseRenderComponent {
  frameAnimationLoop = false;

  constructor (engine: Engine, props?: spec.SpriteComponentData) {
    super(engine);

    this.name = 'MSprite' + seed++;
    if (props) {
      this.fromData(props);
    }
  }

  override onUpdate (dt: number): void {
    let time = this.item.time;
    const duration = this.item.duration;

    if (time > duration && this.frameAnimationLoop) {
      time = time % duration;
    }
    const life = Math.min(Math.max(time / duration, 0.0), 1.0);
    const ta = this.textureSheetAnimation;
    const { video } = this.renderer.texture.source as Texture2DSourceOptionsVideo;

    if (video) {

      if (time === 0) {
        video.pause();
      } else {
        video.play().catch(e => { this.engine.renderErrors.add(e); });
      }
    }
    if (ta) {
      const total = ta.total || (ta.row * ta.col);
      let texRectX = 0;
      let texRectY = 0;
      let texRectW = 1;
      let texRectH = 1;
      let flip;

      if (this.splits) {
        const sp = this.splits[0];

        flip = sp[4];
        texRectX = sp[0];
        texRectY = sp[1];
        if (flip) {
          texRectW = sp[3];
          texRectH = sp[2];
        } else {
          texRectW = sp[2];
          texRectH = sp[3];
        }
      }
      let dx, dy;

      if (flip) {
        dx = 1 / ta.row * texRectW;
        dy = 1 / ta.col * texRectH;
      } else {
        dx = 1 / ta.col * texRectW;
        dy = 1 / ta.row * texRectH;
      }
      let texOffset;

      if (ta.animate) {
        const frameIndex = Math.round(life * (total - 1));
        const yIndex = Math.floor(frameIndex / ta.col);
        const xIndex = frameIndex - yIndex * ta.col;

        texOffset = flip ? [dx * yIndex, dy * (ta.col - xIndex)] : [dx * xIndex, dy * (1 + yIndex)];
      } else {
        texOffset = [0, dy];
      }
      this.material.getVector4('_TexOffset')?.setFromArray([
        texRectX + texOffset[0],
        texRectH + texRectY - texOffset[1],
        dx, dy,
      ]);
    }
  }

  override onDestroy (): void {
    const texture = this.renderer.texture;
    const source = texture.source;

    if (source.sourceType === TextureSourceType.video && source?.video) {
      source.video.pause();
      source.video.src = '';
      source.video.load();
    }
  }

  override fromData (data: spec.SpriteComponentData): void {
    super.fromData(data);

    const { interaction, options } = data;

    this.interaction = interaction;

    const startColor = options.startColor || [1, 1, 1, 1];

    this.material.setColor('_Color', new Color().setFromArray(startColor));
  }
}
