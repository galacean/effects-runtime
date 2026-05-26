import type { Engine, Renderer } from '@galacean/effects';
import { Geometry, Material, Texture, glContext, math, setBlendMode } from '@galacean/effects';
import { ProStandardAccessors } from '../builtin/standard-accessors';
import type { ProDataBuffer } from '../data/data-buffer';
import type { ProEmitterInstance } from '../simulation/emitter-instance';
import { ProRenderer } from './renderer';
import { ProRibbonFacingMode, ProRibbonTessellationMode, ProRibbonTextureMode } from './ribbon-renderer-properties';
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

/** Automatic 模式下每段插入的细分点数 — 视觉曲率与成本的折中常量 */
const AUTOMATIC_SUBDIVISIONS = 4;

interface SortEntry {
  index: number,
  ribbonId: number,
  linkOrder: number,
}

/**
 * Tessellation 之后的最终几何点：用 Catmull-Rom 在原始粒子间插出的中间点，
 * 或本身就是某个原始粒子。renderer 的 writeGeometry 只跟这层数据打交道，
 * 与 dataBuffer / accessor 解耦。
 *
 * 属性一律已 lerp 完成 — width / color / uvDist / velocity 在原始端点之间
 * 线性插值；位置可能是 Catmull-Rom 平滑曲线上的采样
 */
interface InflatedPoint {
  x: number, y: number, z: number,
  width: number,
  r: number, g: number, b: number, a: number,
  uvDist: number,
  velX: number, velY: number, velZ: number,
  ribbonId: number,
}

/**
 * 原始粒子在 inflated 流程里的缓存条目。避免对 dataBuffer 同一粒子做多次
 * accessor 读（Catmull-Rom 需要 4 个邻居 + 属性插值需要 2 个端点）
 */
interface OriginalPointCache {
  x: number, y: number, z: number,
  width: number,
  r: number, g: number, b: number, a: number,
  uvDist: number,
  velX: number, velY: number, velZ: number,
  ribbonId: number,
}

