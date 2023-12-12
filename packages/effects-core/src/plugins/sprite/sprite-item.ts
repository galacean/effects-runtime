import type { Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import type { vec2, vec4, TypedArray, TextureSheetAnimation } from '@galacean/effects-specification';
import type { FilterDefine } from '../../filter';
import type { ValueGetter } from '../../math';
import { vecFill, vecMulCombine, convertAnchor, createValueGetter } from '../../math';
import type { GeometryFromShape } from '../../shape';
import type { Texture } from '../../texture';
import { colorStopsFromGradient, getColorFromGradientStops } from '../../utils';
import type { CalculateItemOptions } from '../cal/calculate-item';
import { CalculateItem } from '../cal/calculate-item';
import type { SpriteMesh, SpriteRenderData } from './sprite-mesh';
import { getImageItemRenderInfo } from './sprite-mesh';
import type { SpriteVFXItem } from './sprite-vfx-item';

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
  filter?: {
    feather: number | spec.FunctionExpression,
  } & Omit<spec.FilterParams, 'feather'>,
}

/**
 * 图层元素基础属性, 经过处理后的 spec.SpriteContent.options
 */
export type SpriteItemOptions = {
  startColor: vec4,
  renderLevel?: string,
} & CalculateItemOptions;

/**
 * 图层元素渲染属性, 经过处理后的 spec.SpriteContent.renderer
 */
export interface SpriteItemRenderer extends Required<Omit<spec.RendererOptions, 'texture' | 'shape' | 'anchor' | 'particleOrigin'>> {
  order: number,
  mask: number,
  texture: Texture,
  shape?: GeometryFromShape,
  anchor?: vec2,
  particleOrigin?: spec.ParticleOrigin,
}

/**
 * 图层的渲染属性，用于 Mesh 的合并判断
 */
export interface SpriteItemRenderInfo {
  side: number,
  occlusion: boolean,
  blending: number,
  cachePrefix: string,
  mask: number,
  maskMode: number,
  cacheId: string,
  filter?: FilterDefine,
  wireframe?: boolean,
}

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

const singleSplits: splitsDataType = [[0, 0, 1, 1, undefined]];
const tempColor: vec4 = [1, 1, 1, 1];

export class SpriteItem extends CalculateItem {
  override options: SpriteItemOptions;
  renderer: SpriteItemRenderer;
  interaction?;
  listIndex: number;
  parentId?: string;
  reusable: boolean;
  cachePrefix: string;
  geoData: { aPoint: number[] | TypedArray, index: number[] | TypedArray };
  mesh?: SpriteMesh;
  anchor?: vec2;

  readonly feather?: ValueGetter<number>;
  readonly textureSheetAnimation?: TextureSheetAnimation;
  readonly splits: splitsDataType;
  readonly startColor: vec4 = [1, 1, 1, 1];
  readonly emptyTexture: Texture;

  private customColor: vec4;
  private customOpacity: number;
  private _filter?: FilterDefine;
  /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
  // override colorOverLifetime: { stop: number, color: any }[];
  // override opacityOverLifetime: ValueGetter<number>;
  /***********************/
  private readonly colorOverLifetime: { stop: number, color: any }[];
  private readonly opacityOverLifetime: ValueGetter<number>;
  private readonly _renderInfo: SpriteItemRenderInfo;

