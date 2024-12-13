import type * as spec from '@galacean/effects-specification';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { clamp } from '@galacean/effects-math/es/core/utils';
import type { Engine } from '../../engine';
import { getConfig, RENDER_PREFER_LOOKUP_TEXTURE } from '../../config';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { MaterialProps } from '../../material';
import {
  getPreMultiAlpha, Material, setBlendMode, setMaskMode, setSideMode,
} from '../../material';
import {
  createKeyFrameMeta, createValueGetter, ValueGetter, getKeyFrameMetaByRawValue,
  RandomValue,
} from '../../math';
import type {
  Attribute, GPUCapability, GeometryProps, ShaderMacros, SharedShaderWithSource,
} from '../../render';
import { GLSLVersion, Geometry, Mesh } from '../../render';
import { particleFrag, particleVert } from '../../shader';
import { Texture, generateHalfFloatTexture } from '../../texture';
import { Transform } from '../../transform';
import { assertExist, enlargeBuffer, imageDataFromGradient } from '../../utils';
import { particleUniformTypeMap } from './particle-vfx-item';

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
  forceTarget?: { curve: ValueGetter<number>, target: spec.vec3 };
  colorOverLifetime?: { color?: number[][], opacity?: ValueGetter<number>, separateAxes?: boolean };
  linearVelOverLifetime?: { asMovement?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean };
  orbitalVelOverLifetime?: { asRotation?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number>, enabled?: boolean, center?: spec.vec3 };
  rotationOverLifetime?: { asRotation?: boolean, x?: ValueGetter<number>, y?: ValueGetter<number>, z?: ValueGetter<number> };
  speedOverLifetime?: ValueGetter<number>;
  time: number;

  readonly useSprite?: boolean;
  readonly textureOffsets: number[];
  readonly maxCount: number;
  readonly anchor: Vector2;

  private cachedRotationVector3 = new Vector3();
  private cachedRotationMatrix = new Matrix3();
  private cachedLinearMove = new Vector3();
  private tempMatrix3 = new Matrix3();

  VERT_MAX_KEY_FRAME_COUNT = 0;

  constructor (
    engine: Engine,
    props: ParticleMeshProps,
  ) {
    const { env } = engine.renderer ?? {};
    const {
      speedOverLifetime, colorOverLifetime, linearVelOverLifetime, orbitalVelOverLifetime, sizeOverLifetime, rotationOverLifetime,
      sprite, gravityModifier, maxCount, textureFlip, useSprite, name,
      gravity, forceTarget, side, occlusion, anchor, blending,
      maskMode, mask, transparentOcclusion, meshSlots,
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
    let useOrbitalVel;

    this.useSprite = useSprite;
    if (enableVertexTexture) {
      macros.push(['ENABLE_VERTEX_TEXTURE', true]);
    }
    if (speedOverLifetime) {
      macros.push(['SPEED_OVER_LIFETIME', true]);
      shaderCacheId |= 1 << 1;
      uniformValues.uSpeedLifetimeValue = speedOverLifetime.toUniform(vertexKeyFrameMeta);
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

    ['x', 'y', 'z'].forEach((pro, i) => {
      let defL = 0;
      let defO = 0;

      if (linearVelOverLifetime?.[pro]) {
        uniformValues[`uLinear${pro.toUpperCase()}ByLifetimeValue`] = linearVelOverLifetime[pro].toUniform(vertexKeyFrameMeta);
        defL = 1;
        shaderCacheId |= 1 << (7 + i);
        linearVelOverLifetime.enabled = true;
      }
      macros.push([`LINEAR_VEL_${pro.toUpperCase()}`, defL]);
      if (orbitalVelOverLifetime?.[pro]) {
        uniformValues[`uOrb${pro.toUpperCase()}ByLifetimeValue`] = orbitalVelOverLifetime[pro].toUniform(vertexKeyFrameMeta);
        defO = 1;
        shaderCacheId |= 1 << (10 + i);
        useOrbitalVel = true;
        orbitalVelOverLifetime.enabled = true;
      }
      macros.push([`ORB_VEL_${pro.toUpperCase()}`, defO]);
    });
    if (linearVelOverLifetime?.asMovement) {
      macros.push(['AS_LINEAR_MOVEMENT', true]);
      shaderCacheId |= 1 << 5;
    }

    if (useOrbitalVel) {
      if (orbitalVelOverLifetime?.asRotation) {
        macros.push(['AS_ORBITAL_MOVEMENT', true]);
        shaderCacheId |= 1 << 6;
      }
      uniformValues.uOrbCenter = new Float32Array(orbitalVelOverLifetime?.center || [0, 0, 0]);
    }

    uniformValues.uSizeByLifetimeValue = sizeOverLifetime?.x.toUniform(vertexKeyFrameMeta);
    if (sizeOverLifetime?.separateAxes) {
      macros.push(['SIZE_Y_BY_LIFE', 1]);
      shaderCacheId |= 1 << 14;
      uniformValues.uSizeYByLifetimeValue = sizeOverLifetime?.y?.toUniform(vertexKeyFrameMeta);
    }
    if (rotationOverLifetime?.z) {
      uniformValues.uRZByLifeTimeValue = rotationOverLifetime.z.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 15;
      macros.push(['ROT_Z_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.x) {
      uniformValues.uRXByLifeTimeValue = rotationOverLifetime.x.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 16;
      macros.push(['ROT_X_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.y) {
      uniformValues.uRYByLifeTimeValue = rotationOverLifetime.y.toUniform(vertexKeyFrameMeta);
      shaderCacheId |= 1 << 17;
      macros.push(['ROT_Y_LIFETIME', 1]);
    }
    if (rotationOverLifetime?.asRotation) {
      macros.push(['ROT_LIFETIME_AS_MOVEMENT', 1]);
      shaderCacheId |= 1 << 18;
    }
    uniformValues.uGravityModifierValue = gravityModifier.toUniform(vertexKeyFrameMeta);

    if (forceTarget) {
      macros.push(['FINAL_TARGET', true]);
      shaderCacheId |= 1 << 19;
      uniformValues.uFinalTarget = new Float32Array(forceTarget.target || [0, 0, 0]);
      uniformValues.uForceCurve = forceTarget.curve.toUniform(vertexKeyFrameMeta);
    }

    if (halfFloatTexture && fragmentKeyFrameMeta.max) {
      shaderCacheId |= 1 << 20;
      uniformValues.uFCurveValueTexture = generateHalfFloatTexture(engine, ValueGetter.getAllData(fragmentKeyFrameMeta, true) as Uint16Array, fragmentKeyFrameMeta.index, 1);
    } else {
      uniformValues.uFCurveValues = ValueGetter.getAllData(fragmentKeyFrameMeta);
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
    uniformValues.uParams = [0, 0, 0, 0];
    uniformValues.uAcceleration = [gravity?.[0] || 0, gravity?.[1] || 0, gravity?.[2] || 0, 0];
    // mtlOptions.uniformValues = uniformValues;

    const material = Material.create(engine, mtlOptions);

    material.blending = true;
    material.depthTest = true;
    material.depthMask = !!occlusion;
    material.stencilRef = mask ? [mask, mask] : undefined;
    setMaskMode(material, maskMode);
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
    this.forceTarget = forceTarget;
    this.sizeOverLifetime = sizeOverLifetime;
    this.speedOverLifetime = speedOverLifetime;
    this.linearVelOverLifetime = linearVelOverLifetime;
    this.orbitalVelOverLifetime = orbitalVelOverLifetime;
    this.orbitalVelOverLifetime = orbitalVelOverLifetime;
    this.gravityModifier = gravityModifier;
    this.rotationOverLifetime = rotationOverLifetime;
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

  onUpdate (dt: number) {
    const aPosArray = this.geometry.getAttributeData('aPos') as Float32Array; // vector3
    const vertexCount = Math.ceil(aPosArray.length / 12);

    this.applyTranslation(vertexCount, dt);
    this.applyRotation(vertexCount, dt);
    this.applyLinearMove(vertexCount, dt);
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

  setPoint (index: number, point: Point) {
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
        aTranslation: new Float32Array(12),
        aLinearMove:new Float32Array(12),
        aRotation0: new Float32Array(36),
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

  private applyTranslation (vertexCount: number, deltaTime: number) {
    const localTime = this.time;
    let aTranslationArray = this.geometry.getAttributeData('aTranslation') as Float32Array;
    const aVelArray = this.geometry.getAttributeData('aVel') as Float32Array; // vector3
    const aOffsetArray = this.geometry.getAttributeData('aOffset') as Float32Array;

    if (aTranslationArray.length < vertexCount * 3) {
      aTranslationArray = this.expandArray(aTranslationArray, vertexCount * 3);
    }
    // const velocity = this.cachedVelocity;
    let velocityX = 0;
    let velocityY = 0;
    let velocityZ = 0;
    const uAcceleration = this.mesh.material.getVector4('uAcceleration');
    const uGravityModifierValue = this.mesh.material.getVector4('uGravityModifierValue');

    for (let i = 0; i < vertexCount; i += 4) {
      const velOffset = i * 12 + 3;

      velocityX = aVelArray[velOffset];
      velocityY = aVelArray[velOffset + 1];
      velocityZ = aVelArray[velOffset + 2];
      // velocity.set(aVelArray[velOffset], aVelArray[velOffset + 1], aVelArray[velOffset + 2]);
      const dt = localTime - aOffsetArray[i * 4 + 2];// 相对delay的时间
      const duration = aOffsetArray[i * 4 + 3];

      if (uAcceleration && uGravityModifierValue) {
        const d = this.gravityModifier.getIntegrateValue(0, dt, duration);
        // const acc = this.tempVector3.set(uAcceleration.x * d, uAcceleration.y * d, uAcceleration.z * d);
        const accX = uAcceleration.x * d;
        const accY = uAcceleration.y * d;
        const accZ = uAcceleration.z * d;

        // speedIntegrate = speedOverLifetime.getIntegrateValue(0, time, duration);
        if (this.speedOverLifetime) {
        // dt / dur 归一化
          const speed = this.speedOverLifetime.getValue(dt / duration);

          velocityX = velocityX * speed + accX;
          velocityY = velocityY * speed + accY;
          velocityZ = velocityZ * speed + accZ;
          // velocity.multiply(speed).add(acc);
        } else {
          velocityX = velocityX + accX;
          velocityY = velocityY + accY;
          velocityZ = velocityZ + accZ;
          // velocity.add(acc);
        }
      }

      const aTranslationOffset = i * 3;

      if (aOffsetArray[i * 4 + 2] < localTime) {
        // const translation = velocity.multiply(deltaTime / 1000);
        const aTranslationX = velocityX * (deltaTime / 1000);
        const aTranslationY = velocityY * (deltaTime / 1000);
        const aTranslationZ = velocityZ * (deltaTime / 1000);

        aTranslationArray[aTranslationOffset] += aTranslationX;
        aTranslationArray[aTranslationOffset + 1] += aTranslationY;
        aTranslationArray[aTranslationOffset + 2] += aTranslationZ;

        aTranslationArray[aTranslationOffset + 3] += aTranslationX;
        aTranslationArray[aTranslationOffset + 4] += aTranslationY;
        aTranslationArray[aTranslationOffset + 5] += aTranslationZ;

        aTranslationArray[aTranslationOffset + 6] += aTranslationX;
        aTranslationArray[aTranslationOffset + 7] += aTranslationY;
        aTranslationArray[aTranslationOffset + 8] += aTranslationZ;

        aTranslationArray[aTranslationOffset + 9] += aTranslationX;
        aTranslationArray[aTranslationOffset + 10] += aTranslationY;
        aTranslationArray[aTranslationOffset + 11] += aTranslationZ;
      }
    }
    this.geometry.setAttributeData('aTranslation', aTranslationArray);
  }

  private applyRotation (vertexCount: number, deltaTime: number) {
    let aRotationArray = this.geometry.getAttributeData('aRotation0') as Float32Array;
    const aOffsetArray = this.geometry.getAttributeData('aOffset') as Float32Array;
    const aRotArray = this.geometry.getAttributeData('aRot') as Float32Array; // vector3
    const aSeedArray = this.geometry.getAttributeData('aSeed') as Float32Array; // float
    const localTime = this.time;
    const aRotationMatrix = this.cachedRotationMatrix;

    if (aRotationArray.length < vertexCount * 9) {
      aRotationArray = this.expandArray(aRotationArray, vertexCount * 9);
    }

    for (let i = 0; i < vertexCount; i += 4) {
      const time = localTime - aOffsetArray[i * 4 + 2];
      const duration = aOffsetArray[i * 4 + 3];
      const life = clamp(time / duration, 0.0, 1.0);
      const aRotOffset = i * 8;
      const aRot = this.cachedRotationVector3.set(aRotArray[aRotOffset], aRotArray[aRotOffset + 1], aRotArray[aRotOffset + 2]);
      const aSeed = aSeedArray[i * 8 + 3];

      const rotation = aRot;

      if (!this.rotationOverLifetime) {
        aRotationMatrix.setZero();
      } else {
      // Adjust rotation based on the specified lifetime components
        if (this.rotationOverLifetime.x) {
          if (this.rotationOverLifetime.x instanceof RandomValue) {
            rotation.x += this.rotationOverLifetime.x.getValue(life, aSeed);
          } else {
            rotation.x += this.rotationOverLifetime.x.getValue(life);
          }
        }
        if (this.rotationOverLifetime.y) {
          if (this.rotationOverLifetime.y instanceof RandomValue) {
            rotation.y += this.rotationOverLifetime.y.getValue(life, aSeed);
          } else {
            rotation.y += this.rotationOverLifetime.y.getValue(life);
          }
        }
        if (this.rotationOverLifetime.z) {
          if (this.rotationOverLifetime.z instanceof RandomValue) {
            rotation.z += this.rotationOverLifetime.z.getValue(life, aSeed);
          } else {
            rotation.z += this.rotationOverLifetime.z.getValue(life);
          }
        }
      }
      // else {
      // // Adjust rotation based on the specified lifetime components
      //   if (this.rotationOverLifetime.x) {
      //     if (this.rotationOverLifetime.x instanceof RandomValue) {
      //       rotation.x += this.rotationOverLifetime.x.getIntegrateValue(0.0, life, aSeed) * duration;
      //     } else {
      //       rotation.x += this.rotationOverLifetime.x.getIntegrateValue(0.0, life, duration) * duration;
      //     }
      //   }
      //   if (this.rotationOverLifetime.y) {
      //     if (this.rotationOverLifetime.y instanceof RandomValue) {
      //       rotation.y += this.rotationOverLifetime.y.getIntegrateValue(0.0, life, aSeed) * duration;
      //     } else {
      //       rotation.y += this.rotationOverLifetime.y.getIntegrateValue(0.0, life, duration) * duration;
      //     }
      //   }
      //   if (this.rotationOverLifetime.z) {
      //     if (this.rotationOverLifetime.z instanceof RandomValue) {
      //       rotation.z += this.rotationOverLifetime.z.getIntegrateValue(0.0, life, aSeed) * duration;
      //     } else {
      //       rotation.z += this.rotationOverLifetime.z.getIntegrateValue(0.0, life, duration) * duration;
      //     }
      //   }
      // }

      // If the rotation vector is zero, return the identity matrix
      if (rotation.dot(rotation) === 0.0) {
        aRotationMatrix.identity();
      }

      const d2r = Math.PI / 180;
      const rotationXD2r = rotation.x * d2r;
      const rotationYD2r = rotation.y * d2r;
      const rotationZD2r = rotation.z * d2r;

      const sinRX = Math.sin(rotationXD2r);
      const sinRY = Math.sin(rotationYD2r);
      const sinRZ = Math.sin(rotationZD2r);

      const cosRX = Math.cos(rotationXD2r);
      const cosRY = Math.cos(rotationYD2r);
      const cosRZ = Math.cos(rotationZD2r);

      // rotZ * rotY * rotX
      aRotationMatrix.set(cosRZ, -sinRZ, 0., sinRZ, cosRZ, 0., 0., 0., 1.); //rotZ
      aRotationMatrix.multiply(this.tempMatrix3.set(cosRY, 0., sinRY, 0., 1., 0., -sinRY, 0, cosRY)); //rotY
      aRotationMatrix.multiply(this.tempMatrix3.set(1., 0., 0., 0, cosRX, -sinRX, 0., sinRX, cosRX)); //rotX

      const aRotationOffset = i * 9;
      const matrixArray = aRotationMatrix.elements;

      aRotationArray.set(matrixArray, aRotationOffset);
      if (i + 4 <= vertexCount) {
        aRotationArray.set(matrixArray, aRotationOffset + 9);
        aRotationArray.set(matrixArray, aRotationOffset + 18);
        aRotationArray.set(matrixArray, aRotationOffset + 27);
      }
    }

    this.geometry.setAttributeData('aRotation0', aRotationArray);
  }

  private applyLinearMove (vertexCount: number, deltaTime: number) {
    let aLinearMoveArray = this.geometry.getAttributeData('aLinearMove') as Float32Array;
    const aOffsetArray = this.geometry.getAttributeData('aOffset') as Float32Array;
    const aSeedArray = this.geometry.getAttributeData('aSeed') as Float32Array; // float
    const localTime = this.time;

    if (aLinearMoveArray.length < vertexCount * 3) {
      aLinearMoveArray = this.expandArray(aLinearMoveArray, vertexCount * 3);
    }

    const linearMove = this.cachedLinearMove;

    if (this.linearVelOverLifetime && this.linearVelOverLifetime.enabled) {
      for (let i = 0; i < vertexCount; i += 4) {
        const time = localTime - aOffsetArray[i * 4 + 2];
        const duration = aOffsetArray[i * 4 + 3];
        // const life = math.clamp(time / duration, 0.0, 1.0);
        const lifetime = time / duration;
        const aSeed = aSeedArray[i * 8 + 3];

        linearMove.setZero();

        if (this.linearVelOverLifetime.asMovement) {
          if (this.linearVelOverLifetime.x) {
            if (this.linearVelOverLifetime.x instanceof RandomValue) {
              linearMove.x = this.linearVelOverLifetime.x.getValue(lifetime, aSeed);
            } else {
              linearMove.x = this.linearVelOverLifetime.x.getValue(lifetime);
            }
          }
          if (this.linearVelOverLifetime.y) {
            if (this.linearVelOverLifetime.y instanceof RandomValue) {
              linearMove.y = this.linearVelOverLifetime.y.getValue(lifetime, aSeed);
            } else {
              linearMove.y = this.linearVelOverLifetime.y.getValue(lifetime);
            }
          }
          if (this.linearVelOverLifetime.z) {
            if (this.linearVelOverLifetime.z instanceof RandomValue) {
              linearMove.z = this.linearVelOverLifetime.z.getValue(lifetime, aSeed);
            } else {
              linearMove.z = this.linearVelOverLifetime.z.getValue(lifetime);
            }
          }
        } else {
        // Adjust rotation based on the specified lifetime components
          if (this.linearVelOverLifetime.x) {
            if (this.linearVelOverLifetime.x instanceof RandomValue) {
              linearMove.x = this.linearVelOverLifetime.x.getIntegrateValue(0.0, time, aSeed);
            } else {
              linearMove.x = this.linearVelOverLifetime.x.getIntegrateValue(0.0, time, duration);
            }
          }
          if (this.linearVelOverLifetime.y) {
            if (this.linearVelOverLifetime.y instanceof RandomValue) {
              linearMove.y = this.linearVelOverLifetime.y.getIntegrateValue(0.0, time, aSeed);
            } else {
              linearMove.y = this.linearVelOverLifetime.y.getIntegrateValue(0.0, time, duration);
            }
          }
          if (this.linearVelOverLifetime.z) {
            if (this.linearVelOverLifetime.z instanceof RandomValue) {
              linearMove.z = this.linearVelOverLifetime.z.getIntegrateValue(0.0, time, aSeed);
            } else {
              linearMove.z = this.linearVelOverLifetime.z.getIntegrateValue(0.0, time, duration);
            }
          }
        }
        const aLinearMoveOffset = i * 3;

        aLinearMoveArray[aLinearMoveOffset] = linearMove.x;
        aLinearMoveArray[aLinearMoveOffset + 1] = linearMove.y;
        aLinearMoveArray[aLinearMoveOffset + 2] = linearMove.z;

        aLinearMoveArray[aLinearMoveOffset + 3] = linearMove.x;
        aLinearMoveArray[aLinearMoveOffset + 4] = linearMove.y;
        aLinearMoveArray[aLinearMoveOffset + 5] = linearMove.z;

        aLinearMoveArray[aLinearMoveOffset + 6] = linearMove.x;
        aLinearMoveArray[aLinearMoveOffset + 7] = linearMove.y;
        aLinearMoveArray[aLinearMoveOffset + 8] = linearMove.z;

        aLinearMoveArray[aLinearMoveOffset + 9] = linearMove.x;
        aLinearMoveArray[aLinearMoveOffset + 10] = linearMove.y;
        aLinearMoveArray[aLinearMoveOffset + 11] = linearMove.z;
      }
    }
    this.geometry.setAttributeData('aLinearMove', aLinearMoveArray);
  }

  private expandArray (array: Float32Array, newSize: number): Float32Array {
    const newArr = new Float32Array(newSize);

    newArr.set(array);

    return newArr;
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
    aTranslation: { size: 3, data: new Float32Array(0) },
    aLinearMove: { size: 3, data: new Float32Array(0) },
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
  const { level, detail } = gpuCapability;
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
