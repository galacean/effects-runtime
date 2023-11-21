import type * as spec from '@galacean/effects-specification';
import type { Composition } from './composition';
import { HELP_LINK } from './constants';
import { glContext } from './gl';
import type { FilterMaterialStates, UniformValue } from './material';
import type { ValueGetter } from './math';
import type { FilterSpriteVFXItem } from './plugins';
import type { RenderFrame, RenderPassSplitOptions, RenderPass, RenderPassDelegate } from './render';

export type FilterDefineFunc = (filter: spec.FilterParams, composition: Composition) => FilterDefine;
export type FilterShaderFunc = (filter: spec.FilterParams) => FilterShaderDefine[];

const filterFuncMap: Record<string, FilterDefineFunc> = {};
const filterShaderFuncMap: Record<string, FilterShaderFunc> = {};

/**
 * 注册滤镜
 * @param name - 滤镜名
 * @param func - 函数，用于在创建 Mesh 前执行
 * @param shaderFunc - 函数，用于获取创建 shader 文本的参数
 */
export function registerFilter (name: string, func: FilterDefineFunc, shaderFunc: FilterShaderFunc) {
  if (name in filterFuncMap) {
    console.error(`Filter ${name} registered twice.`);
  }
  filterFuncMap[name] = func;
  filterShaderFuncMap[name] = shaderFunc;
}

/**
 * 批量注册插件
 * @param filters
 */
export function registerFilters (filters: Record<string, [register: FilterDefineFunc, createShaderDefine: FilterShaderFunc]>) {
  Object.keys(filters).forEach(name => {
    const [register, createShaderDefine] = filters[name];

    registerFilter(name, register, createShaderDefine);
  });
}

/**
 * 执行注册的 shader 回调，创建滤镜的 shader
 * @param filter - `filterShaderFunc` 回调函数的参数
 */
export function createFilterShaders (filter: spec.FilterParams): FilterShaderDefine[] {
  const func = filterShaderFuncMap[filter.name];

  if (!func) {
    throw Error(`Filter ${filter.name} not imported, see ${HELP_LINK['Filter not imported']}`);
  }

  return func(filter);
}

/**
 * 获取滤镜需要在 Mesh 中传递的参数和在 renderPass 中的回调
 * @param filter - `filterFunc` 回调的参数
 * @param composition - 合成对象
 */
export function createFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const func = filterFuncMap[filter.name];

  if (!func) {
    throw Error(`Filter ${filter.name} not imported, see ${HELP_LINK['Filter not imported']}`);
  }
  const ret = func(filter, composition);

  if (!ret.passSplitOptions) {
    ret.passSplitOptions = {
      attachments: [{ texture: { format: glContext.RGBA } }],
    };
  }

  return ret;
}

export interface ParticleFilterDefine {
  fragment: string,
  vertex?: string,
  uniforms?: Record<string, ValueGetter<number>>,
  uniformValues?: Record<string, UniformValue>,
}

export interface FilterShaderDefine {
  vertex?: string,
  fragment?: string,
  shaderCacheId?: string,
  ignoreBlend?: boolean,
  isParticle?: boolean,
  uniforms?: [type: spec.ValueType, value: any][],
}

export interface FilterDefine {
  particle?: ParticleFilterDefine,
  mesh: {
    name?: string,
    vertex?: string,
    fragment?: string,
    shaderCacheId?: string,
    uniformValues?: Record<string, UniformValue>,
    materialStates?: FilterMaterialStates,
    variables?: Record<string, (life: number) => UniformValue>,
  },
  prePasses?: RenderPass[],
  passSplitOptions?: RenderPassSplitOptions,
  renderPassDelegate?: RenderPassDelegate,
  onItemUpdate?: (dt: number, item: FilterSpriteVFXItem) => void,
  onItemRemoved?: (item: FilterSpriteVFXItem) => void,
  onRenderPassCreated?: (rp: RenderPass, renderFrame: RenderFrame) => void,
}
