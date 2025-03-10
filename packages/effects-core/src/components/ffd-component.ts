import { Color } from '@galacean/effects-math/es/core/color';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { Geometry, GLSLVersion } from '../render';
import { MeshComponent } from './mesh-component';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
// import { Vector2 } from '@galacean/effects-math/es/core/vector2';

// TODO 临时本地声明，提供给编辑器
declare module '@galacean/effects-specification' {
  interface FFDComponentData extends spec.ComponentData {
    controlPoints?: {
      x: number,
      y: number,
      z?: number,
    }[],
    renderer?: {
      texture?: any,
      color?: {
        r: number,
        g: number,
        b: number,
        a: number,
      },
      mask?: number,
      maskMode?: number,
    },
  }
}

@effectsClass('FFDComponent')
export class FFDComponent extends MeshComponent {
  private data: spec.FFDComponentData;
  private controlPoints: Float32Array; // 控制点数组
  private animated = true;

  // FFD 顶点着色器
  private vert = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 v_UV;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;
uniform vec3 u_ControlPoints[25]; // 5x5 控制点

// 计算4阶伯恩斯坦基函数
float B0(float t) { return (1.0 - t) * (1.0 - t) * (1.0 - t) * (1.0 - t); }
float B1(float t) { return 4.0 * t * (1.0 - t) * (1.0 - t) * (1.0 - t); }
float B2(float t) { return 6.0 * t * t * (1.0 - t) * (1.0 - t); }
float B3(float t) { return 4.0 * t * t * t * (1.0 - t); }
float B4(float t) { return t * t * t * t; }

// 4阶贝塞尔曲面插值
vec3 bezierSurface(vec2 uv) {
    vec3 result = vec3(0.0);
    float u = uv.x;
    float v = uv.y;
    
    float bu[5] = float[5](B0(u), B1(u), B2(u), B3(u), B4(u));
    float bv[5] = float[5](B0(v), B1(v), B2(v), B3(v), B4(v));
    
    for(int i = 0; i < 5; i++) {
        for(int j = 0; j < 5; j++) {
            result += u_ControlPoints[i * 5 + j] * bu[j] * bv[i];
        }
    }
    
    return result;
}

void main() {
    vec3 newPos = bezierSurface(aUV);
    v_UV = vec2(aUV.x, 1.0 - aUV.y);
    gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(newPos, 1.0);
}
`;

  // 基础片段着色器
  private frag = `
precision highp float;

uniform vec4 _Color;
uniform sampler2D _MainTex;

varying vec2 v_UV;

void main() {
  vec4 color = texture2D(_MainTex, v_UV) * _Color;
  color.rgb *= color.a;
  gl_FragColor = color;
}
`;

  constructor (engine: Engine) {
    super(engine);

    // 创建30x30的网格
    if (!this.geometry) {
      const gridSize = 30;
      const vertices = [];
      const uvs = [];
      const indices = [];

      // 生成顶点、UV和FFD坐标
      for (let i = 0; i <= gridSize; i++) {
        for (let j = 0; j <= gridSize; j++) {
          const x = j / gridSize - 0.5;
          const y = i / gridSize - 0.5;

          // 顶点位置
          vertices.push(x, y, 0);

          // UV坐标
          uvs.push(j / gridSize, 1 - i / gridSize);
        }
      }

      // 生成三角形索引
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const a = i * (gridSize + 1) + j;
          const b = a + 1;
          const c = (i + 1) * (gridSize + 1) + j;
          const d = c + 1;

          // 每个网格由两个三角形组成
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      this.geometry = Geometry.create(engine, {
        attributes: {
          aPos: {
            type: glContext.FLOAT,
            size: 3,
            data: new Float32Array(vertices),
          },
          aUV: {
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array(uvs),
          },
        },
        indices: { data: new Uint16Array(indices) },
        mode: glContext.TRIANGLES,
        drawCount: indices.length,
      });
    }

    // 创建材质
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

      // 初始化控制点
      this.initControlPoints();
    }

    // const boundingBox = [new Vector2(Number.MIN_VALUE, Number.MIN_VALUE), new Vector2(Number.MAX_VALUE, Number.MAX_VALUE)];

    // // 遍历子元素计算包围盒
    // for (const child of this.item.children) {
    //   const childBox = child.getComponent(MeshComponent).getBoundingBox();

    //   if (childBox) {
    //     // 更新包围盒的最小点
    //     boundingBox[0].x = Math.min(boundingBox[0].x, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);
    //     boundingBox[0].y = Math.min(boundingBox[0].y, childBox.area[1].p0.y, childBox.area[1].p1.y, childBox.area[1].p2.y);

    //     // 更新包围盒的最大点
    //     boundingBox[1].x = Math.max(boundingBox[1].x, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);
    //     boundingBox[1].y = Math.max(boundingBox[1].y, childBox.area[1].p0.y, childBox.area[1].p1.y, childBox.area[1].p2.y);
    //   }
    // }

    // 创建包围盒的线框几何体
    // const boxVertices = [
    //   // 前面的四个顶点
    //   boundingBox[0].x, boundingBox[0].y, 0,
    //   boundingBox[1].x, boundingBox[0].y, 0,
    //   boundingBox[1].x, boundingBox[1].y, 0,
    //   boundingBox[0].x, boundingBox[1].y, 0,
    // ];

    // const boxIndices = [
    //   0, 1, 1, 2, 2, 3, 3, 0, // 前面的四条边
    // ];

    // // 创建包围盒的几何体
    // const boxGeometry = Geometry.create(engine, {
    //   attributes: {
    //     aPos: {
    //       type: glContext.FLOAT,
    //       size: 3,
    //       data: new Float32Array(boxVertices),
    //     },
    //   },
    //   indices: { data: new Uint8Array(boxIndices) },
    //   mode: glContext.LINES,
    //   drawCount: boxIndices.length,
    // });

    // // 创建包围盒的材质
    // const boxMaterial = Material.create(engine, {
    //   shader: {
    //     vertex: this.vert,
    //     fragment: `
    //       precision highp float;
    //       void main() {
    //         gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 红色线框
    //       }
    //     `,
    //     glslVersion: GLSLVersion.GLSL1,
    //   },
    // });

