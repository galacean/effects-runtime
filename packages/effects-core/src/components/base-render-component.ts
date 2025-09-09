import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { Maskable } from '../material';
import {
  MaskMode, MaskProcessor, Material, getPreMultiAlpha, setBlendMode, setMaskMode, setSideMode,
} from '../material';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { MeshCollider } from '../plugins';
import type { Renderer } from '../render';
import { Geometry } from '../render';
import { itemFrag, itemVert } from '../shader';
import { Texture } from '../texture';
import { RendererComponent } from './renderer-component';

/**
 * 图层元素渲染属性, 经过处理后的 spec.SpriteContent.renderer
 */
export interface ItemRenderer extends Required<Omit<spec.RendererOptions, 'texture' | 'shape' | 'anchor' | 'particleOrigin' | 'mask'>> {
  texture: Texture,
  mask: number,
}

// TODO: Add to spec
interface MaskableGraphicData extends spec.ComponentData {
  renderer: spec.RendererOptions,
  mask?: spec.MaskOptions,
}

/**
 * @since 2.1.0
 */
export class MaskableGraphic extends RendererComponent implements Maskable {
  interaction?: { behavior: spec.InteractBehavior };
  renderer: ItemRenderer;
  geometry: Geometry;

  protected visible = true;
  protected readonly maskManager: MaskProcessor;

  /**
   * 用于点击测试的碰撞器
   */
  protected meshCollider = new MeshCollider();
  protected defaultGeometry: Geometry;

  private _color = new Color(1, 1, 1, 1);

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
    };

    this.defaultGeometry = Geometry.create(this.engine, {
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
        aUV: {
          size: 2,
          offset: 0,
          releasable: true,
          type: glContext.FLOAT,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]), releasable: true },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });
    this.geometry = this.defaultGeometry;

    const material = Material.create(this.engine, {
      shader: {
        fragment: itemFrag,
        vertex: itemVert,
        shared: true,
      },
    });

    this.material = material;
    this.material.setColor('_Color', new Color(1, 1, 1, 1));
    this.maskManager = new MaskProcessor(engine);
  }

  /**
   * 设置当前 Mesh 的可见性。
   * @param visible - true：可见，false：不可见
   * @deprecated 2.4.0 Please use enabled instead
   */
  setVisible (visible: boolean) {
    this.visible = visible;
  }

  /**
   * 获取当前 Mesh 的可见性。
   * @deprecated 2.4.0 Please use enabled instead
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
      this._color.copyFrom(color);
    } else {
      this._color.setFromArray(color);
    }
    this.material.setColor('_Color', this._color);
  }

  /**
   * 获取当前图层的颜色
   * @since 2.5.0
   */
  get color () {
    return this._color;
  }
  /**
   * 设置当前图层的颜色
   * @since 2.5.0
   */
  set color (value: Color) {
    this.setColor(value);
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

  override render (renderer: Renderer) {
    if (!this.getVisible()) {
      return;
    }

    this.maskManager.drawStencilMask(renderer);

    this.draw(renderer);
  }

  /**
   * @internal
   */
  drawStencilMask (renderer: Renderer) {
    if (!this.isActiveAndEnabled) {
      return;
    }
    const previousColorMask = this.material.colorMask;

    this.material.colorMask = false;
    this.draw(renderer);
    this.material.colorMask = previousColorMask;
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  // TODO 点击测试后续抽象一个 Collider 组件
  getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
    const sizeMatrix = Matrix4.fromScale(this.transform.size.x, this.transform.size.y, 1);
    const worldMatrix = sizeMatrix.premultiply(this.transform.getWorldMatrix());
    const ui = this.interaction;

    if (force || ui) {
      this.meshCollider.setGeometry(this.geometry, worldMatrix);
      const area = this.meshCollider.getBoundingBoxData();

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

  getBoundingBox (): BoundingBoxTriangle {
    const worldMatrix = this.transform.getWorldMatrix();

    this.meshCollider.setGeometry(this.geometry, worldMatrix);
    const boundingBox = this.meshCollider.getBoundingBox();

    return boundingBox;
  }

  private configureMaterial (renderer: ItemRenderer): Material {
    const { side, occlusion, blending: blendMode, mask, texture } = renderer;
    const maskMode = this.maskManager.maskMode;
    const material = this.material;

    material.blending = true;
    material.depthTest = true;
    material.depthMask = occlusion;
    material.stencilRef = mask !== undefined ? [mask, mask] : undefined;

    setBlendMode(material, blendMode);
    // 兼容旧数据中模板需要渲染的情况
    setMaskMode(material, maskMode);
    setSideMode(material, side);

    material.shader.shaderData.properties = '_MainTex("_MainTex",2D) = "white" {}';
    material.setVector4('_TexOffset', new Vector4(0, 0, 1, 1));
    material.setTexture('_MainTex', texture);

    const preMultiAlpha = getPreMultiAlpha(blendMode);
    const texParams = new Vector4();

    texParams.x = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
    texParams.y = preMultiAlpha;
    texParams.z = renderer.renderMode;
    texParams.w = maskMode;
    material.setVector4('_TexParams', texParams);

    if (texParams.x === 0 || (this.maskManager.alphaMaskEnabled)) {
      material.enableMacro('ALPHA_CLIP');
    } else {
      material.disableMacro('ALPHA_CLIP');
    }

    return material;
  }

  private draw (renderer: Renderer) {
    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i];

      material.setVector2('_Size', this.transform.size);

      if (this.renderer.renderMode === spec.RenderMode.BILLBOARD ||
        this.renderer.renderMode === spec.RenderMode.VERTICAL_BILLBOARD ||
        this.renderer.renderMode === spec.RenderMode.HORIZONTAL_BILLBOARD
      ) {
        material.setVector3('_Scale', this.transform.scale);
      }

      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), material, i);
    }
  }

  override fromData (data: unknown): void {
    super.fromData(data);

    const baseRenderComponentData = (data as MaskableGraphicData);
    const renderer = baseRenderComponentData.renderer ?? {};

    const maskOptions = baseRenderComponentData.mask;

    if (maskOptions) {
      this.maskManager.setMaskOptions(maskOptions);
    }

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ? this.engine.findObject<Texture>(renderer.texture) : this.engine.emptyTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (this.maskManager.maskMode === MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: this.maskManager.getRefValue(),
    };

    this.configureMaterial(this.renderer);
  }
}
