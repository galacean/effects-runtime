import { Matrix4, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { vec2, vec4 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { RendererComponent } from '../../components/renderer-component';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { MaterialProps } from '../../material';
import { Material, getPreMultiAlpha, setBlendMode, setMaskMode, setSideMode } from '../../material';
import type { ValueGetter } from '../../math';
import { createValueGetter, trianglesFromRect, vecFill, vecMulCombine } from '../../math';
import type { GeometryDrawMode, Renderer } from '../../render';
import { Geometry } from '../../render';
import type { GeometryFromShape } from '../../shape';
import type { Texture } from '../../texture';
import { addItem, colorStopsFromGradient, getColorFromGradientStops } from '../../utils';
import type { CalculateItemOptions } from '../cal/calculate-item';
import type { PlayableGraph } from '../cal/playable-graph';
import { Playable, PlayableAsset } from '../cal/playable-graph';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import { getImageItemRenderInfo, maxSpriteMeshItemCount, spriteMeshShaderFromRenderInfo } from './sprite-mesh';

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
  wireframe?: boolean,
}

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

const singleSplits: splitsDataType = [[0, 0, 1, 1, undefined]];
const tempColor: vec4 = [1, 1, 1, 1];

let seed = 0;

export class SpriteColorPlayable extends Playable {
  clipData: { colorOverLifetime?: spec.ColorOverLifetime, startColor?: spec.RGBAColorValue };
  colorOverLifetime: { stop: number, color: any }[];
  opacityOverLifetime: ValueGetter<number>;
  startColor: spec.RGBAColorValue;
  renderColor: vec4 = [1, 1, 1, 1];
  spriteMaterial: Material;

  override onPlayablePlay (): void {
    this.spriteMaterial = this.bindingItem.getComponent(SpriteComponent)!.material;
  }

  override processFrame (dt: number): void {
    let colorInc = vecFill(tempColor, 1);
    let colorChanged;
    const life = this.time / this.bindingItem.duration;

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

    if (colorChanged) {
      vecMulCombine<vec4>(this.renderColor, colorInc, this.startColor);
      this.spriteMaterial.getVector4('_Color')!.setFromArray(this.renderColor);
    }
  }

  override fromData (clipData: SpriteColorPlayableAssetData) {
    this.clipData = clipData;
    const colorOverLifetime = clipData.colorOverLifetime;

    if (colorOverLifetime) {
      this.opacityOverLifetime = createValueGetter(colorOverLifetime.opacity ?? 1);
      if (colorOverLifetime.color && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR) {
        this.colorOverLifetime = colorStopsFromGradient(colorOverLifetime.color[1]);
      }
    }
    this.startColor = clipData.startColor || [1, 1, 1, 1];

    return this;
  }
}

@effectsClass('SpriteColorPlayableAsset')
export class SpriteColorPlayableAsset extends PlayableAsset {
  data: SpriteColorPlayableAssetData;

  override createPlayable (graph: PlayableGraph): Playable {
    const spriteColorPlayable = new SpriteColorPlayable(graph);

    spriteColorPlayable.fromData(this.data);

    return spriteColorPlayable;
  }

  override fromData (data: SpriteColorPlayableAssetData): void {
    this.data = data;
  }
}

export interface SpriteColorPlayableAssetData extends spec.EffectsObjectData {
  colorOverLifetime?: spec.ColorOverLifetime,
  startColor?: spec.RGBAColorValue,
}

@effectsClass(spec.DataType.SpriteComponent)
export class SpriteComponent extends RendererComponent {
  renderer: SpriteItemRenderer;
  interaction?: { behavior: spec.InteractBehavior };
  cachePrefix: string;
  geoData: { atlasOffset: number[] | spec.TypedArray, index: number[] | spec.TypedArray };
  anchor?: vec2;

  textureSheetAnimation?: spec.TextureSheetAnimation;
  frameAnimationTime = 0;
  splits: splitsDataType;
  emptyTexture: Texture;
  color: vec4 = [1, 1, 1, 1];
  worldMatrix: Matrix4;
  geometry: Geometry;

  /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
  // override colorOverLifetime: { stop: number, color: any }[];
  // override opacityOverLifetime: ValueGetter<number>;
  /***********************/
  private renderInfo: SpriteItemRenderInfo;
  // readonly mesh: Mesh;
  private readonly wireframe?: boolean;
  private preMultiAlpha: number;
  private visible = true;

  constructor (engine: Engine, props?: SpriteItemProps) {
    super(engine);

    if (props) {
      this.fromData(props);
    }
  }

  /**
   * 设置当前 Mesh 的可见性。
   * @param visible - true：可见，false：不可见
   */
  setVisible (visible: boolean) {
    this.visible = visible;
  }
  /**
   * 获取当前 Mesh 的可见性。
   */
  getVisible (): boolean {
    return this.visible;
  }

  /**
   * 设置当前图层的颜色
   * > Tips: 透明度也属于颜色的一部分，当有透明度/颜色 K 帧变化时，该 API 会失效
   * @since 2.0.0
   * @param color - 颜色值
   */
  setColor (color: vec4) {
    this.color = color;
    this.material.setVector4('_Color', new Vector4().setFromArray(color));
  }

  /**
   * 设置当前 Mesh 的纹理
   * @since 2.0.0
   * @param texture - 纹理对象
   */
  setTexture (texture: Texture) {
    this.renderer.texture = texture;
    this.material.setTexture('uSampler0', texture);
  }

  override render (renderer: Renderer) {
    if (!this.getVisible()) {
      return;
    }
    const material = this.material;
    const geo = this.geometry;

    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    this.material.setVector2('_Size', this.transform.size);
    renderer.drawGeometry(geo, material);
  }

  override start (): void {
    this.priority = this.item.listIndex;
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override update (dt: number): void {
    this.frameAnimationTime += dt / 1000;
    const time = this.frameAnimationTime;
    const duration = this.item.duration;
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
      this.material.getVector4('_TexOffset')!.setFromArray([
        texRectX + texOffset[0],
        texRectH + texRectY - texOffset[1],
        dx, dy,
      ]);
    }
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.item.composition.destroyTextures(this.getTextures());
    }
  }

  private getItemInitData (item: SpriteComponent, idx: number, pointStartIndex: number, textureIndex: number) {
    let geoData = item.geoData;

    if (!geoData) {
      geoData = item.geoData = this.getItemGeometryData(item, idx);
    }
    const index = geoData.index;
    const idxCount = index.length;
    // @ts-expect-error
    const indexData: number[] = this.wireframe ? new Uint8Array([0, 1, 1, 3, 2, 3, 2, 0]) : new index.constructor(idxCount);

    if (!this.wireframe) {
      for (let i = 0; i < idxCount; i++) {
        indexData[i] = pointStartIndex + index[i];
      }
    }

    return {
      atlasOffset: geoData.atlasOffset,
      index: indexData,
    };
  }

  private setItem () {
    const textures: Texture[] = [];
    let texture = this.renderer.texture;

    if (texture) {
      addItem(textures, texture);
    }
    texture = this.renderer.texture;
    const textureIndex = texture ? textures.indexOf(texture) : -1;
    const data = this.getItemInitData(this, 0, 0, textureIndex);

    const renderer = this.renderer;
    const texParams = this.material.getVector4('_TexParams')!;

    texParams.x = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
    texParams.y = +this.preMultiAlpha;
    texParams.z = renderer.renderMode;
    const attributes = {
      atlasOffset: new Float32Array(data.atlasOffset.length),
      index: new Uint16Array(data.index.length),
    };

    attributes.atlasOffset.set(data.atlasOffset);
    attributes.index.set(data.index);
    const { material, geometry } = this;
    const indexData = attributes.index;

    geometry.setIndexData(indexData);
    geometry.setAttributeData('atlasOffset', attributes.atlasOffset);
    geometry.setDrawCount(data.index.length);
    for (let i = 0; i < textures.length; i++) {
      const texture = textures[i];

      material.setTexture('uSampler' + i, texture);
    }
    // FIXME: 内存泄漏的临时方案，后面再调整
    const emptyTexture = this.emptyTexture;

    for (let k = textures.length; k < maxSpriteMeshItemCount; k++) {
      material.setTexture('uSampler' + k, emptyTexture);
    }
  }

  private createGeometry (mode: GeometryDrawMode) {
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

  private createMaterial (renderInfo: SpriteItemRenderInfo, count: number): Material {
    const { side, occlusion, blending, maskMode, mask } = renderInfo;
    const materialProps: MaterialProps = {
      shader: spriteMeshShaderFromRenderInfo(renderInfo, count, 1),
    };

    this.preMultiAlpha = getPreMultiAlpha(blending);

    const material = Material.create(this.engine, materialProps);

    const states = {
      side,
      blending: true,
      blendMode: blending,
      mask,
      maskMode,
      depthTest: true,
      depthMask: occlusion,
    };

    material.blending = states.blending;
    material.stencilRef = states.mask !== undefined ? [states.mask, states.mask] : undefined;
    material.depthTest = states.depthTest;
    material.depthMask = states.depthMask;
    states.blending && setBlendMode(material, states.blendMode);
    setMaskMode(material, states.maskMode);
    setSideMode(material, states.side);

    if (!material.hasUniform('_Color')) {
      material.setVector4('_Color', new Vector4(0, 0, 0, 1));
    }
    if (!material.hasUniform('_TexOffset')) {
      material.setVector4('_TexOffset', new Vector4());
    }
    if (!material.hasUniform('_TexParams')) {
      material.setVector4('_TexParams', new Vector4());
    }

    return material;
  }

  private getItemGeometryData (item: SpriteComponent, aIndex: number) {
    const { splits, renderer, textureSheetAnimation } = item;
    const sx = 1, sy = 1;

    if (renderer.shape) {
      const { index, aPoint } = renderer.shape;
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
        index,
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

  getTextures (): Texture[] {
    const ret = [];
    const tex = this.renderer.texture;

    if (tex) {
      ret.push(tex);
    }

    return ret;
  }

  /**
   * 获取图层包围盒的类型和世界坐标
   * @returns
   */
  getBoundingBox (): BoundingBoxTriangle | void {
    if (!this.item) {
      return;
    }
    const worldMatrix = this.transform.getWorldMatrix();
    const triangles = trianglesFromRect(Vector3.ZERO, 0.5 * this.transform.size.x, 0.5 * this.transform.size.y);

    triangles.forEach(triangle => {
      worldMatrix.transformPoint(triangle.p0 as Vector3);
      worldMatrix.transformPoint(triangle.p1 as Vector3);
      worldMatrix.transformPoint(triangle.p2 as Vector3);
    });

    return {
      type: HitTestType.triangle,
      area: triangles,
    };
  }

  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => {
    const ui = this.interaction;

    if ((force || ui)) {
      const area = this.getBoundingBox();

      if (area) {
        return {
          behavior: this.interaction?.behavior || 0,
          type: area.type,
          triangles: area.area,
          backfaceCulling: this.renderer.side === spec.SideMode.FRONT,
        };
      }
    }
  };

  // TODO: [1.31] @十弦 https://github.com/galacean/effects-runtime/commit/fe8736540b9a461d8e96658f4d755ff8089a263b#diff-a3618f4527c5fe6e842f20d67d5c82984568502c6bf6fdfcbd24f69e2894ca90
  override fromData (data: SpriteItemProps): void {
    super.fromData(data);

    const { interaction, options, listIndex = 0 } = data;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }

    this.interaction = interaction;
    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!(renderer.occlusion),
      transparentOcclusion: !!(renderer.transparentOcclusion) || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      shape: renderer.shape,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

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
    this.name = 'MSprite' + seed++;
    const startColor = options.startColor || [1, 1, 1, 1];

    this.material.setVector4('_Color', new Vector4().setFromArray(startColor));
    this.material.setVector4('_TexOffset', new Vector4().setFromArray([0, 0, 1, 1]));
    this.setItem();
  }

  override toData (): void {
    super.toData();
  }
}
