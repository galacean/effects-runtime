import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Engine } from '../../../engine';
import { glContext } from '../../../gl';
import { Material, setBlendMode } from '../../../material';
import type { Renderer } from '../../../render';
import { Geometry } from '../../../render';
import { Texture } from '../../../texture';
import { ProStandardAccessors } from '../builtin/standard-accessors';
import type { ProDataBuffer } from '../data/data-buffer';
import type { ProEmitterInstance } from '../simulation/emitter-instance';
import { ProRenderer } from './renderer';
import type { ProSpriteRendererProperties } from './sprite-renderer-properties';

const VERT = `
precision highp float;

attribute vec2 aCorner;
attribute vec3 aOffset;
attribute vec2 aSize;
attribute vec4 aColor;
attribute float aRotation;
attribute float aFrame;

varying vec2 vUV;
varying vec4 vColor;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixV;
uniform mat4 effects_ObjectToWorld;
uniform vec4 _SubUVParams; // x: rows, y: cols, z: total, w: enable

void main () {
  float s = sin(aRotation);
  float c = cos(aRotation);
  vec2 rotated = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c);
  vec3 worldCenter = (effects_ObjectToWorld * vec4(aOffset, 1.0)).xyz;
  mat4 v = effects_MatrixV;
  vec3 camRight = vec3(v[0][0], v[1][0], v[2][0]);
  vec3 camUp = vec3(v[0][1], v[1][1], v[2][1]);
  vec3 worldPos = worldCenter + camRight * rotated.x * aSize.x + camUp * rotated.y * aSize.y;
  gl_Position = effects_MatrixVP * vec4(worldPos, 1.0);

  if (_SubUVParams.w > 0.5) {
    float frame = floor(aFrame);
    float cols = _SubUVParams.y;
    float rows = _SubUVParams.x;
    float row = floor(frame / cols);
    float col = frame - row * cols;
    vec2 cellSize = vec2(1.0 / cols, 1.0 / rows);
    vec2 cellOffset = vec2(col, rows - 1.0 - row) * cellSize;
    vUV = cellOffset + (aCorner + vec2(0.5)) * cellSize;
  } else {
    vUV = aCorner + vec2(0.5);
  }
  vColor = aColor;
}
`;

const FRAG = `
precision highp float;

varying vec2 vUV;
varying vec4 vColor;

uniform sampler2D _MainTex;
uniform vec4 _TexParams; // x: useTexture, y: preMulAlpha

void main () {
  vec4 base = vColor;
  if (_TexParams.x > 0.5) {
    vec4 sampled = texture2D(_MainTex, vUV);
    base *= sampled;
  }
  if (_TexParams.y > 0.5) {
    base.rgb *= base.a;
  }
  if (base.a < 0.001) {
    discard;
  }
  gl_FragColor = base;
}
`;

const FLOATS_PER_VERTEX = 2 + 3 + 2 + 4 + 1 + 1; // aCorner + aOffset + aSize + aColor + aRotation + aFrame
const STRIDE_BYTES = FLOATS_PER_VERTEX * 4;
const VERTS_PER_PARTICLE = 4;
const INDICES_PER_PARTICLE = 6;
const CORNER_OFFSETS: ReadonlyArray<[number, number]> = [
  [-0.5, 0.5],
  [-0.5, -0.5],
  [0.5, 0.5],
  [0.5, -0.5],
];

/**
 * CPU 装配的 Sprite Renderer。
 *
 * 每个粒子占 4 顶点 × 6 索引（两个三角形）。Billboard 在顶点着色器里靠
 * effects_MatrixV 的右/上向量展开 + aRotation 在角点上做 2D 旋转。
 *
 * SubUV 由 Particle.SubUVFrame 写入 + _SubUVParams 控制网格切；不开启时
 * 直接采全图。Texture 为空时 shader 走纯颜色分支。
 */
export class ProSpriteRenderer extends ProRenderer {
  override readonly properties: ProSpriteRendererProperties;
  readonly geometry: Geometry;
  readonly material: Material;

  private engine: Engine;
  private vertexArray: Float32Array;
  private indexArray: Uint16Array;
  private allocatedParticles = 0;
  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  private tmpPos: [number, number, number] = [0, 0, 0];
  private tmpSize: [number, number] = [0, 0];
  private tmpColor: [number, number, number, number] = [0, 0, 0, 0];

