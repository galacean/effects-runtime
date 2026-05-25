import type { Engine, Renderer } from '@galacean/effects';
import { Geometry, Material, Texture, glContext, math, setBlendMode } from '@galacean/effects';
import { ProStandardAccessors } from '../builtin/standard-accessors';
import type { ProDataBuffer } from '../data/data-buffer';
import type { ProEmitterInstance } from '../simulation/emitter-instance';
import { ProRenderer } from './renderer';
import { ProRibbonFacingMode, ProRibbonTextureMode } from './ribbon-renderer-properties';
import type { ProRibbonRendererProperties } from './ribbon-renderer-properties';

const VERT = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;
attribute vec4 aColor;

varying vec2 vUV;
varying vec4 vColor;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;

void main () {
  vec4 worldPos = effects_ObjectToWorld * vec4(aPos, 1.0);
  gl_Position = effects_MatrixVP * worldPos;
  vUV = aUV;
  vColor = aColor;
}
`;

const FRAG = `
precision highp float;

varying vec2 vUV;
varying vec4 vColor;

uniform sampler2D _MainTex;
uniform vec4 _TexParams;

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

const FLOATS_PER_VERTEX = 3 + 2 + 4; // aPos + aUV + aColor
const STRIDE_BYTES = FLOATS_PER_VERTEX * 4;

interface SortEntry {
  index: number,
  ribbonId: number,
  age: number,
}

/**
 * CPU 装配的 Ribbon/Trail Renderer（参照 UE Niagara Ribbon Renderer）。
 *
 * 粒子按 (RibbonID asc, Age desc) 排序后连成 triangle strip。
 * 每对相邻同 ribbon 粒子生成一个 quad，宽度由 Size.x * widthScale 决定。
 */
export class ProRibbonRenderer extends ProRenderer {
  override readonly properties: ProRibbonRendererProperties;
  readonly geometry: Geometry;
  readonly material: Material;

  private engine: Engine;
  private vertexArray: Float32Array;
  private indexArray: Uint16Array;
  private allocatedPoints = 0;
  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  private sortBuffer: SortEntry[] = [];

  private tmpPos: [number, number, number] = [0, 0, 0];
  private tmpSize: [number, number] = [0, 0];
  private tmpColor: [number, number, number, number] = [0, 0, 0, 0];
  private tmpVel: [number, number, number] = [0, 0, 0];

  private viewDirX = 0;
  private viewDirY = 0;
  private viewDirZ = 1;

  constructor (engine: Engine, properties: ProRibbonRendererProperties) {
    super(properties);
    this.properties = properties;
    this.engine = engine;
    this.vertexArray = new Float32Array(0);
    this.indexArray = new Uint16Array(0);

    this.geometry = Geometry.create(engine, {
      attributes: {
        aPos: { size: 3, offset: 0, stride: STRIDE_BYTES, type: glContext.FLOAT, data: new Float32Array(0) },
        aUV: { size: 2, offset: 3 * 4, stride: STRIDE_BYTES, dataSource: 'aPos', type: glContext.FLOAT },
        aColor: { size: 4, offset: 5 * 4, stride: STRIDE_BYTES, dataSource: 'aPos', type: glContext.FLOAT },
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
        name: 'ProRibbonRenderer',
      },
    });
    this.material.blending = true;
    this.material.depthTest = true;
    this.material.depthMask = false; // Translucent particles must not write depth
    setBlendMode(this.material, this.properties.blending);
    this.material.setTexture('_MainTex', this.properties.texture ?? Texture.createWithData(engine));
    this.material.setVector4('_TexParams', new math.Vector4(this.properties.texture ? 1 : 0, 0, 0, 0));
  }

  setTexture (texture: Texture | null): void {
    this.properties.texture = texture;
    this.material.setTexture('_MainTex', texture ?? Texture.createWithData(this.engine));
    this.material.setVector4('_TexParams', new math.Vector4(texture ? 1 : 0, 0, 0, 0));
  }

  syncProperties (): void {
    setBlendMode(this.material, this.properties.blending);
  }

  setViewDirection (x: number, y: number, z: number): void {
    this.viewDirX = x;
    this.viewDirY = y;
    this.viewDirZ = z;
  }

  override initialize (_emitterInstance: ProEmitterInstance): void {
    // geometry/material ready at construction
  }

