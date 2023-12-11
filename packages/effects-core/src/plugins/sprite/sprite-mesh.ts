import type * as spec from '@galacean/effects-specification';
import { Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Composition } from '../../composition';
import { PLAYER_OPTIONS_ENV_EDITOR, SPRITE_VERTEX_STRIDE } from '../../constants';
import type { FilterShaderDefine } from '../../filter';
import { glContext } from '../../gl';
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
import type { GeometryDrawMode, GPUCapabilityDetail, SharedShaderWithSource } from '../../render';
import { Geometry, GLSLVersion, Mesh } from '../../render';
import { itemFrag, itemFrameFrag, itemVert } from '../../shader';
import { Texture } from '../../texture';
import type { Transform } from '../../transform';
import { addItem, DestroyOptions } from '../../utils';
import type { SpriteItem, SpriteItemRenderInfo } from './sprite-item';
import type { Engine } from '../../engine';

export type SpriteRenderData = {
  life: number,
  transform: Transform,
  visible?: boolean,
  startSize?: Vector3,
  color?: spec.vec4,
  texOffset?: spec.vec4,
  active?: boolean,
  anchor?: spec.vec3,
};

export type SpriteRegionData = {
  color: spec.vec4,
  position: spec.vec3,
  quat: spec.vec4,
  size: spec.vec2,
};

export let maxSpriteMeshItemCount = 8;
export let maxSpriteTextureCount = 8;

let seed = 1;

export class SpriteMesh {
  items: SpriteItem[] = [];
  splitLayer: boolean;

  readonly mesh: Mesh;

  protected readonly lineMode: boolean;
  private readonly wireframe?: boolean;

  private dirty = false;
  private preMultiAlpha: number;
  private mtlSlotCount: number;

  constructor (
    public engine: Engine,
    renderInfo: SpriteItemRenderInfo,
    private readonly composition: Composition,
  ) {
    const { wireframe } = renderInfo;

    const geometry = this.createGeometry(wireframe ? glContext.LINES : glContext.TRIANGLES);
    const material = this.createMaterial(renderInfo, 2);

    this.wireframe = wireframe;
    this.mesh = Mesh.create(
      engine,
      {
        name: 'MSprite' + seed++,
        priority: 0,
        worldMatrix: Matrix4.fromIdentity(),
        geometry,
        material,
      });
  }

  setItems (items: SpriteItem[]) {
    const datas: Record<string, number[] | spec.TypedArray>[] = [];
    const textures: Texture[] = [];
    let itemSlot = 2;
    let aPointLen = 0;
    let indexLen = 0;
    let pointCount = 0;

    if (!items.length) {
      this.mesh.setVisible(false);

      return true;
    }

    this.items = items.slice();

    if (items.length > 2) {
      itemSlot = maxSpriteMeshItemCount;
    }
    const renderInfo = items[0].renderInfo;

    if (this.mtlSlotCount !== itemSlot) {
      this.mesh.setMaterial(this.createMaterial(renderInfo, itemSlot), { textures: DestroyOptions.keep });
    }
    const attachmentLength = renderInfo?.filter?.passSplitOptions?.attachments?.length ?? 0;

    this.splitLayer = attachmentLength > 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texture = item?.renderer.texture;

      if (texture) {
        addItem(textures, texture);
      }
      item.mesh = this;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const texture = item?.renderer.texture;
      const textureIndex = texture ? textures.indexOf(texture) : -1;
      const data = this.getItemInitData(item, i, pointCount, textureIndex);

      aPointLen += data.aPoint.length;
      indexLen += data.index.length;
      datas.push(data);
      pointCount += data.aPoint.length / 6;
      this.updateItem(item, true);
    }

    const bundle: Record<string, Float32Array | Uint16Array> = {
      aPoint: new Float32Array(aPointLen),
      index: new Uint16Array(indexLen),
    };
    const cursor: Record<string, number> = {
      aPoint: 0,
      index: 0,
    };

