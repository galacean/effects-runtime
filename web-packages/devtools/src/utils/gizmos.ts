import type { Engine, GeometryData, Renderer, math } from '@galacean/effects-core';
import { Geometry, Material, glContext } from '@galacean/effects-core';

type Vector3 = math.Vector3;

export class Gizmos {
  private engine: Engine;
  private rendere: Renderer;
  private geometry: Geometry;
  private material: Material;

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
    vec4 color = vec4(1.0,0.2,0.2,1.0);
    gl_FragColor = color;
  }
  `;

  constructor (engine: Engine) {
    this.engine = engine;
    this.rendere = this.engine.renderer;
    this.material = Material.create(
      this.engine,
      {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
        },
      }
    );
    this.material.initialize();
    this.geometry = Geometry.create(this.engine);
  }

  drawLineStrip (points: Vector3[]) {
    const vertices = [];

    for (const point of points) {
      vertices.push(point.x, point.y, point.z);
    }
    //@ts-expect-error
    const geometryData: GeometryData = {
      vertices: vertices,
    };

    this.geometry.fromData(geometryData);
    //@ts-expect-error TODO mode 在 core 层提供设置
    this.geometry.mode = glContext.LINE_STRIP;
    this.geometry.setDrawCount(points.length);
    this.geometry.flush();
    this.rendere.drawGeometry(this.geometry, this.material);
  }

  drawLine (from: Vector3, to: Vector3) {
    const vertices = [];

    vertices.push(from.x, from.y, from.z);
    vertices.push(to.x, to.y, to.z);
    //@ts-expect-error
    const geometryData: GeometryData = {
      vertices: vertices,
    };

    this.geometry.fromData(geometryData);
    //@ts-expect-error TODO mode 在 core 层提供设置
    this.geometry.mode = glContext.LINES;
    this.geometry.setDrawCount(2);
    this.geometry.flush();
    this.rendere.drawGeometry(this.geometry, this.material);
  }
}