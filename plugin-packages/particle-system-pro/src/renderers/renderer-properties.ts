/**
 * Renderer 的配置基类。
 *
 * 等价于 Niagara 的 UNiagaraRendererProperties——保存渲染相关参数
 * （材质、绑定、排序等），由编辑期数据驱动，运行时构造对应 Renderer。
 *
 * Phase 1 只定义基类与最小公共字段（enabled、material slot 名）。
 * 具体 Sprite/Mesh/Ribbon 的字段在各自 Phase 实现里加。
 */
export abstract class ProRendererProperties {
  enabled = true;
  rendererName = '';
}
