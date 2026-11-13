import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Engine } from '../engine';
import { GraphicsBatchBuffer } from './graphics-batch-buffer';
import { GraphicsTextLayoutCache } from './graphics-text-layout';
import { VertexElementType } from './vertex-element-type';
import { Material } from '../material';
import { Circle } from '../math';
import type { Texture } from '../texture';
import type { FontStyle, FontWeight, GlyphAtlas } from './text-cache';
import { TextCache } from './text-cache';
import { buildAdaptiveBezier } from '../math/shape/build-adaptive-bezier';
import type { ShapePrimitive } from '../math/shape/shape-primitive';
import { buildCircleStrokeMesh, buildLineMesh, buildPolylineMesh, buildRectangleStrokeMesh } from './graphics-primitives';

/**
 * 纹理 UV 子矩形(Y 向上,Y=0 在底部)。 全图为 `{u0:0, v0:0, u1:1, v1:1}`
 */
export type TextureRegion = { u0: number, v0: number, u1: number, v1: number };

export type NinePatchDrawOptions = {
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  marginLeft: number,
  marginTop: number,
  marginRight: number,
  marginBottom: number,
  horizontalMode?: number,
  verticalMode?: number,
  drawCenter?: boolean,
};

/** Logical text metrics produced by the glyph atlas used for rendering. */
export type TextLineLayout = {
  characters: string[],
  /** UTF-16 offsets relative to this line, including its end. */
  boundaries: number[],
  /** Grapheme origins in display pixels, followed by the untrimmed end position. */
  positions: number[],
  width: number,
  lineHeight: number,
};

export type TextMeasurement = {
  /** Layout width, excluding trailing spaces and tabs when trimEnd is enabled. */
  width: number,
  lineHeight: number,
  /** Per-grapheme advances in display pixels, including kerning from the preceding grapheme. */
  advances: number[],
  lines: TextLineLayout[],
  /** Visible glyph bounds relative to the text's vertical layout origin. */
  inkTop: number,
  inkHeight: number,
};

type GlyphInkMetrics = { ascent: number, descent: number };

const FULL_REGION: TextureRegion = { u0: 0, v0: 0, u1: 1, v1: 1 };
const NINE_PATCH_DRAW_SOURCE_SIZE = 'aDrawSourceSize';
const NINE_PATCH_SOURCE_RECT = 'aSourceRect';
const NINE_PATCH_MARGINS = 'aMargins';
const NINE_PATCH_OPTIONS = 'aOptions';

type BatchType = 'colored' | 'textured' | 'text' | 'ninePatch';

type ClipRect = {
  x: number,
  y: number,
  width: number,
  height: number,
};

type GraphicsCommand = {
  type: BatchType | 'clip',
  texture: Texture | null,
  offset: number,
  count: number,
  clip?: ClipRect,
};

export class Graphics {
  /** Font atlases and creation defaults shared by this drawing context. */
  readonly textCache: TextCache;

  private readonly batchBuffer: GraphicsBatchBuffer;
  private readonly ninePatchBuffer: GraphicsBatchBuffer;
  private readonly commands: GraphicsCommand[] = [];
  private commandCount = 0;
  private coloredMaterial: Material;
  private texturedMaterial: Material;
  private textMaterial: Material;
  private ninePatchMaterial: Material;

  private readonly circleShape = new Circle();
  private readonly linePoints: number[] = [];
  private readonly buildPoints: number[] = [];
  private readonly shapeVertices: number[] = [];
  private readonly shapeIndices: number[] = [];

