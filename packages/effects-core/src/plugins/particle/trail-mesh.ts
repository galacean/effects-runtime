import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import { Vector2, Vector4 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';
import type { GradientStop } from '@galacean/effects-specification';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { MaterialProps } from '../../material';
import { Material, getPreMultiAlpha, setBlendMode } from '../../material';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import type { GeometryProps, ShaderMacros, ShaderWithSource, GPUCapability } from '../../render';
import { GLSLVersion, Geometry, Mesh } from '../../render';
import { particleFrag, trailVert } from '../../shader';
import { Texture } from '../../texture';
import { colorStopsFromGradient, interpolateColor } from '../../utils/color';

export type TrailMeshProps = {
  maxTrailCount: number,
  pointCountPerTrail: number,
  colorOverLifetime?: Array<GradientStop>,
  texture?: Texture,
  minimumVertexDistance: number,
  blending: number,
  widthOverTrail: ValueGetter<number>,
  colorOverTrail?: Array<GradientStop>,
  matrix?: Matrix4,
  opacityOverLifetime: ValueGetter<number>,
  occlusion: boolean,
  transparentOcclusion: boolean,
  lifetime: ValueGetter<number>,
  mask: number,
  shaderCachePrefix: string,
  maskMode: number,
  name: string,
};

export type TrailPointOptions = {
  lifetime: number,
  color: number[],
  size: number,
  time: number,
};

export const MAX_UNIFORM_TRAIL_COUNT = 64;

const FLOATS_PER_VERTEX = 3 + 2 + 4; // aPos(3) + aUV(2) + aColor(4)
const STRIDE_BYTES = FLOATS_PER_VERTEX * 4;

type ColorStop = { stop: number, color: number[] };

function buildColorStops (gradient: GradientStop[]): ColorStop[] {
  const raw = colorStopsFromGradient(gradient);

  return raw.map(s => ({ stop: s.time, color: s.color.toArray() }));
}

function sampleGradient (stops: ColorStop[], t: number): [number, number, number, number] {
  if (stops.length === 0) {
    return [255, 255, 255, 255];
  }
  if (t <= stops[0].stop) {
    const c = stops[0].color;

    return [c[0], c[1], c[2], c[3]];
  }
  if (t >= stops[stops.length - 1].stop) {
    const c = stops[stops.length - 1].color;

    return [c[0], c[1], c[2], c[3]];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].stop && t < stops[i + 1].stop) {
      const frac = (t - stops[i].stop) / (stops[i + 1].stop - stops[i].stop);
      const c = interpolateColor(stops[i].color, stops[i + 1].color, frac);

      return [c[0], c[1], c[2], c[3]];
    }
  }
  const c = stops[stops.length - 1].color;

  return [c[0], c[1], c[2], c[3]];
}

export class TrailMesh {
  mesh: Mesh;
  maxTrailCount: number;
  geometry: Geometry;
  lifetime: ValueGetter<number>;
  pointCountPerTrail: number;
  minimumVertexDistance: number;
  checkVertexDistance: boolean;

  private widthOverTrail: ValueGetter<number>;
  private opacityOverLifetime: ValueGetter<number>;
  private colorOverLifetimeStops: ColorStop[] | null;
  private colorOverTrailStops: ColorStop[] | null;
  private textureMap: [number, number, number, number] = [0, 0, 1, 1];

