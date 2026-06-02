import { Plugin } from '@galacean/effects';

/**
 * DOM Content 插件 Loader
 * 当前为空壳实现，组件在运行时由开发手动挂载，无需 JSON 数据解析
 */
export class DomContentLoader extends Plugin {
  override name = 'dom-content';
}
