import type * as spec from '@galacean/effects-specification';
import type { vec3, vec4, GradientStop } from '@galacean/effects-specification';
import { Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import { getConfig, RENDER_PREFER_LOOKUP_TEXTURE } from '../../config';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import { glContext } from '../../gl';
import type { MaterialProps } from '../../material';
import {
  createShaderWithMarcos,
  getPreMultiAlpha,
  Material,
  setBlendMode,
  setMaskMode,
  ShaderType,
} from '../../material';
import {
  createKeyFrameMeta,
  createValueGetter,
  CurveValue,
  getKeyFrameMetaByRawValue,
} from '../../math';
import type { GeometryProps, ShaderMarcos, ShaderWithSource, GPUCapability } from '../../render';
import { Geometry, GLSLVersion, Mesh } from '../../render';
import { particleFrag, trailVert } from '../../shader';
import { generateHalfFloatTexture, Texture } from '../../texture';
import { imageDataFromGradient } from '../../utils';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';

export type TrailMeshConstructor = {
  maxTrailCount: number,
  pointCountPerTrail: number,
  colorOverLifetime?: Array<GradientStop>,
  texture: Texture,
  minimumVertexDistance: number,
  blending: number,
  widthOverTrail: ValueGetter<number>,
  colorOverTrail?: Array<GradientStop>,
  order: number,
  matrix?: Matrix4,
  opacityOverLifetime: ValueGetter<number>,
  occlusion: boolean,
  transparentOcclusion: boolean,
  lifetime: ValueGetter<number>,
  mask: number,
  shaderCachePrefix: string,
  maskMode: number,
  textureMap: vec4,
  name: string,
};

type TrailPointOptions = {
  lifetime: number,
  color: number[],
  size: number,
  time: number,
};

const tmp0 = new Vector3();
const tmp1 = new Vector3();

export class TrailMesh {
  mesh: Mesh;
  maxTrailCount;
  geometry: Geometry;
  lifetime: ValueGetter<number>;
  pointCountPerTrail: number;
  minimumVertexDistance: number;
  useAttributeTrailStart: boolean;
  checkVertexDistance: boolean;

  private pointStart: Vector3[] = [];
  private trailCursors: Uint16Array;

  // TODO: engine 挪到第一个参数
  constructor (
    props: TrailMeshConstructor,
    engine: Engine
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
      maskMode,
      order,
      textureMap = [0, 0, 1, 1],
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
    const { env } = engine.renderer ?? {};
    const uniformValues: any = {};
    // const lookUpTexture = getConfig(RENDER_PREFER_LOOKUP_TEXTURE) ? 1 : 0;
    const lookUpTexture = 0;
    const marcos: ShaderMarcos = [
      ['ENABLE_VERTEX_TEXTURE', enableVertexTexture],
      ['LOOKUP_TEXTURE_CURVE', lookUpTexture],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const useAttributeTrailStart = maxTrailCount > 64;
    let shaderCacheId = 0;

    if (colorOverLifetime) {
      marcos.push(['COLOR_OVER_LIFETIME', true]);
      shaderCacheId |= 1;
      uniformValues.uColorOverLifetime = Texture.createWithData(engine, imageDataFromGradient(colorOverLifetime));
    }
    if (colorOverTrail) {
      marcos.push(['COLOR_OVER_TRAIL', true]);
      shaderCacheId |= 1 << 2;
      uniformValues.uColorOverTrail = Texture.createWithData(engine, imageDataFromGradient(colorOverTrail));
    }
    if (useAttributeTrailStart) {
      marcos.push(['ATTR_TRAIL_START', 1]);
      shaderCacheId |= 1 << 3;
    } else {
      uniformValues.uTrailStart = new Float32Array(maxTrailCount);
    }

    uniformValues.uOpacityOverLifetimeValue = opacityOverLifetime.toUniform(keyFrameMeta);
    const uWidthOverTrail = widthOverTrail.toUniform(keyFrameMeta);

    marcos.push(
      ['VERT_CURVE_VALUE_COUNT', keyFrameMeta.index],
      ['VERT_MAX_KEY_FRAME_COUNT', keyFrameMeta.max]);

    if (enableVertexTexture && lookUpTexture) {
      const tex = generateHalfFloatTexture(engine, CurveValue.getAllData(keyFrameMeta, true) as Uint16Array, keyFrameMeta.index, 1);

      uniformValues.uVCurveValueTexture = tex;
    } else {
      uniformValues.uVCurveValues = CurveValue.getAllData(keyFrameMeta);
    }

    const vertex = createShaderWithMarcos(marcos, trailVert, ShaderType.vertex, level);
    const fragment = createShaderWithMarcos(marcos, particleFrag, ShaderType.fragment, level);
    const mtl: MaterialProps = ({
      shader: {
        vertex,
        fragment,
        marcos,
        glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
        shared: true,
        name: `trail#${name}`,
        cacheId: `-t:+${shaderCacheId}+${keyFrameMeta.index}+${keyFrameMeta.max}`,
      },
      uniformSemantics: {
        effects_MatrixVP: 'VIEWPROJECTION',
        effects_MatrixInvV: 'VIEWINVERSE',
        effects_ObjectToWorld: 'MODEL',
        uEditorTransform: 'EDITOR_TRANSFORM',
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
    setMaskMode(material, maskMode);
    setBlendMode(material, blending);

    const mesh = this.mesh = Mesh.create(
      engine,
      {
        name: `MTrail_${name}`,
        material,
        geometry: Geometry.create(engine, geometryOptions),
        priority: order,
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

        array.push(new Vector4(value[0], value[1], value[2], value[3]));
        array.push(new Vector4(value[4], value[5], value[6], value[7]));
        material.setVector4Array(name, array);
      } else {
        material.setVector4(name, Vector4.fromArray(value));
      }
    });

    material.setFloat('uTime', 0);
    // TODO: 修改下长度
    material.setVector4('uWidthOverTrail', Vector4.fromArray(uWidthOverTrail));
    material.setVector2('uTexOffset', new Vector2(0, 0));
    material.setVector4('uTextureMap', Vector4.fromArray(textureMap));
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
    this.trailCursors = new Uint16Array(maxTrailCount);
  }

  get time () {
    return this.mesh.material.getFloat('uTime') || 0;
  }
  set time (t: number) {
    this.mesh.material.setFloat('uTime', t ?? 0);
  }

  addPoint (trailIndex: number, position: Vector3, opt: TrailPointOptions) {
    opt = opt || ({} as TrailPointOptions);
    let cursor = this.trailCursors[trailIndex];
    const pointCountPerTrail = this.pointCountPerTrail;
    const geometry = this.geometry;
    const segmentPerTrail = pointCountPerTrail - 1;
    const pointIndex = cursor % pointCountPerTrail;
    const previousIndex = (cursor - 1) % pointCountPerTrail;
    const bpreviousIndex = (cursor - 2) % pointCountPerTrail;
    const previousPoint = this.getTrailPosition(trailIndex, previousIndex, tmp0);
    // point too close

    if (previousPoint && this.checkVertexDistance && previousPoint?.distanceSquared(position) < this.minimumVertexDistance) {
      return;
    }

    const pointStartIndex = trailIndex * pointCountPerTrail + pointIndex;
    const dir = calculateDirection(previousPoint, position);
    const time = opt.time || this.time;
    const info = [Math.random(), opt.lifetime || this.lifetime, cursor] as vec3;
    const size = opt.size || 1;

    const dirStartIndex = pointStartIndex * 6;
    const dirData = new Float32Array(6);

    dirData.set(dir, 0);
    dirData.set(dir, 3);

    geometry.setAttributeSubData('aDir', dirStartIndex, dirData);
    geometry.setAttributeSubData('aTime', pointStartIndex * 2, new Float32Array([time, time]));

    const color = opt.color || [1, 1, 1, 1];
    const colorData = new Float32Array(24);
    const positionData = position.toArray();

    colorData.set(color, 0);
    colorData.set(info, 4);
    colorData[7] = 0;
    colorData.set(positionData, 8);
    colorData[11] = 0.5 * size;

    colorData.set(color, 12);
    colorData.set(info, 16);
    colorData[19] = 1;
    colorData.set(positionData, 20);
    colorData[23] = -0.5 * size;

    geometry.setAttributeSubData('aColor', pointStartIndex * 24, colorData);

    if (previousIndex >= 0) {
      const bPreviousPoint = this.getTrailPosition(trailIndex, bpreviousIndex, tmp1) as Vector3;
      const previousDir = new Float32Array(calculateDirection(bPreviousPoint, previousPoint as Vector3, position));
      const previousDirStartIndex = (trailIndex * pointCountPerTrail + previousIndex) * 6;

      geometry.setAttributeSubData('aDir', previousDirStartIndex, previousDir);
      geometry.setAttributeSubData('aDir', previousDirStartIndex + 3, previousDir);
      const indicesStart = trailIndex * pointCountPerTrail * 2;
      const indicesData = new Uint16Array([
        previousIndex * 2 + indicesStart,
        previousIndex * 2 + 1 + indicesStart,
        pointIndex * 2 + indicesStart,
        pointIndex * 2 + indicesStart,
        previousIndex * 2 + 1 + indicesStart,
        pointIndex * 2 + 1 + indicesStart,
      ]);
      const start = (trailIndex * segmentPerTrail + (cursor - 1) % segmentPerTrail) * 6;

      geometry.setIndexSubData(start, indicesData);
    }

    cursor = ++this.trailCursors[trailIndex];
    const mtl = this.mesh.material;
    const params = mtl.getVector4('uParams');
    const trailStart = info[2];

    if (this.useAttributeTrailStart) {
      const len = pointCountPerTrail * 2;
      const startData: Float32Array = new Float32Array(len);

      for (let i = 0; i < len; i++) {
        startData[i] = trailStart;
      }
      geometry.setAttributeSubData('aTrailStart', trailIndex * startData.length, startData);
    } else {
      const value = mtl.getFloats('uTrailStart');

      if (value != undefined) {
        value[trailIndex] = trailStart;
        mtl.setFloats('uTrailStart', value);
      }
    }

    if (params) {
      params.y = Math.max(params.y, cursor - 1) - Math.max(0, cursor - pointCountPerTrail);
      mtl.setVector4('uParams', params);
    }
  }

  getTrailPosition (trail: number, index: number, out: Vector3): Vector3 | undefined {
    const pointCountPerTrail = this.pointCountPerTrail;

    if (index >= 0 && index < pointCountPerTrail) {
      const startIndex = (trail * pointCountPerTrail + index) * 24 + 8;
      const data = this.geometry.getAttributeData('aColor')!;

      out.x = data[startIndex];
      out.y = data[1 + startIndex];
      out.z = data[2 + startIndex];

      return out;
    }
  }

  clearAllTrails () {
    const geo = this.geometry;

    this.trailCursors = new Uint16Array(this.trailCursors.length);
    // @ts-expect-error
    geo.setIndexData(new Uint16Array(geo.getIndexData().length));
  }

  minusTime (time: number) {
    // FIXME: 可选性
    const data = this.geometry.getAttributeData('aTime')!;

    for (let i = 0; i < data.length; i++) {
      data[i] -= time;
    }
    this.geometry.setAttributeData('aTime', data);
    this.time -= time;
  }

  clearTrail (index: number) {
    if (this.trailCursors[index] !== 0) {
      const pointCountPerTrail = this.pointCountPerTrail;
      const indicesPerTrail = (pointCountPerTrail - 1) * 6;
      const indices = this.geometry.getIndexData();

      indices?.set(new Uint16Array(indicesPerTrail), index * indicesPerTrail);
      this.geometry.setIndexData(indices);

      this.trailCursors[index] = 0;
    }
  }

  getPointStartPos (index: number) {
    return this.pointStart[index];
  }

  setPointStartPos (index: number, pos: Vector3) {
    this.pointStart[index] = pos;
  }

  onUpdate (escapeTime: number): any {
  }

}

const tempDir = new Vector3();
const tempDa = new Vector3();
const tempDb = new Vector3();

function calculateDirection (prePoint: Vector3 | undefined, point: Vector3, nextPoint?: Vector3): vec3 {
  const dir = tempDir;

  if (!prePoint && !nextPoint) {
    return [0, 0, 0];
  } else if (!prePoint) {
    dir.subtractVectors(nextPoint!, point);
  } else if (!nextPoint) {
    dir.subtractVectors(point, prePoint);
  } else {
    tempDa.subtractVectors(point, prePoint).normalize();
    // FIXME: 这里有bug。。。
    tempDa.subtractVectors(nextPoint, point);
    tempDb.copyFrom(tempDa).normalize();
    dir.addVectors(tempDa, tempDb);
  }

  return dir.normalize().toArray();
}

export function getTrailMeshShader (trails: spec.ParticleTrail, particleMaxCount: number, name: string, env = '', gpuCapability: GPUCapability): ShaderWithSource {
  let shaderCacheId = 0;
  const lookUpTexture = getConfig(RENDER_PREFER_LOOKUP_TEXTURE) ? 1 : 0;
  const enableVertexTexture = gpuCapability.detail.maxVertexTextures > 0;
  const marcos: ShaderMarcos = [
    ['ENABLE_VERTEX_TEXTURE', enableVertexTexture],
    ['LOOKUP_TEXTURE_CURVE', lookUpTexture],
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];
  const keyFrameMeta = createKeyFrameMeta();

  if (trails.colorOverLifetime) {
    marcos.push(['COLOR_OVER_LIFETIME', true]);
    shaderCacheId |= 1;
  }
  if (trails.colorOverTrail) {
    marcos.push(['COLOR_OVER_TRAIL', true]);
    shaderCacheId |= 1 << 2;
  }

  const useAttributeTrailStart = particleMaxCount > 64;

  if (useAttributeTrailStart) {
    marcos.push(['ATTR_TRAIL_START', 1]);
    shaderCacheId |= 1 << 3;
  }
  getKeyFrameMetaByRawValue(keyFrameMeta, trails.opacityOverLifetime);
  getKeyFrameMetaByRawValue(keyFrameMeta, trails.widthOverTrail);
  marcos.push(
    ['VERT_CURVE_VALUE_COUNT', keyFrameMeta.index],
    ['VERT_MAX_KEY_FRAME_COUNT', keyFrameMeta.max]);

  return {
    vertex: trailVert,
    fragment: particleFrag,
    marcos,
    shared: true,
    name: 'trail#' + name,
    cacheId: `-t:+${shaderCacheId}+${keyFrameMeta.index}+${keyFrameMeta.max}`,
  };
}
