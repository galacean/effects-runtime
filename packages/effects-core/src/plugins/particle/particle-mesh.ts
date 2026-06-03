import type * as spec from '@galacean/effects-specification';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Engine } from '../../engine';
import { getConfig, RENDER_PREFER_LOOKUP_TEXTURE } from '../../config';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { MaterialProps } from '../../material';
import {
  getPreMultiAlpha, Material, setBlendMode, setSideMode,
} from '../../material';
import {
  createKeyFrameMeta, createValueGetter, ValueGetter, getKeyFrameMetaByRawValue,
} from '../../math';
import type {
  Attribute, GPUCapability, GeometryProps, ShaderMacros, SharedShaderWithSource,
} from '../../render';
import { GLSLVersion, Geometry, Mesh } from '../../render';
import { particleFrag, particleVert } from '../../shader';
import { Texture, generateHalfFloatTexture } from '../../texture';
import { assertExist, enlargeBuffer, imageDataFromGradient } from '../../utils';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { particleUniformTypeMap } from './particle-vfx-item';

export interface ParticleMeshData {
  gravityModifier: ValueGetter<number>,
  sizeOverLifetime?: {
    x: ValueGetter<number>,
    y?: ValueGetter<number>,
    separateAxes?: boolean,
  },
  colorOverLifetime?: {
    color?: number[][] | Texture,
    opacity?: ValueGetter<number>,
    separateAxes?: boolean,
  },
}

export interface ParticleMeshProps extends ParticleMeshData {
  renderMode?: number,
  blending?: number,
  mask: number,
  maskMode: number,
  side: number,
  transparentOcclusion?: boolean,
  matrix?: Matrix4,
  sprite?: {
    animate?: boolean,
    blend?: boolean,
    col: number,
    row: number,
    total: number,
  },
  gravity?: spec.vec3,
  useSprite?: boolean,
  textureFlip?: boolean,
  occlusion?: boolean,
  diffuse?: Texture,
  // listIndex: number,
  // duration: number,
  maxCount: number,
  shaderCachePrefix: string,
  name: string,
  anchor: Vector2,
}
export class ParticleMesh implements ParticleMeshData {
  duration: number;
  geometry: Geometry;
  mesh: Mesh;
  particleCount = 0;
  maxParticleBufferCount: number;
  gravityModifier: ValueGetter<number>;
  sizeOverLifetime?: { x: ValueGetter<number>, y?: ValueGetter<number>, separateAxes?: boolean };
  time: number;
  maxCount: number;

  readonly useSprite?: boolean;
  readonly textureOffsets: number[];
  readonly anchor: Vector2;

  VERT_MAX_KEY_FRAME_COUNT = 0;