    // TODO 展示包围盒

    // TODO 根据包围盒生成控制点

  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.updateControlPoints();
      this.animated = false;
    }
  }

  /**
   * 初始化控制点
   */
  private initControlPoints () {
    const pointCount = 25; // 5x5 控制点

    this.controlPoints = new Float32Array(pointCount * 3);

    // 初始化控制点位置为均匀网格
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const idx = (i * 5 + j) * 3;
        const x = j / 4.0 - 0.5; // 将范围映射到 [-0.5, 0.5]
        const y = i / 4.0 - 0.5;

        this.controlPoints[idx] = x;
        this.controlPoints[idx + 1] = y;
        this.controlPoints[idx + 2] = 0;
      }
    }

    // 更新所有控制点
    for (let i = 0; i < 25; i++) {
      this.material.setVector3(`u_ControlPoints[${i}]`, new Vector3(this.controlPoints[i * 3], this.controlPoints[i * 3 + 1], this.controlPoints[i * 3 + 2]));
    }
  }

  /**
   * 更新控制点
   */
  private updateControlPoints () {
    if (!this.data || !this.data.controlPoints) {
      return;
    }

    // 更新控制点位置
    for (let i = 0; i < Math.min(this.data.controlPoints.length, 25); i++) {
      const point = this.data.controlPoints[i];
      const idx = i * 3;

      this.controlPoints[idx] = point.x;
      this.controlPoints[idx + 1] = point.y;
      this.controlPoints[idx + 2] = point.z || 0;

      // 直接更新 uniform
      this.material.setVector3(`u_ControlPoints[${i}]`, new Vector3(point.x, point.y, point.z || 0));
    }
  }

  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;

    // 设置材质属性
    if (data.renderer) {
      const material = this.material;

      if (data.renderer.texture) {
        material.setTexture('_MainTex', data.renderer.texture);
      }

      if (data.renderer.color) {
        const color = data.renderer.color;

        material.setColor('_Color', new Color(color.r, color.g, color.b, color.a));
      }
    }

    // 标记需要更新
    this.animated = true;
  }
}
