import * as spec from '@galacean/effects-specification';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { RendererComponent } from './renderer-component';
import { Texture } from '../texture';
import type { GeometryDrawMode, Renderer } from '../render';
import { Geometry } from '../render';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { addItem } from '../utils';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { HitTestType, spriteMeshShaderFromRenderInfo } from '../plugins';
import type { MaterialProps } from '../material';
import { getPreMultiAlpha, Material, setBlendMode, setMaskMode, setSideMode } from '../material';
import { trianglesFromRect } from '../math';
import type { GeometryFromShape } from '../shape';

/**
 * 图层元素渲染属性, 经过处理后的 spec.SpriteContent.renderer
 */
export interface ItemRenderer extends Required<Omit<spec.RendererOptions, 'texture' | 'shape' | 'anchor' | 'particleOrigin'>> {
  order: number,
  mask: number,
  texture: Texture,
  shape?: GeometryFromShape,
  anchor?: spec.vec2,
  particleOrigin?: spec.ParticleOrigin,
}

/**
 * 图层的渲染属性，用于 Mesh 的合并判断
 */
export interface ItemRenderInfo {
  side: number,
  occlusion: boolean,
  blending: number,
  cachePrefix: string,
  mask: number,
  maskMode: number,
  cacheId: string,
  wireframe?: boolean,
}

/**
 * @since 2.1.0
 */
export class BaseRenderComponent extends RendererComponent {
  interaction?: { behavior: spec.InteractBehavior };
  cachePrefix = '-';
  geoData: { atlasOffset: number[] | spec.TypedArray, index: number[] | spec.TypedArray };
  anchor?: spec.vec2;
  renderer: ItemRenderer;

  emptyTexture: Texture;
  color: spec.vec4 = [1, 1, 1, 1];
  worldMatrix: Matrix4;
  geometry: Geometry;

  protected renderInfo: ItemRenderInfo;
  // readonly mesh: Mesh;
  protected readonly wireframe?: boolean;
  protected preMultiAlpha: number;
  protected visible = true;
  protected isManualTimeSet = false;
  protected frameAnimationTime = 0;

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    this.renderer = {
      renderMode: spec.RenderMode.MESH,
      blending: spec.BlendingMode.ALPHA,
      texture: this.engine.emptyTexture,
      occlusion: false,
      transparentOcclusion: false,
      side: spec.SideMode.DOUBLE,
      mask: 0,
      maskMode: spec.MaskMode.NONE,
      order: 0,
    };
    this.emptyTexture = this.engine.emptyTexture;
    this.renderInfo = getImageItemRenderInfo(this);

    const material = this.createMaterial(this.renderInfo, 2);

    this.worldMatrix = Matrix4.fromIdentity();
    this.material = material;
    this.material.setVector4('_Color', new Vector4().setFromArray([1, 1, 1, 1]));
    this.material.setVector4('_TexOffset', new Vector4().setFromArray([0, 0, 1, 1]));
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
  setColor (color: spec.vec4) {
    this.color = color;
    this.material.setVector4('_Color', new Vector4().setFromArray(color));
  }

  /**
   * 使用纹理对象设置当前 Mesh 的纹理
   * @since 2.0.0
   * @param input - 纹理对象
   */
  setTexture (input: Texture): void;
  /**
   * 使用资源链接异步设置当前 Mesh 的纹理
   * @param input - 资料链接
   * @since 2.3.0
   */
  async setTexture (input: string): Promise<void>;
  async setTexture (input: Texture | string): Promise<void> {
    let texture: Texture;

    if (typeof input === 'string') {
      texture = await Texture.fromImage(input, this.item.engine);
    } else {
      texture = input;
    }

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
  }

  /**
   * @internal
   */
  setAnimationTime (time: number) {
    this.frameAnimationTime = time;
    this.isManualTimeSet = true;
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

    if (this.renderer.renderMode === spec.RenderMode.BILLBOARD ||
      this.renderer.renderMode === spec.RenderMode.VERTICAL_BILLBOARD ||
      this.renderer.renderMode === spec.RenderMode.HORIZONTAL_BILLBOARD
    ) {
      this.material.setVector3('_Scale', this.transform.scale);
    }

    renderer.drawGeometry(geo, material);
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onDestroy (): void {
    if (this.item && this.item.composition) {
      this.item.composition.destroyTextures(this.getTextures());
    }
  }

  protected getItemInitData () {
    this.geoData = this.getItemGeometryData();

    const { index, atlasOffset } = this.geoData;
    const idxCount = index.length;
    // @ts-expect-error
    const indexData: number[] = this.wireframe ? new Uint8Array([0, 1, 1, 3, 2, 3, 2, 0]) : new index.constructor(idxCount);

    if (!this.wireframe) {
      for (let i = 0; i < idxCount; i++) {
        indexData[i] = 0 + index[i];
      }
    }

    return {
      atlasOffset,
      index: indexData,
    };
  }

  protected setItem () {
    const textures: Texture[] = [];
    let texture = this.renderer.texture;

    if (texture) {
      addItem(textures, texture);
    }
    texture = this.renderer.texture;
    const data = this.getItemInitData();

    const renderer = this.renderer;
    const texParams = this.material.getVector4('_TexParams');

    if (texParams) {
      texParams.x = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
      texParams.y = +this.preMultiAlpha;
      texParams.z = renderer.renderMode;

      if (texParams.x === 0) {
        this.material.enableMacro('ALPHA_CLIP');
      } else {
        this.material.disableMacro('ALPHA_CLIP');
      }
    }

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

    material.setTexture('_MainTex', texture);
  }

  protected getItemGeometryData () {
    const renderer = this.renderer;

    if (renderer.shape) {
      const { index = [], aPoint = [] } = renderer.shape;
      const point = new Float32Array(aPoint);
      const position = [];

      const atlasOffset = [];

      for (let i = 0; i < point.length; i += 6) {
        atlasOffset.push(aPoint[i + 2], aPoint[i + 3]);
        position.push(point[i], point[i + 1], 0.0);
      }
      this.geometry.setAttributeData('aPos', new Float32Array(position));

      return {
        index: index as number[],
        atlasOffset,
      };
    } else {
      this.geometry.setAttributeData('aPos', new Float32Array([-0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0]));

      return { index: [0, 1, 2, 2, 1, 3], atlasOffset: [0, 1, 0, 0, 1, 1, 1, 0] };
    }
  }

  protected createGeometry (mode: GeometryDrawMode) {
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
      maxVertex: 4,
    });
  }

  protected createMaterial (renderInfo: ItemRenderInfo, count: number): Material {
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

    material.shader.shaderData.properties = '_MainTex("_MainTex",2D) = "white" {}';
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

  getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
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
}

export function getImageItemRenderInfo (item: BaseRenderComponent): ItemRenderInfo {
  const { renderer } = item;
  const { blending, side, occlusion, mask, maskMode, order } = renderer;
  const blendingCache = +blending;
  const cachePrefix = item.cachePrefix || '-';

  return {
    side,
    occlusion,
    blending,
    mask,
    maskMode,
    cachePrefix,
    cacheId: `${cachePrefix}.${+side}+${+occlusion}+${blendingCache}+${order}+${maskMode}.${mask}`,
  };
}
