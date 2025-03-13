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
      z: number,
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
uniform mat4 effects_ObjectToWorld;
uniform vec3 u_ControlPoints[25]; // 5x5 控制点
uniform vec3 u_BoundMin;          // 包围盒最小点
uniform vec3 u_BoundMax;          // 包围盒最大点

// 计算4阶伯恩斯坦基函数
float B0(float t) { return (1.0 - t) * (1.0 - t) * (1.0 - t) * (1.0 - t); }
float B1(float t) { return 4.0 * t * (1.0 - t) * (1.0 - t) * (1.0 - t); }
float B2(float t) { return 6.0 * t * t * (1.0 - t) * (1.0 - t); }
float B3(float t) { return 4.0 * t * t * t * (1.0 - t); }
float B4(float t) { return t * t * t * t; }

// 基于顶点位置的4阶贝塞尔曲面插值
vec3 bezierSurface(vec3 originalPos) {
    // 检查顶点是否在包围盒内
    bool isInBoundingBox = 
        originalPos.x >= u_BoundMin.x && originalPos.x <= u_BoundMax.x &&
        originalPos.y >= u_BoundMin.y && originalPos.y <= u_BoundMax.y &&
        originalPos.z >= u_BoundMin.z && originalPos.z <= u_BoundMax.z;
    
    // 如果顶点在包围盒外，保持原始位置不变
    if (!isInBoundingBox) {
        return originalPos;
    }
    
    // 将原始顶点位置映射到[0,1]空间用于插值计算
    // 仅使用xy平面坐标计算参数
    float u = (originalPos.x - u_BoundMin.x) / (u_BoundMax.x - u_BoundMin.x);
    float v = (originalPos.y - u_BoundMin.y) / (u_BoundMax.y - u_BoundMin.y);
    
    // 计算伯恩斯坦基函数
    float bu[5] = float[5](B0(u), B1(u), B2(u), B3(u), B4(u));
    float bv[5] = float[5](B0(v), B1(v), B2(v), B3(v), B4(v));
    
    // 计算变形后的位置
    vec3 newPos = vec3(0.0);
    for(int i = 0; i < 5; i++) {
        for(int j = 0; j < 5; j++) {
            newPos += u_ControlPoints[i * 5 + j] * bu[j] * bv[i];
        }
    }
    
    return newPos;
}