  override generateDynamicData (emitterInstance: ProEmitterInstance): void {
    const dataSet = emitterInstance.particleDataSet;
    const dataBuffer = dataSet?.getCurrentData();

    if (!dataSet || !dataBuffer || dataBuffer.numInstances < 2) {
      this.geometry.setDrawCount(0);

      return;
    }
    if (this.cachedLayout !== dataSet.layout) {
      this.accessors = new ProStandardAccessors(dataSet.layout);
      this.cachedLayout = dataSet.layout;
    }

    const num = dataBuffer.numInstances;

    this.buildSortBuffer(dataBuffer, num);
    this.sortParticles();

    const segmentCount = this.countSegments();

    if (segmentCount === 0) {
      this.geometry.setDrawCount(0);

      return;
    }

    this.ensureCapacity(num);
    const actualSegments = this.writeGeometry(dataBuffer);

    this.geometry.setAttributeData('aPos', this.vertexArray);
    this.geometry.setIndexData(this.indexArray);
    this.geometry.setDrawCount(actualSegments * 6);
  }

  override release (): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  draw (renderer: Renderer, worldMatrix: math.Matrix4): void {
    if (this.geometry.getDrawCount() === 0) {
      return;
    }
    renderer.drawGeometry(this.geometry, worldMatrix, this.material);
  }

  private buildSortBuffer (dataBuffer: ProDataBuffer, num: number): void {
    const a = this.accessors!;

    if (this.sortBuffer.length < num) {
      this.sortBuffer = new Array(num);
      for (let i = 0; i < num; i++) {
        this.sortBuffer[i] = { index: 0, ribbonId: 0, age: 0 };
      }
    }
    for (let i = 0; i < num; i++) {
      const entry = this.sortBuffer[i];

      entry.index = i;
      entry.ribbonId = a.ribbonId.get(dataBuffer, i);
      entry.age = a.age.get(dataBuffer, i);
    }
    this.sortBuffer.length = num;
  }

  private sortParticles (): void {
    this.sortBuffer.sort((a, b) => {
      if (a.ribbonId !== b.ribbonId) {
        return a.ribbonId - b.ribbonId;
      }

      return b.age - a.age;
    });
  }

  private countSegments (): number {
    let segments = 0;
    const len = this.sortBuffer.length;

    for (let i = 0; i < len - 1; i++) {
      if (this.sortBuffer[i].ribbonId === this.sortBuffer[i + 1].ribbonId) {
        segments++;
      }
    }

    return segments;
  }

  private ensureCapacity (numPoints: number): void {
    if (numPoints <= this.allocatedPoints) {
      return;
    }
    const newCapacity = Math.max(numPoints, this.allocatedPoints * 2 || 64);

    // 2 vertices per point (left + right)
    this.vertexArray = new Float32Array(newCapacity * 2 * FLOATS_PER_VERTEX);
    // max segments = numPoints - 1, 6 indices per segment
    this.indexArray = new Uint16Array((newCapacity - 1) * 6);
    this.allocatedPoints = newCapacity;
  }

