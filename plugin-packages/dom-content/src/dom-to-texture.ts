/**
 * DOM → Texture 转换工具
 * 通过 SVG foreignObject 将 HTML/CSS 渲染为 Image
 * 安全性依赖 <img> 沙箱机制，禁止改为 iframe/object/embed 加载
 */

import type { MaskableGraphic } from '@galacean/effects';
import { logger } from '@galacean/effects';

/**
 * 将 HTML 字符串渲染为 HTMLImageElement
 * @param html - HTML 字符串（CSS 需内联，图片需 base64）
 * @param width - 渲染宽度（CSS 像素）
 * @param height - 渲染高度（CSS 像素）
 * @param scale - 缩放倍率，默认为 1
 */
export function renderDOMToImage (
  html: string,
  width: number,
  height: number,
  scale = 1,
): Promise<HTMLImageElement> {
  const svg = buildSVG(html, width, height, scale);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return loadImage(dataUrl);
}

/**
 * 构建包含 foreignObject 的 SVG 字符串
 */
function buildSVG (html: string, width: number, height: number, scale: number): string {
  const svgWidth = width * scale;
  const svgHeight = height * scale;

  // 转义可能破坏 SVG 结构的标签
  let safeHtml = sanitizeSVGContent(html);

  // 为内嵌 <svg> 标签自动注入 xmlns（XML 模式下 foreignObject 内的子元素
  // 继承 XHTML 命名空间，缺少 xmlns 的 <svg> 不会被识别为 SVG 元素）
  safeHtml = injectSVGNamespace(safeHtml);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">` +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${safeHtml}</div>` +
    '</foreignObject>' +
    '</svg>'
  );
}

/**
 * 转义 HTML 中可能破坏外层 SVG 结构或带来安全风险的标签
 * - foreignObject：防止提前关闭外层 foreignObject 导致结构破坏
 * - script：虽然 <img> 沙箱机制会阻止脚本执行，但转义可避免 SVG 解析异常并增强防御深度
 *
 * 注意：不转义 <svg> 标签。在 foreignObject 的 XHTML 命名空间中，内嵌 <svg> 是合法的，
 * XML 解析器通过嵌套层级匹配开闭标签，不会与外层 <svg> 冲突。
 */
