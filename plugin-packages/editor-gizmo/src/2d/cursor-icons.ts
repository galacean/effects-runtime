/**
 * 光标图标映射与按需加载：定义 GestureCursorType 到 cursor 描述符的映射，
 * svg 类型在加载后就地填充 content。
 */
import { Downloader } from '@galacean/effects';
import type { GestureCursorType } from './cursor';

const assetsPrefix = 'https://mdn.alipayobjects.com/rms/uri/file/as/0.0.6';

export const cursorMap: Record<GestureCursorType, { type: 'svg' | 'preset', content: string, url?: string }> = {
  normal: { type: 'preset', content: 'default' },
  rotation: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-rotate-32.svg` },
  circle: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-rotate-32.svg` },
  scale: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-scale-32.svg` },
  hand: { type: 'preset', content: 'grab' },
  pointer: { type: 'preset', content: 'pointer' },
  text: { type: 'preset', content: 'text' },
  'text-create': { type: 'preset', content: 'text' },
  'active-hand': { type: 'preset', content: 'grabbing' },
  'frame-create': { type: 'preset', content: 'crosshair' },
  'box-select': { type: 'preset', content: 'crosshair' },
  'text-rotation': { type: 'svg', content: 'default', url: 'https://mdn.alipayobjects.com/huamei_ixsp8m/afts/img/A*R722QoloC44AAAAAKkAAAAgAev-aAQ/original' },
};

/** 加载并缓存所有 SVG 光标资源。 */
export async function loadCursorIcons () {
  const downloader = new Downloader();
  const cursorIconLoaders = (Object.keys(cursorMap) as GestureCursorType[])
    .filter(key => Boolean(cursorMap[key].url))
    .map(key => new Promise<string>((resolve, reject) => {
      downloader.downloadText(cursorMap[key].url!, resolve, (status, message) => {
        reject(new Error(`Failed to load cursor icon (${status}): ${message}`));
      });
    }).then(text => cursorMap[key] = { ...cursorMap[key], content: text }));

  await Promise.all(cursorIconLoaders).catch((e: unknown) => {
    console.error(e);
  });
}
