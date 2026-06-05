import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import { Vector2, Vector4 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';
import type { GradientStop } from '@galacean/effects-specification';
import type { TrailHistory } from './trail-history';
import { RENDER_PREFER_LOOKUP_TEXTURE, getConfig } from '../../config';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { MaterialProps } from '../../material';
import { Material, getPreMultiAlpha, setBlendMode } from '../../material';
import { createKeyFrameMeta, createValueGetter, getKeyFrameMetaByRawValue, ValueGetter } from '../../math';
import type { GPUCapability, GeometryProps, ShaderMacros, ShaderWithSource } from '../../render';
import { GLSLVersion, Geometry, Mesh } from '../../render';
import { particleFrag, trailVert } from '../../shader';
import { Texture, generateHalfFloatTexture } from '../../texture';
import { imageDataFromGradient } from '../../utils';

export type TrailMeshProps = {
  maxTrailCount: number,
  pointCountPerTrail: number,
  colorOverLifetime?: Array<GradientStop>,
  texture?: Texture,
  minimumVertexDistance: number,
  blending: number,
  widthOverTrail: ValueGetter<number>,
  colorOverTrail?: Array<GradientStop>,
  // order: number,
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

export class TrailMesh {
  mesh: Mesh;
  maxTrailCount;
  geometry: Geometry;
  lifetime: ValueGetter<number>;
  pointCountPerTrail: number;
  minimumVertexDistance: number;
  useAttributeTrailStart: boolean;
  checkVertexDistance: boolean;

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

    const { detail, level } = engine.gpuCapability;
    const pointCountPerTrail = Math.max(props.pointCountPerTrail, 2);
    const keyFrameMeta = createKeyFrameMeta();
    const enableVertexTexture = detail.maxVertexTextures > 0;
    const { env } = engine ?? {};
    const uniformValues: any = {};
    // const lookUpTexture = getConfig(RENDER_PREFER_LOOKUP_TEXTURE) ? 1 : 0;
    const lookUpTexture = 0;
    const macros: ShaderMacros = [
      ['ENABLE_VERTEX_TEXTURE', enableVertexTexture],
      ['LOOKUP_TEXTURE_CURVE', lookUpTexture],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const useAttributeTrailStart = maxTrailCount > 64;
    let shaderCacheId = 0;

    if (colorOverLifetime) {
      macros.push(['COLOR_OVER_LIFETIME', true]);
      shaderCacheId |= 1;
      uniformValues.uColorOverLifetime = Texture.createWithData(engine, imageDataFromGradient(colorOverLifetime));
    }
    if (colorOverTrail) {
      macros.push(['COLOR_OVER_TRAIL', true]);
      shaderCacheId |= 1 << 2;
      uniformValues.uColorOverTrail = Texture.createWithData(engine, imageDataFromGradient(colorOverTrail));
    }
    if (useAttributeTrailStart) {
      macros.push(['ATTR_TRAIL_START', 1]);
      shaderCacheId |= 1 << 3;
    } else {
      uniformValues.uTrailStart = new Float32Array(maxTrailCount);
    }

    uniformValues.uOpacityOverLifetimeValue = opacityOverLifetime.toUniform(keyFrameMeta);
    const uWidthOverTrail = widthOverTrail.toUniform(keyFrameMeta);

    macros.push(
      ['VERT_CURVE_VALUE_COUNT', keyFrameMeta.index],
      ['VERT_MAX_KEY_FRAME_COUNT', keyFrameMeta.max]);

    if (enableVertexTexture && lookUpTexture) {
      const tex = generateHalfFloatTexture(engine, ValueGetter.getAllData(keyFrameMeta, true) as Uint16Array, keyFrameMeta.index, 1);

      uniformValues.uVCurveValueTexture = tex;
    } else {
      uniformValues.uVCurveValues = ValueGetter.getAllData(keyFrameMeta);
    }

    const vertex = trailVert;
    const fragment = particleFrag;
    const mtl: MaterialProps = ({
      shader: {
        vertex,
        fragment,
        macros,
        glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
        shared: true,
        name: `trail#${name}`,
        cacheId: `-t:+${shaderCacheId}+${keyFrameMeta.index}+${keyFrameMeta.max}`,
      },
    });

    const maxVertexCount = pointCountPerTrail * maxTrailCount * 2;
    const maxTriangleCount = (pointCountPerTrail - 1) * maxTrailCount;
    const bpe = Float32Array.BYTES_PER_ELEMENT;
    const v12 = 12 * bpe;
    const geometryOptions: GeometryProps = {
      attributes: {
        aColor: { size: 4, stride: v12, data: new Float32Array(maxVertexCount * 12) },
        aSeed: { size: 1, stride: v12, offset: 4 * bpe, dataSource: 'aColor' },
        aInfo: { size: 3, stride: v12, offset: 5 * bpe, dataSource: 'aColor' },
        aPos: { size: 4, stride: v12, offset: 8 * bpe, dataSource: 'aColor' },
        //
        aTime: { size: 1, data: new Float32Array(maxVertexCount) },
        //
        aDir: { size: 3, data: new Float32Array(maxVertexCount * 3) },
      },
      indices: { data: new Uint16Array(maxVertexCount * 6) },
      drawCount: maxTriangleCount * 6,
      name: `trail#${name}`,
      bufferUsage: glContext.DYNAMIC_DRAW,
    };

    if (useAttributeTrailStart) {
      geometryOptions.attributes.aTrailStart = { size: 1, data: new Float32Array(maxVertexCount) };
    } else {
      const indexData = new Float32Array(maxVertexCount);

      geometryOptions.attributes.aTrailStartIndex = { size: 1, data: indexData };
      for (let i = 0; i < maxTrailCount; i++) {
        const c = pointCountPerTrail * 2;
        const s = i * c;

        for (let j = 0; j < c; j++) {
          indexData[s + j] = i;
        }
      }
    }

    const preMulAlpha = getPreMultiAlpha(blending);
    const material = Material.create(engine, mtl);

    material.blending = true;
    material.depthMask = occlusion;
    material.depthTest = true;
    setBlendMode(material, blending);

    const mesh = this.mesh = Mesh.create(
      engine,
      {
        name: `MTrail_${name}`,
        material,
        geometry: Geometry.create(engine, geometryOptions),
        // priority: order,
      }
    );
    const uMaskTex = texture ?? Texture.createWithData(engine);

    Object.keys(uniformValues).map(name => {
      const value = uniformValues[name];

      if (value instanceof Texture) {
        material.setTexture(name, value);
      } else if (name === 'uTrailStart') {
        material.setFloats('uTrailStart', value);
      } else if (name === 'uVCurveValues') {
        const array: Vector4[] = [];

        for (let i = 0; i < value.length; i = i + 4) {
          const v = new Vector4(value[i], value[i + 1], value[i + 2], value[i + 3]);

          array.push(v);
        }
        material.setVector4Array(name, array);
      } else {
        material.setVector4(name, Vector4.fromArray(value));
      }
    });

    material.setFloat('uTime', 0);
    // TODO: 修改下长度
    material.setVector4('uWidthOverTrail', Vector4.fromArray(uWidthOverTrail));
    material.setVector2('uTexOffset', new Vector2(0, 0));
    material.setVector4('uTextureMap', new Vector4(0, 0, 1, 1));
    material.setVector4('uParams', new Vector4(0, pointCountPerTrail - 1, 0, 0));
    material.setTexture('uMaskTex', uMaskTex);
    material.setVector4('uColorParams', new Vector4(texture ? 1 : 0, +preMulAlpha, 0, +(occlusion && !transparentOcclusion)));

    this.maxTrailCount = maxTrailCount;
    this.pointCountPerTrail = pointCountPerTrail;
    this.checkVertexDistance = minimumVertexDistance > 0;
    this.minimumVertexDistance = Math.pow(minimumVertexDistance || 0.001, 2);
    this.useAttributeTrailStart = useAttributeTrailStart;
    this.lifetime = lifetime;
    if (matrix) {
      this.mesh.worldMatrix = matrix;
    }
    this.geometry = mesh.firstGeometry();
  }

  get time () {
    return this.mesh.material.getFloat('uTime') || 0;
  }
  set time (t: number) {
    this.mesh.material.setFloat('uTime', t ?? 0);
  }

  generateTrailGeometry (history: TrailHistory): void {
    const geo = this.geometry;
    const maxPoints = this.pointCountPerTrail;
    const aColor = geo.getAttributeData('aColor') as Float32Array;
    const aDir = geo.getAttributeData('aDir') as Float32Array;
    const aTime = geo.getAttributeData('aTime') as Float32Array;
    const indices = geo.getIndexData() as Uint16Array;
    const useAttrStart = this.useAttributeTrailStart;
    const aTrailStart = useAttrStart ? geo.getAttributeData('aTrailStart') as Float32Array : null;
    const mtl = this.mesh.material;

    let totalSegments = 0;

    for (let ti = 0; ti < this.maxTrailCount; ti++) {
      const count = history.pointCounts[ti];

      if (count < 1) {
        continue;
      }
      const cursor = history.cursors[ti];
      const hBase = ti * maxPoints;
      const vBase = ti * maxPoints;

      for (let p = 0; p < count; p++) {
        const ringIdx = (cursor - count + p + maxPoints * 2) % maxPoints;
        const hIdx = hBase + ringIdx;
        const vi = vBase + p;
        const c24 = vi * 24;

        const px = history.posX[hIdx];
        const py = history.posY[hIdx];
        const pz = history.posZ[hIdx];
        const w = history.widths[hIdx];
        const time = history.times[hIdx];
        const seed = history.seeds[hIdx];

        const r = history.colorR[hIdx];
        const g = history.colorG[hIdx];
        const b = history.colorB[hIdx];
        const a = history.colorA[hIdx];

        // aColor: [color(4), seed(1), info(3), pos(3), width(1)] * 2 vertices
        // info = [seed, lifetime, trailSection]
        const ptLifetime = history.lifetimes[hIdx];

        aColor[c24] = r; aColor[c24 + 1] = g; aColor[c24 + 2] = b; aColor[c24 + 3] = a;
        aColor[c24 + 4] = seed;
        aColor[c24 + 5] = ptLifetime;
        aColor[c24 + 6] = p;
        aColor[c24 + 7] = 0;
        aColor[c24 + 8] = px; aColor[c24 + 9] = py; aColor[c24 + 10] = pz;
        aColor[c24 + 11] = 0.5 * w;

        aColor[c24 + 12] = r; aColor[c24 + 13] = g; aColor[c24 + 14] = b; aColor[c24 + 15] = a;
        aColor[c24 + 16] = seed;
        aColor[c24 + 17] = ptLifetime;
        aColor[c24 + 18] = p;
        aColor[c24 + 19] = 1;
        aColor[c24 + 20] = px; aColor[c24 + 21] = py; aColor[c24 + 22] = pz;
        aColor[c24 + 23] = -0.5 * w;

        // aTime
        aTime[vi * 2] = time;
        aTime[vi * 2 + 1] = time;

        // aDir: replicate old calculateDirection (3-point case uses only forward)
        let dx = 0, dy = 0, dz = 0;
        const hasNext = p < count - 1;
        const hasPrev = p > 0;

        if (hasNext) {
          const nextRing = (cursor - count + p + 1 + maxPoints * 2) % maxPoints;
          const ni = hBase + nextRing;

          dx = history.posX[ni] - px;
          dy = history.posY[ni] - py;
          dz = history.posZ[ni] - pz;
        }
        if (hasPrev) {
          const prevRing = (cursor - count + p - 1 + maxPoints * 2) % maxPoints;
          const pi = hBase + prevRing;
          const pdx = px - history.posX[pi];
          const pdy = py - history.posY[pi];
          const pdz = pz - history.posZ[pi];

          if (dx === 0 && dy === 0 && dz === 0) {
            dx = pdx; dy = pdy; dz = pdz;
          } else {
            dx = (dx + pdx) * 0.5;
            dy = (dy + pdy) * 0.5;
            dz = (dz + pdz) * 0.5;
          }
        }
        const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dLen > 1e-6) {
          dx /= dLen; dy /= dLen; dz /= dLen;
        }
        const d6 = vi * 6;

        aDir[d6] = dx; aDir[d6 + 1] = dy; aDir[d6 + 2] = dz;
        aDir[d6 + 3] = dx; aDir[d6 + 4] = dy; aDir[d6 + 5] = dz;

        // aTrailStart
        if (aTrailStart) {
          aTrailStart[vi * 2] = count - 1;
          aTrailStart[vi * 2 + 1] = count - 1;
        }

        // indices: connect with previous point
        if (p > 0) {
          const prevVi = vBase + p - 1;
          const ii = totalSegments * 6;

          indices[ii] = prevVi * 2;
          indices[ii + 1] = prevVi * 2 + 1;
          indices[ii + 2] = vi * 2;
          indices[ii + 3] = vi * 2;
          indices[ii + 4] = prevVi * 2 + 1;
          indices[ii + 5] = vi * 2 + 1;
          totalSegments++;
        }
      }

      if (!useAttrStart) {
        const uTrailStart = mtl.getFloats('uTrailStart');

        if (uTrailStart) {
          uTrailStart[ti] = count - 1;
          mtl.setFloats('uTrailStart', uTrailStart);
        }
      }
    }

    geo.setAttributeData('aColor', aColor);
    geo.setAttributeData('aDir', aDir);
    geo.setAttributeData('aTime', aTime);
    if (aTrailStart) {
      geo.setAttributeData('aTrailStart', aTrailStart);
    }
    geo.setIndexData(indices);
    geo.setDrawCount(totalSegments * 6);

    const params = mtl.getVector4('uParams');

    if (params) {
      let maxSection = 0;

      for (let ti = 0; ti < this.maxTrailCount; ti++) {
        maxSection = Math.max(maxSection, history.pointCounts[ti] - 1);
      }
      params.y = maxSection;
      mtl.setVector4('uParams', params);
    }
  }

  clearAllTrails (): void {
    this.geometry.setDrawCount(0);
  }

  minusTime (time: number): void {
    this.time -= time;
  }

  onUpdate (escapeTime: number): any {
  }

}

export function getTrailMeshShader (
  trails: spec.ParticleTrail,
  particleMaxCount: number,
  name: string,
  gpuCapability: GPUCapability,
  env = '',
): ShaderWithSource {
  let shaderCacheId = 0;
  const lookUpTexture = getConfig(RENDER_PREFER_LOOKUP_TEXTURE) ? 1 : 0;
  const enableVertexTexture = gpuCapability.detail.maxVertexTextures > 0;
  const macros: ShaderMacros = [
    ['ENABLE_VERTEX_TEXTURE', enableVertexTexture],
    ['LOOKUP_TEXTURE_CURVE', lookUpTexture],
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];
  const keyFrameMeta = createKeyFrameMeta();

  if (trails.colorOverLifetime) {
    macros.push(['COLOR_OVER_LIFETIME', true]);
    shaderCacheId |= 1;
  }
  if (trails.colorOverTrail) {
    macros.push(['COLOR_OVER_TRAIL', true]);
    shaderCacheId |= 1 << 2;
  }

  const useAttributeTrailStart = particleMaxCount > 64;

  if (useAttributeTrailStart) {
    macros.push(['ATTR_TRAIL_START', 1]);
    shaderCacheId |= 1 << 3;
  }
  getKeyFrameMetaByRawValue(keyFrameMeta, trails.opacityOverLifetime);
  getKeyFrameMetaByRawValue(keyFrameMeta, trails.widthOverTrail);
  macros.push(
    ['VERT_CURVE_VALUE_COUNT', keyFrameMeta.index],
    ['VERT_MAX_KEY_FRAME_COUNT', keyFrameMeta.max]);

  return {
    vertex: trailVert,
    fragment: particleFrag,
    macros,
    shared: true,
    name: 'trail#' + name,
    cacheId: `-t:+${shaderCacheId}+${keyFrameMeta.index}+${keyFrameMeta.max}`,
  };
}