  private vertices: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];
  private ninePatchDrawSourceSizes: number[] = [];
  private ninePatchSourceRects: number[] = [];
  private ninePatchMargins: number[] = [];
  private ninePatchOptions: number[] = [];
  private currentVertexCount = 0;
  private currentIndexCount = 0;

  // 当前批次状态：批次切换时(类型变化或纹理变化)需要 flush
  private currentBatchType: BatchType = 'colored';
  private currentBatchTexture: Texture | null = null;

  private readonly textLayouts = new GraphicsTextLayoutCache();
  private readonly textInkMetrics = new WeakMap<GlyphAtlas, Map<string, GlyphInkMetrics>>();

  // 变换栈和缓存(使用 Matrix3 进行 2D 变换)
  private readonly transformStack: Matrix3[] = [new Matrix3()];
  private transformDepth = 0;
  private currentTransform = this.transformStack[0];
  private readonly projectionMatrix = new Matrix4();
  private readonly clipStack: ClipRect[] = [];
  private readonly clipRects: ClipRect[] = [];
  private clipRectCount = 0;
  private logicalWidth = 1;
  private logicalHeight = 1;

  constructor (private engine: Engine) {
    const attributes = [
      { name: VertexElementType.Position, size: 2, source: this.vertices },
      { name: VertexElementType.Color, size: 4, source: this.colors },
      { name: VertexElementType.TexCoord0, size: 2, source: this.uvs },
    ];

    this.batchBuffer = new GraphicsBatchBuffer(engine, attributes, this.indices);
    this.ninePatchBuffer = new GraphicsBatchBuffer(engine, [
      ...attributes,
      { name: NINE_PATCH_DRAW_SOURCE_SIZE, size: 4, source: this.ninePatchDrawSourceSizes },
      { name: NINE_PATCH_SOURCE_RECT, size: 4, source: this.ninePatchSourceRects },
      { name: NINE_PATCH_MARGINS, size: 4, source: this.ninePatchMargins },
      { name: NINE_PATCH_OPTIONS, size: 4, source: this.ninePatchOptions },
    ], this.indices);

    this.coloredMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        varying vec4 vColor;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        void main() {
          vec4 color = vColor;
          color.rgb *= color.a;
          gl_FragColor = color;
        }`,
      },
    });
    this.coloredMaterial.depthTest = false;
    this.coloredMaterial.depthMask = false;
    this.coloredMaterial.blending = true;

    this.texturedMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        attribute vec2 aUV;
        varying vec4 vColor;
        varying vec2 vUV;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          vUV = aUV;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        varying vec2 vUV;
        uniform sampler2D uMainTexture;
        void main() {
          vec4 color = texture2D(uMainTexture, vUV) * vColor;
          color.rgb *= color.a;
          gl_FragColor = color;
        }`,
      },
    });
    this.texturedMaterial.depthTest = false;
    this.texturedMaterial.depthMask = false;
    this.texturedMaterial.blending = true;

    this.ninePatchMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        attribute vec2 aUV;
        attribute vec4 aDrawSourceSize;
        attribute vec4 aSourceRect;
        attribute vec4 aMargins;
        attribute vec4 aOptions;
        varying vec4 vColor;
        varying vec2 vUV;
        varying vec4 vDrawSourceSize;
        varying vec4 vSourceRect;
        varying vec4 vMargins;
        varying vec4 vOptions;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          vUV = aUV;
          vDrawSourceSize = aDrawSourceSize;
          vSourceRect = aSourceRect;
          vMargins = aMargins;
          vOptions = aOptions;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        varying vec2 vUV;
        varying vec4 vDrawSourceSize;
        varying vec4 vSourceRect;
        varying vec4 vMargins;
        varying vec4 vOptions;
        uniform sampler2D uMainTexture;

        float mapNinePatchAxis(
          float pixel,
          float drawSize,
          float sourceSize,
          float marginBegin,
          float marginEnd,
          float repeatMode,
          inout float drawCenter
        ) {
          if (pixel < marginBegin) {
            return pixel / sourceSize;
          } else if (pixel >= drawSize - marginEnd) {
            return (sourceSize - (drawSize - pixel)) / sourceSize;
          } else {
            if (vOptions.z < 0.5) {
              drawCenter -= 1.0;
            }

            if (repeatMode < 0.5) {
              float ratio = (pixel - marginBegin) / (drawSize - marginBegin - marginEnd);
              return (marginBegin + ratio * (sourceSize - marginBegin - marginEnd)) / sourceSize;
            } else if (repeatMode < 1.5) {
              float offset = mod(pixel - marginBegin, sourceSize - marginBegin - marginEnd);
              return (marginBegin + offset) / sourceSize;
            } else {
              float drawArea = drawSize - marginBegin - marginEnd;
              float sourceArea = sourceSize - marginBegin - marginEnd;
              float scale = max(1.0, floor(drawArea / max(sourceArea, 0.0000001) + 0.5));
              float ratio = mod((pixel - marginBegin) / drawArea * scale, 1.0);
              return (marginBegin + ratio * sourceArea) / sourceSize;
            }
          }
        }

        void main() {
          vec2 pixel = vec2(vUV.x, 1.0 - vUV.y) * vDrawSourceSize.xy;
          float drawCenter = 2.0;
          vec2 sourceUV = vec2(
            mapNinePatchAxis(
              pixel.x, vDrawSourceSize.x, vDrawSourceSize.z,
              vMargins.x, vMargins.z, vOptions.x, drawCenter
            ),
            mapNinePatchAxis(
              pixel.y, vDrawSourceSize.y, vDrawSourceSize.w,
              vMargins.y, vMargins.w, vOptions.y, drawCenter
            )
          );

          if (drawCenter < 0.5) {
            discard;
          }

          vec2 uv = vec2(
            vSourceRect.x + sourceUV.x * vSourceRect.z,
            vSourceRect.y - sourceUV.y * vSourceRect.w
          );
          vec4 color = texture2D(uMainTexture, uv) * vColor;
          color.rgb *= color.a;
          gl_FragColor = color;
        }`,
      },
    });
    this.ninePatchMaterial.depthTest = false;
    this.ninePatchMaterial.depthMask = false;
    this.ninePatchMaterial.blending = true;

    // 文本 atlas 在上传时预乘 alpha，因此纹理 RGB 只需乘顶点色和顶点 alpha。
    // 单独使用 material，避免改变 drawTexture 对普通非预乘纹理的处理。
    this.textMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        attribute vec2 aUV;
        varying vec4 vColor;
        varying vec2 vUV;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          vUV = aUV;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        varying vec2 vUV;
        uniform sampler2D uMainTexture;
        void main() {
          vec4 textureColor = texture2D(uMainTexture, vUV);
          float alpha = textureColor.a * vColor.a;
          vec3 rgb = textureColor.rgb * vColor.rgb * vColor.a;
          gl_FragColor = vec4(rgb, alpha);
        }`,
      },
    });
    this.textMaterial.depthTest = false;
    this.textMaterial.depthMask = false;
    this.textMaterial.blending = true;

    this.textCache = new TextCache(engine);
  }

  /**
   * 清空缓冲区，准备新的绘制批次
   */
  begin (): void {
    this.clearBatch();
    this.batchBuffer.clear(); this.ninePatchBuffer.clear(); this.commandCount = 0;

    this.transformDepth = 0;
    this.currentTransform = this.transformStack[0].identity();
    this.clipStack.length = 0;
    this.clipRectCount = 0;

    this.currentBatchType = 'colored';
    this.currentBatchTexture = null;
    this.engine.displayServer.renderingDevice.setScissorTest(false);

    // 创建从屏幕坐标到 NDC 的投影矩阵，屏幕坐标：(0, 0) 在左上角，(width, height) 在右下角，+Y 向下。
    const bounds = this.engine.canvas.getBoundingClientRect();
    const width = bounds.width || this.engine.canvas.width / this.engine.displayServer.pixelRatio || 1;
    const height = bounds.height || this.engine.canvas.height / this.engine.displayServer.pixelRatio || 1;

    this.logicalWidth = width;
    this.logicalHeight = height;

    // 正交投影矩阵：将屏幕坐标 [0, width] x [0, height] 映射到 NDC [-1, 1] x [-1, 1]
    const projectionMatrix = this.projectionMatrix.set(
      2 / width, 0, 0, 0,  // 第一列
      0, -2 / height, 0, 0,  // 第二列
      0, 0, -1, 0,  // 第三列
      -1, 1, 0, 1   // 第四列
    );

    this.coloredMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
    this.texturedMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
    this.textMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
    this.ninePatchMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
  }

  /**
   * 将当前变换压入栈，并设置新的变换
   * @param transform - 新的变换矩阵(会与当前变换相乘)
   */
  pushTransform (transform: Matrix3): void {
    const previous = this.currentTransform;

    this.currentTransform = this.transformStack[++this.transformDepth] ??= new Matrix3();
    this.currentTransform.multiplyMatrices(previous, transform);
  }

  /**
   * 恢复上一个变换
   */
  popTransform (): void {
    if (this.transformDepth === 0) {
      console.warn('Render2D: 变换栈为空,无法弹出');

      return;
    }

    this.currentTransform = this.transformStack[--this.transformDepth];
  }

  /** Pushes a local rectangular child clip using a screen-space AABB scissor. */
  pushClipRect (x: number, y: number, width: number, height: number): void {
    const elements = this.currentTransform.elements;
    const x0 = elements[0] * x + elements[3] * y + elements[6];
    const y0 = elements[1] * x + elements[4] * y + elements[7];
    const x1 = elements[0] * (x + width) + elements[3] * y + elements[6];
    const y1 = elements[1] * (x + width) + elements[4] * y + elements[7];
    const x2 = elements[0] * x + elements[3] * (y + height) + elements[6];
    const y2 = elements[1] * x + elements[4] * (y + height) + elements[7];
    const x3 = elements[0] * (x + width) + elements[3] * (y + height) + elements[6];
    const y3 = elements[1] * (x + width) + elements[4] * (y + height) + elements[7];
    let left = Math.min(x0, x1, x2, x3);
    let top = Math.min(y0, y1, y2, y3);
    let right = Math.max(x0, x1, x2, x3);
    let bottom = Math.max(y0, y1, y2, y3);

    const parent = this.clipStack[this.clipStack.length - 1];

    if (parent) {
      left = Math.max(left, parent.x);
      top = Math.max(top, parent.y);
      right = Math.min(right, parent.x + parent.width);
      bottom = Math.min(bottom, parent.y + parent.height);
    }

    const clip = this.clipRects[this.clipRectCount++] ??= { x: 0, y: 0, width: 0, height: 0 };

    clip.x = left; clip.y = top;
    clip.width = Math.max(0, right - left); clip.height = Math.max(0, bottom - top);
    const previous = parent;

    if (!this.clipRectsEqual(previous, clip)) {
      this.flushBatch();
      this.nextCommand('clip').clip = clip;
    }
    this.clipStack.push(clip);
  }

  /** Restores the parent rectangular clip. */
  popClipRect (): void {
    const previous = this.clipStack[this.clipStack.length - 1];

    if (!previous) {
      console.warn('Graphics: clip stack is empty.');

      return;
    }

    const clip = this.clipStack[this.clipStack.length - 2];

    if (!this.clipRectsEqual(previous, clip)) {
      this.flushBatch();
      this.nextCommand('clip').clip = clip;
    }
    this.clipStack.pop();
  }

  /**
   * 刷新并渲染所有累积的绘制命令
   */
  end (): void {
    this.flushBatch();
    this.submitBatches();
    this.clipStack.length = 0;
    this.engine.displayServer.renderingDevice.setScissorTest(false);
  }

  /**
   * 切换到指定批次类型/纹理。若与当前批次不一致，先 flush 已累积顶点
   */
  private ensureBatch (type: BatchType, texture: Texture | null = null): void {
    const sameBatch = this.currentBatchType === type
      && (type === 'colored' || this.currentBatchTexture === texture);

    if (!sameBatch && this.currentVertexCount > 0) {
      this.flushBatch();
    }

    this.currentBatchType = type;
    this.currentBatchTexture = texture;
  }

  private applyClipRect (clip: ClipRect): void {
    const framebufferWidth = this.engine.canvas.width;
    const framebufferHeight = this.engine.canvas.height;
    const scaleX = framebufferWidth / this.logicalWidth;
    const scaleY = framebufferHeight / this.logicalHeight;
    const left = Math.max(0, Math.min(framebufferWidth, Math.floor(clip.x * scaleX)));
    const top = Math.max(0, Math.min(framebufferHeight, Math.floor(clip.y * scaleY)));
    const right = Math.max(left, Math.min(framebufferWidth, Math.ceil((clip.x + clip.width) * scaleX)));
    const bottom = Math.max(top, Math.min(framebufferHeight, Math.ceil((clip.y + clip.height) * scaleY)));

    this.engine.displayServer.renderingDevice.setScissorTest(true);
    this.engine.displayServer.renderingDevice.setScissor(left, framebufferHeight - bottom, right - left, bottom - top);
  }

  private clipRectsEqual (left?: ClipRect, right?: ClipRect): boolean {
    if (!left || !right) {
      return left === right;
    }

    return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
  }

  /** Records the current batch without changing its position in the draw order. */
  private flushBatch (): void {
    if (this.currentVertexCount === 0 || this.currentIndexCount === 0) {
      return;
    }

    const buffer = this.currentBatchType === 'ninePatch' ? this.ninePatchBuffer : this.batchBuffer;

    // Submit before rebasing would overflow the shared 16-bit index range.
    if (buffer.vertexCount + this.currentVertexCount > GraphicsBatchBuffer.maxVertices) {
      this.submitBatches();
    }
    const command = this.nextCommand(this.currentBatchType);

    command.texture = this.currentBatchTexture;
    command.offset = buffer.indexCount * Uint16Array.BYTES_PER_ELEMENT;
    command.count = this.currentIndexCount;
    buffer.append(this.currentVertexCount, this.currentIndexCount); this.clearBatch();
  }

  private nextCommand (type: GraphicsCommand['type']): GraphicsCommand {
    const command = this.commands[this.commandCount] ??= { type, texture: null, offset: 0, count: 0 };

    this.commandCount++;
    command.type = type; command.texture = null; command.clip = undefined;

    return command;
  }

  private submitBatches (): void {
    if (this.commandCount === 0) { return; }
    this.textCache.uploadDirty();
    this.batchBuffer.upload(); this.ninePatchBuffer.upload();
    for (let index = 0; index < this.commandCount; index++) {
      const command = this.commands[index];

      if (command.type === 'clip') {
        if (command.clip) { this.applyClipRect(command.clip); } else {
          this.engine.displayServer.renderingDevice.setScissorTest(false);
        }
      } else {
        const geometry = command.type === 'ninePatch' ? this.ninePatchBuffer.geometry : this.batchBuffer.geometry;
        const material = command.type === 'text' ? this.textMaterial
          : command.type === 'ninePatch' ? this.ninePatchMaterial
            : command.type === 'textured' ? this.texturedMaterial : this.coloredMaterial;

        if (command.type !== 'colored') {
          material.setTexture('uMainTexture', command.texture ?? this.engine.assetServer.whiteTexture);
        }
        geometry.setDrawStart(command.offset); geometry.setDrawCount(command.count);
        this.engine.renderer.drawGeometry(geometry, Matrix4.IDENTITY, material);
      }
      command.texture = null; command.clip = undefined;
    }
    this.commandCount = 0; this.batchBuffer.clear(); this.ninePatchBuffer.clear();
  }

  private clearBatch (): void {
    // Reset the used ranges without discarding the arrays' retained storage.
    this.currentVertexCount = 0;
    this.currentIndexCount = 0;
  }

  private reserveVertices (count: number): void {
    if (this.currentVertexCount + count > GraphicsBatchBuffer.maxVertices) {
      this.flushBatch();
    }
  }

  /**
   * 线段顶点按顺序连接 (p0-p1, p1-p2, p2-p3, ...)
   * @param points - 点数组，格式 [x1,y1,x2,y2,...]，至少需要2个点(4个数值)
   * @param color - 线条颜色，范围 0-1
   * @param thickness - 线宽(像素)
   */
  drawLines (points: number[], color: Color = Color.WHITE, thickness: number = 1.0): void {
    if (!points || points.length < 4 || points.length % 2 !== 0) {
      console.warn('drawLines: 至少需要2个点（4个数值），且数组长度必须为偶数');

      return;
    }

    const closed = points[0] === points[points.length - 2] && points[1] === points[points.length - 1];

    this.buildPolyline(points, color, thickness, closed);
  }

  /**
   * 绘制单条线段
   * @param x1 - 起点 X 坐标
   * @param y1 - 起点 Y 坐标
   * @param x2 - 终点 X 坐标
   * @param y2 - 终点 Y 坐标
   * @param color - 线条颜色，默认白色，范围 0-1
   * @param thickness - 线宽(像素)，默认 1
   */
  drawLine (x1: number, y1: number, x2: number, y2: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    buildLineMesh(x1, y1, x2, y2, thickness, this.shapeVertices, this.shapeIndices);
    this.appendShape(color);
  }

  /**
   * 绘制三阶贝塞尔曲线（P0 起点，P1/P2 控制点，P3 终点）
   * @param x1 - P0 起点 X 坐标
   * @param y1 - P0 起点 Y 坐标
   * @param x2 - P1 第一控制点 X 坐标
   * @param y2 - P1 第一控制点 Y 坐标
   * @param x3 - P2 第二控制点 X 坐标
   * @param y3 - P2 第二控制点 Y 坐标
   * @param x4 - P3 终点 X 坐标
   * @param y4 - P3 终点 Y 坐标
   * @param color - 曲线颜色，默认白色，范围 0-1
   * @param thickness - 线宽(像素)，默认 1
   */
  drawBezier (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    const bezierPoints = this.buildPoints;

    bezierPoints.length = 0;
    bezierPoints.push(x1, y1);
    buildAdaptiveBezier(bezierPoints, x1, y1, x2, y2, x3, y3, x4, y4, undefined, this.getScreenScale());

    this.buildPolyline(bezierPoints, color, thickness, false);
  }

  /**
   * 绘制三角形边框（闭合连接 3 个顶点）
   * @param x1 - 顶点 1 X 坐标
   * @param y1 - 顶点 1 Y 坐标
   * @param x2 - 顶点 2 X 坐标
   * @param y2 - 顶点 2 Y 坐标
   * @param x3 - 顶点 3 X 坐标
   * @param y3 - 顶点 3 Y 坐标
   * @param color - 边框颜色，默认白色，范围 0-1
   * @param thickness - 线宽(像素)，默认 1
   */
  drawTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.buildPoints.length = 0;
    this.buildPoints.push(x1, y1, x2, y2, x3, y3);
    this.buildPolyline(this.buildPoints, color, thickness, true);
  }

  /**
   * 绘制矩形边框
   * @param x - 矩形左上角 X 坐标
   * @param y - 矩形左上角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 边框颜色，默认白色，范围 0-1
   * @param thickness - 线宽(像素)，默认 1
   */
  drawRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    buildRectangleStrokeMesh(x, y, width, height, thickness, this.shapeVertices, this.shapeIndices);
    this.appendShape(color);
  }

  /**
   * 绘制圆形边框
   * @param cx - 圆心 X 坐标
   * @param cy - 圆心 Y 坐标
   * @param radius - 半径(像素)
   * @param color - 边框颜色，默认白色，范围 0-1
   * @param thickness - 线宽(像素)，默认 1
   */
  drawCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    buildCircleStrokeMesh(cx, cy, radius, thickness, this.getScreenScale(), this.shapeVertices, this.shapeIndices);
    this.appendShape(color);
  }

  /**
   * 绘制填充三角形（实心）
   * @param x1 - 顶点 1 X 坐标
   * @param y1 - 顶点 1 Y 坐标
   * @param x2 - 顶点 2 X 坐标
   * @param y2 - 顶点 2 Y 坐标
   * @param x3 - 顶点 3 X 坐标
   * @param y3 - 顶点 3 Y 坐标
   * @param color - 填充颜色，默认白色，范围 0-1
   */
  fillTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE): void {
    this.ensureBatch('colored');
    this.reserveVertices(3);
    const vertexOffset = this.currentVertexCount;
    const vertexStart = vertexOffset * 2;
    const indexOffset = this.currentIndexCount;

    this.vertices[vertexStart] = x1; this.vertices[vertexStart + 1] = y1;
    this.vertices[vertexStart + 2] = x2; this.vertices[vertexStart + 3] = y2;
    this.vertices[vertexStart + 4] = x3; this.vertices[vertexStart + 5] = y3;
    this.indices[indexOffset] = vertexOffset;
    this.indices[indexOffset + 1] = vertexOffset + 1;
    this.indices[indexOffset + 2] = vertexOffset + 2;
    this.currentVertexCount += 3; this.currentIndexCount += 3;
    this.applyTransformAndColor(vertexOffset, 3, color);
  }

  /**
   * 绘制填充矩形
   * @param x - 矩形左上角 X 坐标
   * @param y - 矩形左上角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 填充颜色，默认白色，范围 0-1
   *
   * 通过 pushQuad 写入 4 个顶点和 6 个索引，并应用当前变换和顶点色。
   */
  fillRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE): void {
    this.ensureBatch('colored');
    this.pushQuad(x, y, width, height, color);
  }

  /**
   * 绘制填充圆形（实心）
   * @param cx - 圆心 X 坐标
   * @param cy - 圆心 Y 坐标
   * @param radius - 半径(像素)
   * @param color - 填充颜色，默认白色，范围 0-1
   */
  fillCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE): void {
    this.setCircleShape(cx, cy, radius);
    this.buildShape(this.circleShape, color);
  }

  /**
   * 绘制纹理矩形（本地坐标，Y 向下，(x, y) 为左上角）
   * @param x - 矩形左上角 X 坐标
   * @param y - 矩形左上角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param texture - 要采样的纹理。同纹理连续绘制会合批，纹理切换会自动 flush 当前批次
   * @param region - 纹理 UV 子矩形，默认全图。Y 向上，(u0,v0) 为左下角 UV
   * @param color - 乘色，默认白色
   */
  drawTexture (
    x: number, y: number, width: number, height: number,
    texture: Texture,
    region: TextureRegion = FULL_REGION,
    color: Color = Color.WHITE,
  ): void {
    this.ensureBatch('textured', texture);
    this.pushQuad(x, y, width, height, color, region.u0, region.v0, region.u1, region.v1);
  }

  /**
   * Draws a nine-patch as one quad. Stretching and repetition are resolved in the fragment shader,
   * so Tile and TileFit do not expand into CPU-side geometry.
   */
  drawNinePatch (
    x: number, y: number, width: number, height: number,
    texture: Texture,
    options: NinePatchDrawOptions,
    color: Color = Color.WHITE,
  ): void {
    if (width <= 0 || height <= 0 || options.sourceWidth <= 0 || options.sourceHeight <= 0) {
      return;
    }

    this.ensureBatch('ninePatch', texture);
    const sourceU = options.sourceX / texture.width;
    const sourceV = 1 - options.sourceY / texture.height;
    const sourceUSize = options.sourceWidth / texture.width;
    const sourceVSize = options.sourceHeight / texture.height;
    const horizontalMode = options.horizontalMode ?? 0;
    const verticalMode = options.verticalMode ?? 0;
    const drawCenter = Number(options.drawCenter ?? true);

    this.pushQuad(x, y, width, height, color, 0, 0, 1, 1);
    const vertexOffset = this.currentVertexCount - 4;

    for (let i = 0; i < 4; i++) {
      const offset = (vertexOffset + i) * 4;

      this.ninePatchDrawSourceSizes[offset] = width;
      this.ninePatchDrawSourceSizes[offset + 1] = height;
      this.ninePatchDrawSourceSizes[offset + 2] = options.sourceWidth;
      this.ninePatchDrawSourceSizes[offset + 3] = options.sourceHeight;
      this.ninePatchSourceRects[offset] = sourceU;
      this.ninePatchSourceRects[offset + 1] = sourceV;
      this.ninePatchSourceRects[offset + 2] = sourceUSize;
      this.ninePatchSourceRects[offset + 3] = sourceVSize;
      this.ninePatchMargins[offset] = options.marginLeft;
      this.ninePatchMargins[offset + 1] = options.marginTop;
      this.ninePatchMargins[offset + 2] = options.marginRight;
      this.ninePatchMargins[offset + 3] = options.marginBottom;
      this.ninePatchOptions[offset] = horizontalMode;
      this.ninePatchOptions[offset + 1] = verticalMode;
      this.ninePatchOptions[offset + 2] = drawCenter;
      this.ninePatchOptions[offset + 3] = 0;
    }
  }

  /**
   * 绘制文本（本地坐标，Y 向下，(x, y) 为文本 cell 左上角）。
   *
   * 文本走字符级 bitmap atlas（同一字体下每个字只渲染一次，任意文本组合复用 atlas）;
   * `color` 与 atlas 字形 RGBA 相乘，任意颜色都不会污染 atlas。
   *
   * 字体参数全部展开，避免调用方每帧创建临时 style 对象触发 GC
   * @param x - 文本排版起点 X 坐标，字形 bearing 和透明 padding 由缓存计算
   * @param y - 文本 cell 顶部 Y 坐标
   * @param text - 要绘制的文本内容，空串直接 return
   * @param fontSize - 字号（逻辑像素）
   * @param color - 乘色，默认白色，范围 0-1
   * @param fontFamily - 字体族，默认 `sans-serif`
   * @param fontWeight - 字重，默认 `normal`，支持 `'bold'` 或数字
   * @param fontStyle - 字形，默认 `normal`，支持 `'italic'`
   */
  drawText (
    x: number, y: number,
    text: string,
    fontSize: number,
    color: Color = Color.WHITE,
    fontFamily: string = 'sans-serif',
    fontWeight: FontWeight = 'normal',
    fontStyle: FontStyle = 'normal',
  ): void {
    if (!text) {
      return;
    }
    const atlas = this.getTextAtlas(fontSize, fontFamily, fontWeight, fontStyle);
    const { layout } = this.textLayouts.get(atlas, text, fontSize);
    let currentY = atlas.baseLineOffset;
    let linePositionYShift = (atlas.lineHeight - atlas.fontMetrics.fontSize) / 2;

    if (linePositionYShift - atlas.baseLineOffset < 0) {
      linePositionYShift = 0;
    }
    for (const line of layout.lines) {
      for (let i = 0; i < line.charPositions.length; i++) {
        const data = atlas.chars[line.chars[i]];

        if (data?.page === undefined || !data.frame) {
          continue;
        }
        const page = atlas.pages[data.page];
        const frame = data.frame;

        this.ensureBatch('text', page.texture);
        this.pushQuad(
          x + Math.round(line.charPositions[i] + data.xOffset) * layout.scale,
          y + Math.round(currentY + data.yOffset + linePositionYShift) * layout.scale,
          frame.width * layout.scale, frame.height * layout.scale,
          color,
          frame.x / page.width, 1 - (frame.y + frame.height) / page.height,
          (frame.x + frame.width) / page.width, 1 - frame.y / page.height,
        );
      }
      currentY += atlas.lineHeight;
    }
  }

  /** Measures the same grapheme layout and font scale used for rendering. */
  measureText (
    text: string,
    fontSize: number,
    fontFamily: string = 'sans-serif',
    fontWeight: FontWeight = 'normal',
    fontStyle: FontStyle = 'normal',
    trimEnd = true,
  ): TextMeasurement {
    const atlas = this.getTextAtlas(fontSize, fontFamily, fontWeight, fontStyle);
    const cached = this.textLayouts.get(atlas, text, fontSize, trimEnd);
    const layout = cached.layout;
    const advances: number[] = [];
    const lineBreaks: string[] = [];
    let previous: string | undefined;

    for (const char of cached.characters ??= TextCache.graphemeSegmenter(text)) {
      const data = atlas.chars[char];

      advances.push((data.xAdvance + (data.kerning[previous!] || 0)) * layout.scale);
      if (char === '\r' || char === '\n') {lineBreaks.push(char);}
      previous = char;
    }

    const lineHeight = atlas.lineHeight * layout.scale;
    const lines: TextLineLayout[] = [];
    const lineShift = Math.max(0, (atlas.lineHeight - atlas.fontMetrics.fontSize) / 2);
    let inkTop = Infinity;
    let inkBottom = -Infinity;

    // The final empty line is a layout sentinel, including for empty input.
    for (let lineIndex = 0; lineIndex < layout.lines.length - 1; lineIndex++) {
      const line = layout.lines[lineIndex];
      const boundaries = [0];
      const positions: number[] = [];
      let offset = 0;
      let cursor = 0;
      let previousCharacter: string | undefined = lineBreaks[lineIndex - 1];

      for (let i = 0; i < line.chars.length; i++) {
        const character = line.chars[i];
        const glyph = atlas.chars[character];
        // Whitespace has no drawable origin in the bitmap layout, but still occupies editing space.
        const position = /\s/.test(character)
          ? cursor + (glyph.kerning[previousCharacter] || 0)
          : line.charPositions[i];

        positions.push((Math.round(position + glyph.xOffset) - glyph.xOffset) * layout.scale);
        cursor = position + glyph.xAdvance;
        offset += character.length;
        boundaries.push(offset);
        previousCharacter = character;

        if (glyph.page !== undefined) {
          const metrics = this.getGlyphInkMetrics(atlas, character);

          if (metrics.ascent !== 0 || metrics.descent !== 0) {
            const top = Math.round(atlas.baseLineOffset + lineIndex * atlas.lineHeight + glyph.yOffset + lineShift) - glyph.yOffset;
            const baseline = top + atlas.fontMetrics.ascent;

            inkTop = Math.min(inkTop, (baseline - metrics.ascent) * layout.scale);
            inkBottom = Math.max(inkBottom, (baseline + metrics.descent) * layout.scale);
          }
        }
      }
      positions.push(cursor * layout.scale);
      lines.push({
        characters: line.chars.slice(), boundaries, positions,
        width: line.width * layout.scale, lineHeight,
      });
    }

    return {
      width: layout.width * layout.scale,
      lineHeight, advances, lines,
      inkTop: inkTop === Infinity ? 0 : inkTop,
      inkHeight: inkTop === Infinity ? 0 : inkBottom - inkTop,
    };
  }

  private getGlyphInkMetrics (atlas: GlyphAtlas, character: string): GlyphInkMetrics {
    let cache = this.textInkMetrics.get(atlas);

    if (!cache) {
      cache = new Map();
      this.textInkMetrics.set(atlas, cache);
    }
    let metrics = cache.get(character);

    if (!metrics) {
      const context = atlas.pages[0].canvasAndContext.context;
      const measured = context.measureText(character);
      const scale = atlas.baseMeasurementFontSize / atlas.baseRenderedFontSize;

      metrics = {
        ascent: (measured.actualBoundingBoxAscent ?? 0) * scale,
        descent: (measured.actualBoundingBoxDescent ?? 0) * scale,
      };
      cache.set(character, metrics);
    }

    return metrics;
  }

  private getTextAtlas (fontSize: number, fontFamily: string, fontWeight: FontWeight, fontStyle: FontStyle): GlyphAtlas {
    if (this.textCache.resolution !== this.engine.displayServer.pixelRatio) {
      // Submit pending text before the resolution change destroys its pages.
      this.flushBatch();
      this.submitBatches();
    }

    return this.textCache.getAtlas(fontSize, fontFamily, fontWeight, fontStyle);
  }

  dispose (): void {
    this.batchBuffer.dispose();
    this.ninePatchBuffer.dispose();
    this.coloredMaterial.dispose();
    this.texturedMaterial.dispose();
    this.textMaterial.dispose();
    this.ninePatchMaterial.dispose();
    this.textLayouts.clear();
    this.textCache.dispose();
  }

  private buildShape (shape: ShapePrimitive, color: Color): void {
    const buildPoints = this.buildPoints;

    buildPoints.length = 0;
    shape.build(buildPoints, this.getScreenScale());
    this.shapeVertices.length = 0; this.shapeIndices.length = 0;
    shape.triangulate(buildPoints, this.shapeVertices, 0, this.shapeIndices, 0);
    this.appendShape(color);
  }

  private buildPolyline (points: readonly number[], color: Color, thickness: number, closed: boolean): void {
    const linePoints = this.linePoints;

    linePoints.length = 0;
    for (let index = 0; index < points.length; index += 2) {
      const x = points[index], y = points[index + 1];

      if (linePoints.length > 0 && x === linePoints[linePoints.length - 2] && y === linePoints[linePoints.length - 1]) { continue; }
      linePoints.push(x, y);
    }
    if (closed && linePoints.length > 2 && linePoints[0] === linePoints[linePoints.length - 2] && linePoints[1] === linePoints[linePoints.length - 1]) {
      linePoints.length -= 2;
    }
    buildPolylineMesh(linePoints, thickness, closed, this.shapeVertices, this.shapeIndices);
    this.appendShape(color);
  }

  private appendShape (color: Color): void {
    const count = this.shapeVertices.length / 2;

    if (this.shapeIndices.length === 0) { return; }
    this.ensureBatch('colored');
    this.reserveVertices(count);
    const vertexOffset = this.currentVertexCount;
    const vertexStart = vertexOffset * 2;

    for (let index = 0; index < this.shapeVertices.length; index++) {
      this.vertices[vertexStart + index] = this.shapeVertices[index];
    }
    for (let index = 0; index < this.shapeIndices.length; index++) {
      this.indices[this.currentIndexCount + index] = this.shapeIndices[index] + vertexOffset;
    }
    this.currentVertexCount += count; this.currentIndexCount += this.shapeIndices.length;

    this.applyTransformAndColor(vertexOffset, count, color);
  }

  private getScreenScale (): number {
    const transform = this.currentTransform.elements;
    const transformScaleX = Math.hypot(transform[0], transform[1]);
    const transformScaleY = Math.hypot(transform[3], transform[4]);
    const framebufferScaleX = this.engine.canvas.width / this.logicalWidth;
    const framebufferScaleY = this.engine.canvas.height / this.logicalHeight;

    return Math.max(transformScaleX * framebufferScaleX, transformScaleY * framebufferScaleY, 1);
  }

  private setCircleShape (x: number, y: number, radius: number): void {
    this.circleShape.x = x;
    this.circleShape.y = y;
    this.circleShape.radius = radius;
  }

  private applyTransformAndColor (vertexOffset: number, count: number, color: Color): void {
    for (let i = 0; i < count; i++) {
      const vertexStart = (vertexOffset + i) * 2;
      const colorStart = (vertexOffset + i) * 4;

      this.applyTransform(this.vertices[vertexStart], this.vertices[vertexStart + 1], this.vertices, vertexStart);

      this.colors[colorStart] = color.r;
      this.colors[colorStart + 1] = color.g;
      this.colors[colorStart + 2] = color.b;
      this.colors[colorStart + 3] = color.a;

      // colored 批次的 UV 不会被读取,但仍写入 0 以保持 vertices/uvs 数组等长
      this.uvs[vertexStart] = 0;
      this.uvs[vertexStart + 1] = 0;
    }
  }

  /**
   * 推一个 quad（4 顶点 + 6 索引，2 个三角形）。
   *
   * - colored 批次：UV 写 0（shader 不读）
   * - textured 批次：UV 按纹理子区域写
   *
   * 顶点写入前应用当前变换，索引以当前批次的顶点偏移为起点。
   */
  private pushQuad (
    x: number, y: number, width: number, height: number,
    color: Color,
    u0 = 0, v0 = 0, u1 = 0, v1 = 0,
  ): void {
    this.reserveVertices(4);
    const vertexOffset = this.currentVertexCount;

    // 4 顶点（本地坐标，左上/右上/左下/右下），应用当前变换写入 vertices
    const vertexStart = vertexOffset * 2;

    this.applyTransform(x, y, this.vertices, vertexStart);
    this.applyTransform(x + width, y, this.vertices, vertexStart + 2);
    this.applyTransform(x, y + height, this.vertices, vertexStart + 4);
    this.applyTransform(x + width, y + height, this.vertices, vertexStart + 6);
    this.uvs[vertexStart] = u0; this.uvs[vertexStart + 1] = v1;
    this.uvs[vertexStart + 2] = u1; this.uvs[vertexStart + 3] = v1;
    this.uvs[vertexStart + 4] = u0; this.uvs[vertexStart + 5] = v0;
    this.uvs[vertexStart + 6] = u1; this.uvs[vertexStart + 7] = v0;

    for (let i = 0; i < 4; i++) {
      const cIndex = (vertexOffset + i) * 4;

      this.colors[cIndex] = color.r;
      this.colors[cIndex + 1] = color.g;
      this.colors[cIndex + 2] = color.b;
      this.colors[cIndex + 3] = color.a;
    }
    const indexOffset = this.currentIndexCount;

    this.indices[indexOffset] = vertexOffset;
    this.indices[indexOffset + 1] = vertexOffset + 1;
    this.indices[indexOffset + 2] = vertexOffset + 2;
    this.indices[indexOffset + 3] = vertexOffset + 2;
    this.indices[indexOffset + 4] = vertexOffset + 1;
    this.indices[indexOffset + 5] = vertexOffset + 3;
    this.currentVertexCount += 4; this.currentIndexCount += 6;
  }

  /**
   * 应用自定义变换到点
   * @param x - 点的 x 坐标
   * @param y - 点的 y 坐标
   * @param result - 变换结果存储数组
   * @param offset - 存储数组的偏移位置
   */
  private applyTransform (x: number, y: number, result: number[], offset = 0): void {
    const m = this.currentTransform.elements;

    result[offset] = m[0] * x + m[3] * y + m[6];
    result[offset + 1] = m[1] * x + m[4] * y + m[7];
  }
}
