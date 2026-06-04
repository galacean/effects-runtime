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
import { assertExist } from '../../utils';
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