    for (let i = 0; i < datas.length; i++) {
      const data = datas[i];

      Object.keys(bundle).forEach(name => {
        const arr = bundle[name];
        const ta = data[name];

        arr.set(ta, cursor[name]);
        cursor[name] += ta.length;
      });
    }
    const { material, geometry } = this.mesh;
    const indexData = bundle.index;

    geometry.setIndexData(indexData);
    geometry.setAttributeData('aPoint', bundle.aPoint);
    geometry.setDrawCount(indexLen);
    this.mesh.setVisible(!!geometry.getDrawCount());
    this.mesh.priority = items[0].listIndex;
    for (let i = 0; i < textures.length; i++) {
      const texture = textures[i];

      material.setTexture('uSampler' + i, texture);
    }
    // FIXME: 内存泄漏的临时方案，后面再调整
    const emptyTexture = items[0].emptyTexture;

    for (let k = textures.length; k < maxSpriteMeshItemCount; k++) {
      material.setTexture('uSampler' + k, emptyTexture);
    }
    if (this.splitLayer) {
      const tex = generateFeatureTexture(this.engine, items[0].feather);

      material.setTexture('uFeatherSampler', tex);
    }
  }

  updateItem (item: SpriteItem, init?: boolean) {
    const index = this.items.indexOf(item);

    if (index <= -1) {
      return;
    }
    const texDataArray = this.mesh.material.getVector4Array('uTexParams');
    const idxStart = index * 4;

    const selfData = item.getRenderData(item.time, init);

    const mainDataArray = this.mesh.material.getMatrixArray('uMainData')!;
    const start = index * 16;
    const uPosStart = start;
    const uSizeStart = start + 4;
    const uQuatStart = start + 8;
    const uColorStart = start + 12;

    if (!selfData.visible && !init) {
      mainDataArray[uSizeStart + 2] = -1;

      return;
    }

    const uColor = selfData.color || [mainDataArray[uColorStart], mainDataArray[uColorStart + 1], mainDataArray[uColorStart + 2], mainDataArray[uColorStart + 3]];

    // if (selfData.startSize) {
    //   selfData.transform.scaleBy(1 / selfData.startSize[0], 1 / selfData.startSize[1], 1);
    // }

    const tempPos = new Vector3();
    const tempQuat = new Quaternion();
    const tempScale = new Vector3();

    selfData.transform.assignWorldTRS(tempPos, tempQuat, tempScale);

    const uPos = [...tempPos.toArray(), 0];
    const uSize = [...tempScale.toArray(), 0];
    const uQuat = tempQuat.toArray();

    if (!isNaN(item.getCustomOpacity())) {
      uColor[3] = item.getCustomOpacity();
    }

    // selfData.transform.assignWorldTRS(uPos, uQuat, uSize);

    /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
    // vecMulCombine(uColor, selfData.color, parentData.color);
    /***********************/
    for (let i = 0; i < 4; i++) {
      mainDataArray[uPosStart + i] = uPos[i];
      mainDataArray[uQuatStart + i] = uQuat[i];
      mainDataArray[uSizeStart + i] = uSize[i];
      mainDataArray[uColorStart + i] = uColor[i];
    }
    uSize[2] = selfData.life;
    mainDataArray[uSizeStart + 2] = selfData.life;
    if (init) {
      const renderer = item.renderer;

      texDataArray[idxStart] = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
      texDataArray[idxStart + 2] = renderer.renderMode;
      texDataArray[idxStart + 1] = +this.preMultiAlpha;
    }
    if (selfData.texOffset) {
      const texOffsetDataArray = this.mesh.material.getVector4Array('uTexOffset');

      for (let i = 0; i < 4; i++) {
        texOffsetDataArray[index * 4 + i] = selfData.texOffset[i];
      }
    }
  }

  applyChange () {
    if (this.dirty) {
      this.setItems(this.items);
      this.dirty = false;
    }
  }

  getItemInitData (item: SpriteItem, idx: number, pointStartIndex: number, textureIndex: number) {
    let geoData = item.geoData;

    if (this.lineMode) {
      geoData = this.getItemGeometryData(item, idx);
    } else if (!geoData) {
      geoData = item.geoData = this.getItemGeometryData(item, idx);
    }
    const pointData = geoData.aPoint;

    if (pointData[4] !== idx || pointData[5] !== textureIndex) {
      for (let i = 0; i < pointData.length; i += 6) {
        pointData[i + 4] = idx;
        pointData[i + 5] = textureIndex;
      }
    }
    const index = geoData.index;
    const idxCount = index.length;
    // @ts-expect-error
    const indexData: number[] = this.wireframe ? new Uint8Array([0, 1, 1, 3, 2, 3, 2, 0]) : new index.constructor(idxCount);

    if (!this.wireframe) {
      for (let i = 0; i < idxCount; i++) {
        indexData[i] = pointStartIndex + index[i];
      }
    }

    return {
      aPoint: geoData.aPoint,
      index: indexData,
    };
  }

  getItemRegionData (item: SpriteItem): SpriteRegionData | void {
    const index = this.items.indexOf(item);

    if (index > -1) {
      //const mainData = this.mainDataBlock.getUniformValue('uMainData') as spec.TypedArray;
      const mainData = this.mesh.material.getMatrixArray('uMainData');
      const idx = index * 16;

      if (mainData === null) { return; }

      return {
        position: [mainData[idx] || 0, mainData[idx + 1] || 0, mainData[idx + 2] || 0],
        size: [mainData[idx + 4], mainData[idx + 5]],
        quat: [mainData[idx + 8], mainData[idx + 9], mainData[idx + 10], mainData[idx + 11]],
        color: [mainData[idx + 12], mainData[idx + 13], mainData[idx + 14], mainData[idx + 15]],
      };
    }
  }

  invalidMaterial () {
    this.mtlSlotCount = 0;
  }

  private createGeometry (mode: GeometryDrawMode) {
    const BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

    return Geometry.create(
      this.engine,
      {
        attributes: {
          aPoint: {
            size: 4,
            offset: 0,
            stride: SPRITE_VERTEX_STRIDE * BYTES_PER_ELEMENT,
            releasable: true,
            type: glContext.FLOAT,
            data: new Float32Array(0),
          },
          aIndex: {
            size: 2,
            offset: 4 * BYTES_PER_ELEMENT,
            stride: SPRITE_VERTEX_STRIDE * BYTES_PER_ELEMENT,
            dataSource: 'aPoint',
            type: glContext.FLOAT,
          },
        },
        indices: { data: new Uint16Array(0), releasable: true },
        mode,
        maxVertex: 4 * maxSpriteMeshItemCount,
      });
  }

  private createMaterial (renderInfo: SpriteItemRenderInfo, count: number): Material {
    const { filter, side, occlusion, blending, maskMode, mask } = renderInfo;
    const filterMesh = filter?.mesh || {};
    const engine = this.engine;
    const materialProps: MaterialProps = {
      shader: spriteMeshShaderFromRenderInfo(renderInfo, count, engine.gpuCapability.level, engine.renderer?.env,),
    };

    this.preMultiAlpha = getPreMultiAlpha(blending);
    this.mtlSlotCount = count;

    const material = Material.create(engine, materialProps);

    const states = {
      side,
      blending: true,
      blendMode: blending,
      mask,
      maskMode,
      depthTest: true,
      depthMask: occlusion,
      ...filterMesh.materialStates,
    };

    material.blending = states.blending;
    material.stencilRef = states.mask !== undefined ? [states.mask, states.mask] : undefined;
    material.depthTest = states.depthTest;
    material.depthMask = states.depthMask;
    states.blending && setBlendMode(material, states.blendMode);
    material.blendFunction = states.blendFunction;
    setMaskMode(material, states.maskMode);
    setSideMode(material, states.side);

    const filterUniform = filterMesh.uniformValues;

    // TODO uniform的数据组织形式待优化，临时方案。
    if (filterUniform) {
      for (const key of Object.keys(filterUniform)) {
        const value = filterUniform[key];

        if (value instanceof Texture) {
          material.setTexture(key, value);
        } else if (typeof value === 'number') {
          material.setFloat(key, value);
        } else if ((value as number[]).length === 2) {
          material.setVector2(key, Vector2.fromArray(value as spec.vec2));
        } else if ((value as number[]).length === 4) {
          material.setVector4(key, Vector4.fromArray(value as spec.vec4));
        } else {
          material.setMatrix(key, Matrix4.fromArray(value as spec.mat4));
        }
      }
    }

    const uMainData: Matrix4[] = [];
    const uTexParams: Vector4[] = [];
    const uTexOffset: Vector4[] = [];

    for (let i = 0; i < count; i++) {
      uMainData.push(Matrix4.fromIdentity());
      uTexParams.push(new Vector4());
      uTexOffset.push(new Vector4());
    }
    if (!material.hasUniform('uMainData')) {
      material.setMatrixArray('uMainData', uMainData);
    }
    if (!material.hasUniform('uTexParams')) {
      material.setVector4Array('uTexParams', uTexParams);
    }
    if (!material.hasUniform('uTexOffset')) {
      material.setVector4Array('uTexOffset', uTexOffset);
    }

    return material;
  }

  getItemGeometryData (item: SpriteItem, aIndex: number) {
    const { splits, renderer, textureSheetAnimation, startSize } = item;
    const { x: sx, y: sy } = startSize;

    if (renderer.shape) {
      const { index, aPoint } = renderer.shape;
      const point = new Float32Array(aPoint);

      for (let i = 0; i < point.length; i += 6) {
        point[i] *= sx;
        point[i + 1] *= sy;
      }

      return {
        index,
        aPoint: Array.from(point),
      };
    }

    const originData = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
    const aPoint = [];
    const index = [];
    let col = 2;
    let row = 2;

    if (splits.length === 1) {
      col = 1;
      row = 1;
    }
    for (let x = 0; x < col; x++) {
      for (let y = 0; y < row; y++) {
        const base = (y * 2 + x) * 4;
        // @ts-expect-error
        const split: number[] = textureSheetAnimation ? [0, 0, 1, 1, splits[0][4]] : splits[y * 2 + x];
        const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
        const dw = ((x + x + 1) / col - 1) / 2;
        const dh = ((y + y + 1) / row - 1) / 2;
        const tox = split[0];
        const toy = split[1];
        const tsx = split[4] ? split[3] : split[2];
        const tsy = split[4] ? split[2] : split[3];
        const origin = [
          originData[0] / col + dw,
          originData[1] / row + dh,
          originData[2] / col + dw,
          originData[3] / row + dh,
          originData[4] / col + dw,
          originData[5] / row + dh,
          originData[6] / col + dw,
          originData[7] / row + dh,
        ];

        aPoint.push(
          (origin[0]) * sx, (origin[1]) * sy, texOffset[0] * tsx + tox, texOffset[1] * tsy + toy, aIndex, 0,
          (origin[2]) * sx, (origin[3]) * sy, texOffset[2] * tsx + tox, texOffset[3] * tsy + toy, aIndex, 0,
          (origin[4]) * sx, (origin[5]) * sy, texOffset[4] * tsx + tox, texOffset[5] * tsy + toy, aIndex, 0,
          (origin[6]) * sx, (origin[7]) * sy, texOffset[6] * tsx + tox, texOffset[7] * tsy + toy, aIndex, 0,
        );
        if (this.lineMode) {
          index.push(base, 1 + base, 1 + base, 3 + base, 3 + base, 2 + base, 2 + base, base);
        } else {
          index.push(base, 1 + base, 2 + base, 2 + base, 1 + base, 3 + base);
        }
      }
    }

    return { index, aPoint };
  }
}

