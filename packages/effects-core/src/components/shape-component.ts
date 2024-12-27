import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material, setMaskMode } from '../material';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import type { ShapePath } from '../plugins/shape/shape-path';
import { Geometry, GLSLVersion } from '../render';
import { MeshComponent } from './mesh-component';
import { StarType } from '../plugins/shape/poly-star';

interface CurveData {
  point: spec.Vector2Data,
  controlPoint1: spec.Vector2Data,
  controlPoint2: spec.Vector2Data,
}

/**
 * 图形组件
 * @since 2.1.0
 */
@effectsClass('ShapeComponent')
export class ShapeComponent extends MeshComponent {

  private path = new GraphicsPath();
  private curveValues: CurveData[] = [];
  private data: spec.ShapeComponentData;
  private animated = true;

  private vert = `
precision highp float;

attribute vec3 aPos;//x y

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;

void main() {
  vec4 pos = vec4(aPos.xyz, 1.0);
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
}
`;

  private frag = `
precision highp float;

uniform vec4 _Color;

void main() {
  vec4 color = _Color;
  color.rgb *= color.a;
  gl_FragColor = color;
}
`;

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    if (!this.geometry) {
      this.geometry = Geometry.create(engine, {
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
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array(),
          },
        },
        mode: glContext.TRIANGLES,
        drawCount: 4,
      });
    }

    if (!this.material) {
      const materialProps: MaterialProps = {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
          glslVersion: GLSLVersion.GLSL1,
        },
      };

      this.material = Material.create(engine, materialProps);
      this.material.setColor('_Color', new Color(1, 1, 1, 1));
      this.material.depthMask = false;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.buildPath(this.data);
      this.buildGeometryFromPath(this.path.shapePath);
      this.animated = false;
    }
  }

  private buildGeometryFromPath (shapePath: ShapePath) {
    const shapePrimitives = shapePath.shapePrimitives;
    const vertices: number[] = [];
    const indices: number[] = [];

    // triangulate shapePrimitive
    for (const shapePrimitive of shapePrimitives) {
      const shape = shapePrimitive.shape;
      const points: number[] = [];
      const indexOffset = indices.length;
      const vertOffset = vertices.length / 2;

      shape.build(points);

      shape.triangulate(points, vertices, vertOffset, indices, indexOffset);
    }

    const vertexCount = vertices.length / 2;

    // get the current attribute and index arrays from the geometry, avoiding re-creation
    let positionArray = this.geometry.getAttributeData('aPos');
    let uvArray = this.geometry.getAttributeData('aUV');
    let indexArray = this.geometry.getIndexData();

    if (!positionArray || positionArray.length < vertexCount * 3) {
      positionArray = new Float32Array(vertexCount * 3);
    }
    if (!uvArray || uvArray.length < vertexCount * 2) {
      uvArray = new Float32Array(vertexCount * 2);
    }
    if (!indexArray) {
      indexArray = new Uint16Array(indices.length);
    }

    // set position and uv attribute array
    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const positionArrayOffset = i * 2;
      const uvOffset = i * 2;

      positionArray[pointsOffset] = vertices[positionArrayOffset];
      positionArray[pointsOffset + 1] = vertices[positionArrayOffset + 1];
      positionArray[pointsOffset + 2] = 0;

      uvArray[uvOffset] = positionArray[pointsOffset];
      uvArray[uvOffset + 1] = positionArray[pointsOffset + 1];
    }

    // set index array
    indexArray.set(indices);

    // rewrite to geometry
    this.geometry.setAttributeData('aPos', positionArray);
    this.geometry.setAttributeData('aUV', uvArray);
    this.geometry.setIndexData(indexArray);
    this.geometry.setDrawCount(indices.length);
  }

  private buildPath (data: spec.ShapeComponentData) {
    this.path.clear();

    const shapeData = data;

    switch (shapeData.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customData = shapeData as spec.CustomShapeData;
        const points = customData.points;
        const easingIns = customData.easingIns;
        const easingOuts = customData.easingOuts;

        this.curveValues = [];

        for (const shape of customData.shapes) {
          this.setFillColor(shape.fill);

          const indices = shape.indexes;

          for (let i = 1; i < indices.length; i++) {
            const pointIndex = indices[i];
            const lastPointIndex = indices[i - 1];

            this.curveValues.push({
              point: points[pointIndex.point],
              controlPoint1: easingOuts[lastPointIndex.easingOut],
              controlPoint2: easingIns[pointIndex.easingIn],
            });
          }

          // Push the last curve
          this.curveValues.push({
            point: points[indices[0].point],
            controlPoint1: easingOuts[indices[indices.length - 1].easingOut],
            controlPoint2: easingIns[indices[0].easingIn],
          });
        }

        this.path.moveTo(this.curveValues[this.curveValues.length - 1].point.x, this.curveValues[this.curveValues.length - 1].point.y);

        for (const curveValue of this.curveValues) {
          const point = curveValue.point;
          const control1 = curveValue.controlPoint1;
          const control2 = curveValue.controlPoint2;

          this.path.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, point.x, point.y, 1);
        }

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = shapeData as spec.EllipseData;

        this.path.ellipse(0, 0, ellipseData.xRadius, ellipseData.yRadius);

        this.setFillColor(ellipseData.fill);

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = shapeData as spec.RectangleData;

        this.path.rect(-rectangleData.width / 2, -rectangleData.height / 2, rectangleData.width, rectangleData.height);

        this.setFillColor(rectangleData.fill);

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const starData = shapeData as spec.StarData;

        this.path.polyStar(starData.pointCount, starData.outerRadius, starData.innerRadius, starData.outerRoundness, starData.innerRoundness, StarType.Star);

        this.setFillColor(starData.fill);

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = shapeData as spec.PolygonData;

        this.path.polyStar(polygonData.pointCount, polygonData.radius, polygonData.radius, polygonData.roundness, polygonData.roundness, StarType.Polygon);

        this.setFillColor(polygonData.fill);

        break;
      }
    }
  }

  private setFillColor (fill?: spec.ShapeFillParam) {
    if (fill) {
      const color = fill.color;

      this.material.setColor('_Color', new Color(color.r, color.g, color.b, color.a));
    }
  }

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.data = data;

    const material = this.material;

    //@ts-expect-error // TODO 新版蒙版上线后重构
    material.stencilRef = data.renderer.mask !== undefined ? [data.renderer.mask, data.renderer.mask] : undefined;
    //@ts-expect-error // TODO 新版蒙版上线后重构
    setMaskMode(material, data.renderer.maskMode);
  }
}