  constructor (
    props: SpriteItemProps,
    opts: {
      emptyTexture: Texture,
    },
    vfxItem: SpriteVFXItem,
  ) {
    super(props, vfxItem);
    const { interaction, renderer, options, listIndex = 0 } = props;
    const { emptyTexture } = opts;
    const { transform } = vfxItem;
    const scale = transform.scale;

    this.options = {
      ...this.options,
      startColor: options.startColor || [1, 1, 1, 1],
    };

    this.interaction = interaction;
    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: this.initTexture(renderer.texture, emptyTexture),
      occlusion: !!(renderer.occlusion),
      transparentOcclusion: !!(renderer.transparentOcclusion) || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      shape: renderer.shape,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

    const realAnchor = convertAnchor(renderer.anchor, renderer.particleOrigin);

    // 兼容旧JSON（anchor和particleOrigin可能同时存在）
    if (!renderer.anchor && renderer.particleOrigin !== undefined) {
      this.basicTransform.position.add([-realAnchor[0] * scale.x, -realAnchor[1] * scale.y, 0]);
    }
    this.transform.setAnchor(realAnchor[0] * scale.x, realAnchor[1] * scale.y, 0);

    const colorOverLifetime = props.colorOverLifetime;

    if (colorOverLifetime) {
      this.opacityOverLifetime = createValueGetter(colorOverLifetime.opacity ?? 1);
      if (colorOverLifetime.color && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR) {
        this.colorOverLifetime = colorStopsFromGradient(colorOverLifetime.color[1]);
      }
    }

    if (props.filter?.feather && props.filter?.feather !== 1) {
      this.feather = createValueGetter(props.filter.feather);
    }

    this.emptyTexture = emptyTexture;
    this.splits = props.splits || singleSplits;
    this.listIndex = vfxItem.listIndex || 0;
    this.textureSheetAnimation = props.textureSheetAnimation;
    this.cachePrefix = '-';
    this.parentId = vfxItem.parentId;
    this.reusable = vfxItem.reusable;
    this._renderInfo = getImageItemRenderInfo(this);
  }

  get filter () {
    return this._filter;
  }

  set filter (f: FilterDefine | undefined) {
    this._filter = f;
    this._renderInfo.filter = f;
  }

  get renderInfo () {
    return this._renderInfo;
  }

  initTexture (texture: Texture, emptyTexture: Texture) {
    const tex = texture ?? emptyTexture;

    return tex;
  }

  getTextures (): Texture[] {
    const ret = [];
    const tex = this.renderer.texture;

    if (tex) {
      ret.push(tex);
    }

    return ret;
  }

  /**
   * @internal
   */
  setColor (r: number, g: number, b: number, a: number) {
    this.customColor = [r, g, b, a];
  }

  setOpacity (opacity: number) {
    this.customOpacity = opacity;
  }

  /**
   * @internal
   */
  getCustomOpacity () {
    return this.customOpacity;
  }

  override getRenderData (_time: number, init?: boolean): SpriteRenderData {
    const ret = super.getRenderData(_time, init);
    let colorInc = vecFill(tempColor, 1);
    let colorChanged;
    const time = _time < 0 ? _time : Math.max(_time, 0.);
    const duration = this.options.duration;
    const life = time / duration < 0 ? 0 : (time / duration > 1 ? 1 : time / duration);

    if (this.customColor) {
      ret.color = this.customColor;
    } else {
      const opacityOverLifetime = this.opacityOverLifetime;
      const colorOverLifetime = this.colorOverLifetime;

      if (colorOverLifetime) {
        colorInc = getColorFromGradientStops(colorOverLifetime, life, true) as vec4;
        colorChanged = true;
      }
      if (opacityOverLifetime) {
        colorInc[3] *= opacityOverLifetime.getValue(life);
        colorChanged = true;
      }

      if (colorChanged || init) {
        ret.color = vecMulCombine<vec4>(this.startColor, colorInc, this.options.startColor);
      }
    }

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
      ret.texOffset = [
        texRectX + texOffset[0],
        texRectH + texRectY - texOffset[1],
        dx, dy,
      ];

    } else if (init) {
      ret.texOffset = [0, 0, 1, 1];
    }
    ret.visible = this.vfxItem.contentVisible;
    // 图层元素作为父节点时，除了k的大小变换，自身的尺寸也需要传递给子元素，子元素可以通过startSize读取
    ret.startSize = this.startSize;

    return ret;
  }

  protected override calculateScaling (sizeChanged: boolean, sizeInc: Vector3, init?: boolean) {
    if (sizeChanged || init) {
      this.transform.setScale(sizeInc.x, sizeInc.y, sizeInc.z);
    }
  }

}
