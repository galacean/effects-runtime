import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { effectsClass } from '../../decorators';
import { RendererComponent } from '../../components';
import { Material } from '../../material';
import { Geometry } from '../../render/geometry';
import { glContext } from '../../gl';
import type { Engine } from '../../engine';
import { SdfTextParagraph } from './sdf/paragraph';
import type { FontAsset } from './fontAsset';
import type { ParagraphOptions } from './paragraphOptions';
import type { Renderer } from '../../render';
import { createCustomLayoutEngine } from './sdf';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

// 导入shader代码
// Shader 代码将在运行时加载
const msdfVertexShader = `
precision highp float;

attribute vec2 aOffset;
attribute vec4 aWorld0;
attribute vec4 aWorld1;
attribute vec4 aWorld2;
attribute vec4 aWorld3;
attribute vec4 aUV;

uniform mat4 effects_MatrixVP;

varying vec2 vAtlasUV;

void main() {
  mat4 aWorld = mat4(aWorld0, aWorld1, aWorld2, aWorld3);
  vec4 worldPos = aWorld * vec4(aOffset.xy - vec2(0.5, 0.5), 0.0, 1.0);
  gl_Position = effects_MatrixVP * worldPos;
  vAtlasUV = vec2(aUV.x + aOffset.x * aUV.z, aUV.y + (1.0 - aOffset.y) * aUV.w);
}
`;

const msdfFragmentShader = `
#extension GL_OES_standard_derivatives : enable

precision highp float;

uniform sampler2D uFontAtlas;
uniform vec4 uColor;
uniform vec4 uStrokeColor;
uniform float uStrokeInsetWidth;
uniform float uStrokeOutsetWidth;
uniform float uThickness;

varying vec2 vAtlasUV;

float median(vec3 msdf) {
  return max(min(msdf.r, msdf.g), min(max(msdf.r, msdf.g), msdf.b));
}

void main() {
  vec3 s = texture2D(uFontAtlas, vAtlasUV).rgb;
  float sigDist = median(s) - 0.5 + uThickness;

  float alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);

  float sigDistOutset = sigDist + uStrokeOutsetWidth * 0.5;
  float sigDistInset = sigDist - uStrokeInsetWidth * 0.5;

  float outset = clamp(sigDistOutset / fwidth(sigDistOutset) + 0.5, 0.0, 1.0);
  float inset = 1.0 - clamp(sigDistInset / fwidth(sigDistInset) + 0.5, 0.0, 1.0);

  float border = outset * inset;

  vec4 filledFragColor = vec4(uColor.rgb, alpha * uColor.a);
  vec4 strokedFragColor = vec4(uStrokeColor.rgb, border * uStrokeColor.a);

  gl_FragColor = mix(filledFragColor, strokedFragColor, border);
}
`;

/**
 * MSDF文本组件
 * 使用MSDF (Multi-channel Signed Distance Field) 技术渲染文本
 */
@effectsClass('MSDFTextComponent')
export class MSDFTextComponent extends RendererComponent {
  /**
   * 字体资源
   */
  font: FontAsset;

  /**
   * 文本颜色
   */
  color: Color = new Color(1.0, 1.0, 1.0, 1.0);

  /**
   * 描边颜色
   */
  strokeColor: Color = new Color(1.0, 1.0, 1.0, 1.0);

  /**
   * 描边内嵌宽度
   */
  strokeInsetWidth = 0;

  /**
   * 描边外扩宽度
   */
  strokeOutsetWidth = 0;

  /**
   * 厚度控制 (0 表示使用字体定义的厚度)
   * 取值范围: -0.5 到 0.5
   */
  thicknessControl = 0;

  private charMatrices: number[] = [];
  private charUvs: number[] = [];
  private isDirty = true;
  private geometry: Geometry;
  private instanceCount = 0;

  // 缓存的矩阵
  private baseMatrix = new Matrix4();
  private scalingMatrix = new Matrix4();
  private translationMatrix = new Matrix4();
  private fontScaleMatrix = new Matrix4();
  private offsetMatrix = new Matrix4();
  private scaledMatrix = new Matrix4();
  private localMatrix = new Matrix4();
  private finalMatrix = new Matrix4();