/**
 * CPU 装配的 Ribbon/Trail Renderer（参照 UE Niagara Ribbon Renderer）。
 *
 * 粒子按 (RibbonID asc, LinkOrder desc) 排序后连成 triangle strip。
 * LinkOrder 是 InitializeParticle 写入的全局单调递增 spawn 序号，
 * 始终 distinct，burst 同帧 / 可变 lifetime 下都不会出现连接抖动。
 *
 * 每对相邻同 ribbon 粒子生成一个 quad。宽度优先取 per-particle
 * Particle.RibbonWidth（由 ProRibbonWidth / ProRibbonWidthScale 写入），
 * 为 0（哨兵）时回退到 Size.x * widthScale 老路径，向后兼容。
 *
 * Tessellation：properties.tessellationMode != Disabled 时，原始相邻粒子
 * 之间按 Catmull-Rom（带 curveTension）插出 N 个中间点，宽度 / 颜色 /
 * UV 距离线性插值。低 spawn rate 下 ribbon 不再呈折线感
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

  /** 原始粒子属性缓存 — 长度 ≥ sortBuffer.length，活跃部分用 sortBuffer.length 切片 */
  private originalCache: OriginalPointCache[] = [];
  /** inflated 点池 — 长度 ≥ inflatedLen，永不缩 */
  private inflatedPoints: InflatedPoint[] = [];
  private inflatedLen = 0;

  /** pre-pass 结果：每个 inflated 点所在 ribbon 的最后一个点下标。
   * Stretch 模式 v 分子用 (i - ribbonStart) / (endIdx - ribbonStart)；
   * 旧实现非端点处除数误用 len-1，跨 ribbon 后内部顶点 UV 被压扁 */
  private endIdxForPoint: Int32Array = new Int32Array(0);

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

    if (this.countSegments() === 0) {
      this.geometry.setDrawCount(0);

      return;
    }

    this.cacheOriginalAttributes(dataBuffer);
    const subdivisions = this.computeSubdivisions();

    this.buildInflatedPoints(subdivisions);

    if (this.inflatedLen < 2) {
      this.geometry.setDrawCount(0);

      return;
    }

    this.computeRibbonRanges();
    this.ensureCapacity(this.inflatedLen);
    const actualSegments = this.writeGeometry();

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
        this.sortBuffer[i] = { index: 0, ribbonId: 0, linkOrder: 0 };
      }
    }
    for (let i = 0; i < num; i++) {
      const entry = this.sortBuffer[i];

      entry.index = i;
      entry.ribbonId = a.ribbonId.get(dataBuffer, i);
      entry.linkOrder = a.ribbonLinkOrder.get(dataBuffer, i);
    }
    this.sortBuffer.length = num;
  }

  private sortParticles (): void {
    this.sortBuffer.sort((a, b) => {
      if (a.ribbonId !== b.ribbonId) {
        return a.ribbonId - b.ribbonId;
      }

      return b.linkOrder - a.linkOrder;
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

  /**
   * 一次性把原始粒子的位置 / 宽度 / 颜色 / 速度 / UV 距离读到缓存，
   * 避免后续 inflation 阶段在 Catmull-Rom 邻居访问里对同一粒子重复 accessor 读
   */
  private cacheOriginalAttributes (dataBuffer: ProDataBuffer): void {
    const a = this.accessors!;
    const sorted = this.sortBuffer;
    const len = sorted.length;
    const cache = this.originalCache;
    const props = this.properties;

    while (cache.length < len) {
      cache.push({
        x: 0, y: 0, z: 0,
        width: 0,
        r: 0, g: 0, b: 0, a: 0,
        uvDist: 0,
        velX: 0, velY: 0, velZ: 0,
        ribbonId: 0,
      });
    }
    for (let i = 0; i < len; i++) {
      const pIdx = sorted[i].index;
      const o = cache[i];

      a.position.get(dataBuffer, pIdx, this.tmpPos);
      a.size.get(dataBuffer, pIdx, this.tmpSize);
      a.color.get(dataBuffer, pIdx, this.tmpColor);
      a.velocity.get(dataBuffer, pIdx, this.tmpVel);
      o.x = this.tmpPos[0];
      o.y = this.tmpPos[1];
      o.z = this.tmpPos[2];
      const perParticleWidth = a.ribbonWidth.get(dataBuffer, pIdx);

      o.width = perParticleWidth > 0 ? perParticleWidth : this.tmpSize[0] * props.widthScale;
      o.r = this.tmpColor[0];
      o.g = this.tmpColor[1];
      o.b = this.tmpColor[2];
      o.a = this.tmpColor[3];
      o.uvDist = a.ribbonUVDistance.get(dataBuffer, pIdx);
      o.velX = this.tmpVel[0];
      o.velY = this.tmpVel[1];
      o.velZ = this.tmpVel[2];
      o.ribbonId = sorted[i].ribbonId;
    }
  }

  private computeSubdivisions (): number {
    const mode = this.properties.tessellationMode;

    if (mode === ProRibbonTessellationMode.Disabled) {
      return 0;
    }
    if (mode === ProRibbonTessellationMode.Custom) {
      // 防御性 clamp — 负值 / 离谱大值都会让 vertex 量爆掉
      return Math.max(0, Math.min(64, Math.floor(this.properties.customSubdivisions)));
    }

    return AUTOMATIC_SUBDIVISIONS;
  }

  /**
   * 走一遍 sortBuffer，按 ribbon 边界做 Catmull-Rom 细分。
   * 输出：inflatedPoints[0..inflatedLen)，跨 ribbon 之间 ribbonId 不同
   * 即可隔离（与 sortBuffer 同一套 ribbonId）
   */
  private buildInflatedPoints (subdivisions: number): void {
    const cache = this.originalCache;
    const len = this.sortBuffer.length;
    const tension = Math.max(0, Math.min(1, this.properties.curveTension));
    // (1 - τ) / 2 ：Catmull-Rom 切线缩放系数；τ=1 → s=0 → 退化成线性
    const s = (1 - tension) * 0.5;

    let write = 0;

    for (let i = 0; i < len; i++) {
      const p1 = cache[i];
      const isRibbonEnd = i === len - 1 || cache[i + 1].ribbonId !== p1.ribbonId;
      const isRibbonStart = i === 0 || cache[i - 1].ribbonId !== p1.ribbonId;

      // 1. 原始粒子点
      write = this.writeInflated(write, p1.x, p1.y, p1.z, p1.width,
        p1.r, p1.g, p1.b, p1.a, p1.uvDist,
        p1.velX, p1.velY, p1.velZ, p1.ribbonId);

      // 2. 细分点（在 i 与 i+1 之间）— 只在 ribbon 内部段插入
      if (isRibbonEnd || subdivisions === 0) {
        continue;
      }
      const p2 = cache[i + 1];
      // 边界处用端点复制扮 P0 / P3，避免越界 / 跨 ribbon 拉伸
      const p0 = isRibbonStart ? p1 : cache[i - 1];
      const nextIsRibbonEnd = i + 2 >= len || cache[i + 2].ribbonId !== p1.ribbonId;
      const p3 = nextIsRibbonEnd ? p2 : cache[i + 2];

      // Catmull-Rom 切线（带 tension）— 切线只依赖位置
      const t1x = s * (p2.x - p0.x);
      const t1y = s * (p2.y - p0.y);
      const t1z = s * (p2.z - p0.z);
      const t2x = s * (p3.x - p1.x);
      const t2y = s * (p3.y - p1.y);
      const t2z = s * (p3.z - p1.z);

      for (let k = 1; k <= subdivisions; k++) {
        const t = k / (subdivisions + 1);
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const x = h00 * p1.x + h10 * t1x + h01 * p2.x + h11 * t2x;
        const y = h00 * p1.y + h10 * t1y + h01 * p2.y + h11 * t2y;
        const z = h00 * p1.z + h10 * t1z + h01 * p2.z + h11 * t2z;

        // 属性 (width / color / uvDist / velocity) 沿 t 线性插值 —
        // Catmull-Rom 只用于位置平滑；属性曲线插值收益小、易引入 overshoot
        const omt = 1 - t;
        const width = omt * p1.width + t * p2.width;
        const r = omt * p1.r + t * p2.r;
        const g = omt * p1.g + t * p2.g;
        const b = omt * p1.b + t * p2.b;
        const aCol = omt * p1.a + t * p2.a;
        const uvDist = omt * p1.uvDist + t * p2.uvDist;
        const velX = omt * p1.velX + t * p2.velX;
        const velY = omt * p1.velY + t * p2.velY;
        const velZ = omt * p1.velZ + t * p2.velZ;

        write = this.writeInflated(write, x, y, z, width, r, g, b, aCol, uvDist,
          velX, velY, velZ, p1.ribbonId);
      }
    }
    this.inflatedLen = write;
  }

  private writeInflated (
    idx: number,
    x: number, y: number, z: number,
    width: number,
    r: number, g: number, b: number, a: number,
    uvDist: number,
    velX: number, velY: number, velZ: number,
    ribbonId: number,
  ): number {
    const pool = this.inflatedPoints;

    if (idx >= pool.length) {
      pool.push({
        x: 0, y: 0, z: 0,
        width: 0,
        r: 0, g: 0, b: 0, a: 0,
        uvDist: 0,
        velX: 0, velY: 0, velZ: 0,
        ribbonId: 0,
      });
    }
    const p = pool[idx];

    p.x = x; p.y = y; p.z = z;
    p.width = width;
    p.r = r; p.g = g; p.b = b; p.a = a;
    p.uvDist = uvDist;
    p.velX = velX; p.velY = velY; p.velZ = velZ;
    p.ribbonId = ribbonId;

    return idx + 1;
  }

  /**
   * 一次性反向扫，把每个 inflated 点所在 ribbon 的最后一个点下标填进 endIdxForPoint。
   * 用于 writeGeometry 里 Stretch 模式 v 分母 — 避免每个非端点除数误用全局 len-1
   * 而把中间顶点 UV 挤到错误比例。多 ribbon 场景必要
   */
  private computeRibbonRanges (): void {
    const len = this.inflatedLen;
    const points = this.inflatedPoints;

    if (this.endIdxForPoint.length < len) {
      this.endIdxForPoint = new Int32Array(Math.max(len, this.endIdxForPoint.length * 2 || 64));
    }
    const arr = this.endIdxForPoint;
    let currentEnd = len - 1;

    for (let i = len - 1; i >= 0; i--) {
      if (i < len - 1 && points[i + 1].ribbonId !== points[i].ribbonId) {
        currentEnd = i;
      }
      arr[i] = currentEnd;
    }
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

  // Writes vertices for all inflated points and indices for segments within the same ribbon.
  // Returns the number of actual segments generated.
  private writeGeometry (): number {
    const verts = this.vertexArray;
    const indices = this.indexArray;
    const props = this.properties;
    const points = this.inflatedPoints;
    const len = this.inflatedLen;
    const isCamera = props.facingMode === ProRibbonFacingMode.Camera;
    const isStretch = props.textureMode === ProRibbonTextureMode.Stretch;
    const isTiledFromStart = props.textureMode === ProRibbonTextureMode.TiledFromStart;

    // Pass 1: write all vertices (2 per inflated point)
    let ribbonStart = 0;
    let accDist = 0;
    // ribbon 起点的 RibbonUVDistance，用于 TiledFromStart 模式做相对锚定
    // 否则 source 已走很远时第一段 v 会是上千，texture 进入完全相同 phase
    // 也意味着 fract(v) 偏移随源年龄漂移，trail 看起来"texture 在滚"
    let ribbonStartUVDist = 0;

    for (let i = 0; i < len; i++) {
      const p = points[i];
      const isRibbonEnd = i === len - 1 || points[i + 1].ribbonId !== p.ribbonId;

      const px = p.x;
      const py = p.y;
      const pz = p.z;
      const width = p.width;

      // Compute tangent from neighbors in inflated array
      let tx = 0, ty = 0, tz = 0;

      if (i < len - 1 && points[i + 1].ribbonId === p.ribbonId) {
        const np = points[i + 1];

        tx = np.x - px;
        ty = np.y - py;
        tz = np.z - pz;
      }
      if (i > ribbonStart) {
        const pp = points[i - 1];
        const ptx = px - pp.x;
        const pty = py - pp.y;
        const ptz = pz - pp.z;

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
        nx = ty * p.velZ - tz * p.velY;
        ny = tz * p.velX - tx * p.velZ;
        nz = tx * p.velY - ty * p.velX;
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

      if (isStretch) {
        // 用 inflated 索引而非原始索引：tessellation 之后曲线长度变化，
        // 但在 stretch 模式我们要均匀拉满 [0, 1]，逐"几何"点等分最直观。
        // endIdxForPoint 是 pre-pass 算出的"当前 ribbon 最后一个点下标"，
        // 多 ribbon 时不会跨条 — 旧实现误用 len-1 把后续 ribbon 也算进除数
        const ribbonRange = this.endIdxForPoint[i] - ribbonStart;

        v = ribbonRange > 0 ? (i - ribbonStart) / ribbonRange : 0;
      } else if (isTiledFromStart) {
        // 直接读 per-particle RibbonUVDistance（spawn 模块已按 source 路径
        // 累计写入），跨帧粒子掉队 / spawn rate 抖动都不会让 UV 倒退
        const currUVDist = p.uvDist;

        if (i === ribbonStart) {
          // 整条 ribbon 的 UV 锚定到第一个粒子。注意 sorted 顺序是
          // LinkOrder desc：第一个粒子是 ribbon 上"最新"那个（即 v=0
          // 在 ribbon 头部，v 越大越靠近 trail 尾部），与 Tile 模式一致
          ribbonStartUVDist = currUVDist;
        }
        // 取 abs 防御性：源粒子 prevPos 异常（如刚 spawn）可能让本帧
        // distAtFrameStart 偶发反序；不让符号污染纹理坐标
        v = Math.abs(currUVDist - ribbonStartUVDist) / props.tileLength;
      } else {
        if (i > ribbonStart) {
          const pp = points[i - 1];
          const dx = px - pp.x;
          const dy = py - pp.y;
          const dz = pz - pp.z;

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
      verts[off + 5] = p.r;
      verts[off + 6] = p.g;
      verts[off + 7] = p.b;
      verts[off + 8] = p.a;

      // Right vertex (u=1)
      off += FLOATS_PER_VERTEX;
      verts[off] = px + nx * halfW;
      verts[off + 1] = py + ny * halfW;
      verts[off + 2] = pz + nz * halfW;
      verts[off + 3] = 1;
      verts[off + 4] = v;
      verts[off + 5] = p.r;
      verts[off + 6] = p.g;
      verts[off + 7] = p.b;
      verts[off + 8] = p.a;

      if (isRibbonEnd) {
        ribbonStart = i + 1;
        accDist = 0;
        ribbonStartUVDist = 0;
      }
    }

    // Pass 2: build index buffer (only connect adjacent inflated points in same ribbon)
    let segIdx = 0;

    for (let i = 0; i < len - 1; i++) {
      if (points[i].ribbonId === points[i + 1].ribbonId) {
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
