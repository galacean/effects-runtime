import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { Maskable, MaterialProps } from '../material';
import {
  getPreMultiAlpha, MaskMode, Material, setBlendMode, setMaskMode, setSideMode, MaskProcessor,
} from '../material';
import { trianglesFromRect } from '../math';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { HitTestType } from '../plugins';
import type { GeometryDrawMode, Renderer, ShaderMacros } from '../render';
import { GLSLVersion, Geometry } from '../render';
import type { GeometryFromShape } from '../shape';
import { Texture } from '../texture';
import { RendererComponent } from './renderer-component';
import { itemFrag, itemVert } from '../shader';

/**
 * 图层元素渲染属性, 经过处理后的 spec.SpriteContent.renderer
 */
export interface ItemRenderer extends Required<Omit<spec.RendererOptions, 'texture' | 'shape' | 'anchor' | 'particleOrigin' | 'mask'>> {
  order: number,
  texture: Texture,
  mask: number,
  maskMode: MaskMode,
  shape?: GeometryFromShape,
  anchor?: spec.vec2,
  particleOrigin?: spec.ParticleOrigin,
}

/**
 * @since 2.1.0
 */
export class BaseRenderComponent extends RendererComponent implements Maskable {
  interaction?: { behavior: spec.InteractBehavior };
  renderer: ItemRenderer;
  color = new Color(1, 1, 1, 1);
  geometry: Geometry;
  readonly maskManager: MaskProcessor;

  protected preMultiAlpha: number;
  protected visible = true;
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
      maskMode: MaskMode.NONE,
      mask: 0,
      order: 0,
    };

    const material = this.createMaterial(this.renderer);

    this.material = material;
    this.material.setColor('_Color', new Color().setFromArray([1, 1, 1, 1]));
    this.material.setVector4('_TexOffset', new Vector4().setFromArray([0, 0, 1, 1]));
    this.maskManager = new MaskProcessor(engine);
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
   * @since 2.4.0
   * @param color - 颜色值
   */
  setColor (color: Color): void;
  /**
   * 设置当前图层的颜色
   * > Tips: 透明度也属于颜色的一部分，当有透明度/颜色 K 帧变化时，该 API 会失效
   * @since 2.0.0
   * @param color - 颜色值
   */
  setColor (color: spec.vec4): void;
  setColor (color: spec.vec4 | Color) {
    if (color instanceof Color) {
      this.color.copyFrom(color);
    } else {
      this.color.setFromArray(color);
    }
    this.material.setColor('_Color', this.color);
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

  protected getItemGeometryData (geometry: Geometry) {
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
      geometry.setAttributeData('aPos', new Float32Array(position));

      return {
        index: index as number[],
        atlasOffset,
      };
    } else {
      geometry.setAttributeData('aPos', new Float32Array([-0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0]));

      return { index: [0, 1, 2, 2, 1, 3], atlasOffset: [0, 1, 0, 0, 1, 1, 1, 0] };
    }
  }

  protected createGeometry (mode: GeometryDrawMode) {
    const geometry = Geometry.create(this.engine, {
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
    });

    const geoData = this.getItemGeometryData(geometry);
    const { index, atlasOffset } = geoData;

    const attributes = {
      atlasOffset: new Float32Array(atlasOffset.length),
      index: new Uint16Array(index.length),
    };

    attributes.atlasOffset.set(atlasOffset);
    attributes.index.set(index);
    const indexData = attributes.index;

    geometry.setIndexData(indexData);
    geometry.setAttributeData('atlasOffset', attributes.atlasOffset);
    geometry.setDrawCount(index.length);

    return geometry;
  }

  protected getMaterialProps (): MaterialProps {
    const macros: ShaderMacros = [
    ];
    const fragment = itemFrag;
    const vertex = itemVert;
    const level = 1;

    const shader = {
      fragment,
      vertex,
      glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
      macros,
      shared: true,
    };

    return {
      shader,
    };
  }

  protected createMaterial (renderer: ItemRenderer): Material {
    const { side, occlusion, blending: blendMode, maskMode, mask, texture } = renderer;
    const materialProps = this.getMaterialProps();

    this.preMultiAlpha = getPreMultiAlpha(blendMode);

    const material = Material.create(this.engine, materialProps);

    material.blending = true;
    material.depthTest = true;
    material.depthMask = occlusion;
    material.stencilRef = mask !== undefined ? [mask, mask] : undefined;

    setBlendMode(material, blendMode);
    // 兼容旧数据中模板需要渲染的情况
    setMaskMode(material, maskMode, !!this.renderer.shape);
    setSideMode(material, side);

    material.shader.shaderData.properties = '_MainTex("_MainTex",2D) = "white" {}';
    material.setColor('_Color', new Color(0, 0, 0, 1));
    material.setVector4('_TexOffset', new Vector4());
    material.setTexture('_MainTex', texture);

    const texParams = new Vector4();

    texParams.x = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
    texParams.y = +this.preMultiAlpha;
    texParams.z = renderer.renderMode;
    texParams.w = renderer.maskMode;
    material.setVector4('_TexParams', texParams);

    if (texParams.x === 0 || (renderer.maskMode === MaskMode.MASK && !renderer.shape)) {
      material.enableMacro('ALPHA_CLIP');
    } else {
      material.disableMacro('ALPHA_CLIP');
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
