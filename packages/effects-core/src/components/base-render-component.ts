import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
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
import { Geometry, FilterMode, RenderTextureFormat } from '../render';
import { itemFrag, itemVert, screenMeshVert } from '../shader';
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
 * @since 2.7.0
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

  // 高斯模糊相关属性
  private blurEnabled = false;
  private blurRadius = 0;
  private blurIterations = 3; // 模糊迭代次数，控制模糊范围
  private blurMaterialH?: Material; // 水平模糊材质
  private blurMaterialV?: Material; // 垂直模糊材质
  private blurBlitMaterial?: Material; // 最终合成材质
  private blurGeometry?: Geometry; // 全屏四边形
  private needsBlurInit = true;

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    this.renderer = {
      renderMode: spec.RenderMode.MESH,
      blending: spec.BlendingMode.ALPHA,
      texture: this.engine.whiteTexture,
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

    this.setBlur(1, 2);
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
   * 设置高斯模糊羽化效果
   * @param radius - 模糊半径（0-100），0表示禁用模糊
   * @param iterations - 模糊迭代次数（1-7），越大模糊范围越广但性能消耗越高
   */
  setBlur (radius: number, iterations = 3) {
    this.blurRadius = Math.max(0, Math.min(100, radius));
    this.blurIterations = Math.max(1, Math.min(7, iterations));
    this.blurEnabled = this.blurRadius > 0;

    if (this.blurEnabled && this.needsBlurInit) {
      this.initBlurResources();
    }
  }

  /**
   * 获取当前模糊半径
   */
  getBlurRadius (): number {
    return this.blurRadius;
  }

  /**
   * 初始化模糊所需的资源
   */
  private initBlurResources () {
    if (!this.needsBlurInit) {
      return;
    }

    // 创建全屏四边形几何体
    this.blurGeometry = Geometry.create(this.engine, {
      mode: glContext.TRIANGLE_STRIP,
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
        },
      },
      drawCount: 4,
    });

    // 创建水平模糊材质（支持 alpha 通道）
    this.blurMaterialH = Material.create(this.engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: `
          precision highp float;
          varying vec2 uv;
          uniform sampler2D _MainTex;
          uniform vec2 _TextureSize;
          
          vec4 GaussH(sampler2D tex, vec2 uv) {
            vec4 color = vec4(0.0);
            float offsets[9];
            offsets[0] = -4.0; offsets[1] = -3.0; offsets[2] = -2.0; offsets[3] = -1.0; offsets[4] = 0.0;
            offsets[5] = 1.0; offsets[6] = 2.0; offsets[7] = 3.0; offsets[8] = 4.0;
            float weights[9];
            weights[0] = 0.01621622; weights[1] = 0.05405405; weights[2] = 0.12162162; weights[3] = 0.19459459;
            weights[4] = 0.22702703; weights[5] = 0.19459459; weights[6] = 0.12162162; weights[7] = 0.05405405; weights[8] = 0.01621622;
            for(int i = 0; i < 9; i++) {
              vec2 offset = vec2(offsets[i] * 2.0 * (1.0 / _TextureSize.x), 0.0);
              color += texture2D(tex, uv + offset) * weights[i];
            }
            return color;
          }
          
          void main() {
            gl_FragColor = GaussH(_MainTex, uv);
          }
        `,
      },
    });
    this.blurMaterialH.blending = false;
    this.blurMaterialH.depthTest = false;
    this.blurMaterialH.culling = false;

    // 创建垂直模糊材质（支持 alpha 通道）
    this.blurMaterialV = Material.create(this.engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: `
          precision highp float;
          varying vec2 uv;
          uniform sampler2D _MainTex;
          uniform vec2 _TextureSize;
          
          vec4 GaussV(sampler2D tex, vec2 uv) {
            vec4 color = vec4(0.0);
            float offsets[9];
            offsets[0] = -4.0; offsets[1] = -3.0; offsets[2] = -2.0; offsets[3] = -1.0; offsets[4] = 0.0;
            offsets[5] = 1.0; offsets[6] = 2.0; offsets[7] = 3.0; offsets[8] = 4.0;
            float weights[9];
            weights[0] = 0.01621622; weights[1] = 0.05405405; weights[2] = 0.12162162; weights[3] = 0.19459459;
            weights[4] = 0.22702703; weights[5] = 0.19459459; weights[6] = 0.12162162; weights[7] = 0.05405405; weights[8] = 0.01621622;
            for(int i = 0; i < 9; i++) {
              vec2 offset = vec2(0.0, offsets[i] * 2.0 * (1.0 / _TextureSize.y));
              color += texture2D(tex, uv + offset) * weights[i];
            }
            return color;
          }
          
          void main() {
            gl_FragColor = GaussV(_MainTex, uv);
          }
        `,
      },
    });
    this.blurMaterialV.blending = false;
    this.blurMaterialV.depthTest = false;
    this.blurMaterialV.culling = false;

    // 创建最终合成材质（用于全屏绘制模糊结果）
    this.blurBlitMaterial = Material.create(this.engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: `
          precision highp float;
          varying vec2 uv;
          uniform sampler2D _MainTex;
          uniform vec4 _Color;
          
          void main() {
            vec4 texColor = texture2D(_MainTex, uv);
            gl_FragColor = texColor * _Color;
          }
        `,
      },
    });
    this.blurBlitMaterial.blending = true;
    this.blurBlitMaterial.depthTest = false;
    this.blurBlitMaterial.depthMask = false;
    this.blurBlitMaterial.culling = false;

    this.needsBlurInit = false;
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
    // 如果启用了模糊效果，使用多层RT渲染
    if (this.blurEnabled) {
      // 检查模糊资源是否已初始化
      if (!this.blurGeometry || !this.blurMaterialH || !this.blurMaterialV) {
        // 资源未初始化，回退到正常渲染
        this.blurEnabled = false; // 禁用模糊避免重复警告
        this.drawNormal(renderer);

        return;
      }
      this.drawWithBlur(renderer);
    } else {
      // 正常渲染
      this.drawNormal(renderer);
    }
  }

  /**
   * 正常渲染（无模糊）
   */
  private drawNormal (renderer: Renderer) {
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

  /**
   * 使用高斯模糊羽化渲染
   * 参考 postprocess 的 hqbloom pass，利用多层 RT 和线性过滤优化性能
   *
   * 实现原理：
   * 1. 将图层内容渲染到第一个 RT
   * 2. 通过多次降采样（每次减半分辨率）进行高斯模糊
   * 3. 每次降采样都执行水平和垂直两个 Pass
   * 4. 利用 GPU 的线性过滤（minFilter/magFilter=LINEAR）自动插值，减少采样次数
   * 5. 最终将模糊结果合成到屏幕
   */
  private drawWithBlur (renderer: Renderer) {
    // 这里不需要再检查资源，因为 draw() 方法已经检查过了
    // 但为了保险起见，还是加上防御性检查
    if (!this.blurGeometry || !this.blurMaterialH || !this.blurMaterialV) {
      console.error('Blur resources missing in drawWithBlur, this should not happen');
      this.drawNormal(renderer);

      return;
    }

    // 使用全屏尺寸作为 RT 大小，这样可以捕捉到大范围的模糊扩散效果
    const screenWidth = renderer.getWidth();
    const screenHeight = renderer.getHeight();

    // 可以选择使用全屏分辨率，或者为了性能使用稍低的分辨率
    const baseWidth = Math.max(256, Math.floor(screenWidth));
    const baseHeight = Math.max(256, Math.floor(screenHeight));

    // 保存当前的 framebuffer
    const previousFramebuffer = renderer.getFramebuffer();

    // 第一步：将图层内容渲染到第一个 RT
    // 使用固定名称，让 renderer 可以复用 RT
    const sourceRTName = `blur_source_${this.item.id}`;
    const sourceRT = renderer.getTemporaryRT(
      sourceRTName,
      baseWidth,
      baseHeight,
      0, // 不需要深度缓冲
      FilterMode.Linear, // 线性过滤
      RenderTextureFormat.RGBA32,
    );

    renderer.setFramebuffer(sourceRT);
    renderer.clear({
      colorAction: 0, // TextureLoadAction.clear
      clearColor: [0, 0, 0, 0],
      depthAction: 0,
      stencilAction: 0,
    });

    // 渲染原始内容到第一个 RT
    this.drawNormal(renderer);

    let currentTexture = sourceRT?.getColorTextures()[0];

    if (!currentTexture) {
      throw new Error('Failed to get source texture');
    }

    let currentWidth = baseWidth;
    let currentHeight = baseHeight;

    // 多层高斯模糊：逐步降采样并模糊
    for (let i = 0; i < this.blurIterations; i++) {
      // 计算当前层的分辨率（每次减半，利用线性过滤优化）
      currentWidth = Math.max(32, Math.floor(currentWidth / 2));
      currentHeight = Math.max(32, Math.floor(currentHeight / 2));

      // === 水平模糊 Pass ===
      // 使用固定名称 + 迭代索引，让 renderer 可以复用 RT
      const hRTName = `blur_h_${this.item.id}_${i}`;
      const hRT = renderer.getTemporaryRT(
        hRTName,
        currentWidth,
        currentHeight,
        0,
        FilterMode.Linear,
        RenderTextureFormat.RGBA32,
      );

      renderer.setFramebuffer(hRT);
      renderer.clear({
        colorAction: 0, // TextureLoadAction.clear
        clearColor: [0, 0, 0, 0],
        depthAction: 0,
        stencilAction: 0,
      });

      // 设置水平模糊材质参数
      this.blurMaterialH.setTexture('_MainTex', currentTexture);
      this.blurMaterialH.setVector2('_TextureSize', new Vector2(currentWidth, currentHeight));

      // 绘制全屏四边形执行水平模糊
      renderer.drawGeometry(this.blurGeometry, Matrix4.fromIdentity(), this.blurMaterialH);

      const hTexture = hRT?.getColorTextures()[0];

      if (!hTexture) {
        throw new Error('Failed to get horizontal blur texture');
      }

      // === 垂直模糊 Pass ===
      // 使用固定名称 + 迭代索引，让 renderer 可以复用 RT
      const vRTName = `blur_v_${this.item.id}_${i}`;
      const vRT = renderer.getTemporaryRT(
        vRTName,
        currentWidth,
        currentHeight,
        0,
        FilterMode.Linear,
        RenderTextureFormat.RGBA32,
      );

      renderer.setFramebuffer(vRT);
      renderer.clear({
        colorAction: 0, // TextureLoadAction.clear
        clearColor: [0, 0, 0, 0],
        depthAction: 0,
        stencilAction: 0,
      });

      // 设置垂直模糊材质参数
      this.blurMaterialV.setTexture('_MainTex', hTexture);
      this.blurMaterialV.setVector2('_TextureSize', new Vector2(currentWidth, currentHeight));

      // 绘制全屏四边形执行垂直模糊
      renderer.drawGeometry(this.blurGeometry, Matrix4.fromIdentity(), this.blurMaterialV);

      // 更新当前纹理为这次迭代的结果
      const vTexture = vRT?.getColorTextures()[0];

      if (!vTexture) {
        throw new Error('Failed to get vertical blur texture');
      }

      currentTexture = vTexture;
    }

    // 关键：在切换 framebuffer 之前，先解绑所有模糊材质中的纹理
    // 避免 feedback loop 错误
    this.blurMaterialH.setTexture('_MainTex', this.engine.whiteTexture);
    this.blurMaterialV.setTexture('_MainTex', this.engine.whiteTexture);

    // 恢复原始 framebuffer
    renderer.setFramebuffer(previousFramebuffer);

    // 复用已创建的 blit 材质，避免重复创建影响性能
    if (!this.blurBlitMaterial) {
      throw new Error('Blur blit material not initialized');
    }

    // 设置纹理和颜色
    this.blurBlitMaterial.setTexture('_MainTex', currentTexture);
    this.blurBlitMaterial.setColor('_Color', this._color);

    // 设置混合模式
    setBlendMode(this.blurBlitMaterial, this.renderer.blending);

    // 使用全屏四边形绘制
    renderer.drawGeometry(this.blurGeometry, Matrix4.fromIdentity(), this.blurBlitMaterial);

    // 注意：temporaryRT 由 renderer 管理，不需要手动释放
    // renderer 会在合适的时机自动清理这些临时 RT
  }

  override fromData (data: unknown): void {
    super.fromData(data);

    const maskableGraphicData = (data as MaskableGraphicData);
    const renderer = maskableGraphicData.renderer ?? {};

    const maskOptions = maskableGraphicData.mask;

    if (maskOptions) {
      this.maskManager.setMaskOptions(maskOptions);
    }

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ? this.engine.findObject<Texture>(renderer.texture) : this.engine.whiteTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (this.maskManager.maskMode === MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: this.maskManager.getRefValue(),
    };

    this.configureMaterial(this.renderer);
  }
}
