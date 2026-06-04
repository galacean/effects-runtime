import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Engine } from '../../engine';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { MaterialProps } from '../../material';
import {
  getPreMultiAlpha, Material, setBlendMode, setSideMode,
} from '../../material';
import type {
  Attribute, GeometryProps, ShaderMacros,
} from '../../render';
import { GLSLVersion, Geometry, Mesh } from '../../render';
import { particleFrag, particleVert } from '../../shader';
import { Texture } from '../../texture';
import { assertExist, enlargeBuffer } from '../../utils';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { particleUniformTypeMap } from './particle-vfx-item';

export interface ParticleMeshData {
}

export interface ParticleMeshProps extends ParticleMeshData {
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
  // listIndex: number,
  // duration: number,
  maxCount: number,
  name: string,
  anchor: Vector2,
}
export class ParticleMesh implements ParticleMeshData {
  duration: number;
  geometry: Geometry;
  mesh: Mesh;
  particleCount = 0;
  maxParticleBufferCount: number;
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
      sprite, maxCount, textureFlip, useSprite, name,
      side, occlusion, anchor, blending,
      transparentOcclusion,
      renderMode = 0,
      diffuse = Texture.createWithData(engine),
    } = props;
    const macros: ShaderMacros = [
      ['RENDER_MODE', +renderMode],
      ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const { level } = engine.gpuCapability;
    const uniformValues: Record<string, any> = {};
    let shaderCacheId = 0;

    this.useSprite = useSprite;
    if (sprite?.animate) {
      macros.push(['USE_SPRITE', true]);
      shaderCacheId |= 1 << 2;
      uniformValues.uFSprite = uniformValues.uSprite = new Float32Array([sprite.col, sprite.row, sprite.total, sprite.blend ? 1 : 0]);
      this.useSprite = true;
    }

    const shaderCache = ['-p:', renderMode, shaderCacheId].join('+');

    const fragment = particleFrag;
    const vertex = particleVert;

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
        aSize: new Float32Array(8),
        aColorScale: new Float32Array(16),
      };
      const useSprite = this.useSprite;

      if (useSprite) {
        pointData.aSprite = new Float32Array(12);
      }

      const i3 = index * 3;
      const i4 = index * 4;
      const i2 = index * 2;
      const position = [0, 0, 0];
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
        const j2 = j * 2;

        pointData.aSize[j2] = db.sizeScale[i2];
        pointData.aSize[j2 + 1] = db.sizeScale[i2 + 1];
        pointData.aColorScale[j4] = db.colorScale[i4];
        pointData.aColorScale[j4 + 1] = db.colorScale[i4 + 1];
        pointData.aColorScale[j4 + 2] = db.colorScale[i4 + 2];
        pointData.aColorScale[j4 + 3] = db.colorScale[i4 + 3];
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
    aSize: { size: 2, data: new Float32Array(0) },
    aColorScale: { size: 4, data: new Float32Array(0) },
  };

  if (useSprite) {
    attributes['aSprite'] = { size: 3, stride: 3 * bpe, data: new Float32Array(0) };
  }

  return { attributes, indices: { data: new Uint16Array(0) }, name, maxVertex };
}

