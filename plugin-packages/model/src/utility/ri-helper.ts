import type { GeometryProps, Engine } from '@galacean/effects';
import {
  glContext,
  Geometry,
  Material,
  Mesh,
  RenderPassAttachmentStorageType,
} from '@galacean/effects';
import type { Matrix4 } from '../runtime/math';
import { Vector2, Vector3 } from '../runtime/math';

export class FBOOptions {
  resolution: Vector2;
  colorAttachments: object[];
  depthAttachment?: any;

  constructor (options: Record<string, any>) {
    this.resolution = options.resolution ?? new Vector2(512, 512);
    this.colorAttachments = options.colorAttachments ?? [];
    this.depthAttachment = options.depthAttachment;
  }

  addDepthAttachment (options: Record<string, any>) {
    this.depthAttachment = {
      storageType: options.storageType ?? RenderPassAttachmentStorageType.depth_16_texture,
    };
  }

  addDefaultDepthAttachment () {
    this.depthAttachment = { storageType: RenderPassAttachmentStorageType.depth_16_texture };
  }

  deleteDepthAttachment () {
    this.depthAttachment = undefined;
  }

  addColorAttachment (options: Record<string, any>) {
    this.colorAttachments.push({
      texture: {
        format: options.format ?? glContext.RGBA,
        type: options.type ?? glContext.HALF_FLOAT,
        minFilter: options.filter ?? glContext.LINEAR,
        magFilter: options.filter ?? glContext.LINEAR,
      },
    });
  }

  deleteColorAttachment (target: number) {
    if (target >= 0 && target < this.colorAttachments.length) {
      this.colorAttachments.splice(target, 1);
    }
  }

  get viewport (): [number, number, number, number] {
    return [0, 0, this.resolution.x, this.resolution.y];
  }
}

export class BoxMesh {
  mesh: Mesh;

  constructor (engine: Engine, priority: number) {
    const material = Material.create(
      engine,
      {
        shader: {
          vertex: this.vertexShader,
          fragment: this.fragmentShader,
          shared: true,
        },
      }
    );

    material.depthTest = true;
    material.depthMask = true;
    this.mesh = Mesh.create(
      engine,
      {
        name: 'boxMesh',
        material,
        geometry: Geometry.create(engine, this.geometry),
        priority,
      }
    );
  }

  update (modelMatrix: Matrix4, viewProjMatrix: Matrix4, positions: Float32Array, lineColor: Vector3) {
    const material = this.mesh.material;

    material.setMatrix('u_ModelMatrix', modelMatrix);
    material.setMatrix('u_ViewProjectionMatrix', viewProjMatrix);
    for (let i = 0; i < positions.length; i += 3) {
      material.setVector3(`u_PositionList[${i / 3}]`, Vector3.fromArray(positions, i));
    }
    material.setVector3('u_LineColor', lineColor);
  }

  dispose () {
    this.mesh.dispose();
    // @ts-expect-error
    this.mesh = undefined;
  }

  get vertexShader (): string {
    return `
      #version 100
      precision highp float;

      uniform mat4 u_ModelMatrix;
      uniform mat4 u_ViewProjectionMatrix;
      uniform vec3 u_PositionList[8];
      attribute vec3 a_Position;
      void main(){
        int index = int(a_Position.x + 0.5);
        vec4 pos = u_ModelMatrix * vec4(u_PositionList[index], 1);
        gl_Position = u_ViewProjectionMatrix * pos;
      }
    `;
  }

  get fragmentShader (): string {
    return `
      #version 100
      precision highp float;

      uniform vec3 u_LineColor;
      void main(){
        gl_FragColor = vec4(u_LineColor, 1);
      }
    `;
  }

  get geometry (): GeometryProps {
    const data = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const index = new Uint32Array([
      0, 1, 1, 2, 2, 3, 3, 0,
      4, 5, 5, 6, 6, 7, 7, 4,
      0, 4, 1, 5, 2, 6, 3, 7,
    ]);

    return {
      attributes: {
        a_Position: {
          type: glContext.FLOAT,
          size: 1,
          data,
          stride: Float32Array.BYTES_PER_ELEMENT,
          offset: 0,
        },
      },
      mode: glContext.LINES,
      indices: { data: index },
      drawStart: 0,
      drawCount: 24,
    };
  }
}
