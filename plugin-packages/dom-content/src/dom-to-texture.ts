/**
 * DOM → Texture 转换工具
 * 通过 SVG foreignObject 将 HTML/CSS 渲染为 Image，安全性依赖 <img> 沙箱机制。
 */

import type { MaskableGraphic } from '@galacean/effects';
import { logger } from '@galacean/effects';

/** 将 HTML 渲染为 Image 对象 */
export function renderDOMToImage (
  html: string,
  width: number,
  height: number,
  scale = 1,
): Promise<HTMLImageElement> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale)
    || width <= 0 || height <= 0 || scale <= 0) {
    throw new Error('renderDOMToImage: width, height and scale must be positive finite numbers.');
  }

  const svg = buildSVG(html, width, height, scale);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return loadImage(dataUrl);
}

/** 构建 SVG foreignObject 字符串 */
function buildSVG (html: string, width: number, height: number, scale: number): string {
  const svgWidth = width * scale;
  const svgHeight = height * scale;

  const safeHtml = injectSVGNamespace(sanitizeSVGContent(html));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">` +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${safeHtml}</div>` +
    '</foreignObject>' +
    '</svg>'
  );
}

/** 清理 HTML 内容，防止 XSS 攻击和 SVG 结构破坏 */
export function sanitizeSVGContent (html: string): string {
  // 转义危险标签：foreignObject, script, iframe, object, embed, link, base, meta, style
  let result = html.replace(
    /<\/?(foreignObject|script|iframe|object|embed|link|base|meta|style)(?:\s[^>]*)?>/gi,
    match => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );

  // 移除 on* 事件处理器和 javascript: 协议
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  result = result.replace(/(href|src|action|formaction)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');

  return result;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 为缺少 xmlns 的内嵌 <svg> 自动注入命名空间 */
function injectSVGNamespace (html: string): string {
  return html.replace(/<svg(?=[\s>])/gi, (match, offset) => {
    const rest = html.slice(offset);
    const tagEnd = rest.indexOf('>');

    if (tagEnd === -1) { return match; }
    if (/\bxmlns\s*=/i.test(rest.slice(0, tagEnd))) { return match; }

    return `${match} xmlns="${SVG_NS}"`;
  });
}

/** 匹配 <img src="..."> 或 <img src='...'> */
const IMG_SRC_REGEX = /<img\s[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;

/**
 * 将 HTML 中外部图片 URL 转为 base64 内联。
 * SVG foreignObject 不支持外部资源，需预先内联。
 * 失败的图片保留原 URL 并打印警告。
 */
export async function inlineImageSources (html: string): Promise<string> {
  const urlSet = new Set<string>();
  let match: RegExpExecArray | null;

  IMG_SRC_REGEX.lastIndex = 0;
  while ((match = IMG_SRC_REGEX.exec(html)) !== null) {
    const url = match[1] ?? match[2];

    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
      urlSet.add(url);
    }
  }

  if (urlSet.size === 0) { return html; }

  const urlToBase64 = new Map<string, string>();

  await Promise.all([...urlSet].map(async url => {
    try {
      urlToBase64.set(url, await fetchAsBase64(url));
    } catch (e) {
      logger.warn(`inlineImageSources: Failed to fetch "${url}", keeping original URL.`, e);
    }
  }));

  let result = html;

  for (const [url, base64] of urlToBase64) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    result = result.replace(
      new RegExp(`(<img\\s[^>]*?\\bsrc\\s*=\\s*(?:"|'))${escaped}((?:"|'))`, 'gi'),
      (_, prefix: string, suffix: string) => `${prefix}${base64}${suffix}`,
    );
  }

  return result;
}

/** 下载 URL 并转为 base64 data URL */
async function fetchAsBase64 (url: string): Promise<string> {
  // eslint-disable-next-line compat/compat -- Web 平台专用
  const res = await fetch(url);

  if (!res.ok) { throw new Error(`HTTP ${res.status} ${res.statusText}`); }
  const blob = await res.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => { resolve(reader.result as string); };
    reader.onerror = () => { reject(new Error('FileReader failed to read blob as data URL.')); };
    reader.readAsDataURL(blob);
  });
}

const LOAD_IMAGE_TIMEOUT = 10000;

/** 加载 data URL 为 Image 对象，支持超时和错误处理 */
function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) { return; }
      settled = true;
      img.onload = null;
      img.onerror = null;
      reject(new Error(`DOM to image failed: loading timed out after ${LOAD_IMAGE_TIMEOUT}ms.`));
    }, LOAD_IMAGE_TIMEOUT);

    img.onload = () => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      reject(new Error('DOM to image failed: SVG data URL could not be loaded as image.'));
    };
    img.src = url;
  });
}

/** 将 HTML 渲染为纹理并替换 SpriteComponent 等组件的纹理 */
export async function replaceSpriteTexture (
  component: MaskableGraphic,
  html: string,
  width: number,
  height: number,
  scale = 1,
): Promise<void> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale)
    || width <= 0 || height <= 0 || scale <= 0) {
    throw new Error('replaceSpriteTexture: width, height and scale must be positive finite numbers.');
  }

  const texWidth = Math.round(width * scale);
  const texHeight = Math.round(height * scale);

  if (texWidth <= 0 || texHeight <= 0) {
    throw new Error('replaceSpriteTexture: width * scale and height * scale must produce positive texture dimensions.');
  }

  const image = await renderDOMToImage(html, width, height, scale);
  const canvas = document.createElement('canvas');

  canvas.width = texWidth;
  canvas.height = texHeight;

  const ctx = canvas.getContext('2d');

  if (!ctx) { throw new Error('replaceSpriteTexture: Failed to get canvas 2d context.'); }
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
