import { Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Engine } from '../../../engine';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../../constants';
import { getPreMultiAlpha, Material, setBlendMode, setSideMode } from '../../../material';
import type { Attribute, GeometryProps, ShaderMacros } from '../../../render';
import { GLSLVersion, Geometry, Mesh } from '../../../render';
import { particleFrag, particleVert } from '../../../shader';
import { Texture } from '../../../texture';
import { assertExist } from '../../../utils';

// aPos 顶点布局:每顶点 12 个 float,排成四组 vec3:
//   [0..2] position, [3..5] velocity, [6..8] dirX, [9..11] dirY。
// shader 通过 aPos / aDirX / aDirY 三个名字读取(offset 0/6/9);velocity 段仅 CPU 写、shader 不读。
const FLOATS_PER_POS_VERTEX = 12;
// aRot 顶点布局:每顶点 8 个 float —— [0..2] rotation, [3] seed, [4..7] color。
const FLOATS_PER_ROT_VERTEX = 8;
const ROT_COLOR_OFFSET = 4;
const VERTS_PER_PARTICLE = 4;

export interface ParticleMeshProps {
  renderMode?: number,
  blending?: number,
  mask: number,
  maskMode: number,
  side: number,
  transparentOcclusion?: boolean,
  sprite?: {
    animate?: boolean,
    blend?: boolean,
    col: number,
    row: number,
    total: number,
  },
  useSprite?: boolean,
  textureFlip?: boolean,
  occlusion?: boolean,
  diffuse?: Texture,
  maxCount: number,
  name: string,
  anchor: Vector2,
}

/**
 * Sprite 粒子的材质 + 几何载体。由 {@link ParticleSpriteRenderer} 持有:
 * 负责在构造期把 renderer props 落成一份 Material(着色器 + uniform)与一份预分配的
 * SoA 顶点几何,运行期顶点数据由 renderer 每帧覆写。
 */
export class ParticleMesh {
  geometry: Geometry;
  mesh: Mesh;
  maxParticleBufferCount: number;
  time: number;

  readonly useSprite?: boolean;
  readonly textureOffsets: number[];
  readonly anchor: Vector2;

