import { Color } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import { BaseRenderComponent } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { MaskProps } from '../../material';
import type { Geometry } from '../../render';
import { type GeometryFromShape } from '../../shape';
import { TextureSourceType, type Texture, type Texture2DSourceOptionsVideo } from '../../texture';
import type { Playable, PlayableGraph } from '../cal/playable-graph';
import { PlayableAsset } from '../cal/playable-graph';

/**
 * 用于创建 spriteItem 的数据类型, 经过处理后的 spec.SpriteContent
 */
export interface SpriteItemProps extends Omit<spec.SpriteContent, 'renderer' | 'mask'>, MaskProps {
  listIndex?: number,
  renderer: {
    shape: GeometryFromShape,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

/**
 * 图层元素基础属性, 经过处理后的 spec.SpriteContent.options
 */
export type SpriteItemOptions = {
  startColor: spec.vec4,
  renderLevel?: spec.RenderLevel,
};

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

const singleSplits: splitsDataType = [[0, 0, 1, 1, undefined]];

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
  textureSheetAnimation?: spec.TextureSheetAnimation;
  splits: splitsDataType = singleSplits;
  frameAnimationLoop = false;

  constructor (engine: Engine, props?: SpriteItemProps) {
    super(engine);

    this.name = 'MSprite' + seed++;
    this.geometry = this.createGeometry();
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

  override getItemGeometryData (geometry: Geometry) {
    const { splits, textureSheetAnimation } = this;
    const sx = 1, sy = 1;
    const renderer = this.renderer;

    if (renderer.shape) {
      const { index = [], aPoint = [] } = renderer.shape;
      const point = new Float32Array(aPoint);
      const position = [];

      const atlasOffset = [];

      for (let i = 0; i < point.length; i += 6) {
        point[i] *= sx;
        point[i + 1] *= sy;
        atlasOffset.push(aPoint[i + 2], aPoint[i + 3]);
        position.push(point[i], point[i + 1], 0.0);
      }
      geometry.setAttributeData('aPos', new Float32Array(position));

      return {
        index: index as number[],
        atlasOffset,
      };
    }

    const originData = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
    const atlasOffset = [];
    const index = [];
    let col = 2;
    let row = 2;

    if (splits.length === 1) {
      col = 1;
      row = 1;
    }
    const position = [];

    for (let x = 0; x < col; x++) {
      for (let y = 0; y < row; y++) {
        const base = (y * 2 + x) * 4;
        // @ts-expect-error
        const split: number[] = textureSheetAnimation ? [0, 0, 1, 1, splits[0][4]] : splits[y * 2 + x];
        const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
        const dw = ((x + x + 1) / col - 1) / 2;
        const dh = ((y + y + 1) / row - 1) / 2;
        const tox = split[0];
        const toy = split[1];
        const tsx = split[4] ? split[3] : split[2];
        const tsy = split[4] ? split[2] : split[3];
        const origin = [
          originData[0] / col + dw,
          originData[1] / row + dh,
          originData[2] / col + dw,
          originData[3] / row + dh,
          originData[4] / col + dw,
          originData[5] / row + dh,
          originData[6] / col + dw,
          originData[7] / row + dh,
        ];

        atlasOffset.push(
          texOffset[0] * tsx + tox, texOffset[1] * tsy + toy,
          texOffset[2] * tsx + tox, texOffset[3] * tsy + toy,
          texOffset[4] * tsx + tox, texOffset[5] * tsy + toy,
          texOffset[6] * tsx + tox, texOffset[7] * tsy + toy,
        );
        position.push((origin[0]) * sx, (origin[1]) * sy, 0.0,
          (origin[2]) * sx, (origin[3]) * sy, 0.0,
          (origin[4]) * sx, (origin[5]) * sy, 0.0,
          (origin[6]) * sx, (origin[7]) * sy, 0.0);
        index.push(base, 1 + base, 2 + base, 2 + base, 1 + base, 3 + base);
      }
    }
    geometry.setAttributeData('aPos', new Float32Array(position));

    return { index, atlasOffset };
  }

  override fromData (data: SpriteItemProps): void {
    super.fromData(data);

    const { interaction, options } = data;

    this.interaction = interaction;
    this.splits = data.splits || singleSplits;
    this.textureSheetAnimation = data.textureSheetAnimation;

    const geometry = this.createGeometry();

    this.geometry = geometry;
    const startColor = options.startColor || [1, 1, 1, 1];

    this.material.setColor('_Color', new Color().setFromArray(startColor));
  }
}
