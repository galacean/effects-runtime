import type { Engine, Renderer } from '@galacean/effects';
import { Geometry, Material, Texture, glContext, math, setBlendMode } from '@galacean/effects';
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
attribute vec3 aVelocity;
attribute float aCameraOffset;
attribute vec2 aPivotOffset;

varying vec2 vUV;
varying vec4 vColor;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixV;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;
uniform vec4 _SubUVParams;   // x: rows, y: cols, z: total, w: enable
uniform vec4 _FacingParams;  // x: mode (0=billboard, 1=velocity, 2=unaligned)

void main () {
  vec3 worldCenter = (effects_ObjectToWorld * vec4(aOffset, 1.0)).xyz;

  // Camera offset：沿"远离相机"方向偏移 aCameraOffset 米（对齐 UE 约定）。
  // 正值=远离相机；负值=靠近相机（常用于消除粒子与几何相交闪烁）。
  if (abs(aCameraOffset) > 1e-5) {
    vec3 camPosCO = effects_MatrixInvV[3].xyz;
    vec3 toCam = camPosCO - worldCenter;
    float lenCO = length(toCam);

    if (lenCO > 1e-4) {
      worldCenter -= (toCam / lenCO) * aCameraOffset;
    }
  }

  vec3 axisX;
  vec3 axisY;

  if (_FacingParams.x > 1.5) {
    // Unaligned：quad 在物体局部 XY 平面展开，不做 billboard
    // 对齐 UE ENiagaraSpriteAlignment::Unaligned
    axisX = normalize((effects_ObjectToWorld * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    axisY = normalize((effects_ObjectToWorld * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  } else if (_FacingParams.x > 0.5) {
    // Velocity-aligned billboard：Y 沿速度，X = cross(viewDir, Y)
    // 速度也要变换到世界空间（Local space 模拟时 aVelocity 是局部速度）
    vec3 worldVel = (effects_ObjectToWorld * vec4(aVelocity, 0.0)).xyz;
    float vLen = length(worldVel);

    if (vLen > 1e-4) {
      axisY = worldVel / vLen;
      vec3 camPos = effects_MatrixInvV[3].xyz;
      vec3 viewDir = normalize(camPos - worldCenter);
      vec3 sideRaw = cross(viewDir, axisY);
      float sLen = length(sideRaw);

      axisX = sLen > 1e-4 ? sideRaw / sLen : vec3(1.0, 0.0, 0.0);
    } else {
      // 静止粒子退化为 billboard
      axisX = vec3(effects_MatrixV[0][0], effects_MatrixV[1][0], effects_MatrixV[2][0]);
      axisY = vec3(effects_MatrixV[0][1], effects_MatrixV[1][1], effects_MatrixV[2][1]);
    }
  } else {
    // Billboard
    axisX = vec3(effects_MatrixV[0][0], effects_MatrixV[1][0], effects_MatrixV[2][0]);
    axisY = vec3(effects_MatrixV[0][1], effects_MatrixV[1][1], effects_MatrixV[2][1]);
  }

  // PivotOffset 偏移角点后再旋转（对齐 UE PivotOffsetBinding）
  vec2 shifted = aCorner + aPivotOffset;
  float s = sin(aRotation);
  float c = cos(aRotation);
  vec2 rotated = vec2(shifted.x * c - shifted.y * s, shifted.x * s + shifted.y * c);

  vec3 worldPos = worldCenter + axisX * rotated.x * aSize.x + axisY * rotated.y * aSize.y;
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

const FLOATS_PER_VERTEX = 2 + 3 + 2 + 4 + 1 + 1 + 3 + 1 + 2; // aCorner + aOffset + aSize + aColor + aRotation + aFrame + aVelocity + aCameraOffset + aPivotOffset
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
  private tmpVel: [number, number, number] = [0, 0, 0];
  private tmpPivot: [number, number] = [0, 0];

  // 排序上下文 — 由 renderer-component 每帧推入
  private camX = 0; private camY = 0; private camZ = 8;
  private viewX = 0; private viewY = 0; private viewZ = -1;
  private worldMatrixForSort: math.Matrix4 | null = null;

  // 排序用的 indices buffer，按 sortMode 写入排序后的粒子下标顺序
  private sortIndices: Int32Array = new Int32Array(0);
  private sortKeys: Float32Array = new Float32Array(0);
  /** sort 时的 number[] scratch — 复用避免每帧 GC；length 跟 num 一致 */
  private sortScratch: number[] = [];

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
        aVelocity: { size: 3, offset: 13 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aCameraOffset: { size: 1, offset: 16 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
        aPivotOffset: { size: 2, offset: 17 * 4, stride: STRIDE_BYTES, dataSource: 'aCorner', type: glContext.FLOAT },
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
    this.material.depthMask = false; // Translucent particles must not write depth
    setBlendMode(this.material, this.properties.blending);
    this.material.setTexture('_MainTex', this.properties.texture ?? Texture.createWithData(engine));
    this.material.setVector4('_TexParams', new math.Vector4(this.properties.texture ? 1 : 0, 0, 0, 0));
    this.material.setVector4('_SubUVParams', this.computeSubUVParams());
    this.material.setVector4('_FacingParams', this.computeFacingParams());
  }

  /**
   * 设置纹理。传 null 关闭采样、纯走颜色。
   */
  setTexture (texture: Texture | null): void {
    this.properties.texture = texture;
    this.material.setTexture('_MainTex', texture ?? Texture.createWithData(this.engine));
    this.material.setVector4('_TexParams', new math.Vector4(texture ? 1 : 0, 0, 0, 0));
  }

  /**
   * properties 上的 blending/subUV 改了之后调一下，把变更推到 material。
   */
  syncProperties (): void {
    setBlendMode(this.material, this.properties.blending);
    this.material.setVector4('_SubUVParams', this.computeSubUVParams());
    this.material.setVector4('_FacingParams', this.computeFacingParams());
  }

  /**
   * 由 renderer-component 在 render 前调用，把 camera/view/worldMatrix
   * 传进来供深度排序使用。world space 模式下传 identity 也行（粒子已是世界坐标）。
   */
  setSortContext (
    cx: number, cy: number, cz: number,
    vx: number, vy: number, vz: number,
    worldMatrix: math.Matrix4,
  ): void {
    this.camX = cx; this.camY = cy; this.camZ = cz;
    this.viewX = vx; this.viewY = vy; this.viewZ = vz;
    this.worldMatrixForSort = worldMatrix;
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
    this.buildSortOrder(dataBuffer);
    this.writeVertices(dataBuffer);
    this.geometry.setAttributeData('aCorner', this.vertexArray);
    this.geometry.setDrawCount(dataBuffer.numInstances * INDICES_PER_PARTICLE);
  }

  /**
   * 按 sortMode 生成排序后的粒子下标顺序，写入 sortIndices。
   * none 模式直接返回原顺序（避免分配）。
   *
   * 关键：写 vertex buffer 时按粒子下标遍历，但用 sortIndices[i] 取真实粒子；
   * 排序后越靠后的越先画（粒子按 vertex order 画 → 后面的覆盖前面的 → 排序
   * 需让"远的"在前、"近的"在后，alpha 混合就正确）。
   */
  private buildSortOrder (dataBuffer: ProDataBuffer): void {
    const num = dataBuffer.numInstances;
    const a = this.accessors!;

    if (this.sortIndices.length < num) {
      this.sortIndices = new Int32Array(num);
      this.sortKeys = new Float32Array(num);
    }

    const mode = this.properties.sortMode;

    if (mode === 'none') {
      for (let i = 0; i < num; i++) {
        this.sortIndices[i] = i;
      }

      return;
    }

    // 计算每个粒子的排序 key
    const tmp: [number, number, number] = [0, 0, 0];

    // 在 world space 模式下 position 已经是世界坐标，无需变换；local space 下要乘 worldMatrix
    const wm = this.worldMatrixForSort?.elements;
    const useWorld = !!wm;

    for (let i = 0; i < num; i++) {
      a.position.get(dataBuffer, i, tmp);
      let wx = tmp[0], wy = tmp[1], wz = tmp[2];

      if (useWorld) {
        const m = wm;
        const x = wx, y = wy, z = wz;

        wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      }

      let key = 0;

      if (mode === 'viewDepth') {
        // dot(particlePos - camPos, viewDir) — 越大越远（沿视线方向越远）
        key = (wx - this.camX) * this.viewX + (wy - this.camY) * this.viewY + (wz - this.camZ) * this.viewZ;
      } else if (mode === 'distance') {
        const dx = wx - this.camX, dy = wy - this.camY, dz = wz - this.camZ;

        key = dx * dx + dy * dy + dz * dz;
      } else {
        // age：越大越老 → 越老越先画（先 spawn 的在下层）
        key = a.age.get(dataBuffer, i);
      }
      this.sortIndices[i] = i;
      this.sortKeys[i] = key;
    }

    // 按 key 降序排序（key 大的在前 → 先写入 vertex → 先画 → 被后画的覆盖）。
    // 复用 sortScratch — 旧实现每帧 new Array + push 会引起 GC 抖动；TypedArray 不能
    // 带 key 自定义比较，所以用 number[]
    const idxArr = this.sortScratch;

    while (idxArr.length < num) {
      idxArr.push(0);
    }
    idxArr.length = num;
    for (let i = 0; i < num; i++) { idxArr[i] = i; }
    const keys = this.sortKeys;

    idxArr.sort((x, y) => keys[y] - keys[x]);
    for (let i = 0; i < num; i++) {
      this.sortIndices[i] = idxArr[i];
    }
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

  private computeSubUVParams (): math.Vector4 {
    const p = this.properties;
    const enabled = p.subUVTotal > 1 && p.subUVRows > 0 && p.subUVCols > 0 ? 1 : 0;

    return new math.Vector4(p.subUVRows, p.subUVCols, p.subUVTotal, enabled);
  }

  private computeFacingParams (): math.Vector4 {
    const fm = this.properties.facingMode;
    const mode = fm === 'velocity' ? 1 : fm === 'unaligned' ? 2 : 0;

    return new math.Vector4(mode, 0, 0, 0);
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
    const indices = this.sortIndices;

    for (let pIdx = 0; pIdx < num; pIdx++) {
      const p = indices[pIdx];

      a.position.get(dataBuffer, p, this.tmpPos);
      a.size.get(dataBuffer, p, this.tmpSize);
      a.color.get(dataBuffer, p, this.tmpColor);
      a.velocity.get(dataBuffer, p, this.tmpVel);
      a.pivotOffset.get(dataBuffer, p, this.tmpPivot);
      const px = this.tmpPos[0];
      const py = this.tmpPos[1];
      const pz = this.tmpPos[2];
      const sx = this.tmpSize[0];
      const sy = this.tmpSize[1];
      const cr = this.tmpColor[0];
      const cg = this.tmpColor[1];
      const cb = this.tmpColor[2];
      const ca = this.tmpColor[3];
      const vx = this.tmpVel[0];
      const vy = this.tmpVel[1];
      const vz = this.tmpVel[2];
      const rot = a.rotation.get(dataBuffer, p);
      const frame = a.subUVFrame.get(dataBuffer, p);
      const co = a.cameraOffset.get(dataBuffer, p);
      const pox = this.tmpPivot[0];
      const poy = this.tmpPivot[1];

      let base = pIdx * VERTS_PER_PARTICLE * FLOATS_PER_VERTEX;

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
        verts[base + 13] = vx;
        verts[base + 14] = vy;
        verts[base + 15] = vz;
        verts[base + 16] = co;
        verts[base + 17] = pox;
        verts[base + 18] = poy;
        base += FLOATS_PER_VERTEX;
      }
    }
  }
}
