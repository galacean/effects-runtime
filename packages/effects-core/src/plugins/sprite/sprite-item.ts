import { Matrix4, Vector4 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { GeometryDrawMode } from '../../render';
import { Geometry } from '../../render';
import type { GeometryFromShape } from '../../shape';
import type { Texture, Texture2DSourceOptionsVideo } from '../../texture';
import type { PlayableGraph, Playable } from '../cal/playable-graph';
import { PlayableAsset } from '../cal/playable-graph';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import type { ItemRenderer } from '../../components';
import { BaseRenderComponent, getImageItemRenderInfo } from '../../components/base-render-component';

/**
 * 用于创建 spriteItem 的数据类型, 经过处理后的 spec.SpriteContent
 */
export interface SpriteItemProps extends Omit<spec.SpriteContent, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
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

/**
 * 图层元素渲染属性, 经过处理后的 spec.SpriteContent.renderer
 */
export interface SpriteItemRenderer extends ItemRenderer {
  shape?: GeometryFromShape,
}

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

const singleSplits: splitsDataType = [[0, 0, 1, 1, undefined]];

let seed = 0;

@effectsClass('SpriteColorPlayableAsset')
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

  /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
  // override colorOverLifetime: { stop: number, color: any }[];
  // override opacityOverLifetime: ValueGetter<number>;

  constructor (engine: Engine, props?: SpriteItemProps) {
    super(engine);

    this.name = 'MSprite' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
    this.setItem();
    if (props) {
      this.fromData(props);
    }
  }

  override onUpdate (dt: number): void {
    if (!this.isManualTimeSet) {
      this.frameAnimationTime += dt / 1000;
      this.isManualTimeSet = false;
    }
    let time = this.frameAnimationTime;
    const duration = this.item.duration;

    if (time > duration && this.frameAnimationLoop) {
      time = time % duration;
    }
    const life = Math.min(Math.max(time / duration, 0.0), 1.0);
    const ta = this.textureSheetAnimation;

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
    const { video } = this.renderer.texture.source as Texture2DSourceOptionsVideo;

    if (video?.paused) {
      video.play().catch(e => { this.engine.renderErrors.add(e); });
    }
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.item.composition.destroyTextures(this.getTextures());
    }
  }

  override createGeometry (mode: GeometryDrawMode) {
    const maxVertex = 12 * this.splits.length;

    return Geometry.create(this.engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array([
            -0.5, 0.5, 0, //左上
            -0.5, -0.5, 0, //左下
            0.5, 0.5, 0, //右上
            0.5, -0.5, 0, //右下
          ]),
        },
        atlasOffset: {
          size: 2,
          offset: 0,
          releasable: true,
          type: glContext.FLOAT,
          data: new Float32Array(0),
        },
      },
      indices: { data: new Uint16Array(0), releasable: true },
      mode,
      maxVertex,
    });

  }

  override getItemGeometryData () {
    const { splits, textureSheetAnimation } = this;
    const sx = 1, sy = 1;
    const renderer = this.renderer as SpriteItemRenderer;

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
      this.geometry.setAttributeData('aPos', new Float32Array(position));

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
    this.geometry.setAttributeData('aPos', new Float32Array(position));

    return { index, atlasOffset };
  }

  override fromData (data: SpriteItemProps): void {
    super.fromData(data);

    const { interaction, options, listIndex = 0 } = data;
    let renderer = data.renderer;

    if (!renderer) {
      renderer = {} as SpriteItemProps['renderer'];
    }

    this.interaction = interaction;
    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      shape: renderer.shape,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    } as SpriteItemRenderer;

    this.emptyTexture = this.engine.emptyTexture;
    this.splits = data.splits || singleSplits;
    this.textureSheetAnimation = data.textureSheetAnimation;
    this.cachePrefix = '-';
    this.renderInfo = getImageItemRenderInfo(this);

    const geometry = this.createGeometry(glContext.TRIANGLES);
    const material = this.createMaterial(this.renderInfo, 2);

    this.worldMatrix = Matrix4.fromIdentity();
    this.material = material;
    this.geometry = geometry;
    const startColor = options.startColor || [1, 1, 1, 1];

    this.material.setVector4('_Color', new Vector4().setFromArray(startColor));
    this.material.setVector4('_TexOffset', new Vector4().setFromArray([0, 0, 1, 1]));
    this.setItem();
  }
}