  constructor (engine: Engine, font?: FontAsset) {
    super(engine);

    this.font = font!;

    // 创建基础几何体 - 单位四边形，带实例化属性
    const spriteData = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);

    // 初始化空的实例化数据
    const emptyWorldData = new Float32Array(16);
    const emptyUVData = new Float32Array(4);

    this.geometry = Geometry.create(engine, {
      mode: glContext.TRIANGLE_STRIP,
      attributes: {
        aOffset: {
          type: glContext.FLOAT,
          size: 2,
          data: spriteData,
        },
        // mat4 需要拆分成 4 个 vec4 属性
        aWorld0: {
          type: glContext.FLOAT,
          size: 4,
          stride: 64, // 16 floats * 4 bytes
          offset: 0,
          data: emptyWorldData,
          instanceDivisor: 1,
        },
        aWorld1: {
          type: glContext.FLOAT,
          size: 4,
          stride: 64,
          offset: 16, // 4 floats * 4 bytes
          data: emptyWorldData,
          instanceDivisor: 1,
        },
        aWorld2: {
          type: glContext.FLOAT,
          size: 4,
          stride: 64,
          offset: 32, // 8 floats * 4 bytes
          data: emptyWorldData,
          instanceDivisor: 1,
        },
        aWorld3: {
          type: glContext.FLOAT,
          size: 4,
          stride: 64,
          offset: 48, // 12 floats * 4 bytes
          data: emptyWorldData,
          instanceDivisor: 1,
        },
        aUV: {
          type: glContext.FLOAT,
          size: 4,
          data: emptyUVData,
          instanceDivisor: 1,
        },
      },
      drawCount: 4,
    });

    // 创建材质
    this.material = Material.create(engine, {
      shader: {
        vertex: msdfVertexShader,
        fragment: msdfFragmentShader,
      },
    });