  constructor (
    engine: Engine,
    props: ParticleMeshProps,
  ) {
    const { env } = engine ?? {};
    const {
      colorOverLifetime, sizeOverLifetime,
      sprite, gravityModifier, maxCount, textureFlip, useSprite, name,
      gravity, side, occlusion, anchor, blending,
      transparentOcclusion,
      renderMode = 0,
      diffuse = Texture.createWithData(engine),
    } = props;
    const { detail } = engine.gpuCapability;
    const { halfFloatTexture, maxVertexUniforms } = detail;
    const macros: ShaderMacros = [
      // spec.RenderMode
      ['RENDER_MODE', +renderMode],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const { level } = engine.gpuCapability;
    const vertexKeyFrameMeta = createKeyFrameMeta();
    const fragmentKeyFrameMeta = createKeyFrameMeta();
    const enableVertexTexture = maxVertexUniforms > 0;
    const uniformValues: Record<string, any> = {};
    let vertex_lookup_texture = 0;
    let shaderCacheId = 0;

    this.useSprite = useSprite;
    if (enableVertexTexture) {
      macros.push(['ENABLE_VERTEX_TEXTURE', true]);
    }
    if (sprite?.animate) {
      macros.push(['USE_SPRITE', true]);
      shaderCacheId |= 1 << 2;
      uniformValues.uFSprite = uniformValues.uSprite = new Float32Array([sprite.col, sprite.row, sprite.total, sprite.blend ? 1 : 0]);
      this.useSprite = true;
    }
    if (colorOverLifetime?.color) {
      macros.push(['COLOR_OVER_LIFETIME', true]);
      shaderCacheId |= 1 << 4;
      uniformValues.uColorOverLifetime = colorOverLifetime.color instanceof Texture ? colorOverLifetime.color : Texture.createWithData(engine, imageDataFromGradient(colorOverLifetime.color));
    }
    if (colorOverLifetime?.opacity) {
      uniformValues.uOpacityOverLifetimeValue = colorOverLifetime.opacity.toUniform(vertexKeyFrameMeta);
    } else {
      uniformValues.uOpacityOverLifetimeValue = createValueGetter(1).toUniform(vertexKeyFrameMeta);
    }

    uniformValues.uSizeByLifetimeValue = sizeOverLifetime?.x.toUniform(vertexKeyFrameMeta);
    if (sizeOverLifetime?.separateAxes) {
      macros.push(['SIZE_Y_BY_LIFE', 1]);
      shaderCacheId |= 1 << 14;
      uniformValues.uSizeYByLifetimeValue = sizeOverLifetime?.y?.toUniform(vertexKeyFrameMeta);
    }

    if (halfFloatTexture && fragmentKeyFrameMeta.max) {
      shaderCacheId |= 1 << 20;
      uniformValues.uFCurveValueTexture = generateHalfFloatTexture(engine, ValueGetter.getAllData(fragmentKeyFrameMeta, true) as Uint16Array, fragmentKeyFrameMeta.index, 1);
    } else {
      uniformValues.uFCurveValues = ValueGetter.getAllData(fragmentKeyFrameMeta);
    }
    const vertexCurveTexture = vertexKeyFrameMeta.max + vertexKeyFrameMeta.curves.length - 32 > maxVertexUniforms;

    if (vertexCurveTexture && halfFloatTexture && enableVertexTexture) {
      const tex = generateHalfFloatTexture(engine, ValueGetter.getAllData(vertexKeyFrameMeta, true) as Uint16Array, vertexKeyFrameMeta.index, 1);

      uniformValues.uVCurveValueTexture = tex;
      vertex_lookup_texture = 1;
    } else {
      uniformValues.uVCurveValues = ValueGetter.getAllData(vertexKeyFrameMeta);
    }
    const shaderCache = ['-p:', renderMode, shaderCacheId, vertexKeyFrameMeta.index, vertexKeyFrameMeta.max, fragmentKeyFrameMeta.index, fragmentKeyFrameMeta.max].join('+');

    macros.push(
      ['VERT_CURVE_VALUE_COUNT', vertexKeyFrameMeta.index],
      ['FRAG_CURVE_VALUE_COUNT', fragmentKeyFrameMeta.index],
      ['VERT_MAX_KEY_FRAME_COUNT', vertexKeyFrameMeta.max],
      ['FRAG_MAX_KEY_FRAME_COUNT', fragmentKeyFrameMeta.max],
    );
    this.VERT_MAX_KEY_FRAME_COUNT = vertexKeyFrameMeta.max;

    const fragment = particleFrag;
    const originalVertex = `#define LOOKUP_TEXTURE_CURVE ${vertex_lookup_texture}\n${particleVert}`;
    const vertex = originalVertex;

    const shader = {
      fragment,
      vertex,
      glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
      shared: true,
      cacheId: shaderCache,
      macros,
      name: `particle#${name}`,
    };
    const mtlOptions: MaterialProps = {
      shader,
    };
    const preMulAlpha = getPreMultiAlpha(blending);

    uniformValues.uTexOffset = new Float32Array(diffuse ? [1 / diffuse.getWidth(), 1 / diffuse.getHeight()] : [0, 0]);
    uniformValues.uMaskTex = diffuse;
    uniformValues.uColorParams = new Float32Array([diffuse ? 1 : 0, +preMulAlpha, 0, +(!!occlusion && !transparentOcclusion)]);
    uniformValues.uParams = [0, 0, 0, 0];
    uniformValues.uAcceleration = [gravity?.[0] || 0, gravity?.[1] || 0, gravity?.[2] || 0, 0];
    // mtlOptions.uniformValues = uniformValues;

    const material = Material.create(engine, mtlOptions);

    material.blending = true;
    material.depthTest = true;
    material.depthMask = !!occlusion;
    setBlendMode(material, blending);
    setSideMode(material, side);

    Object.keys(uniformValues).map(name => {
      const value = uniformValues[name];

      if (value instanceof Texture) {
        material.setTexture(name, value);

        return;
      }
      const res: Vector4[] = [];

      switch (particleUniformTypeMap[name]) {
        case 'vec4':
          material.setVector4(name, Vector4.fromArray(value));

          break;
        case 'vec3':
          material.setVector3(name, Vector3.fromArray(value));

          break;
        case 'vec2':
          material.setVector2(name, Vector2.fromArray(value));

          break;
        case 'vec4Array':

          for (let i = 0; i < value.length; i = i + 4) {
            const v = new Vector4(value[i], value[i + 1], value[i + 2], value[i + 3]);

            res.push(v);
          }
          material.setVector4Array(name, res);
          res.length = 0;

          break;
        default:
          console.warn(`Uniform ${name}'s type not in typeMap.`);
      }
    });

    material.setVector3('emissionColor', new Vector3(0, 0, 0));
    material.setFloat('emissionIntensity', 0.0);

    const geometry = Geometry.create(engine, generateGeometryProps(maxCount * 4, this.useSprite, `particle#${name}`));
    const mesh = Mesh.create(engine, {
      name: `MParticle_${name}`,
      // priority: listIndex,
      material,
      geometry,
    });

    this.anchor = anchor;
    this.mesh = mesh;
    this.geometry = mesh.firstGeometry();
    this.sizeOverLifetime = sizeOverLifetime;
    this.gravityModifier = gravityModifier;
    this.maxCount = maxCount;
    // this.duration = duration;
    this.textureOffsets = textureFlip ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
    this.time = 0;
  }
  // get time () {
  //   // const value = this.mesh.material.getVector4('uParams')!;

  //   // return value.x;
  //   return this._time;
  // }
  // set time (value: number) {
  //   this._time = value;
  //   // this.mesh.material.setVector4('uParams', new Vector4(+v, this.duration, 0, 0));
  // }

  getPointColor (index: number) {
    const data = this.geometry.getAttributeData('aRot');
    const i = index * 32 + 4;

    assertExist(data);

    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  clearPoints () {
    this.resetGeometryData(this.geometry);
    this.particleCount = 0;
    this.geometry.setDrawCount(0);
    this.maxParticleBufferCount = 0;
  }

  resetGeometryData (geometry: Geometry) {
    const names = geometry.getAttributeNames();
    const index = geometry.getIndexData();

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const data = geometry.getAttributeData(name);

      if (data) {
        // @ts-expect-error
        geometry.setAttributeData(name, new data.constructor(0));
      }
    }
    // @ts-expect-error
    geometry.setIndexData(new index.constructor(0));
  }

  minusTime (time: number) {
    const aOffset = this.geometry.getAttributeData('aOffset') as Float32Array;

    for (let i = 0; i < aOffset.length; i += 4) {
      aOffset[i + 2] -= time;
    }
    this.geometry.setAttributeData('aOffset', aOffset);
    this.time -= time;
  }

  removePoint (index: number) {
    if (index < this.particleCount) {
      this.geometry.setAttributeSubData('aOffset', index * 16, new Float32Array(16));
    }
  }

  setPointFromBuffer (index: number, db: ParticleDataBuffer) {
    const maxCount = this.maxCount;

    if (index < maxCount) {
      const particleCount = index + 1;
      const vertexCount = particleCount * 4;
      const geometry = this.geometry;
      const increaseBuffer = particleCount > this.maxParticleBufferCount;
      let inc = 2;

      if (this.particleCount > 300) {
        inc = (this.particleCount + 100) / this.particleCount;
      } else if (this.particleCount > 100) {
        inc = 1.4;
      }
      const pointData: Record<string, Float32Array> = {
        aPos: new Float32Array(48),
        aRot: new Float32Array(32),
        aOffset: new Float32Array(16),
        aTranslation: new Float32Array(12),
        aRotation0: new Float32Array(36),
      };
      const useSprite = this.useSprite;

      if (useSprite) {
        pointData.aSprite = new Float32Array(12);
      }

      const i3 = index * 3;
      const i4 = index * 4;
      const i2 = index * 2;
      const position = [db.position[i3], db.position[i3 + 1], db.position[i3 + 2]];
      const rotation = [db.rotation[i3], db.rotation[i3 + 1], db.rotation[i3 + 2]];
      const scaleX = db.size[i2];
      const scaleY = db.size[i2 + 1];

      const offsets = this.textureOffsets;
      const off = [0, 0, db.delay[index], db.lifetime[index]];
      const wholeUV = [0, 0, 1, 1];
      const seed = db.seed[index];
      const sizeOffsets = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

      for (let j = 0; j < 4; j++) {
        const offset = j * 2;
        const j3 = j * 3;
        const j4 = j * 4;
        const j12 = j * 12;
        const j8 = j * 8;

        pointData.aPos.set(position, j12);
        pointData.aPos[j12 + 3] = db.velocity[i3];
        pointData.aPos[j12 + 4] = db.velocity[i3 + 1];
        pointData.aPos[j12 + 5] = db.velocity[i3 + 2];
        pointData.aRot.set(rotation, j8);
        pointData.aRot[j8 + 3] = seed;
        pointData.aRot[j8 + 4] = db.color[i4];
        pointData.aRot[j8 + 5] = db.color[i4 + 1];
        pointData.aRot[j8 + 6] = db.color[i4 + 2];
        pointData.aRot[j8 + 7] = db.color[i4 + 3];

        if (useSprite) {
          pointData.aSprite[j3] = db.sprite[i3];
          pointData.aSprite[j3 + 1] = db.sprite[i3 + 1];
          pointData.aSprite[j3 + 2] = db.sprite[i3 + 2];
        }
        const uv = db.uv[i4] !== 0 || db.uv[i4 + 1] !== 0 || db.uv[i4 + 2] !== 0 || db.uv[i4 + 3] !== 0
          ? [db.uv[i4], db.uv[i4 + 1], db.uv[i4 + 2], db.uv[i4 + 3]]
          : wholeUV;

        if (uv) {
          const uvy = useSprite ? (1 - offsets[offset + 1]) : offsets[offset + 1];

          off[0] = uv[0] + offsets[offset] * uv[2];
          off[1] = uv[1] + uvy * uv[3];
        }
        pointData.aOffset.set(off, j4);
        const ji = (j + j);
        const sx = (sizeOffsets[ji] - this.anchor.x) * scaleX;
        const sy = (sizeOffsets[ji + 1] - this.anchor.y) * scaleY;

        for (let k = 0; k < 3; k++) {
          pointData.aPos[j12 + 6 + k] = db.dirX[i3 + k] * sx;
          pointData.aPos[j12 + 9 + k] = db.dirY[i3 + k] * sy;
        }
      }
      const indexData = new Uint16Array([0, 1, 2, 2, 1, 3].map(x => x + index * 4));

      if (increaseBuffer) {
        const baseIndexData = geometry.getIndexData() as Uint16Array;
        const idx = enlargeBuffer(baseIndexData, particleCount * 6, maxCount * 6, inc);

        idx.set(indexData, index * 6);
        geometry.setIndexData(idx);
        this.maxParticleBufferCount = idx.length / 6;
      } else {
        geometry.setIndexSubData(index * 6, indexData);
      }

      Object.keys(pointData).forEach(name => {
        const data = pointData[name];
        const attrSize = geometry.getAttributeStride(name) / Float32Array.BYTES_PER_ELEMENT;

        if (increaseBuffer) {
          const baseData = geometry.getAttributeData(name);

          assertExist(baseData);

          const geoData = enlargeBuffer(baseData, vertexCount * attrSize, maxCount * 4 * attrSize, inc);

          geoData.set(data, data.length * index);
          geometry.setAttributeData(name, geoData);
        } else {
          geometry.setAttributeSubData(name, data.length * index, data);
        }
      });
      this.particleCount = Math.max(particleCount, this.particleCount);
      geometry.setDrawCount(this.particleCount * 6);
    }
  }
}

function generateGeometryProps (
  maxVertex: number,
  useSprite?: boolean,
  name?: string,
): GeometryProps {
  const bpe = Float32Array.BYTES_PER_ELEMENT;
  const j12 = bpe * 12;
  const attributes: Record<string, Attribute> = {
    aPos: { size: 3, offset: 0, stride: j12, data: new Float32Array(0) },
    aVel: { size: 3, offset: 3 * bpe, stride: j12, dataSource: 'aPos' },
    aDirX: { size: 3, offset: 6 * bpe, stride: j12, dataSource: 'aPos' },
    aDirY: { size: 3, offset: 9 * bpe, stride: j12, dataSource: 'aPos' },
    //
    aRot: { size: 3, offset: 0, stride: 8 * bpe, data: new Float32Array(0) },
    aSeed: { size: 1, offset: 3 * bpe, stride: 8 * bpe, dataSource: 'aRot' },
    aColor: { size: 4, offset: 4 * bpe, stride: 8 * bpe, dataSource: 'aRot' },
    //
    aOffset: { size: 4, stride: 4 * bpe, data: new Float32Array(0) },
    aTranslation: { size: 3, data: new Float32Array(0) },
    aRotation0: { size: 3, offset: 0, stride: 9 * bpe, data: new Float32Array(0) },
    aRotation1: { size: 3, offset: 3 * bpe, stride: 9 * bpe, dataSource: 'aRotation0' },
    aRotation2: { size: 3, offset: 6 * bpe, stride: 9 * bpe, dataSource: 'aRotation0' },
  };

  if (useSprite) {
    attributes['aSprite'] = { size: 3, stride: 3 * bpe, data: new Float32Array(0) };
  }

  return { attributes, indices: { data: new Uint16Array(0) }, name, maxVertex };
}

export function getParticleMeshShader (
  item: spec.ParticleItem,
  gpuCapability: GPUCapability,
  env = '',
) {
  const props = item.content;
  const renderMode = +(props.renderer?.renderMode || 0);
  const macros: ShaderMacros = [
    ['RENDER_MODE', renderMode],
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];
  const { detail } = gpuCapability;
  const vertexKeyFrameMeta = createKeyFrameMeta();
  const fragmentKeyFrameMeta = createKeyFrameMeta();
  const enableVertexTexture = detail.maxVertexUniforms > 0;
  const { speedOverLifetime } = props.positionOverLifetime ?? {};
  let vertex_lookup_texture = 0;
  let shaderCacheId = 0;

  if (enableVertexTexture) {
    macros.push(['ENABLE_VERTEX_TEXTURE', true]);
  }

  if (speedOverLifetime) {
    macros.push(['SPEED_OVER_LIFETIME', true]);
    shaderCacheId |= 1 << 1;
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, speedOverLifetime);
  }
  const sprite = props.textureSheetAnimation;

