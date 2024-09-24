import { RendererComponent } from '.';
import { effectsClass, math } from '..';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { earcut } from '../libs/earcut';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { ShapePath } from '../plugins/graphics/shape-path';
import { triangulate } from '../plugins/graphics/triangulate';
import type { Renderer } from '../render';
import { Geometry, GLSLVersion } from '../render';

@effectsClass('GraphicsComponent')
export class GraphicsComponent extends RendererComponent {
  triangulateMethod = TriangulateMethod.LibTess;

  controlPoint1X = 0;
  controlPoint1Y = -0.65;

  controlPoint2X = 1;
  controlPoint2Y = -0.05;

  private shapePath: ShapePath = new ShapePath();
  private geometry: Geometry;

  private vert = `precision highp float;
  
    attribute vec3 aPos;//x y
  
    varying vec4 vColor;
  
    uniform vec4 _Color;
    uniform mat4 effects_MatrixVP;
    uniform mat4 effects_MatrixInvV;
    uniform mat4 effects_ObjectToWorld;
  
    void main() {
      vColor = _Color;
      vec4 pos = vec4(aPos.xyz, 1.0);
      gl_Position = effects_MatrixVP * pos;
    }
    `;

  private frag = `precision highp float;
  
    varying vec4 vColor;
  
    void main() {
      vec4 color = vec4(1.0,1.0,1.0,1.0);
      gl_FragColor = color;
    }
    `;

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
      this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
      this.material.depthMask = true;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override onUpdate (dt: number): void {
    this.shapePath.controlPoint1X = this.controlPoint1X;
    this.shapePath.controlPoint1Y = this.controlPoint1Y;
    this.shapePath.controlPoint2X = this.controlPoint2X;
    this.shapePath.controlPoint2Y = this.controlPoint2Y;

    this.shapePath.buildPath();
    this.buildGeometryFromPath(this.shapePath);
  }

  override render (renderer: Renderer): void {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    renderer.drawGeometry(this.geometry, this.material);
  }

  buildGeometryFromPath (shapePath: ShapePath) {
    const vertices: number[] = [];
    // const uvs: number[] = [];
    const indices: number[] = [];

    const currentPoly = shapePath.currentPoly;

    if (!currentPoly) {
      return;
    }

    if (this.triangulateMethod === TriangulateMethod.Earcut) {
      triangulateWithHoles(currentPoly.points, [], vertices, 2, 0, indices, 0);

      const positionCount = vertices.length / 2;
      const positionArray = new Float32Array(positionCount * 3);

      for (let i = 0; i < positionCount; i++) {
        const pointsOffset = i * 3;
        const positionArrayOffset = i * 2;

        positionArray[pointsOffset] = vertices[positionArrayOffset] * 1;
        positionArray[pointsOffset + 1] = vertices[positionArrayOffset + 1] * 1;
        positionArray[pointsOffset + 2] = 0;
      }

      this.geometry.setIndexData(new Uint16Array(indices));
      this.geometry.setAttributeData('aPos', positionArray);
      this.geometry.setDrawCount(indices.length);
    } else {
      const triangles = triangulate([currentPoly.points]);

      const positionCount = triangles.length / 2;
      const positionArray = new Float32Array(positionCount * 3);

      for (let i = 0; i < positionCount; i++) {
        const pointsOffset = i * 3;
        const positionArrayOffset = i * 2;

        positionArray[pointsOffset] = triangles[positionArrayOffset] * 1;
        positionArray[pointsOffset + 1] = triangles[positionArrayOffset + 1] * 1;
        positionArray[pointsOffset + 2] = 0;
      }
      this.geometry.setAttributeData('aPos', positionArray);
      this.geometry.setDrawCount(positionArray.length / 3);
    }
  }
}

export function triangulateWithHoles (
  points: number[],
  holes: number[],
  vertices: number[],
  verticesStride: number,
  verticesOffset: number,

  indices: number[],
  indicesOffset: number
) {
  const triangles = earcut(points, holes, 2);

  if (!triangles) {
    return;
  }

  for (let i = 0; i < triangles.length; i += 3) {
    indices[indicesOffset++] = (triangles[i] + verticesOffset);
    indices[indicesOffset++] = (triangles[i + 1] + verticesOffset);
    indices[indicesOffset++] = (triangles[i + 2] + verticesOffset);
  }

  let index = verticesOffset * verticesStride;

  for (let i = 0; i < points.length; i += 2) {
    vertices[index] = points[i];
    vertices[index + 1] = points[i + 1];

    index += verticesStride;
  }
}

enum TriangulateMethod {
  Earcut,
  LibTess,
}