export function sanitizeSVGContent (html: string): string {
  return html
    .replace(/<\/?foreignObject(?=[\s>/]|$)/gi, match => match.replace(/</g, '&lt;'))
    .replace(/<\/?script(?=[\s>/]|$)/gi, match => match.replace(/</g, '&lt;'));
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 为 HTML 中缺少 xmlns 的 `<svg` 开标签自动注入 `xmlns="http://www.w3.org/2000/svg"`
 *
 * 在 XML 解析模式下（data:image/svg+xml），foreignObject 内的 XHTML 命名空间会被子元素继承，
 * 导致没有 xmlns 的 `<svg>` 被当作 XHTML 元素而非 SVG 元素，图形不会渲染。
 * 此函数自动补全 xmlns，使用户无需关心这一细节。
 */
function injectSVGNamespace (html: string): string {
  return html.replace(/<svg(?=[\s>])/gi, (match, offset) => {
    // 检查该 <svg 标签后面的属性中是否已包含 xmlns
    const rest = html.slice(offset);
    const tagEnd = rest.indexOf('>');

    if (tagEnd === -1) { return match; }

    const tagContent = rest.slice(0, tagEnd);

    if (/\bxmlns\s*=/i.test(tagContent)) { return match; }

    return `${match} xmlns="${SVG_NS}"`;
  });
}

/**
 * 匹配 <img> 标签中 src 属性值的正则
 * 支持双引号、单引号两种写法，大小写不敏感
 */
const IMG_SRC_REGEX = /<img\s[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;

/**
 * 解析 HTML 中 `<img>` 标签的外部 src URL，自动 fetch 并转为 base64 data URL 内联
 *
 * SVG foreignObject 不允许加载外部资源，因此需要在渲染前将图片转为 base64 内联。
 * 此函数会自动跳过已经是 `data:` 或 `blob:` 协议的 src。
 * 所有图片并发下载；单张图片下载失败时保留原始 URL 并打印 warning，不中断整体流程。
 *
 * @param html - 包含 `<img>` 标签的 HTML 字符串
 * @returns 所有外部图片 src 已替换为 base64 data URL 的 HTML 字符串
 */
export async function inlineImageSources (html: string): Promise<string> {
  // 收集所有需要下载的外部 URL（去重）
  const urlSet = new Set<string>();
  let match: RegExpExecArray | null;

  // 重置 lastIndex（全局正则复用安全）
  IMG_SRC_REGEX.lastIndex = 0;
  while ((match = IMG_SRC_REGEX.exec(html)) !== null) {
    const url = match[1] ?? match[2];

    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
      urlSet.add(url);
    }
  }

  if (urlSet.size === 0) {
    return html;
  }

  // 并发下载所有图片并转为 base64
  const urlToBase64 = new Map<string, string>();
  const tasks = [...urlSet].map(async url => {
    try {
      const base64 = await fetchAsBase64(url);

      urlToBase64.set(url, base64);
    } catch (e) {
      logger.warn(`inlineImageSources: Failed to fetch "${url}", keeping original URL.`, e);
    }
  });

  await Promise.all(tasks);

  // 替换 HTML 中的 URL
  let result = html;

  for (const [url, base64] of urlToBase64) {
    // 全局替换该 URL（同一张图可能出现多次）
    result = result.split(url).join(base64);
  }

  return result;
}

/**
 * 下载 URL 资源并转为 base64 data URL
 */
async function fetchAsBase64 (url: string): Promise<string> {
  // eslint-disable-next-line compat/compat -- dom-content 插件仅支持 Web 平台，fetch 在目标浏览器中均可用
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => { resolve(reader.result as string); };
    reader.onerror = () => { reject(new Error('FileReader failed to read blob as data URL.')); };
    reader.readAsDataURL(blob);
  });
}

/** 图片加载超时时间（毫秒） */
const LOAD_IMAGE_TIMEOUT = 10000;

/**
 * 加载 data URL 为 Image 对象
 */
function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) { return; }
      settled = true;
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error(`DOM to image failed: loading timed out after ${LOAD_IMAGE_TIMEOUT}ms.`));
    }, LOAD_IMAGE_TIMEOUT);

    img.onload = () => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(img);
    };
    img.onerror = () => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      reject(new Error('DOM to image failed: SVG data URL could not be loaded as image.'));
    };
    img.src = url;
  });
}

/**
 * 将 HTML 渲染为纹理并替换已有渲染组件（如 SpriteComponent）的纹理
 *
 * 适用于场景中已有占位图的情况，一步完成 HTML → Image → Canvas → Blob → setTexture 的完整流程。
 * @param component - 目标渲染组件（SpriteComponent 等 MaskableGraphic 子类）
 * @param html - HTML 字符串（CSS 需内联，图片需 base64）
 * @param width - 渲染宽度（CSS 像素）
 * @param height - 渲染高度（CSS 像素）
 * @param scale - 缩放倍率，用于高清屏适配，默认为 1
 */
export async function replaceSpriteTexture (
  component: MaskableGraphic,
  html: string,
  width: number,
  height: number,
  scale = 1,
): Promise<void> {
  const image = await renderDOMToImage(html, width, height, scale);
  const texWidth = Math.round(width * scale);
  const texHeight = Math.round(height * scale);
  const canvas = document.createElement('canvas');

  canvas.width = texWidth;
  canvas.height = texHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('replaceSpriteTexture: Failed to get canvas 2d context.');
  }
  ctx.drawImage(image, 0, 0, texWidth, texHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => {
      if (b) { resolve(b); } else { reject(new Error('replaceSpriteTexture: canvas.toBlob failed.')); }
    }, 'image/png');
  });
  const url = URL.createObjectURL(blob);

  try {
    await component.setTexture(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