export function setSpriteMeshMaxItemCountByGPU (gpuCapability: GPUCapabilityDetail) {
  // 8 or 16
  maxSpriteTextureCount = Math.min(gpuCapability.maxFragmentTextures, 16);
  if (gpuCapability.maxVertexUniforms >= 256) {
    return maxSpriteMeshItemCount = 32;
  } else if (gpuCapability.maxVertexUniforms >= 128) {
    return maxSpriteMeshItemCount = 16;
  }
  maxSpriteTextureCount = 8;
}

export function getImageItemRenderInfo (item: SpriteItem): SpriteItemRenderInfo {
  const { renderer } = item;
  const filter = item.filter;
  const { blending, side, occlusion, mask, maskMode, order } = renderer;
  const blendingCache = +blending;
  const cachePrefix = item.cachePrefix || '-';
  const filterId = filter?.mesh?.shaderCacheId || '$F$';

  return {
    side,
    occlusion,
    blending,
    mask,
    maskMode,
    cachePrefix,
    filter,
    cacheId: `${cachePrefix}.${filterId}.${+side}+${+occlusion}+${blendingCache}+${order}+${maskMode}.${mask}`,
  };
}

export function spriteMeshShaderFromFilter (level: number, filter?: FilterShaderDefine, options?: { count?: number, ignoreBlend?: boolean, wireframe?: boolean, env?: string }): SharedShaderWithSource {
  const { count = 2, env = '', ignoreBlend, wireframe } = options ?? {};
  const marcos: [key: string, val: boolean | number][] = [
    ['MAX_ITEM_COUNT', count],
    ['PRE_MULTIPLY_ALPHA', false],
    ['ENV_EDITOR', env === PLAYER_OPTIONS_ENV_EDITOR],
    ['ADJUST_LAYER', !!filter],
    ['USE_BLEND', !ignoreBlend],
    ['MAX_FRAG_TEX', maxSpriteTextureCount >= 16 ? 16 : 8],
  ];
  const fragment = wireframe ? itemFrameFrag : itemFrag.replace(/#pragma\s+FILTER_FRAG/, filter?.fragment || '');
  const vertex = itemVert.replace(/#pragma\s+FILTER_VERT/, filter?.vertex || 'vec4 filterMain(float t,vec4 pos){return effects_MatrixVP * pos;}');

  return {
    fragment: createShaderWithMarcos(marcos, fragment, ShaderType.fragment, level),
    vertex: createShaderWithMarcos(marcos, vertex, ShaderType.vertex, level),
    glslVersion: level === 1 ? GLSLVersion.GLSL1 : GLSLVersion.GLSL3,
    marcos,
    shared: true,
  };
}

export function spriteMeshShaderIdFromRenderInfo (renderInfo: SpriteItemRenderInfo, count: number): string {
  return renderInfo.filter ? `${renderInfo.filter.mesh.shaderCacheId}_effects_filter` : `${renderInfo.cachePrefix}_effects_sprite_${count}`;
}

export function spriteMeshShaderFromRenderInfo (renderInfo: SpriteItemRenderInfo, count: number, level: number, env?: string): SharedShaderWithSource {
  const { filter, wireframe } = renderInfo;
  const shader = spriteMeshShaderFromFilter(level, filter?.mesh, {
    count,
    wireframe,
    env,
  });

  shader.shared = true;
  if (!wireframe) {
    shader.cacheId = spriteMeshShaderIdFromRenderInfo(renderInfo, count);
  }

  return shader;
}

function generateFeatureTexture (engine: Engine, feather?: ValueGetter<number>): Texture {
  let tex: Texture;

  if (!feather) {
    tex = Texture.createWithData(engine);
  } else {
    const len = 128;
    const data = new Uint8Array(len);

    for (let i = 0, s = len - 1; i < len; i++) {
      const p = i / s;
      const val = feather.getValue(p);

      data[i] = Math.round(val * 255);
    }
    tex = Texture.createWithData(engine, { width: len, height: 1, data }, {
      name: 'feather',
      format: glContext.LUMINANCE,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    });
  }

  return tex;
}

// TODO 只有单测用
export function setMaxSpriteMeshItemCount (count: number) {
  maxSpriteMeshItemCount = count;
}

export function setSpriteMeshMaxFragmentTextures (count: number) {
  maxSpriteTextureCount = count;
}