  constructor (engine: Engine, props: ParticleMeshProps) {
    const {
      sprite, maxCount, textureFlip, useSprite, name,
      side, occlusion, anchor, blending, transparentOcclusion,
      renderMode = 0,
      diffuse = Texture.createWithData(engine),
    } = props;
    const { env } = engine ?? {};
    const { level } = engine.gpuCapability;

    // 1. macro + sprite sheet 参数(sprite 开启时顶点/片元共用同一组 uv 网格)
    const macros: ShaderMacros = [
      ['RENDER_MODE', +renderMode],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    let spriteUniform: Float32Array | null = null;

    if (sprite?.animate) {
      macros.push(['USE_SPRITE', true]);
      spriteUniform = new Float32Array([sprite.col, sprite.row, sprite.total, sprite.blend ? 1 : 0]);
    }
    this.useSprite = useSprite || spriteUniform !== null;

    // 2. material(shader + 状态 + uniform)
    const material = this.createMaterial(engine, {
      name, level, renderMode, blending, side, occlusion, transparentOcclusion, diffuse, macros, spriteUniform,
    });

    // 3. geometry + mesh(预分配 maxCount*4 顶点的 SoA 布局)
    const geometry = Geometry.create(engine, generateGeometryProps(maxCount * VERTS_PER_PARTICLE, this.useSprite, `particle#${name}`));
    const mesh = Mesh.create(engine, { name: `MParticle_${name}`, material, geometry });

    this.anchor = anchor;
    this.mesh = mesh;
    this.geometry = mesh.firstGeometry();
    this.textureOffsets = textureFlip ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
    this.time = 0;
  }

  // ---- runtime: per-frame / lifecycle ----

  /** 循环回绕时,把所有已写粒子的起始时间整体前移,使 age 计算不跨越循环边界。 */
  minusTime (time: number) {
    const aOffset = this.geometry.getAttributeData('aOffset') as Float32Array;

    for (let i = 0; i < aOffset.length; i += 4) {
      aOffset[i + 2] -= time;
    }
    this.geometry.setAttributeData('aOffset', aOffset);
    this.time -= time;
  }

  /** 清空渲染数据(drawCount=0)并把容量标记为 0,强制下一帧 ensureCapacity 重建缓冲。 */
  clearPoints () {
    this.resetGeometryData(this.geometry);
    this.geometry.setDrawCount(0);
    this.maxParticleBufferCount = 0;
  }

  // ---- query ----

  /** 取第 index 个粒子的颜色(读 aRot 首顶点的 color 段)。供交互拾取取色用。 */
  getPointColor (index: number) {
    const data = this.geometry.getAttributeData('aRot');

    assertExist(data);
    const i = index * FLOATS_PER_ROT_VERTEX * VERTS_PER_PARTICLE + ROT_COLOR_OFFSET;

    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  // ---- private ----

  private createMaterial (
    engine: Engine,
    ctx: {
      name: string, level: number, renderMode: number,
      blending: number | undefined, side: number,
      occlusion: boolean | undefined, transparentOcclusion: boolean | undefined,
      diffuse: Texture, macros: ShaderMacros, spriteUniform: Float32Array | null,
    },
  ): Material {
    const shaderCacheId = ctx.spriteUniform ? 1 << 2 : 0;
    const shader = {
      vertex: particleVert,
      fragment: particleFrag,
      glslVersion: ctx.level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
      shared: true,
      cacheId: ['-p:', ctx.renderMode, shaderCacheId].join('+'),
      macros: ctx.macros,
      name: `particle#${ctx.name}`,
    };
    const preMulAlpha = getPreMultiAlpha(ctx.blending);
    const material = Material.create(engine, { shader });

    // 渲染状态
    material.blending = true;
    material.depthTest = true;
    material.depthMask = !!ctx.occlusion;
    setBlendMode(material, ctx.blending);
    setSideMode(material, ctx.side);

    // uniform:漫反射贴图 + 采样偏移 + 颜色参数 + sprite sheet
    // uColorParams = (hasDiffuse, preMulAlpha, _, occlusionEdge)
    material.setTexture('uMaskTex', ctx.diffuse);
    material.setVector2('uTexOffset', new Vector2(
      ctx.diffuse ? 1 / ctx.diffuse.getWidth() : 0,
      ctx.diffuse ? 1 / ctx.diffuse.getHeight() : 0,
    ));
    material.setVector4('uColorParams', new Vector4(
      ctx.diffuse ? 1 : 0,
      +preMulAlpha,
      0,
      +(!!ctx.occlusion && !ctx.transparentOcclusion),
    ));
    material.setVector4('uParams', new Vector4(0, 0, 0, 0));

    if (ctx.spriteUniform) {
      // 顶点 (uSprite) / 片元 (uFSprite) 各取一份独立 Vector4。
      material.setVector4('uSprite', Vector4.fromArray(ctx.spriteUniform));
      material.setVector4('uFSprite', Vector4.fromArray(ctx.spriteUniform));
    }

    material.setVector3('emissionColor', new Vector3(0, 0, 0));
    material.setFloat('emissionIntensity', 0.0);

    return material;
  }

  /** 把每个 attribute / index 的 data 缩成长度 0,保留 attribute 注册表本身。 */
  private resetGeometryData (geometry: Geometry) {
    const names = geometry.getAttributeNames();
    const index = geometry.getIndexData();

    for (const name of names) {
      const data = geometry.getAttributeData(name);

      if (data) {
        // @ts-expect-error Float32Array/Uint16Array 构造器接受 length=0
        geometry.setAttributeData(name, new data.constructor(0));
      }
    }
    // @ts-expect-error 同上
    geometry.setIndexData(new index.constructor(0));
  }
}

/**
 * 生成 SoA 顶点几何的 attribute 布局描述。所有 buffer 初始为空(长度 0),
 * 运行期由 ParticleSpriteRenderer.ensureCapacity 按需扩容。
 *
 * aPos 与 aRot 各自是一块连续 buffer,内部用 stride 切出多组数据,
 * 部分组通过 dataSource 别名暴露给 shader(同一份内存,不同名字/offset)。
 */
function generateGeometryProps (
  maxVertex: number,
  useSprite?: boolean,
  name?: string,
): GeometryProps {
  const bpe = Float32Array.BYTES_PER_ELEMENT;
  const posStride = bpe * FLOATS_PER_POS_VERTEX;
  const rotStride = bpe * FLOATS_PER_ROT_VERTEX;
  const attributes: Record<string, Attribute> = {
    // aPos block: position(3) | velocity(3) | dirX(3) | dirY(3)
    aPos: { size: 3, offset: 0, stride: posStride, data: new Float32Array(0) },
    aDirX: { size: 3, offset: 6 * bpe, stride: posStride, dataSource: 'aPos' },
    aDirY: { size: 3, offset: 9 * bpe, stride: posStride, dataSource: 'aPos' },
    // aRot block: rotation(3) | seed(1) | color(4)
    aRot: { size: 3, offset: 0, stride: rotStride, data: new Float32Array(0) },
    aColor: { size: 4, offset: ROT_COLOR_OFFSET * bpe, stride: rotStride, dataSource: 'aRot' },
    // per-vertex 平铺
    aOffset: { size: 4, stride: 4 * bpe, data: new Float32Array(0) },
    aTranslation: { size: 3, data: new Float32Array(0) },
  };

  if (useSprite) {
    attributes.aSprite = { size: 3, stride: 3 * bpe, data: new Float32Array(0) };
  }

  return { attributes, indices: { data: new Uint16Array(0) }, name, maxVertex };
}
