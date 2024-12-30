export const RUNTIME_ENV = 'runtime_env';

export const RENDER_PREFER_LOOKUP_TEXTURE = 'lookup_texture';
// 文本元素使用 offscreen canvas 绘制
export const TEMPLATE_USE_OFFSCREEN_CANVAS = 'offscreen_canvas';
// 后处理配置相关
export const POST_PROCESS_SETTINGS = 'post_process_settings';

const config: Record<string, number | boolean | string | Record<string, any>> = {};

export function getConfig<T extends number | boolean | string | Record<string, any>> (name: string) {
  return config[name] as T;
}

export function setConfig<T extends number | boolean | string | Record<string, any>> (name: string, value: T) {
  return config[name] = value;
}