  if (sprite && sprite.animate) {
    macros.push(['USE_SPRITE', true]);
    shaderCacheId |= 1 << 2;
  }

  const colorOverLifetime = props.colorOverLifetime;

  if (colorOverLifetime && colorOverLifetime.color) {
    macros.push(['COLOR_OVER_LIFETIME', true]);
    shaderCacheId |= 1 << 4;
  }

  const opacity = colorOverLifetime && colorOverLifetime.opacity;

  if (opacity) {
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, opacity);
  }
  const positionOverLifetime = props.positionOverLifetime;
  let useOrbitalVel;

  ['x', 'y', 'z'].forEach((pro, i) => {
    let defL = 0;
    const linearPro = 'linear' + pro.toUpperCase();
    const orbitalPro = 'orbital' + pro.toUpperCase();

    if (positionOverLifetime?.[linearPro as keyof spec.ParticlePositionOverLifetime]) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime[linearPro as keyof spec.ParticlePositionOverLifetime] as spec.NumberExpression);
      defL = 1;
      shaderCacheId |= 1 << (7 + i);
    }
    macros.push([`LINEAR_VEL_${pro.toUpperCase()}`, defL]);
    let defO = 0;

    if (positionOverLifetime?.[orbitalPro as keyof spec.ParticlePositionOverLifetime]) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime[orbitalPro as keyof spec.ParticlePositionOverLifetime] as spec.NumberExpression);
      defO = 1;
      shaderCacheId |= 1 << (10 + i);
      useOrbitalVel = true;
    }
    macros.push([`ORB_VEL_${pro.toUpperCase()}`, defO]);
  });
  if (positionOverLifetime?.asMovement) {
    macros.push(['AS_LINEAR_MOVEMENT', true]);
    shaderCacheId |= 1 << 5;
  }
  if (useOrbitalVel) {
    if (positionOverLifetime?.asRotation) {
      macros.push(['AS_ORBITAL_MOVEMENT', true]);
      shaderCacheId |= 1 << 6;
    }
  }

  if (props.sizeOverLifetime) {
    const sizeOverLifetime = props.sizeOverLifetime;
    const separateAxes = sizeOverLifetime.separateAxes;

    if (separateAxes) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, sizeOverLifetime.x);
      macros.push(['SIZE_Y_BY_LIFE', 1]);
      shaderCacheId |= 1 << 14;
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, sizeOverLifetime.y);
    } else {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, sizeOverLifetime.size);
    }
  }

  if (props.rotationOverLifetime) {
    const rot = props.rotationOverLifetime;

    if (rot.z) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot?.z);
      shaderCacheId |= 1 << 15;
      macros.push(['ROT_Z_LIFETIME', 1]);
    }
    if (rot.separateAxes) {
      if (rot.x) {
        getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot.x);
        shaderCacheId |= 1 << 16;
        macros.push(['ROT_X_LIFETIME', 1]);
      }
      if (rot.y) {
        getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot.y);
        shaderCacheId |= 1 << 17;
        macros.push(['ROT_Y_LIFETIME', 1]);
      }
    }
    if (rot?.asRotation) {
      macros.push(['ROT_LIFETIME_AS_MOVEMENT', 1]);
      shaderCacheId |= 1 << 18;
    }
  }

  getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime?.gravityOverLifetime);
  const forceOpt = positionOverLifetime?.forceTarget;

  if (forceOpt) {
    macros.push(['FINAL_TARGET', true]);
    shaderCacheId |= 1 << 19;
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime.forceCurve);
  }
  const HALF_FLOAT = detail.halfFloatTexture;

  if (HALF_FLOAT && fragmentKeyFrameMeta.max) {
    shaderCacheId |= 1 << 20;
  }
  const maxVertexUniforms = detail.maxVertexUniforms;
  let vertexCurveTexture = vertexKeyFrameMeta.max + vertexKeyFrameMeta.curves.length - 32 > maxVertexUniforms;

  if (getConfig(RENDER_PREFER_LOOKUP_TEXTURE)) {
    vertexCurveTexture = true;
  }

  if (vertexCurveTexture && HALF_FLOAT && enableVertexTexture) {
    vertex_lookup_texture = 1;
  }
  const shaderCache = ['-p:', renderMode, shaderCacheId, vertexKeyFrameMeta.index, vertexKeyFrameMeta.max, fragmentKeyFrameMeta.index, fragmentKeyFrameMeta.max].join('+');
  const shader: SharedShaderWithSource = {
    fragment: particleFrag,
    vertex: `#define LOOKUP_TEXTURE_CURVE ${vertex_lookup_texture}\n${particleVert}`,
    shared: true,
    cacheId: shaderCache,
    macros,
    name: `particle#${item.name}`,
  };

  macros.push(
    ['VERT_CURVE_VALUE_COUNT', vertexKeyFrameMeta.index],
    ['FRAG_CURVE_VALUE_COUNT', fragmentKeyFrameMeta.index],
    ['VERT_MAX_KEY_FRAME_COUNT', vertexKeyFrameMeta.max],
    ['FRAG_MAX_KEY_FRAME_COUNT', fragmentKeyFrameMeta.max],
  );

  return { shader, vertex: vertexKeyFrameMeta.index, fragment: fragmentKeyFrameMeta.index };
}

export function modifyMaxKeyframeShader (shader: SharedShaderWithSource, maxVertex: number, maxFrag: number) {
  const shaderIds = shader.cacheId?.split('+') as Array<string | number>;

  shaderIds[3] = maxVertex;
  shaderIds[5] = maxFrag;
  shader.cacheId = shaderIds.join('+');

  if (!shader.macros) {
    return;
  }

  for (let i = 0; i < shader.macros.length; i++) {
    const marco = shader.macros[i];

    if (marco[0] === 'VERT_CURVE_VALUE_COUNT') {
      marco[1] = maxVertex;
    } else if (marco[0] === 'FRAG_CURVE_VALUE_COUNT') {
      marco[1] = maxFrag;

      break;
    }
  }
}
