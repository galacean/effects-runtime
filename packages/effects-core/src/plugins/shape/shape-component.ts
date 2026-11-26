import { Box3 } from '@galacean/effects-math/es/core/box3';
import { Color } from '@galacean/effects-math/es/core/color';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Box2 } from '@galacean/effects-math/es/extension/box2';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { Maskable, Material } from '../../material';
import type { Renderer } from '../../render';
import { BufferUsage, Geometry, VertexElementType, getWorldTriangles } from '../../render';
import type { StrokeAttributes } from '../../math';
import { StarType } from '../../math';
import type { ItemRenderer } from '../../components';
import { RendererComponent } from '../../components';
import type { Texture } from '../../texture/texture';
import { glContext } from '../../gl';
import type { Paint, SolidPaint } from './paint';
import { applyPaintRendererOptions, createPaint, createPaintMaterial, updatePaintMaterial } from './paint';
import { TrimPath } from './trim-path';
import { TrimmedPathResult } from './trimmed-path-result';
import { GraphicsPath } from './graphics-path';
import { appendBezierPath, buildPathGeometry } from './path-geometry';
import { Transform } from '../../transform';
import { getContourPathBounds, makeStrokeContourPath } from './contour-path';
import { expandStrokePath, flattenStrokePath } from '../../math/shape/stroke-expansion';
import { triangulate } from '../../math/shape/triangulate';
import type { HitTestTriangleParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';

export * from './paint';

interface ShapeAttributes {
  /**
   * 矢量图形类型
   */
  type: spec.ShapePrimitiveType,
  transform?: spec.TransformData,
}

/**
 * 自定义图形参数
 */
interface CustomShapeAttribute extends ShapeAttributes, spec.MaskPathData {
  type: spec.ShapePrimitiveType.Custom,
  /**
   * 路径点
   */
  points: Vector2[],
  /**
   * 入射控制点
   */
  easingIns: Vector2[],
  /**
   * 入射控制点
   */
  easingOuts: Vector2[],
}

/**
 * 椭圆组件参数
 */
export interface EllipseAttribute extends ShapeAttributes {
  type: spec.ShapePrimitiveType.Ellipse,
  /**
   * x 轴半径
   * -- TODO 后续完善类型
   * -- TODO 可以看一下用xRadius/yRadius 还是 width/height
   */
  xRadius: number,
  /**
   * y 轴半径
   */
  yRadius: number,
}

/**
 * 矩形参数
 */
export interface RectangleAttribute extends ShapeAttributes {
  /**
   * 宽度
   */
  width: number,
  /**
   * 高度
   */
  height: number,
  /**
   * 角点元素
   */
  roundness: number,
}

/**
 * 星形参数
 */
export interface StarAttribute extends ShapeAttributes {
  /**
   * 顶点数 - 内外顶点同数
   */
  pointCount: number,
  /**
   * 内径
   */
  innerRadius: number,
  /**
   * 外径
   */
  outerRadius: number,
  /**
   * 内径点圆度
   */
  innerRoundness: number,
  /**
   * 外径点圆度
   */
  outerRoundness: number,
}

/**
 * 多边形参数
 */
export interface PolygonAttribute extends ShapeAttributes {
  /**
   * 顶点数
   */
  pointCount: number,
  /**
   * 外切圆半径
   */
  radius: number,
  /**
   * 角点圆度
   */
  roundness: number,
}

/**
 * 图形组件
 * @since 2.1.0
 */
@effectsClass(spec.DataType.ShapeComponent)
export class ShapeComponent extends RendererComponent implements Maskable {

  private static readonly tempMVP = Matrix4.fromIdentity();

  private shapeDirty = true;
  private materialDirty = true;
  private graphicsPath = new GraphicsPath();
  private pathBounds?: Box2;
  private readonly renderBounds = new Box3();
  private readonly fillPathResult = new TrimmedPathResult();
  private readonly strokePathResult = new TrimmedPathResult();

  private fills: Paint[] = [];
  private readonly strokeAttributes: StrokeAttributes = {
    width: 1,
    alignment: 0.5,
    cap: spec.LineCap.Butt,
    join: spec.LineJoin.Miter,
    miterLimit: 10,
  };

  private strokes: Paint[] = [];
  private shapeAttributes: ShapeAttributes;
  private _strokeTrimPath: TrimPath | null = null;
  private _fillTrimPath: TrimPath | null = null;

  private rendererOptions: ItemRenderer;
  private geometry: Geometry;
  private fillMaterials: Material[] = [];
  private strokeMaterials: Material[] = [];

  get shape () {
    return this.shapeAttributes;
  }

  get strokeWidth (): number {
    return this.strokeAttributes.width;
  }

  set strokeWidth (value: number) {
    if (this.strokeAttributes.width !== value) {
      this.strokeAttributes.width = value;
      this.shapeDirty = true;
    }
  }

  get strokeAlignment (): number {
    return this.strokeAttributes.alignment;
  }

  set strokeAlignment (value: number) {
    if (this.strokeAttributes.alignment !== value) {
      this.strokeAttributes.alignment = value;
      this.shapeDirty = true;
    }
  }

  get strokeCap (): spec.LineCap {
    return this.strokeAttributes.cap;
  }

  set strokeCap (value: spec.LineCap) {
    if (this.strokeAttributes.cap !== value) {
      this.strokeAttributes.cap = value;
      this.shapeDirty = true;
    }
  }

  get strokeJoin (): spec.LineJoin {
    return this.strokeAttributes.join;
  }

  set strokeJoin (value: spec.LineJoin) {
    if (this.strokeAttributes.join !== value) {
      this.strokeAttributes.join = value;
      this.shapeDirty = true;
    }
  }

  get strokeMiterLimit (): number {
    return this.strokeAttributes.miterLimit;
  }

  set strokeMiterLimit (value: number) {
    if (this.strokeAttributes.miterLimit !== value) {
      this.strokeAttributes.miterLimit = value;
      this.shapeDirty = true;
    }
  }

  get strokeTrimPath (): TrimPath | null {
    return this._strokeTrimPath;
  }

  set strokeTrimPath (value: TrimPath | null) {
    this._strokeTrimPath = value;
    this.shapeDirty = true;
  }

  get fillTrimPath (): TrimPath | null {
    return this._fillTrimPath;
  }

  set fillTrimPath (value: TrimPath | null) {
    this._fillTrimPath = value;
    this.shapeDirty = true;
  }

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    this.rendererOptions = {
      renderMode: spec.RenderMode.MESH,
      blending: spec.BlendingMode.ALPHA,
      texture: this.engine.assetServer.whiteTexture,
      occlusion: false,
      transparentOcclusion: false,
      side: spec.SideMode.DOUBLE,
    };

    // Create Shape Attrributes
    //-------------------------------------------------------------------------

    const gradientStrokeFill: SolidPaint = {
      type: spec.FillType.Solid,
      color: new Color(1, 1, 1, 1),
    };

    this.strokes.push(gradientStrokeFill);

    const gradientLayerFill: SolidPaint = {
      type: spec.FillType.Solid,
      color: new Color(1, 1, 1, 1),
    };

    this.fills.push(gradientLayerFill);

    this.shapeAttributes = {
      type: spec.ShapePrimitiveType.Custom,
      points: [],
      easingIns: [],
      easingOuts: [],
      shapes: [],
    } as CustomShapeAttribute;

    // Create Geometry
    //-------------------------------------------------------------------------

    this.geometry = Geometry.create(this.engine, {
      attributes: {
        [VertexElementType.Position]: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array([
            -0.5, 0.5, 0, //左上
            -0.5, -0.5, 0, //左下
            0.5, 0.5, 0, //右上
            0.5, -0.5, 0, //右下
          ]),
        },
        [VertexElementType.TexCoord0]: {
          size: 2,
          offset: 0,
          type: glContext.FLOAT,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      mode: glContext.TRIANGLES,
      drawCount: 6,
      bufferUsage: glContext.DYNAMIC_DRAW,
    });

    this.geometry.subMeshes.push({
      offset: 0,
      indexCount: 0,
      vertexCount: 0,
    }, {
      offset: 0,
      indexCount: 0,
      vertexCount: 0,
    });
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
    // Bounds can be queried before attachment, when no viewport scale is available.
    this.shapeDirty = true;
  }

  override onUpdate (dt: number): void {
    this.updateGeometry();
    if (this.materialDirty) {
      this.updateMaterials();
      this.materialDirty = false;
    }
  }

  override render (renderer: Renderer) {
    this.maskProcessor.applyMasks(renderer, this);

    this.draw(renderer);
  }

  /**
   * @internal
   */
  drawStencilMask (maskRef: number) {
    if (!this.isActiveAndEnabled) {
      return;
    }

    for (let i = 0; i < this.fillMaterials.length; i++) {
      this.maskProcessor.drawStencilGeometry(this.engine.renderer, this.geometry, this.transform.getWorldMatrix(), this.fillMaterials[i], maskRef, 0);
    }

    for (let i = 0; i < this.strokeMaterials.length; i++) {
      this.maskProcessor.drawStencilGeometry(this.engine.renderer, this.geometry, this.transform.getWorldMatrix(), this.strokeMaterials[i], maskRef, 1);
    }
  }

  private draw (renderer: Renderer) {
    for (let i = 0; i < this.fillMaterials.length; i++) {
      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.fillMaterials[i], 0);
    }

    for (let i = 0; i < this.strokeMaterials.length; i++) {
      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.strokeMaterials[i], 1);
    }
  }

  getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
    if (!force) {
      return;
    }

    const sizeMatrix = Matrix4.fromScale(this.transform.size.x, this.transform.size.y, 1);
    const worldMatrix = sizeMatrix.premultiply(this.transform.getWorldMatrix());

    return {
      behavior: 0,
      type: HitTestType.triangle,
      triangles: getWorldTriangles(this.geometry, worldMatrix),
      backfaceCulling: this.rendererOptions.side === spec.SideMode.FRONT,
      clipMasks: this.frameClipMasks,
    };
  };

  /** 原始路径在元素局部坐标系中的几何边界，包含贝塞尔曲线段内极值。 */
  override getBoundingBox (out = new Box3()): Box3 {
    if (!this.pathBounds) {
      // An editor can request the new bounds before the next rendering update.
      if (this.shapeDirty) {
        this.buildPath(this.shapeAttributes);
      }
      this.pathBounds = getContourPathBounds(makeStrokeContourPath(this.graphicsPath));
    }

    const { min, max } = this.pathBounds;

    if (this.pathBounds.isEmpty()) { return out.makeEmpty(); }
    out.min.set(min.x, min.y, 0);
    out.max.set(max.x, max.y, 0);

    return out;
  }

  /** 填充和描边网格在同一局部坐标系中实际覆盖的边界。 */
  override getRenderBounds (out = new Box3()): Box3 {
    this.updateGeometry();

    return out.copyFrom(this.renderBounds);
  }

  private updateGeometry (): void {
    if (!this.shapeDirty) {
      return;
    }
    const screenScale = this.computeScreenScale();

    this.buildPath(this.shapeAttributes, screenScale);
    const fillResult = this._fillTrimPath?.createTrimmedPath(this.graphicsPath, screenScale, this.fillPathResult)
      ?? this.fillPathResult.reset(this.graphicsPath);
    const strokeResult = this._strokeTrimPath?.createTrimmedPath(this.graphicsPath, screenScale, this.strokePathResult)
      ?? this.strokePathResult.reset(this.graphicsPath);

    this.buildGeometryFromPath(fillResult.path, strokeResult, screenScale);
    this.shapeDirty = false;
    this.materialDirty = true;
  }

  private buildGeometryFromPath (fillPath: GraphicsPath, strokeResult: TrimmedPathResult, screenScale: number) {
    const { vertices, indices } = this.fills.length > 0
      ? buildPathGeometry(fillPath.shapePath, screenScale, 'separate')
      : { vertices: [], indices: [] };
    const lineStyle = this.strokeAttributes;

    const fillIndexCount = indices.length;

    if (this.strokes.length > 0 && this.strokeWidth > 0) {
      const strokePath = strokeResult.path;
      const strokeContourPath = makeStrokeContourPath(strokePath);
      const maskPath = lineStyle.alignment === 0.5 || strokePath === this.graphicsPath
        ? strokeContourPath : makeStrokeContourPath(this.graphicsPath);
      const expanded = expandStrokePath(strokeContourPath, lineStyle, screenScale, maskPath, strokeResult);
      const contours = flattenStrokePath(expanded, screenScale);
      const triangles = triangulate(contours.map(contour => contour.points), 'nonzero');
      const vertexOffset = vertices.length / 2;

      for (let i = 0; i < triangles.length; i++) {
        vertices.push(triangles[i]);
      }
      for (let i = 0; i < triangles.length / 2; i++) {
        indices.push(vertexOffset + i);
      }
    }

    const strokeIndexCount = indices.length - fillIndexCount;
    const vertexCount = vertices.length / 2;

    // Get the current attribute and index arrays from the geometry, avoiding re-creation
    let positionArray = this.geometry.getAttributeData(VertexElementType.Position);
    let uvArray = this.geometry.getAttributeData(VertexElementType.TexCoord0);
    let indexArray = this.geometry.getIndexData();

    if (!positionArray || positionArray.length < vertexCount * 3) {
      positionArray = new Float32Array(vertexCount * 3);
    }

    if (!uvArray || uvArray.length < vertexCount * 2) {
      uvArray = new Float32Array(vertexCount * 2);
    }

    const IndexArray = vertexCount > 65536 ? Uint32Array : Uint16Array;

    if (!indexArray || !(indexArray instanceof IndexArray) || indexArray.length < indices.length) {
      indexArray = new IndexArray(indices.length);
    }

    // The buffers may retain vertices from a larger mesh. Only measure this build.
    this.renderBounds.makeEmpty();
    const point = new Vector3();

    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const positionArrayOffset = i * 2;

      const x = vertices[positionArrayOffset];
      const y = vertices[positionArrayOffset + 1];

      positionArray[pointsOffset] = x;
      positionArray[pointsOffset + 1] = y;
      positionArray[pointsOffset + 2] = 0;

      this.renderBounds.expandByPoint(point.set(x, y, 0));
    }

    // Set uv attribute array
    const { min } = this.renderBounds;
    const size = this.renderBounds.getSize();

    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const uvOffset = i * 2;

      uvArray[uvOffset] = size.x ? (positionArray[pointsOffset] - min.x) / size.x : 0;
      uvArray[uvOffset + 1] = size.y ? (positionArray[pointsOffset + 1] - min.y) / size.y : 0;
    }

    // Set index array
    indexArray.set(indices);

    // Rewrite to geometry
    this.updateAttributeData(VertexElementType.Position, positionArray, 3);
    this.updateAttributeData(VertexElementType.TexCoord0, uvArray, 2);
    this.geometry.setIndexData(indexArray);
    this.geometry.setDrawCount(indices.length);

    const fillSubMesh = this.geometry.subMeshes[0];
    const strokeSubMesh = this.geometry.subMeshes[1];

    fillSubMesh.indexCount = fillIndexCount;
    strokeSubMesh.offset = fillIndexCount * indexArray.BYTES_PER_ELEMENT;
    strokeSubMesh.indexCount = strokeIndexCount;
  }

  private updateAttributeData (name: string, data: spec.TypedArray, size: number): void {
    const buffer = this.geometry.getVertexBuffer(name)?.buffer;

    if (!buffer || data.byteLength > buffer.capacity) {
      this.geometry.setVerticesData(name, data, { size }, BufferUsage.Dynamic);

      return;
    }
    this.geometry.setAttributeData(name, data);
  }

  private computeScreenScale (): number {
    const defaultPpu = 1;
    const composition = this.item?.composition;

    if (!composition) {
      return defaultPpu;
    }

    const camera = composition.camera;

    if (!camera) {
      return defaultPpu;
    }

    const mvp = camera.getModelViewProjection(
      ShapeComponent.tempMVP, this.transform.getWorldMatrix()
    );
    const e = mvp.elements;

    // 列优先：col0=[e[0],e[1]], col1=[e[4],e[5]]
    // 透视投影下 MVP 不含 w-divide，cols 0-1 的长度是 clip-space 缩放
    // 需要除以物体中心的 w 值才能得到 NDC 缩放
    // 物体局部原点 [0,0,0,1] 经 MVP 后 w = e[15]（≈ 物体到相机距离）
    const w = Math.abs(e[15]) || 1;
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1]) / w;
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5]) / w;
    const maxNdcScale = Math.max(sx, sy);

    // 使用实际渲染像素尺寸；离屏 canvas 没有 DOM 布局尺寸。
    // drawing buffer 已包含 pixelRatio，不能重复乘以 DPR。
    const device = this.engine.displayServer.renderingDevice;
    const ndcToPixels = Math.max(device.getWidth(), device.getHeight()) / 2;

    // pixelsPerUnit: 1个局部空间单位在屏幕上对应多少像素
    // 椭圆/圆/矩形中使用 n = ceil(√(ppu × (rx+ry))) 确保圆弧误差 ≈ 1.2px
    const pixelsPerUnit = maxNdcScale * ndcToPixels;

    const minPpu = 1;
    const maxPpu = 2000;

    return Math.max(minPpu, Math.min(maxPpu, pixelsPerUnit));
  }

  private buildPath (shapeAttribute: ShapeAttributes, screenScale = 1) {
    this.graphicsPath.clear();
    const ppu = screenScale;

    switch (shapeAttribute.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customShapeAtribute = this.shapeAttributes as CustomShapeAttribute;

        for (const shape of customShapeAtribute.shapes) {
          const indexes = shape.indexes.filter(index => customShapeAtribute.points[index.point]);

          if (indexes.length < 2) {
            continue;
          }
          const path = shape.transform ? new GraphicsPath() : this.graphicsPath;

          appendBezierPath(path, customShapeAtribute, { ...shape, indexes }, ppu);
          if (shape.transform) {
            this.appendTransformedPath(path, shape.transform);
          }
        }

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = shapeAttribute as EllipseAttribute;

        this.graphicsPath.ellipse(0, 0, ellipseData.xRadius, ellipseData.yRadius);

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = shapeAttribute as RectangleAttribute;

        this.graphicsPath.rect(-rectangleData.width / 2, -rectangleData.height / 2, rectangleData.width, rectangleData.height, rectangleData.roundness);

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const starData = shapeAttribute as StarAttribute;

        this.graphicsPath.polyStar(starData.pointCount, starData.outerRadius, starData.innerRadius, starData.outerRoundness, starData.innerRoundness, StarType.Star);

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = shapeAttribute as PolygonAttribute;

        this.graphicsPath.polyStar(polygonData.pointCount, polygonData.radius, polygonData.radius, polygonData.roundness, polygonData.roundness, StarType.Polygon);

        break;
      }
    }
    if (shapeAttribute.transform) {
      this.appendTransformedPath(this.graphicsPath, shapeAttribute.transform);
    }
  }

  private appendTransformedPath (path: GraphicsPath, data: spec.TransformData): void {
    const commands = makeStrokeContourPath(path);
    const transform = new Transform();

    transform.fromData(data);
    transform.setScale(transform.scale.x * (data.size?.x ?? 1), transform.scale.y * (data.size?.y ?? 1), transform.scale.z);
    const matrix = transform.getMatrix();
    const point = new Vector3();

    if (path === this.graphicsPath) {
      this.graphicsPath.clear();
    }
    for (const command of commands) {
      for (const control of command.data) {
        point.set(control.x, control.y, 0);
        matrix.transformPoint(point, point); control.set(point.x, point.y);
      }
      switch (command.action) {
        case 'moveTo':
          this.graphicsPath.moveTo(command.data[0].x, command.data[0].y);

          break;
        case 'lineTo':
          this.graphicsPath.lineTo(command.data[0].x, command.data[0].y);

          break;
        case 'bezierCurveTo':
          this.graphicsPath.bezierCurveTo(command.data[0].x, command.data[0].y, command.data[1].x, command.data[1].y,
            command.data[2].x, command.data[2].y, command.smoothness, command.scale);

          break;
        case 'closePath':
          this.graphicsPath.closePath();

          break;
      }
    }
  }

  private updateMaterials () {
    const destSize = new Vector2(1, 1);

    if (this.fills.some(paint => paint.type === spec.FillType.Texture) || this.strokes.some(paint => paint.type === spec.FillType.Texture)) {
      const size = this.getRenderBounds().getSize();

      destSize.set(size.x, size.y);
    }
    for (let i = 0; i < this.fills.length; i++) {
      updatePaintMaterial(this.fillMaterials[i], this.fills[i], destSize);
    }
    for (let i = 0; i < this.strokes.length; i++) {
      updatePaintMaterial(this.strokeMaterials[i], this.strokes[i], destSize);
    }
  }

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.shapeDirty = true;
    this.pathBounds = undefined;

    const renderer = data.renderer ?? {};

    this.rendererOptions = {
      renderMode: spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ? this.findObject<Texture>(renderer.texture) : this.engine.assetServer.whiteTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || this.maskProcessor.isTrackMatte,
      side: renderer.side ?? spec.SideMode.DOUBLE,
    };

    this.strokeCap = data.strokeCap ?? spec.LineCap.Butt;
    this.strokeWidth = data.strokeWidth ?? 1;
    this.strokeJoin = data.strokeJoin ?? spec.LineJoin.Miter;
    this.strokeAlignment = data.strokeAlignment ?? 0.5;
    this.strokeMiterLimit = data.strokeMiterLimit ?? 10;
    this.strokeAttributes.variableWidthPoints = data.variableWidthPoints?.map(point => ({ ...point }));

    this._strokeTrimPath = null;
    this._fillTrimPath = null;

    if (data.strokeTrimPath) {
      this._strokeTrimPath = new TrimPath();
      this._strokeTrimPath.fromData(data.strokeTrimPath);
    }

    if (data.fillTrimPath) {
      this._fillTrimPath = new TrimPath();
      this._fillTrimPath.fromData(data.fillTrimPath);
    }

    this.fills.length = 0;
    for (const fill of data.fills) {
      this.fills.push(createPaint(fill, path => path ? this.findObject<Texture>(path) : this.engine.assetServer.whiteTexture));
    }

    this.strokes.length = 0;
    for (const stroke of data.strokes) {
      this.strokes.push(createPaint(stroke, path => path ? this.findObject<Texture>(path) : this.engine.assetServer.whiteTexture));
    }
    this.syncPaintMaterials(this.fillMaterials, this.fills.length);
    this.syncPaintMaterials(this.strokeMaterials, this.strokes.length);

    this.materials = [...this.fillMaterials, ...this.strokeMaterials];

    switch (data.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customShapeData = data as spec.CustomShapeData;
        const customShapeAttribute: CustomShapeAttribute = {
          type: spec.ShapePrimitiveType.Custom,
          points: [],
          easingIns: [],
          easingOuts: [],
          shapes: [],
        };

        for (const point of customShapeData.points) {
          customShapeAttribute.points.push(new Vector2(point.x, point.y));
        }
        for (const easingIn of customShapeData.easingIns) {
          customShapeAttribute.easingIns.push(new Vector2(easingIn.x, easingIn.y));
        }
        for (const easingOut of customShapeData.easingOuts) {
          customShapeAttribute.easingOuts.push(new Vector2(easingOut.x, easingOut.y));
        }
        customShapeAttribute.shapes = customShapeData.shapes;

        this.shapeAttributes = customShapeAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = data as spec.EllipseData;
        const ellipseAttribute: EllipseAttribute = {
          type: spec.ShapePrimitiveType.Ellipse,
          xRadius: ellipseData.xRadius,
          yRadius: ellipseData.yRadius,
        };

        this.shapeAttributes = ellipseAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = data as spec.RectangleData;
        const rectangleAttribute: RectangleAttribute = {
          type: spec.ShapePrimitiveType.Rectangle,
          width: rectangleData.width,
          height: rectangleData.height,
          roundness: rectangleData.roundness,
        };

        this.shapeAttributes = rectangleAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const starData = data as spec.StarData;
        const starAttribute: StarAttribute = {
          type: spec.ShapePrimitiveType.Star,
          pointCount: starData.pointCount,
          innerRadius: starData.innerRadius,
          outerRadius: starData.outerRadius,
          innerRoundness: starData.innerRoundness,
          outerRoundness: starData.outerRoundness,
        };

        this.shapeAttributes = starAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = data as spec.PolygonData;
        const polygonAttribute: PolygonAttribute = {
          type: spec.ShapePrimitiveType.Polygon,
          pointCount: polygonData.pointCount,
          radius: polygonData.radius,
          roundness: polygonData.roundness,
        };

        this.shapeAttributes = polygonAttribute;

        break;
      }
    }
    this.shapeAttributes.transform = data.transform;
  }

  override onApplyAnimationProperties (): void {
    this.shapeDirty = true;
    this.pathBounds = undefined;
    this.materialDirty = true;
  }

  private syncPaintMaterials (materials: Material[], count: number): void {
    while (materials.length > count) {
      materials.pop()!.dispose();
    }
    for (let i = 0; i < count; i++) {
      if (!materials[i]) {
        materials.push(createPaintMaterial(this.engine, this.rendererOptions, this.maskProcessor.alphaMaskEnabled));
      } else {
        applyPaintRendererOptions(materials[i], this.rendererOptions, this.maskProcessor.alphaMaskEnabled);
      }
    }
  }
}