    this.material.blending = true;
    this.material.depthTest = true;
    this.priority = 0;
  }

  /**
   * 设置字体资源
   */
  setFont (font: FontAsset): void {
    this.font = font;
  }

  /**
   * 添加一段文本
   * @param text - 要添加的文本
   * @param options - 段落选项（可选）
   * @param worldMatrix - 世界矩阵（可选）
   */
  addParagraph (text: string, options?: Partial<ParagraphOptions>, worldMatrix?: Matrix4): void {
    if (!this.font) {
      console.error('MSDFTextComponent: Font not set');

      return;
    }

    const paragraph = new SdfTextParagraph(text, this.font, options);

    const fontScale = this.font.scale;
    const texWidth = this.font._font.common.scaleW;
    const texHeight = this.font._font.common.scaleH;
    const glyphs = paragraph.glyphs.filter(g => g.char.page >= 0);

    const worldMatrixToUse = worldMatrix || Matrix4.fromIdentity();

    this.fontScaleMatrix = Matrix4.fromScale(fontScale, fontScale, 1.0);
    // offsetMatrix要和shader中的 aOffset - 0.5 配合使用
    this.offsetMatrix = Matrix4.fromTranslation(0.5, -0.5, 0.0);

    const charsUvsBase = this.charUvs.length;
    const matricesBase = this.charMatrices.length;

    glyphs.forEach((g, i) => {
      this.charUvs[charsUvsBase + i * 4 + 0] = g.char.x / texWidth;
      this.charUvs[charsUvsBase + i * 4 + 1] = g.char.y / texHeight;
      this.charUvs[charsUvsBase + i * 4 + 2] = g.char.width / texWidth;
      this.charUvs[charsUvsBase + i * 4 + 3] = g.char.height / texHeight;

      const x = g.x + g.char.xoffset;
      const y = 1.0 - (g.y + g.char.yoffset);

      // baseMatrix = scalingMatrix * offsetMatrix
      this.scalingMatrix = Matrix4.fromScale(g.char.width, g.char.height, 1.0);
      this.baseMatrix.multiplyMatrices(this.scalingMatrix, this.offsetMatrix);

      // scaledMatrix = fontScaleMatrix * baseMatrix
      this.scaledMatrix.multiplyMatrices(this.fontScaleMatrix, this.baseMatrix);

      // translationMatrix 使用缩放后的坐标
      this.translationMatrix = Matrix4.fromTranslation(x * fontScale, y * fontScale, 0.0);

      // localMatrix = translationMatrix * scaledMatrix
      this.localMatrix.multiplyMatrices(this.translationMatrix, this.scaledMatrix);

      // finalMatrix = worldMatrix * localMatrix
      this.finalMatrix.multiplyMatrices(worldMatrixToUse, this.localMatrix);

      // 将矩阵数据复制到数组
      const elements = this.finalMatrix.elements;

      for (let j = 0; j < 16; j++) {
        this.charMatrices[matricesBase + i * 16 + j] = elements[j];
      }
    });

    this.instanceCount = this.charMatrices.length / 16;
    this.isDirty = true;
  }

  /**
   * 清空文本内容
   */
  clear (): void {
    this.charMatrices = [];
    this.charUvs = [];
    this.instanceCount = 0;
    this.isDirty = true;
  }

  // Test Code
  //-------------------------------------------------------------------------

  text = 'Test Text';
  horizontalAlign: 'left' | 'center' | 'right' = 'center';
  verticalAlign: 'middle' | 'top' | 'bottom' = 'middle';
  // maxWidth = 2000;
  // maxHeight = 200;

  //-------------------------------------------------------------------------

  override onUpdate (dt: number): void {
    // Test Code
    //-------------------------------------------------------------------------

    this.clear();
    // 将世界空间的 size 转换为字体坐标系（除以 fontScale）
    // 因为 addParagraph 中会将所有坐标乘以 fontScale
    const fontScale = this.font?.scale ?? 1;

    this.addParagraph(this.text, {
      maxWidth: this.transform.size.x / fontScale,
      maxHeight: this.transform.size.y / fontScale,
      customLayoutEngine: createCustomLayoutEngine(this.font),
      horizontalAlign: this.horizontalAlign,
      verticalAlign: this.verticalAlign,
    });

    //-------------------------------------------------------------------------

    if (this.isDirty && this.instanceCount > 0) {
      // 更新实例化数据 - 将mat4数据分别设置到四个vec4属性
      const worldData = new Float32Array(this.charMatrices);

      this.geometry.setAttributeData('aWorld0', worldData);
      this.geometry.setAttributeData('aWorld1', worldData);
      this.geometry.setAttributeData('aWorld2', worldData);
      this.geometry.setAttributeData('aWorld3', worldData);
      this.geometry.setAttributeData('aUV', new Float32Array(this.charUvs));

      // 只需要设置 drawCount，instanceCount 通过数据长度推断
      this.geometry.setDrawCount(4);
      this.isDirty = false;
    }

    // Test Code
    //-------------------------------------------------------------------------
    this.updateBoundingBox();
    //-------------------------------------------------------------------------
  }

  // Test Code
  //-------------------------------------------------------------------------
  updateBoundingBox (): void {
    // 计算实际的容器宽高（与 addParagraph 中传入的 maxWidth/maxHeight 一致）
    const containerWidth = this.transform.size.x;
    const containerHeight = this.transform.size.y;

    // 默认 translate 是 {x: -0.5, y: -0.5}，会让文字居中
    // 所以包围盒的范围是从 -0.5 * container 到 0.5 * container
    // 再乘以 fontScale 得到实际渲染坐标
    const halfWidth = containerWidth * 0.5;
    const halfHeight = containerHeight * 0.5;

    const min = new Vector3(-halfWidth, -halfHeight, 0);
    const max = new Vector3(halfWidth, halfHeight, 0);

    this.boundingBoxInfo.reConstruct(min, max, this.transform.getWorldMatrix());
  }

  //-------------------------------------------------------------------------

  override render (renderer: Renderer): void {
    if (this.instanceCount === 0 || !this.font) {
      return;
    }

    // 设置材质参数
    this.material.setTexture('uFontAtlas', this.font.textures[0]);
    this.material.setColor('uColor', this.color);
    this.material.setColor('uStrokeColor', this.strokeColor);
    this.material.setFloat('uThickness', this.thicknessControl * 0.9);
    this.material.setFloat('uStrokeInsetWidth', this.strokeInsetWidth);
    this.material.setFloat('uStrokeOutsetWidth', this.strokeOutsetWidth);

    // 使用实例化渲染
    renderer.drawGeometryInstanced(this.geometry, this.material, this.instanceCount);
  }

  override onDestroy (): void {
    this.geometry?.dispose();
    this.material?.dispose();
  }
}