  /**
   * Writes vertices for all sorted points and indices for segments within same ribbon.
   * Returns the number of actual segments generated.
   */
  private writeGeometry (dataBuffer: ProDataBuffer): number {
    const a = this.accessors!;
    const verts = this.vertexArray;
    const indices = this.indexArray;
    const props = this.properties;
    const sorted = this.sortBuffer;
    const len = sorted.length;
    const isCamera = props.facingMode === ProRibbonFacingMode.Camera;
    const isStretch = props.textureMode === ProRibbonTextureMode.Stretch;

    // Pass 1: write all vertices (2 per point)
    // We need to know ribbon boundaries for UV computation
    let ribbonStart = 0;
    let accDist = 0;

    for (let i = 0; i < len; i++) {
      const pIdx = sorted[i].index;
      const isRibbonEnd = i === len - 1 || sorted[i].ribbonId !== sorted[i + 1].ribbonId;

      a.position.get(dataBuffer, pIdx, this.tmpPos);
      a.size.get(dataBuffer, pIdx, this.tmpSize);
      a.color.get(dataBuffer, pIdx, this.tmpColor);

      const px = this.tmpPos[0];
      const py = this.tmpPos[1];
      const pz = this.tmpPos[2];
      const width = this.tmpSize[0] * props.widthScale;

      // Compute tangent from neighbors
      let tx = 0, ty = 0, tz = 0;

      if (i < len - 1 && sorted[i].ribbonId === sorted[i + 1].ribbonId) {
        const nextPIdx = sorted[i + 1].index;
        const np: [number, number, number] = [0, 0, 0];

        a.position.get(dataBuffer, nextPIdx, np);
        tx = np[0] - px;
        ty = np[1] - py;
        tz = np[2] - pz;
      }
      if (i > ribbonStart) {
        const prevPIdx = sorted[i - 1].index;
        const pp: [number, number, number] = [0, 0, 0];

        a.position.get(dataBuffer, prevPIdx, pp);
        const ptx = px - pp[0];
        const pty = py - pp[1];
        const ptz = pz - pp[2];

        if (tx === 0 && ty === 0 && tz === 0) {
          tx = ptx;
          ty = pty;
          tz = ptz;
        } else {
          // average of forward and backward tangents
          tx = (tx + ptx) * 0.5;
          ty = (ty + pty) * 0.5;
          tz = (tz + ptz) * 0.5;
        }
      }

      const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);

      if (tLen > 1e-6) {
        tx /= tLen;
        ty /= tLen;
        tz /= tLen;
      }

      // Compute normal perpendicular to tangent
      let nx: number, ny: number, nz: number;

      if (isCamera) {
        nx = ty * this.viewDirZ - tz * this.viewDirY;
        ny = tz * this.viewDirX - tx * this.viewDirZ;
        nz = tx * this.viewDirY - ty * this.viewDirX;
      } else {
        a.velocity.get(dataBuffer, pIdx, this.tmpVel);
        nx = ty * this.tmpVel[2] - tz * this.tmpVel[1];
        ny = tz * this.tmpVel[0] - tx * this.tmpVel[2];
        nz = tx * this.tmpVel[1] - ty * this.tmpVel[0];
      }

      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

      if (nLen > 1e-6) {
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;
      } else {
        nx = 0;
        ny = 1;
        nz = 0;
      }

      // Compute UV v-coordinate
      let v: number;
      const ribbonLen = (isRibbonEnd ? i : i) - ribbonStart + 1;

      if (isStretch) {
        v = ribbonLen > 1 ? (i - ribbonStart) / ((isRibbonEnd ? i : len - 1) - ribbonStart) : 0;
      } else {
        if (i > ribbonStart) {
          const prevPIdx = sorted[i - 1].index;
          const pp: [number, number, number] = [0, 0, 0];

          a.position.get(dataBuffer, prevPIdx, pp);
          const dx = px - pp[0];
          const dy = py - pp[1];
          const dz = pz - pp[2];

          accDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        v = accDist / props.tileLength;
      }

      // Write left and right vertices
      const halfW = width * 0.5;
      let off = i * 2 * FLOATS_PER_VERTEX;

      // Left vertex (u=0)
      verts[off] = px - nx * halfW;
      verts[off + 1] = py - ny * halfW;
      verts[off + 2] = pz - nz * halfW;
      verts[off + 3] = 0;
      verts[off + 4] = v;
      verts[off + 5] = this.tmpColor[0];
      verts[off + 6] = this.tmpColor[1];
      verts[off + 7] = this.tmpColor[2];
      verts[off + 8] = this.tmpColor[3];

      // Right vertex (u=1)
      off += FLOATS_PER_VERTEX;
      verts[off] = px + nx * halfW;
      verts[off + 1] = py + ny * halfW;
      verts[off + 2] = pz + nz * halfW;
      verts[off + 3] = 1;
      verts[off + 4] = v;
      verts[off + 5] = this.tmpColor[0];
      verts[off + 6] = this.tmpColor[1];
      verts[off + 7] = this.tmpColor[2];
      verts[off + 8] = this.tmpColor[3];

      if (isRibbonEnd) {
        ribbonStart = i + 1;
        accDist = 0;
      }
    }

    // Pass 2: build index buffer (only connect adjacent points in same ribbon)
    let segIdx = 0;

    for (let i = 0; i < len - 1; i++) {
      if (sorted[i].ribbonId === sorted[i + 1].ribbonId) {
        const v0 = i * 2;
        const v1 = (i + 1) * 2;
        const idx = segIdx * 6;

        indices[idx] = v0;
        indices[idx + 1] = v0 + 1;
        indices[idx + 2] = v1;
        indices[idx + 3] = v1;
        indices[idx + 4] = v0 + 1;
        indices[idx + 5] = v1 + 1;
        segIdx++;
      }
    }

    return segIdx;
  }
}
