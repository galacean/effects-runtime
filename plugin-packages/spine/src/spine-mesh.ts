import type { BlendMode } from '@esotericsoftware/spine-core';
import type {
  Attribute, Disposable, Engine, ShaderMacros, SharedShaderWithSource, Texture, math,
} from '@galacean/effects';
import {
  GLSLVersion, Geometry, Material, Mesh, PLAYER_OPTIONS_ENV_EDITOR, glContext,
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
  renderOptions: {
    maskMode?: number,
    mask?: number,
  },
  engine: Engine,
}

let seed = 1;

export class SpineMesh implements Disposable {
  private vertices: Float32Array | null;
  private indices: Uint16Array | null;
  private verticesLength = 0;
  private indicesLength = 0;
  private engine: Engine;

  mesh: Mesh;
  geometry: Geometry;
  material: Material;
  lastTexture: Texture;
  blendMode: BlendMode;
  priority: number;

  constructor (renderInfo: SpineMeshRenderInfo) {
    const { blendMode, texture, priority, renderOptions = {}, name = 'MSpine', engine } = renderInfo;
    const { mask = 0, maskMode = 0 } = renderOptions;

    this.blendMode = blendMode;
    this.lastTexture = texture;
    this.priority = priority;
    this.engine = engine;
    this.geometry = this.createGeometry();
    this.material = this.createMaterial(maskMode, mask);
    this.mesh = Mesh.create(
      engine,
      {
        name: name + seed++,
        priority: this.priority,
        material: this.material,
        geometry: this.geometry,
      });
    this.vertices = new Float32Array(SlotGroup.MAX_VERTICES * SlotGroup.VERTEX_SIZE);
    this.indices = new Uint16Array(SlotGroup.MAX_VERTICES);

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
      'aPosition': { size: 2, offset: 0, stride, data: new Float32Array(0) },
      'aColor': { size: 4, offset: 2 * BYTES_PER_ELEMENT, stride, dataSource: 'aPosition' },
      'aTexCoords': { size: 2, offset: 6 * BYTES_PER_ELEMENT, stride, dataSource: 'aPosition' },
      'aColor2': { size: 4, offset: 8 * BYTES_PER_ELEMENT, stride, dataSource: 'aPosition' },
    };

    return Geometry.create(
      this.engine,
      {
        attributes,
        indices: { data: new Uint16Array(0), releasable: true },
        mode: glContext.TRIANGLES,
        maxVertex: SlotGroup.MAX_VERTICES,
      });
  }

  createMaterial (maskMode: number, maskOrder: number): Material {
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
      this.indices[j] = indices[i] + pointBefore;
    }
    this.indicesLength += indices.length;
  }

  endUpdate (worldMatrix: math.Matrix4) {
    if (!this.vertices || !this.indices) {
      throw new Error('Can not update SpineMesh after dispose.');
    }
    for (let i = this.verticesLength; i < this.vertices.length; i++) {
      this.vertices[i] = 0;
    }
    for (let i = this.indicesLength; i < this.indices.length; i++) {
      this.indices[i] = 0;
    }
    this.geometry.setAttributeData('aPosition', this.vertices);
    this.geometry.setIndexData(this.indices);
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