  constructor (
    engine: Engine,
    props: TrailMeshProps,
  ) {
    const {
      colorOverLifetime,
      colorOverTrail,
      maxTrailCount,
      opacityOverLifetime = createValueGetter(1),
      widthOverTrail,
      name,
      occlusion,
      blending,
      texture,
      transparentOcclusion,
      minimumVertexDistance,
      lifetime,
      matrix,
    } = props;

    const { env } = engine ?? {};
    const { level } = engine.gpuCapability;
    const pointCountPerTrail = Math.max(props.pointCountPerTrail, 2);

    const macros: ShaderMacros = [
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];

    const mtl: MaterialProps = ({
      shader: {
        vertex: trailVert,
        fragment: particleFrag,
        macros,
        glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
        shared: true,
        name: `trail#${name}`,
        cacheId: '-t:ribbon',
      },
    });

    const maxVertexCount = pointCountPerTrail * maxTrailCount * 2;
    const maxTriangleCount = (pointCountPerTrail - 1) * maxTrailCount;
    const geometryOptions: GeometryProps = {
      attributes: {
        aPos: { size: 3, offset: 0, stride: STRIDE_BYTES, data: new Float32Array(maxVertexCount * FLOATS_PER_VERTEX) },
        aUV: { size: 2, offset: 3 * 4, stride: STRIDE_BYTES, dataSource: 'aPos' },
        aColor: { size: 4, offset: 5 * 4, stride: STRIDE_BYTES, dataSource: 'aPos' },
      },
      indices: { data: new Uint16Array(maxTriangleCount * 6) },
      drawCount: 0,
      name: `trail#${name}`,
      bufferUsage: glContext.DYNAMIC_DRAW,
    };

    const preMulAlpha = getPreMultiAlpha(blending);
    const material = Material.create(engine, mtl);

    material.blending = true;
    material.depthMask = occlusion;
    material.depthTest = true;
    setBlendMode(material, blending);

    const mesh = this.mesh = Mesh.create(engine, {
      name: `MTrail_${name}`,
      material,
      geometry: Geometry.create(engine, geometryOptions),
    });
    const uMaskTex = texture ?? Texture.createWithData(engine);

    material.setTexture('uMaskTex', uMaskTex);
    material.setVector2('uTexOffset', new Vector2(0, 0));
    material.setVector4('uTextureMap', new Vector4(0, 0, 1, 1));
    material.setVector4('uColorParams', new Vector4(texture ? 1 : 0, +preMulAlpha, 0, +(occlusion && !transparentOcclusion)));

    this.maxTrailCount = maxTrailCount;
    this.pointCountPerTrail = pointCountPerTrail;
    this.checkVertexDistance = minimumVertexDistance > 0;
    this.minimumVertexDistance = Math.pow(minimumVertexDistance || 0.001, 2);
    this.lifetime = lifetime;
    this.widthOverTrail = widthOverTrail;
    this.opacityOverLifetime = opacityOverLifetime;
    this.colorOverLifetimeStops = colorOverLifetime ? buildColorStops(colorOverLifetime) : null;
    this.colorOverTrailStops = colorOverTrail ? buildColorStops(colorOverTrail) : null;

    if (matrix) {
      this.mesh.worldMatrix = matrix;
    }
    this.geometry = mesh.firstGeometry();
  }

  clearAllTrails (): void {
    this.geometry.setDrawCount(0);
  }

