import type { BlendMode } from '@esotericsoftware/spine-core';
import type {
  Attribute, Disposable, Engine, ShaderMacros, SharedShaderWithSource, Texture, math,
} from '@galacean/effects';
import {
  GLSLVersion, Geometry, Material, Mesh, PLAYER_OPTIONS_ENV_EDITOR, glContext, VertexElementType,
} from '@galacean/effects';
import fs from './shader/fragment.glsl';
import vs from './shader/vertex.glsl';
import { SlotGroup } from './slot-group';
import { setBlending } from './utils';

export interface SpineMeshRenderInfo {
  texture: Texture,
  priority: number,
  blendMode: BlendMode,
  name?: string,
  engine: Engine,
}

let seed = 1;

export class SpineMesh implements Disposable {
  private vertices: Float32Array | null;
  private indices: Uint16Array | null;
  private verticesLength = 0;
  private indicesLength = 0;
  private indicesDirty = false;
  private engine: Engine;

  mesh: Mesh;
  geometry: Geometry;
  material: Material;
  lastTexture: Texture;
  blendMode: BlendMode;
  priority: number;

  constructor (renderInfo: SpineMeshRenderInfo) {
    const { blendMode, texture, priority, name = 'MSpine', engine } = renderInfo;

    this.blendMode = blendMode;
    this.lastTexture = texture;
    this.priority = priority;
    this.engine = engine;
    this.vertices = new Float32Array(SlotGroup.MAX_VERTICES * SlotGroup.VERTEX_SIZE);
    this.indices = new Uint16Array(SlotGroup.MAX_VERTICES);
    this.geometry = this.createGeometry();
    this.material = this.createMaterial();
    this.mesh = Mesh.create(
      engine,
      {
        name: name + seed++,
        priority: this.priority,
        material: this.material,
        geometry: this.geometry,
      });
  }

  get blending () {
    return this.blendMode;
  }

  get texture (): Texture {
    return this.lastTexture;
  }

  get indicesNum (): number {
    return this.indicesLength;
  }

  createGeometry (): Geometry {
    const BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;
    const stride = BYTES_PER_ELEMENT * SlotGroup.VERTEX_SIZE;
    const attributes: Record<string, Attribute> = {
      [VertexElementType.Position]: { size: 2, offset: 0, stride, data: this.vertices! },
      [VertexElementType.Color]: { size: 4, offset: 2 * BYTES_PER_ELEMENT, stride, dataSource: VertexElementType.Position },
      [VertexElementType.TexCoord0]: { size: 2, offset: 6 * BYTES_PER_ELEMENT, stride, dataSource: VertexElementType.Position },
      aColor2: { size: 4, offset: 8 * BYTES_PER_ELEMENT, stride, dataSource: VertexElementType.Position },
    };

    return Geometry.create(
      this.engine,
      {
        attributes,
        indices: { data: this.indices! },
        drawCount: 0,
        mode: glContext.TRIANGLES,
        maxVertex: SlotGroup.MAX_VERTICES,
        bufferUsage: glContext.DYNAMIC_DRAW,
      });
  }

  createMaterial (): Material {
    const material = Material.create(
      this.engine,
      {
        shader: createShader(this.engine),
      });

    material.setTexture('uTexture', this.lastTexture);
    material.blending = true;
    material.culling = false;
    material.depthTest = false;
    material.depthMask = false;

    setBlending(material, this.blendMode);

    return material;
  }

  updateMesh (vertices: number[], indices: number[], verticesLength: number) {
    if (!this.vertices || !this.indices) {
      throw new Error('Can not update SpineMesh after dispose.');
    }
    const verticesStart = this.verticesLength;
    const indexStart = this.indicesLength;
    const pointBefore = this.verticesLength / SlotGroup.VERTEX_SIZE;

    this.vertices.set(vertices, verticesStart);
    this.verticesLength += verticesLength;

    for (let i = 0, j = indexStart; i < indices.length; i++, j++) {
      const index = indices[i] + pointBefore;

      if (this.indices[j] !== index) {
        this.indices[j] = index;
        this.indicesDirty = true;
      }
    }
    this.indicesLength += indices.length;
  }

  endUpdate (worldMatrix: math.Matrix4) {
    if (!this.vertices || !this.indices) {
      throw new Error('Can not update SpineMesh after dispose.');
    }
    if (this.indicesLength > 0) {
      this.geometry.setAttributeSubData(VertexElementType.Position, 0, this.vertices.subarray(0, this.verticesLength));
      if (this.indicesDirty) {
        this.geometry.setIndexSubData(0, this.indices.subarray(0, this.indicesLength));
        this.indicesDirty = false;
      }
    }
    this.geometry.setDrawCount(this.indicesLength);
  }

  startUpdate () {
    this.verticesLength = 0;
    this.indicesLength = 0;
  }

  dispose (): void {
    this.geometry.dispose();
    this.vertices = null;
    this.indices = null;
  }
}

export function createShader (engine: Engine): SharedShaderWithSource {
  const env = engine.env;
  const macros: ShaderMacros = [
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];

  return {
    fragment: fs,
    vertex: vs,
    glslVersion: GLSLVersion.GLSL1,
    macros,
    shared: true,
  };
}