  constructor (engine: Engine, properties: ProSpriteRendererProperties) {
    super(properties);
    this.properties = properties;
    this.engine = engine;
    this.vertexArray = new Float32Array(0);
    this.indexArray = new Uint16Array(0);

    this.geometry = Geometry.create(engine, {
      attributes: {
        aCorner: { size: 2, offset: 0, stride: STRIDE_BYTES, type: glContext.FLOAT, data: new Float32Array(0) },
        aOffset: { size: 3, offset: 2 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aSize: { size: 2, offset: 5 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aColor: { size: 4, offset: 7 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aRotation: { size: 1, offset: 11 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aFrame: { size: 1, offset: 12 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
      },
      indices: { data: new Uint16Array(0), releasable: false },
      mode: glContext.TRIANGLES,
      drawCount: 0,
      bufferUsage: glContext.DYNAMIC_DRAW,
    });

    this.material = Material.create(engine, {
      shader: {
        vertex: VERT,
        fragment: FRAG,
        shared: true,
        name: 'ProSpriteRenderer',
      },
    });
    this.material.blending = true;
    this.material.depthTest = true;
    this.material.depthMask = false;
    setBlendMode(this.material, this.properties.blending);
    this.material.setTexture('_MainTex', this.properties.texture ?? Texture.createWithData(engine));
    this.material.setVector4('_TexParams', new Vector4(this.properties.texture ? 1 : 0, 0, 0, 0));
    this.material.setVector4('_SubUVParams', this.computeSubUVParams());
  }

  /**
   * 设置纹理。传 null 关闭采样、纯走颜色。
   */
  setTexture (texture: Texture | null): void {
    this.properties.texture = texture;
    this.material.setTexture('_MainTex', texture ?? Texture.createWithData(this.engine));
    this.material.setVector4('_TexParams', new Vector4(texture ? 1 : 0, 0, 0, 0));
  }

  /**
   * properties 上的 blending/subUV 改了之后调一下，把变更推到 material。
   */
  syncProperties (): void {
    setBlendMode(this.material, this.properties.blending);
    this.material.setVector4('_SubUVParams', this.computeSubUVParams());
  }

  override initialize (_emitterInstance: ProEmitterInstance): void {
    // 几何 / 材质在构造时已就绪
  }

  override generateDynamicData (emitterInstance: ProEmitterInstance): void {
    const dataSet = emitterInstance.particleDataSet;
    const dataBuffer = dataSet?.getCurrentData();

    if (!dataSet || !dataBuffer || dataBuffer.numInstances === 0) {
      this.geometry.setDrawCount(0);

      return;
    }
    if (this.cachedLayout !== dataSet.layout) {
      this.accessors = new ProStandardAccessors(dataSet.layout);
      this.cachedLayout = dataSet.layout;
    }
    this.ensureCapacity(dataBuffer.numInstances);
    this.writeVertices(dataBuffer);
    this.geometry.setAttributeData('aCorner', this.vertexArray);
    this.geometry.setDrawCount(dataBuffer.numInstances * INDICES_PER_PARTICLE);
  }

  override release (): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  draw (renderer: Renderer, worldMatrix: Matrix4): void {
    if (this.geometry.getDrawCount() === 0) {
      return;
    }
    renderer.drawGeometry(this.geometry, worldMatrix, this.material);
  }

  private computeSubUVParams (): Vector4 {
    const p = this.properties;
    const enabled = p.subUVTotal > 1 && p.subUVRows > 0 && p.subUVCols > 0 ? 1 : 0;

    return new Vector4(p.subUVRows, p.subUVCols, p.subUVTotal, enabled);
  }

  private ensureCapacity (numParticles: number): void {
    if (numParticles <= this.allocatedParticles) {
      return;
    }
    const newCapacity = Math.max(numParticles, this.allocatedParticles * 2 || 64);

    this.vertexArray = new Float32Array(newCapacity * VERTS_PER_PARTICLE * FLOATS_PER_VERTEX);

    const indexCount = newCapacity * INDICES_PER_PARTICLE;
    const indices = new Uint16Array(indexCount);

    for (let p = 0; p < newCapacity; p++) {
      const v = p * VERTS_PER_PARTICLE;
      const i = p * INDICES_PER_PARTICLE;

      indices[i] = v;
      indices[i + 1] = v + 1;
      indices[i + 2] = v + 2;
      indices[i + 3] = v + 2;
      indices[i + 4] = v + 1;
      indices[i + 5] = v + 3;
    }
    this.indexArray = indices;
    this.geometry.setIndexData(indices);
    this.allocatedParticles = newCapacity;
  }

  private writeVertices (dataBuffer: ProDataBuffer): void {
    const a = this.accessors!;
    const verts = this.vertexArray;
    const num = dataBuffer.numInstances;

    for (let p = 0; p < num; p++) {
      a.position.get(dataBuffer, p, this.tmpPos);
      a.size.get(dataBuffer, p, this.tmpSize);
      a.color.get(dataBuffer, p, this.tmpColor);
      const px = this.tmpPos[0];
      const py = this.tmpPos[1];
      const pz = this.tmpPos[2];
      const sx = this.tmpSize[0];
      const sy = this.tmpSize[1];
      const cr = this.tmpColor[0];
      const cg = this.tmpColor[1];
      const cb = this.tmpColor[2];
      const ca = this.tmpColor[3];
      const rot = a.rotation.get(dataBuffer, p);
      const frame = a.subUVFrame.get(dataBuffer, p);

      let base = p * VERTS_PER_PARTICLE * FLOATS_PER_VERTEX;

      for (let v = 0; v < VERTS_PER_PARTICLE; v++) {
        const corner = CORNER_OFFSETS[v];

        verts[base] = corner[0];
        verts[base + 1] = corner[1];
        verts[base + 2] = px;
        verts[base + 3] = py;
        verts[base + 4] = pz;
        verts[base + 5] = sx;
        verts[base + 6] = sy;
        verts[base + 7] = cr;
        verts[base + 8] = cg;
        verts[base + 9] = cb;
        verts[base + 10] = ca;
        verts[base + 11] = rot;
        verts[base + 12] = frame;
        base += FLOATS_PER_VERTEX;
      }
    }
  }
}