  generateRibbonFromSorted (
    sortedInput: number[],
    db: ParticleDataBuffer,
    currentTime: number,
    viewDirX: number, viewDirY: number, viewDirZ: number,
  ): void {
    const geo = this.geometry;
    const maxPoints = this.pointCountPerTrail * this.maxTrailCount;
    const sorted = sortedInput.length > maxPoints ? sortedInput.slice(0, maxPoints) : sortedInput;
    const verts = geo.getAttributeData('aPos') as Float32Array;
    const indices = geo.getIndexData() as Uint16Array;

    let totalSegments = 0;

    indices.fill(0);

    const ribbonSizes: number[] = [];
    let curRibbonSize = 0;

    for (let i = 0; i < sorted.length; i++) {
      curRibbonSize++;
      if (i === sorted.length - 1 || db.ribbonId[sorted[i + 1]] !== db.ribbonId[sorted[i]]) {
        ribbonSizes.push(curRibbonSize);
        curRibbonSize = 0;
      }
    }

    let ribbonStart = 0;
    let curRibbonIdx = 0;

    for (let i = 0; i < sorted.length; i++) {
      const idx = sorted[i];
      const isRibbonEnd = i === sorted.length - 1 || db.ribbonId[sorted[i + 1]] !== db.ribbonId[idx];
      const isRibbonStart = i === 0 || db.ribbonId[sorted[i - 1]] !== db.ribbonId[idx];

      if (isRibbonStart) {
        ribbonStart = i;
      }

      const p = i - ribbonStart;
      const ribbonSize = ribbonSizes[curRibbonIdx];
      const trail = ribbonSize > 1 ? 1 - p / (ribbonSize - 1) : 0;

      const i3 = idx * 3;
      const i4 = idx * 4;
      const px = db.position[i3];
      const py = db.position[i3 + 1];
      const pz = db.position[i3 + 2];
      const baseWidth = db.size[idx * 2];
      const ptLifetime = db.lifetime[idx];

      // time = normalized age for opacity/color over lifetime
      const sourceBirthTime = db.linearMove[idx * 3];
      const time = ptLifetime > 0 ? Math.min((currentTime - sourceBirthTime) / ptLifetime, 1) : 0;

      // width = baseWidth * widthOverTrail(trail)
      const widthScale = this.widthOverTrail.getValue(trail);
      const halfW = baseWidth * widthScale * 0.5;

      // color = baseColor * colorOverLifetime(time) * colorOverTrail(trail)
      let cr = db.color[i4];
      let cg = db.color[i4 + 1];
      let cb = db.color[i4 + 2];
      let ca = db.color[i4 + 3];

      ca *= Math.max(0, Math.min(1, this.opacityOverLifetime.getValue(time)));

      if (this.colorOverLifetimeStops) {
        const c = sampleGradient(this.colorOverLifetimeStops, time);

        cr *= c[0] / 255;
        cg *= c[1] / 255;
        cb *= c[2] / 255;
        ca *= c[3] / 255;
      }
      if (this.colorOverTrailStops) {
        const c = sampleGradient(this.colorOverTrailStops, trail);

        cr *= c[0] / 255;
        cg *= c[1] / 255;
        cb *= c[2] / 255;
        ca *= c[3] / 255;
      }

      // tangent direction (average of forward and backward)
      let tx = 0, ty = 0, tz = 0;

      if (!isRibbonEnd) {
        const ni3 = sorted[i + 1] * 3;

        tx = db.position[ni3] - px;
        ty = db.position[ni3 + 1] - py;
        tz = db.position[ni3 + 2] - pz;
      }
      if (!isRibbonStart) {
        const pi3 = sorted[i - 1] * 3;
        const pdx = px - db.position[pi3];
        const pdy = py - db.position[pi3 + 1];
        const pdz = pz - db.position[pi3 + 2];

        if (tx === 0 && ty === 0 && tz === 0) {
          tx = pdx; ty = pdy; tz = pdz;
        } else {
          tx = (tx + pdx) * 0.5;
          ty = (ty + pdy) * 0.5;
          tz = (tz + pdz) * 0.5;
        }
      }
      const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);

      if (tLen > 1e-6) {
        tx /= tLen; ty /= tLen; tz /= tLen;
      }

      // normal = cross(tangent, viewDir) — camera facing
      let nx = ty * viewDirZ - tz * viewDirY;
      let ny = tz * viewDirX - tx * viewDirZ;
      let nz = tx * viewDirY - ty * viewDirX;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

      if (nLen > 1e-6) {
        nx /= nLen; ny /= nLen; nz /= nLen;
      } else {
        nx = 0; ny = 1; nz = 0;
      }

      // UV
      const u = trail;
      const tm = this.textureMap;
      const uvLeft0 = tm[0] + u * tm[2];
      const uvLeft1 = tm[1];
      const uvRight0 = tm[0] + u * tm[2];
      const uvRight1 = tm[1] + tm[3];

      // write left + right vertices
      let off = i * 2 * FLOATS_PER_VERTEX;

      verts[off] = px - nx * halfW;
      verts[off + 1] = py - ny * halfW;
      verts[off + 2] = pz - nz * halfW;
      verts[off + 3] = uvLeft0;
      verts[off + 4] = uvLeft1;
      verts[off + 5] = cr;
      verts[off + 6] = cg;
      verts[off + 7] = cb;
      verts[off + 8] = ca;

      off += FLOATS_PER_VERTEX;
      verts[off] = px + nx * halfW;
      verts[off + 1] = py + ny * halfW;
      verts[off + 2] = pz + nz * halfW;
      verts[off + 3] = uvRight0;
      verts[off + 4] = uvRight1;
      verts[off + 5] = cr;
      verts[off + 6] = cg;
      verts[off + 7] = cb;
      verts[off + 8] = ca;

      // indices: connect with previous point in same ribbon
      if (!isRibbonStart) {
        const v0 = (i - 1) * 2;
        const v1 = i * 2;
        const ii = totalSegments * 6;

        indices[ii] = v0;
        indices[ii + 1] = v0 + 1;
        indices[ii + 2] = v1;
        indices[ii + 3] = v1;
        indices[ii + 4] = v0 + 1;
        indices[ii + 5] = v1 + 1;
        totalSegments++;
      }

      if (isRibbonEnd) {
        curRibbonIdx++;
      }
    }

    geo.setAttributeData('aPos', verts);
    geo.setIndexData(indices);
    geo.setDrawCount(totalSegments * 6);
  }

}

export function getTrailMeshShader (
  _trails: spec.ParticleTrail,
  _particleMaxCount: number,
  name: string,
  _gpuCapability: GPUCapability,
  env = '',
): ShaderWithSource {
  const macros: ShaderMacros = [
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];

  return {
    vertex: trailVert,
    fragment: particleFrag,
    macros,
    shared: true,
    name: 'trail#' + name,
    cacheId: '-t:ribbon',
  };
}
