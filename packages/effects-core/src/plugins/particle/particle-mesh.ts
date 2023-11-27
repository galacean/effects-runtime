import type * as spec from '@galacean/effects-specification';
import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import { Euler, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Composition } from '../../composition';
import { getConfig, RENDER_PREFER_LOOKUP_TEXTURE } from '../../config';
import { FILTER_NAME_NONE, PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { FilterShaderDefine, ParticleFilterDefine } from '../../filter';
import { createFilter, createFilterShaders } from '../../filter';
import type { MaterialProps } from '../../material';
import {
  createShaderWithMarcos,
  getPreMultiAlpha,
  Material,
  setBlendMode,
  setMaskMode,
  setSideMode,
  ShaderType,
} from '../../material';
import type { ValueGetter } from '../../math';
import {
  createKeyFrameMeta,
  createValueGetter,
  CurveValue,
  getKeyFrameMetaByRawValue,
  calculateTranslation,
} from '../../math';
import type { Attribute, GeometryProps, ShaderMarcos, SharedShaderWithSource, GPUCapability } from '../../render';
import { Geometry, GLSLVersion, Mesh } from '../../render';
import { particleFrag, particleVert } from '../../shader';
import { generateHalfFloatTexture, Texture } from '../../texture';
import { Transform } from '../../transform';
import { enlargeBuffer, imageDataFromGradient } from '../../utils';

export type Point = {
  vel: Vector3,
  lifetime: number,
  color: spec.vec4,
  uv: number[],
  dirX: Vector3,
  dirY: Vector3,
  delay: number,
  sprite?: [start: number, duration: number, cycles: number],
  transform: Transform,
  gravity: spec.vec3,
  size: Vector2,
};

export interface ParticleMeshData {
  gravityModifier: ValueGetter<number>,
  sizeOverLifetime?: {
    x: ValueGetter<number>,
    y?: ValueGetter<number>,
    separateAxes?: boolean,
  },
  meshSlots?: number[],
  forceTarget?: {
    curve: ValueGetter<number>,
    target: spec.vec3,
  },
  colorOverLifetime?: {
    color?: number[][] | Texture,
    opacity?: ValueGetter<number>,
    separateAxes?: boolean,
  },
  linearVelOverLifetime?: {
    asMovement?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
    enabled?: boolean,
  } & Record<string, any>,
  orbitalVelOverLifetime?: {
    asRotation?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
    enabled?: boolean,
    center?: spec.vec3,
  } & Record<string, any>,
  rotationOverLifetime?: {
    asRotation?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  },
  speedOverLifetime?: ValueGetter<number>,
}

export interface ParticleMeshProps extends ParticleMeshData {
  renderMode?: number,
  blending?: number,
  mask: number,
  maskMode: number,
  side: number,
  filter?: spec.FilterParams,
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
  forceTarget?: {
    curve: ValueGetter<number>,
    target: spec.vec3,
  },
  listIndex: number,
  duration: number,
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
  forceTarget?: { curve: ValueGetter<number>, target: spec.vec3 };
  colorOverLifetime?: { color?: number[][], opacity?: ValueGetter<number>, separateAxes?: boolean };
  linearVelOverLifetime?: { asMovement?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean };
  orbitalVelOverLifetime?: { asRotation?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean, center?: spec.vec3 };
  rotationOverLifetime?: { asRotation?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number> };
  speedOverLifetime?: ValueGetter<number>;

  readonly useSprite?: boolean;
  readonly textureOffsets: number[];
  readonly maxCount: number;
  readonly anchor: Vector2;

  constructor (
    props: ParticleMeshProps,
    rendererOptions: { composition: Composition },
  ) {
    const engine = rendererOptions.composition.getEngine();
    const { env } = engine.renderer ?? {};
    const {
      speedOverLifetime, colorOverLifetime, linearVelOverLifetime, orbitalVelOverLifetime, sizeOverLifetime, rotationOverLifetime,
      sprite, gravityModifier, maxCount, duration, textureFlip, useSprite, name,
      filter, gravity, forceTarget, side, occlusion, anchor, blending,
      maskMode, mask, transparentOcclusion, listIndex, meshSlots,
      renderMode = 0,
      diffuse = Texture.createWithData(engine),
    } = props;
    const { detail } = engine.gpuCapability;
    const { halfFloatTexture, maxVertexUniforms } = detail;
    const marcos: ShaderMarcos = [
      ['RENDER_MODE', +renderMode],
      ['PRE_MULTIPLY_ALPHA', false],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const { level } = engine.gpuCapability;
    const vertexKeyFrameMeta = createKeyFrameMeta();
    const fragmentKeyFrameMeta = createKeyFrameMeta();
    const enableVertexTexture = maxVertexUniforms > 0;
    const uniformValues: Record<string, any> = {};
    let vertex_lookup_texture = 0;
    let shaderCacheId = 0;
    let particleDefine: ParticleFilterDefine;
    let useOrbitalVel;

    this.useSprite = useSprite;
    if (enableVertexTexture) {
      marcos.push(['ENABLE_VERTEX_TEXTURE', true]);
    }
    if (speedOverLifetime) {
      marcos.push(['SPEED_OVER_LIFETIME', true]);
      shaderCacheId |= 1 << 1;
      uniformValues.uSpeedLifetimeValue = speedOverLifetime.toUniform(vertexKeyFrameMeta);
    }
    if (sprite?.animate) {
      marcos.push(['USE_SPRITE', true]);
      shaderCacheId |= 1 << 2;
      uniformValues.uFSprite = uniformValues.uSprite = new Float32Array([sprite.col, sprite.row, sprite.total, sprite.blend ? 1 : 0]);
      this.useSprite = true;
    }
    if (filter && filter.name !== FILTER_NAME_NONE) {
      marcos.push(['USE_FILTER', true]);
      shaderCacheId |= 1 << 3;
      const filterDefine = createFilter(filter, rendererOptions.composition);

      if (!filterDefine.particle) {
        throw new Error(`particle filter ${filter.name} not implement`);
      }
      particleDefine = filterDefine.particle;
      Object.keys(particleDefine.uniforms ?? {}).forEach(uName => {
        const getter = particleDefine.uniforms?.[uName];

        if (uniformValues[uName]) {
          throw new Error('conflict uniform name:' + uName);
        }
        uniformValues[uName] = getter?.toUniform(vertexKeyFrameMeta);
      });
      Object.keys(particleDefine.uniformValues ?? {}).forEach(uName => {
        const val = particleDefine.uniformValues?.[uName];

        if (uniformValues[uName]) {
          throw new Error('conflict uniform name:' + uName);
        }
        uniformValues[uName] = val;
      });
    }
    if (colorOverLifetime?.color) {
      marcos.push(['COLOR_OVER_LIFETIME', true]);
      shaderCacheId |= 1 << 4;
      uniformValues.uColorOverLifetime = colorOverLifetime.color instanceof Texture ? colorOverLifetime.color : Texture.createWithData(engine, imageDataFromGradient(colorOverLifetime.color));
    }
    if (colorOverLifetime?.opacity) {
      uniformValues.uOpacityOverLifetimeValue = colorOverLifetime.opacity.toUniform(vertexKeyFrameMeta);
    } else {
      uniformValues.uOpacityOverLifetimeValue = createValueGetter(1).toUniform(vertexKeyFrameMeta);
    }

    ['x', 'y', 'z'].forEach((pro, i) => {
      let defL = 0;
      let defO = 0;

      if (linearVelOverLifetime?.[pro]) {
        uniformValues[`uLinear${pro.toUpperCase()}ByLifetimeValue`] = linearVelOverLifetime[pro].toUniform(vertexKeyFrameMeta);
        defL = 1;
        shaderCacheId |= 1 << (7 + i);
        linearVelOverLifetime.enabled = true;
      }
      marcos.push([`LINEAR_VEL_${pro.toUpperCase()}`, defL]);
      if (orbitalVelOverLifetime?.[pro]) {
        uniformValues[`uOrb${pro.toUpperCase()}ByLifetimeValue`] = orbitalVelOverLifetime[pro].toUniform(vertexKeyFrameMeta);
        defO = 1;
        shaderCacheId |= 1 << (10 + i);
        useOrbitalVel = true;
        orbitalVelOverLifetime.enabled = true;
      }
      marcos.push([`ORB_VEL_${pro.toUpperCase()}`, defO]);
    });
    if (linearVelOverLifetime?.asMovement) {
      marcos.push(['AS_LINEAR_MOVEMENT', true]);
      shaderCacheId |= 1 << 5;
    }

    if (useOrbitalVel) {
      if (orbitalVelOverLifetime?.asRotation) {
        marcos.push(['AS_ORBITAL_MOVEMENT', true]);
        shaderCacheId |= 1 << 6;
      }
      uniformValues.uOrbCenter = new Float32Array(orbitalVelOverLifetime?.center || [0, 0, 0]);
    }
    uniformValues.uSizeByLifetimeValue = sizeOverLifetime?.x.toUniform(vertexKeyFrameMeta);
    if (sizeOverLifetime?.separateAxes) {
      marcos.push(['SIZE_Y_BY_LIFE', 1]);
      shaderCacheId |= 1 << 14;
      uniformValues.uSizeYByLifetimeValue = sizeOverLifetime?.y?.toUniform(vertexKeyFrameMeta);
    }
    if (rotationOverLifetime?.z) {
      uniformValues.uRZByLifeTimeValue = rotationOverLifetime.z.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 15;
      marcos.push(['ROT_Z_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.x) {
      uniformValues.uRXByLifeTimeValue = rotationOverLifetime.x.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 16;
      marcos.push(['ROT_X_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.y) {
      uniformValues.uRYByLifeTimeValue = rotationOverLifetime.y.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 17;
      marcos.push(['ROT_Y_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.asRotation) {
      marcos.push(['ROT_LIFETIME_AS_MOVEMENT', 1]);
      shaderCacheId |= 1 << 18;
    }
    uniformValues.uGravityModifierValue = gravityModifier.toUniform(vertexKeyFrameMeta);

    if (forceTarget) {
      marcos.push(['FINAL_TARGET', true]);
      shaderCacheId |= 1 << 19;
      uniformValues.uFinalTarget = new Float32Array(forceTarget.target || [0, 0, 0]);
      uniformValues.uForceCurve = forceTarget.curve.toUniform(vertexKeyFrameMeta);
    }

    if (halfFloatTexture && fragmentKeyFrameMeta.max) {
      shaderCacheId |= 1 << 20;
      uniformValues.uFCurveValueTexture = generateHalfFloatTexture(engine, CurveValue.getAllData(fragmentKeyFrameMeta, true) as Uint16Array, fragmentKeyFrameMeta.index, 1);
    } else {
      uniformValues.uFCurveValues = CurveValue.getAllData(fragmentKeyFrameMeta);
    }
    const vertexCurveTexture = vertexKeyFrameMeta.max + vertexKeyFrameMeta.curves.length - 32 > maxVertexUniforms;

    // if (getConfig(RENDER_PREFER_LOOKUP_TEXTURE)) {
    //   vertexCurveTexture = true;
    // }
    if (level === 2) {
      vertexKeyFrameMeta.max = -1;
      vertexKeyFrameMeta.index = meshSlots ? meshSlots[0] : getSlot(vertexKeyFrameMeta.index);
      if (fragmentKeyFrameMeta.index > 0) {
        fragmentKeyFrameMeta.max = -1;
        fragmentKeyFrameMeta.index = meshSlots ? meshSlots[1] : getSlot(fragmentKeyFrameMeta.index);
      }
    }
    if (vertexCurveTexture && halfFloatTexture && enableVertexTexture) {
      const tex = generateHalfFloatTexture(engine, CurveValue.getAllData(vertexKeyFrameMeta, true) as Uint16Array, vertexKeyFrameMeta.index, 1);

      uniformValues.uVCurveValueTexture = tex;
      vertex_lookup_texture = 1;
    } else {
      uniformValues.uVCurveValues = CurveValue.getAllData(vertexKeyFrameMeta);
    }
    const shaderCache = ['-p:', renderMode, shaderCacheId, vertexKeyFrameMeta.index, vertexKeyFrameMeta.max, fragmentKeyFrameMeta.index, fragmentKeyFrameMeta.max].join('+');

    marcos.push(
      ['VERT_CURVE_VALUE_COUNT', vertexKeyFrameMeta.index],
      ['FRAG_CURVE_VALUE_COUNT', fragmentKeyFrameMeta.index],
      ['VERT_MAX_KEY_FRAME_COUNT', vertexKeyFrameMeta.max],
      ['FRAG_MAX_KEY_FRAME_COUNT', fragmentKeyFrameMeta.max],
    );

    const fragment = filter ? particleFrag.replace(/#pragma\s+FILTER_FRAG/, particleDefine!.fragment) : particleFrag;
    const originalVertex = `#define LOOKUP_TEXTURE_CURVE ${vertex_lookup_texture}\n${particleVert}`;
    const vertex = filter ? originalVertex.replace(/#pragma\s+FILTER_VERT/, particleDefine!.vertex || 'void filterMain(float t){}\n') : originalVertex;

    const shader = {
      fragment: createShaderWithMarcos(marcos, fragment, ShaderType.fragment, level),
      vertex: createShaderWithMarcos(marcos, vertex, ShaderType.vertex, level),
      glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
      shared: true,
      cacheId: shaderCache,
      marcos,
      name: `particle#${name}`,
    };

    if (filter) {
      shader.cacheId += filter.name;
    }

    const mtlOptions: MaterialProps = {
      shader,
      uniformSemantics: {
        effects_MatrixV: 'VIEW',
        effects_MatrixVP: 'VIEWPROJECTION',
        uEditorTransform: 'EDITOR_TRANSFORM',
        effects_ObjectToWorld: 'MODEL',
      },
    };
    const preMulAlpha = getPreMultiAlpha(blending);

    uniformValues.uTexOffset = new Float32Array(diffuse ? [1 / diffuse.getWidth(), 1 / diffuse.getHeight()] : [0, 0]);
    uniformValues.uMaskTex = diffuse;
    uniformValues.uColorParams = new Float32Array([diffuse ? 1 : 0, +preMulAlpha, 0, +(!!occlusion && !transparentOcclusion)]);
    uniformValues.uParams = [0, duration, 0, 0];
    uniformValues.uAcceleration = [gravity?.[0] || 0, gravity?.[1] || 0, gravity?.[2] || 0, 0];
    // mtlOptions.uniformValues = uniformValues;

    const material = Material.create(engine, mtlOptions);

    material.blending = true;
    material.depthTest = true;
    material.depthMask = !!(occlusion);
    material.stencilRef = mask ? [mask, mask] : undefined;
    setMaskMode(material, maskMode);
    setBlendMode(material, blending);
    setSideMode(material, side);

    const typeMap: Record<string, string> = {
      'uSprite': 'vec4',
      'uParams': 'vec4',
      'uAcceleration': 'vec4',
      'uGravityModifierValue': 'vec4',
      'uOpacityOverLifetimeValue': 'vec4',
      'uRXByLifeTimeValue': 'vec4',
      'uRYByLifeTimeValue': 'vec4',
      'uRZByLifeTimeValue': 'vec4',
      'uLinearXByLifetimeValue': 'vec4',
      'uLinearYByLifetimeValue': 'vec4',
      'uLinearZByLifetimeValue': 'vec4',
      'uSpeedLifetimeValue': 'vec4',
      'uOrbXByLifetimeValue': 'vec4',
      'uOrbYByLifetimeValue': 'vec4',
      'uOrbZByLifetimeValue': 'vec4',
      'uSizeByLifetimeValue': 'vec4',
      'uSizeYByLifetimeValue': 'vec4',
      'uColorParams': 'vec4',
      'uFSprite': 'vec4',
      'uPreviewColor': 'vec4',
      'uVCurveValues': 'vec4Array',
      'uFCurveValues': 'vec4',
      'uFinalTarget': 'vec3',
      'uForceCurve': 'vec4',
      'uOrbCenter': 'vec3',
      'uTexOffset': 'vec2',
      'uPeriodValue': 'vec4',
      'uMovementValue': 'vec4',
      'uStrengthValue': 'vec4',
      'uWaveParams': 'vec4',
    };

    Object.keys(uniformValues).map(name => {
      const value = uniformValues[name];

      if (value instanceof Texture) {
        material.setTexture(name, value);

        return;
      }
      const res: Vector4[] = [];

      switch (typeMap[name]) {
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
          console.warn(`uniform ${name}'s type not in typeMap`);
      }
    });
    material.setVector3('emissionColor', new Vector3(0, 0, 0));
    material.setFloat('emissionIntensity', 0.0);

    const geometry = Geometry.create(engine, generateGeometryProps(maxCount * 4, this.useSprite, `particle#${name}`));
    const mesh = Mesh.create(engine, {
      name: `MParticle_${name}`,
      priority: listIndex,
      material,
      geometry,
    });

    this.anchor = anchor;
    this.mesh = mesh;
    this.geometry = mesh.firstGeometry();
    this.forceTarget = forceTarget;
    this.sizeOverLifetime = sizeOverLifetime;
    this.speedOverLifetime = speedOverLifetime;
    this.linearVelOverLifetime = linearVelOverLifetime;
    this.orbitalVelOverLifetime = orbitalVelOverLifetime;
    this.orbitalVelOverLifetime = orbitalVelOverLifetime;
    this.gravityModifier = gravityModifier;
    this.maxCount = maxCount;
    this.duration = duration;
    this.textureOffsets = textureFlip ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
  }

  get time () {
    const value = this.mesh.material.getVector4('uParams')!;

    return value.x;
  }
  set time (v: number) {
    this.mesh.material.setVector4('uParams', new Vector4(+v, this.duration, 0, 0));
  }

  getPointColor (index: number) {
    const data = this.geometry.getAttributeData('aRot')!;
    const i = index * 32 + 4;

    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  /**
   * 待废弃
   * @deprecated - 使用 `particle-system.getPointPosition` 替代
   */
  getPointPosition (index: number): Vector3 {
    const geo = this.geometry;
    const posIndex = index * 48;
    const posData = geo.getAttributeData('aPos') as Float32Array;
    const offsetData = geo.getAttributeData('aOffset') as Float32Array;
    const time = this.time - offsetData[index * 16 + 2];
    const pointDur = offsetData[index * 16 + 3];
    const mtl = this.mesh.material;
    const acc = mtl.getVector4('uAcceleration')!.toVector3();
    const pos = Vector3.fromArray(posData, posIndex);
    const vel = Vector3.fromArray(posData, posIndex + 3);
    const ret = calculateTranslation(new Vector3(), this, acc, time, pointDur, pos, vel);

    if (this.forceTarget) {
      const target = mtl.getVector3('uFinalTarget')!;
      const life = this.forceTarget.curve.getValue(time / pointDur);
      const dl = 1 - life;

      ret.x = ret.x * dl + target.x * life;
      ret.y = ret.y * dl + target.y * life;
      ret.z = ret.z * dl + target.z * life;
    }

    return ret;
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
    const data = this.geometry.getAttributeData('aOffset')!;

    for (let i = 0; i < data.length; i += 4) {
      data[i + 2] -= time;
    }
    this.geometry.setAttributeData('aOffset', data);
    this.time -= time;
  }

  removePoint (index: number) {
    if (index < this.particleCount) {
      this.geometry.setAttributeSubData('aOffset', index * 16, new Float32Array(16));
    }
  }

  setPoint (point: Point, index: number) {
    const maxCount = this.maxCount;

    if (index < maxCount) {
      const particleCount = index + 1;
      const vertexCount = particleCount * 4;
      const geometry = this.geometry;
      const increaseBuffer = particleCount > this.maxParticleBufferCount;
      let inc = 1;

      if (this.particleCount > 300) {
        inc = (this.particleCount + 100) / this.particleCount;
      } else if (this.particleCount > 100) {
        inc = 1.4;
      } else if (this.particleCount > 0) {
        inc = 2;
      }
      const pointData: Record<string, Float32Array> = {
        aPos: new Float32Array(48),
        aRot: new Float32Array(32),
        aOffset: new Float32Array(16),
      };
      const useSprite = this.useSprite;

      if (useSprite) {
        pointData.aSprite = new Float32Array(12);
      }

      const tempPos = new Vector3();
      const tempQuat = new Quaternion();
      const scale = new Vector3(1, 1, 1);

      point.transform.assignWorldTRS(tempPos, tempQuat, scale);
      const tempEuler = Transform.getRotation(tempQuat, new Euler());

      const position = tempPos.toArray();
      const rotation = tempEuler.toArray();

      const offsets = this.textureOffsets;
      const off = [0, 0, point.delay, point.lifetime];
      const wholeUV = [0, 0, 1, 1];
      const vel = point.vel;
      const color: number[] = point.color;
      const sizeOffsets = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
      const seed = Math.random();
      let sprite;

      if (useSprite) {
        sprite = point.sprite;
      }

      for (let j = 0; j < 4; j++) {
        const offset = j * 2;
        const j3 = j * 3;
        const j4 = j * 4;
        const j12 = j * 12;
        const j8 = j * 8;

        pointData.aPos.set(position, j12);
        vel.fill(pointData.aPos, j12 + 3);
        pointData.aRot.set(rotation, j8);
        pointData.aRot[j8 + 3] = seed;
        pointData.aRot.set(color, j8 + 4);

        if (useSprite) {
          // @ts-expect-error
          pointData.aSprite.set(sprite, j3);
        }
        const uv = point.uv || wholeUV;

        if (uv) {
          const uvy = useSprite ? (1 - offsets[offset + 1]) : offsets[offset + 1];

          off[0] = uv[0] + offsets[offset] * uv[2];
          off[1] = uv[1] + uvy * uv[3];
        }
        pointData.aOffset.set(off, j4);
        const ji = (j + j);
        const sx = (sizeOffsets[ji] - this.anchor.x) * scale.x;
        const sy = (sizeOffsets[ji + 1] - this.anchor.y) * scale.y;

        for (let k = 0; k < 3; k++) {
          pointData.aPos[j12 + 6 + k] = point.dirX.getElement(k) * sx;
          pointData.aPos[j12 + 9 + k] = point.dirY.getElement(k) * sy;
        }
      }
      const indexData = new Uint16Array([0, 1, 2, 2, 1, 3].map(x => x + index * 4));

      if (increaseBuffer) {
        const baseIndexData = geometry.getIndexData() as Uint16Array;
        const idx = enlargeBuffer(baseIndexData, particleCount * 6, inc, maxCount * 6);

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
          const baseData = geometry.getAttributeData(name)!;
          const geoData = enlargeBuffer(baseData, vertexCount * attrSize, inc, maxCount * 4 * attrSize);

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

const gl2UniformSlots = [10, 32, 64, 160];

function getSlot (count: number): number {
  for (let w = 0; w < gl2UniformSlots.length; w++) {
    const slot = gl2UniformSlots[w];

    if (slot > count) {
      return slot;
    }
  }

  return count || gl2UniformSlots[0];
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
  };

  if (useSprite) {
    attributes['aSprite'] = { size: 3, data: new Float32Array(0) };
  }

  return { attributes, indices: { data: new Uint16Array(0) }, name, maxVertex };
}

export function getParticleMeshShader (item: spec.ParticleItem, env = '', gpuCapability: GPUCapability) {
  const props = item.content;
  const renderMode = +(props.renderer?.renderMode || 0);
  const marcos: [key: string, value: boolean | number][] = [
    ['RENDER_MODE', renderMode],
    ['PRE_MULTIPLY_ALPHA', false],
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
  ];
  const { level, detail } = gpuCapability;
  const vertexKeyFrameMeta = createKeyFrameMeta();
  const fragmentKeyFrameMeta = createKeyFrameMeta();
  const enableVertexTexture = detail.maxVertexUniforms > 0;
  const { speedOverLifetime } = props.positionOverLifetime ?? {};
  let vertex_lookup_texture = 0;
  let shaderCacheId = 0;

  if (enableVertexTexture) {
    marcos.push(['ENABLE_VERTEX_TEXTURE', true]);
  }

  if (speedOverLifetime) {
    marcos.push(['SPEED_OVER_LIFETIME', true]);
    shaderCacheId |= 1 << 1;
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, speedOverLifetime);
  }
  const sprite = props.textureSheetAnimation;

  if (sprite && sprite.animate) {
    marcos.push(['USE_SPRITE', true]);
    shaderCacheId |= 1 << 2;
  }
  let filter: FilterShaderDefine | undefined = undefined;

  if (props.filter && (props.filter as any).name !== FILTER_NAME_NONE) {
    marcos.push(['USE_FILTER', true]);
    shaderCacheId |= 1 << 3;
    const f = createFilterShaders(props.filter).find(f => f.isParticle);

    if (!f) {
      throw Error(`particle filter ${props.filter.name} not implement`);
    }
    filter = f;
    f.uniforms?.forEach(val => getKeyFrameMetaByRawValue(vertexKeyFrameMeta, val));

    // filter = processFilter(props.filter, fragmentKeyFrameMeta, vertexKeyFrameMeta, options);
  }
  const colorOverLifetime = props.colorOverLifetime;

  if (colorOverLifetime && colorOverLifetime.color) {
    marcos.push(['COLOR_OVER_LIFETIME', true]);
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
    marcos.push([`LINEAR_VEL_${pro.toUpperCase()}`, defL]);
    let defO = 0;

    if (positionOverLifetime?.[orbitalPro as keyof spec.ParticlePositionOverLifetime]) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime[orbitalPro as keyof spec.ParticlePositionOverLifetime] as spec.NumberExpression);
      defO = 1;
      shaderCacheId |= 1 << (10 + i);
      useOrbitalVel = true;
    }
    marcos.push([`ORB_VEL_${pro.toUpperCase()}`, defO]);
  });
  if (positionOverLifetime?.asMovement) {
    marcos.push(['AS_LINEAR_MOVEMENT', true]);
    shaderCacheId |= 1 << 5;
  }
  if (useOrbitalVel) {
    if (positionOverLifetime?.asRotation) {
      marcos.push(['AS_ORBITAL_MOVEMENT', true]);
      shaderCacheId |= 1 << 6;
    }
  }

  const sizeOverLifetime = props.sizeOverLifetime;

  getKeyFrameMetaByRawValue(vertexKeyFrameMeta, sizeOverLifetime?.x);
  if (sizeOverLifetime?.separateAxes) {
    marcos.push(['SIZE_Y_BY_LIFE', 1]);
    shaderCacheId |= 1 << 14;
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, sizeOverLifetime?.y);
  }

  const rot = props.rotationOverLifetime;

  if (rot?.z) {
    getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot?.z);
    shaderCacheId |= 1 << 15;
    marcos.push(['ROT_Z_LIFETIME', 1]);
  }
  if (rot?.separateAxes) {
    if (rot.x) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot.x);
      shaderCacheId |= 1 << 16;
      marcos.push(['ROT_X_LIFETIME', 1]);
    }
    if (rot.y) {
      getKeyFrameMetaByRawValue(vertexKeyFrameMeta, rot.y);
      shaderCacheId |= 1 << 17;
      marcos.push(['ROT_Y_LIFETIME', 1]);
    }
  }

  if (rot?.asRotation) {
    marcos.push(['ROT_LIFETIME_AS_MOVEMENT', 1]);
    shaderCacheId |= 1 << 18;
  }

  getKeyFrameMetaByRawValue(vertexKeyFrameMeta, positionOverLifetime?.gravityOverLifetime);
  const forceOpt = positionOverLifetime?.forceTarget;

  if (forceOpt) {
    marcos.push(['FINAL_TARGET', true]);
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
  if (level === 2) {
    vertexKeyFrameMeta.max = -1;
    // vertexKeyFrameMeta.index = getSlot(vertexKeyFrameMeta.index);
    if (fragmentKeyFrameMeta.index > 0) {
      fragmentKeyFrameMeta.max = -1;
      // fragmentKeyFrameMeta.index = getSlot(fragmentKeyFrameMeta.index);
    }
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
    marcos,
    name: `particle#${item.name}`,
  };

  if (filter) {
    shader.fragment = shader.fragment.replace(/#pragma\s+FILTER_FRAG/, filter.fragment ?? '');
    shader.vertex = shader.vertex.replace(/#pragma\s+FILTER_VERT/, filter.vertex || 'void filterMain(float t){}\n');
    shader.cacheId += '+' + props.filter?.name;
  }
  marcos.push(
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

  if (!shader.marcos) {
    return;
  }

  for (let i = 0; i < shader.marcos.length; i++) {
    const marco = shader.marcos[i];

    if (marco[0] === 'VERT_CURVE_VALUE_COUNT') {
      marco[1] = maxVertex;
    } else if (marco[0] === 'FRAG_CURVE_VALUE_COUNT') {
      marco[1] = maxFrag;

      break;
    }
  }
}
