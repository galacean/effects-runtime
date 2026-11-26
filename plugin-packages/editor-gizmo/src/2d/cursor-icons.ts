/**
 * 光标图标映射与按需加载：定义 GestureCursorType 到 cursor 描述符的映射，
 * svg 类型在加载后就地填充 content。
 */
import { Downloader } from '@galacean/effects';
import type { GestureCursorType } from './cursor';

const assetsPrefix = 'https://mdn.alipayobjects.com/rms/uri/file/as/0.0.6';
const pencilPath = 'M3 17V13.5Q3 13 3.5 12.5L13 3a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L7.5 16.5Q7 17 6.5 17Z';
const pencilCursor = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="miter"><defs><filter id="pencilShadow" x="0" y="0" width="24" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"/><feOffset dx="1" dy="1"/><feGaussianBlur stdDeviation=".5"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .5 0" result="shadow"/><feBlend in="SourceGraphic" in2="shadow" mode="normal"/></filter></defs><g filter="url(#pencilShadow)"><path d="${pencilPath}" fill="white" stroke="white" stroke-width="4"/><path d="${pencilPath}" fill="white" stroke="#151515" stroke-width="2"/><path d="M12 4l4 4" fill="none" stroke="#151515" stroke-width="1"/></g></svg>`);
const penOutline = 'M3.8 2.25C7.6 2.25 12.5 2.9 14.6 5.4C15.6 6.5 15.85 8.1 15.75 9.5Q15.7 9.9 16.2 10.4L16.9 11.4Q17.4 11.9 16.8 12.5L12.4 16.6Q11.9 17.1 11.4 16.6L10.4 15.75C7.6 16.1 6 15.25 4.6 13.4C3.1 11.1 2.5 7.5 2.25 3.8Q2.2 3.5 2.4 3.25L3.15 3.15L3.25 2.4Q3.5 2.2 3.8 2.25Z';
// 热点 (2, 2) 位于笔头左上落点，笔缝连接圆孔。
const penCursor = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><defs><filter id="penShadow" x="0" y="0" width="24" height="24" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="1" stdDeviation=".65" flood-color="black" flood-opacity=".3"/></filter></defs><g filter="url(#penShadow)"><path d="${penOutline}" fill="white" stroke="white" stroke-width="2.875"/><g stroke="black" stroke-width=".875"><path d="${penOutline}" fill="white"/><path d="M3.15 3.15 8.2 8.1" stroke-linecap="butt" fill="none"/><circle cx="9.75" cy="9.625" r="2.2" fill="white"/></g></g></svg>`);

export const cursorMap: Record<GestureCursorType, { type: 'svg' | 'preset', content: string, url?: string }> = {
  normal: { type: 'preset', content: 'default' },
  pencil: { type: 'preset', content: `url("data:image/svg+xml,${pencilCursor}") 3 17, default` },
  pen: { type: 'preset', content: `url("data:image/svg+xml,${penCursor}") 2 2, crosshair` },
  rotation: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-rotate-32.svg` },
  circle: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-rotate-32.svg` },
  scale: { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-scale-32.svg` },
  'horizontal-arrow': { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-move-h-32.svg` },
  'vertical-arrow': { type: 'svg', content: 'default', url: `${assetsPrefix}/icons/cursor-move-v-32.svg` },
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