void main() {
    vec3 newPos = bezierSurface(aPos);
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

      // 初始化默认控制点 (会在onStart中基于实际包围盒更新)
      this.initDefaultControlPoints();
    }
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;

    // 在组件启动时，基于 item 的包围盒更新控制点
    this.initControlPointsFromBoundingBox();
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.updateControlPoints();
      this.animated = false;
    }
  }

  /**
   * 初始化默认控制点
   */
  private initDefaultControlPoints () {
    const pointCount = 25; // 5x5 控制点

    this.controlPoints = new Float32Array(pointCount * 3);

    // 设置临时的默认包围盒边界，会在onStart中更新为实际值
    this.material.setVector3('u_BoundMin', new Vector3(-0.5, -0.5, 0.0));
    this.material.setVector3('u_BoundMax', new Vector3(0.5, 0.5, 0.0));

    // 初始化控制点为默认网格
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const idx = (i * 5 + j) * 3;
        const x = j / 4.0 - 0.5;
        const y = i / 4.0 - 0.5;
        const z = 0.0;

        this.controlPoints[idx] = x;
        this.controlPoints[idx + 1] = y;
        this.controlPoints[idx + 2] = z;

        // 更新uniform
        this.material.setVector3(`u_ControlPoints[${i * 5 + j}]`, new Vector3(x, y, z));
      }
    }
  }

  /**
   * 基于包围盒初始化控制点
   */
  private initControlPointsFromBoundingBox () {
    // 此时this.item应该已经初始化
    if (!this.item) {
      console.warn('FFDComponent: item is not initialized, cannot get bounding box');

      return;
    }

    // 获取网格的包围盒
    let minX = -0.5, minY = -0.5, minZ = 0;
    let maxX = 0.5, maxY = 0.5, maxZ = 0;

    // 尝试获取包围盒，可能是从当前组件或子组件获取
    const boundingBox = this.getBoundingBox();

    // 如果当前组件没有包围盒，尝试从子组件获取
    if (!boundingBox && this.item.children && this.item.children.length > 0) {
      // 初始化一个无限大的包围盒
      minX = Infinity; minY = Infinity; minZ = Infinity;
      maxX = -Infinity; maxY = -Infinity; maxZ = -Infinity;

      // 遍历所有子组件，合并它们的包围盒
      for (const child of this.item.children) {
        const childComponent = child.getComponent(MeshComponent);

        if (childComponent) {
          const childBox = childComponent.getBoundingBox();

          if (childBox && childBox.area) {
            // 合并子组件的包围盒
            if (childBox.area[0]?.p0 !== undefined) {
              minX = Math.min(minX, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);
              maxX = Math.max(maxX, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);

              minY = Math.min(minY, childBox.area[0].p0.y, childBox.area[0].p1.y, childBox.area[0].p2.y);
              maxY = Math.max(maxY, childBox.area[0].p0.y, childBox.area[0].p1.y, childBox.area[0].p2.y);

              minZ = Math.min(minZ, childBox.area[0].p0.z, childBox.area[0].p1.z, childBox.area[0].p2.z);
              maxZ = Math.max(maxZ, childBox.area[0].p0.z, childBox.area[0].p1.z, childBox.area[0].p2.z);
            }
          }
        }
      }

      // 如果没有找到有效的包围盒，使用默认值
      if (minX === Infinity) {
        minX = -0.5; minY = -0.5; minZ = 0;
        maxX = 0.5; maxY = 0.5; maxZ = 0;
        console.warn('FFDComponent: No valid bounding box found in children, using default range.');
      }
    } else if (boundingBox && boundingBox.area) {
      // 使用当前组件的包围盒
      if (boundingBox.area[0]?.p0 !== undefined) {
        minX = Math.min(
          boundingBox.area[0].p0.x,
          boundingBox.area[0].p1.x,
          boundingBox.area[0].p2.x
        );
        maxX = Math.max(
          boundingBox.area[0].p0.x,
          boundingBox.area[0].p1.x,
          boundingBox.area[0].p2.x
        );

        minY = Math.min(
          boundingBox.area[0].p0.y,
          boundingBox.area[0].p1.y,
          boundingBox.area[0].p2.y
        );
        maxY = Math.max(
          boundingBox.area[0].p0.y,
          boundingBox.area[0].p1.y,
          boundingBox.area[0].p2.y
        );

        minZ = Math.min(
          boundingBox.area[0].p0.z,
          boundingBox.area[0].p1.z,
          boundingBox.area[0].p2.z
        );
        maxZ = Math.max(
          boundingBox.area[0].p0.z,
          boundingBox.area[0].p1.z,
          boundingBox.area[0].p2.z
        );
      }
    } else {
      console.warn('FFDComponent: Unable to get bounding box, using default range.');
    }

    // 更新包围盒边界的uniform
    this.material.setVector3('u_BoundMin', new Vector3(minX, minY, minZ));
    this.material.setVector3('u_BoundMax', new Vector3(maxX, maxY, maxZ));

    // 基于包围盒范围均匀生成5x5控制点
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const idx = (i * 5 + j) * 3;

        // 将控制点均匀分布在包围盒范围内
        const x = minX + (j / 4.0) * (maxX - minX);
        const y = minY + (i / 4.0) * (maxY - minY);
        const z = minZ; // 通常Z值保持不变

        this.controlPoints[idx] = x;
        this.controlPoints[idx + 1] = y;
        this.controlPoints[idx + 2] = z;

        // 更新uniform
        this.material.setVector3(`u_ControlPoints[${i * 5 + j}]`, new Vector3(x, y, z));
      }
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
      this.controlPoints[idx + 2] = point.z;

      // 直接更新 uniform
      this.material.setVector3(`u_ControlPoints[${i}]`, new Vector3(point.x, point.y, point.z));
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
