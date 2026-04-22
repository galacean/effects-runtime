/** DOM → Texture 转换工具，通过 SVG foreignObject 将 HTML/CSS 渲染为 Image */

import { logger } from '@galacean/effects';

export interface RenderOptions {
  /** 自动内联 @font-face 外部字体，默认 true */
  inlineFonts?: boolean,
  /** 自动内联外部图片/资源 URL，默认 true */
  inlineImages?: boolean,
  /** 自动从宿主文档提取 CSS url(#id) 引用的 SVG 定义，默认 true */
  extractDefs?: boolean,
}

const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  inlineFonts: true,
  inlineImages: true,
  extractDefs: true,
};

const SVG_DEF_TAGS = new Set(['filter', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'pattern', 'marker']);
const IMG_SRC_REGEX = /<img\s[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
const EXTRA_SRC_REGEX = /<(?:video|source|input|audio)\s[^>]*?\b(?:src|poster)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
const CSS_URL_REGEX = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)"']+))\s*\)/gi;
const FONT_FACE_REGEX = /@font-face\s*\{[^}]*\}/gi;
const FONT_URL_REGEX = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)"']+))\s*\)/gi;
const CSS_SVG_REF_REGEX = /url\(\s*(?:"|')?#([a-zA-Z][\w.-]*)(?:"|')?\s*\)/g;
const INLINE_SVG_REGEX = /<svg[\s>][\s\S]*?<\/svg\s*>/gi;
const isInlineUrl = (url: string) => url.startsWith('data:') || url.startsWith('blob:');

/** 将 HTML 渲染为 Image 对象，默认自动执行内联字体/图片/提取 SVG 定义 */
export async function renderDOMToImage (
  html: string,
  width: number,
  height: number,
  scale = 1,
  options?: RenderOptions,
): Promise<HTMLImageElement> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale)
    || width <= 0 || height <= 0 || scale <= 0) {
    throw new Error('renderDOMToImage: width, height and scale must be positive finite numbers.');
  }

  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  let processedHtml = html;

  if (opts.inlineFonts) { processedHtml = await inlineFontSources(processedHtml); }
  if (opts.inlineImages) { processedHtml = await inlineImageSources(processedHtml); }

  const svgDefs = opts.extractDefs ? extractSVGDefs(processedHtml) : '';
  const svgWidth = width * scale;
  const svgHeight = height * scale;
  const safeHtml = injectSVGNamespace(sanitizeSVGContent(processedHtml));
  const defsBlock = svgDefs ? `<defs>${svgDefs}</defs>` : '';
  const svg = (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">` +
    defsBlock +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${safeHtml}</div>` +
    '</foreignObject></svg>'
  );

  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

/** 清理 HTML：转义危险标签，移除事件处理器和 javascript: 协议 */
export function sanitizeSVGContent (html: string): string {
  let result = html.replace(
    /<\/?(foreignObject|script|iframe|object|embed|link|base|meta)(?:\s[^>]*)?>/gi,
    match => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );

  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  result = result.replace(/(href|src|action|formaction)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');

  return result;
}

/** 为缺少 xmlns 的内嵌 <svg> 自动注入命名空间 */
function injectSVGNamespace (html: string): string {
  return html.replace(/<svg(?=[\s>])/gi, (match, offset) => {
    const rest = html.slice(offset);
    const tagEnd = rest.indexOf('>');

    if (tagEnd === -1 || /\bxmlns\s*=/i.test(rest.slice(0, tagEnd))) { return match; }

    return `${match} xmlns="http://www.w3.org/2000/svg"`;
  });
}

/** 将 HTML 中外部资源 URL 转为 base64 内联，失败时保留原 URL */
export async function inlineImageSources (html: string): Promise<string> {
  const urlSet = new Set<string>();
  let match: RegExpExecArray | null;

  IMG_SRC_REGEX.lastIndex = 0;
  while ((match = IMG_SRC_REGEX.exec(html)) !== null) {
    const url = match[1] ?? match[2];

    if (url && !isInlineUrl(url)) { urlSet.add(url); }
  }

  EXTRA_SRC_REGEX.lastIndex = 0;
  while ((match = EXTRA_SRC_REGEX.exec(html)) !== null) {
    const url = match[1] ?? match[2];

    if (url && !isInlineUrl(url)) { urlSet.add(url); }
  }

  CSS_URL_REGEX.lastIndex = 0;
  while ((match = CSS_URL_REGEX.exec(html)) !== null) {
    const url = match[1] ?? match[2] ?? match[3];

    if (url && !isInlineUrl(url) && !url.startsWith('#')) { urlSet.add(url); }
  }

  if (urlSet.size === 0) { return html; }

  const urlToBase64 = new Map<string, string>();

  await Promise.all([...urlSet].map(async url => {
    try { urlToBase64.set(url, await fetchAsBase64(url)); } catch (e) { logger.warn(`inlineImageSources: Failed to fetch "${url}".`, e); }
  }));

  return replaceUrls(html, urlToBase64);
}

/** 将 @font-face 中的外部字体 URL 转为 base64 内联 */
export async function inlineFontSources (html: string): Promise<string> {
  const urlSet = new Set<string>();

  FONT_FACE_REGEX.lastIndex = 0;
  let faceMatch: RegExpExecArray | null;

  while ((faceMatch = FONT_FACE_REGEX.exec(html)) !== null) {
    FONT_URL_REGEX.lastIndex = 0;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = FONT_URL_REGEX.exec(faceMatch[0])) !== null) {
      const url = urlMatch[1] ?? urlMatch[2] ?? urlMatch[3];

      if (url && !isInlineUrl(url)) { urlSet.add(url); }
    }
  }

  if (urlSet.size === 0) { return html; }

  const urlToBase64 = new Map<string, string>();

  await Promise.all([...urlSet].map(async url => {
    try { urlToBase64.set(url, await fetchAsBase64(url)); } catch (e) { logger.warn(`inlineFontSources: Failed to fetch font "${url}".`, e); }
  }));

  return replaceUrls(html, urlToBase64);
}

/** 替换 URL 为 base64 */
function replaceUrls (html: string, urlToBase64: Map<string, string>): string {
  let result = html;

  for (const [url, base64] of urlToBase64) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    result = result.replace(
      new RegExp(`(<(?:img|video|source|input|audio)\\s[^>]*?\\b(?:src|poster)\\s*=\\s*(?:"|'))${escaped}((?:"|'))`, 'gi'),
      (_, p, s) => `${p}${base64}${s}`,
    );
    result = result.replace(
      new RegExp(`(url\\(\\s*(?:"|'))${escaped}((?:"|')\\s*\\))`, 'gi'),
      (_, p, s) => `${p}${base64}${s}`,
    );
    result = result.replace(
      new RegExp(`(url\\(\\s*)${escaped}(\\s*\\))`, 'gi'),
      (_, p, s) => `${p}${base64}${s}`,
    );
  }

  return result;
}

/** 从宿主文档提取 CSS url(#id) 引用的 SVG 定义，支持 filter/clipPath/mask/gradient/pattern/marker */
export function extractSVGDefs (html: string): string {
  if (typeof document === 'undefined') { return ''; }

  const htmlWithoutInlineSVG = html.replace(INLINE_SVG_REGEX, '');
  const ids = new Set<string>();

  CSS_SVG_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CSS_SVG_REF_REGEX.exec(htmlWithoutInlineSVG)) !== null) {
    ids.add(match[1]);
  }

  if (ids.size === 0) { return ''; }

  const serializer = new XMLSerializer();
  const parts: string[] = [];

  for (const id of ids) {
    const el = document.getElementById(id);

    if (!el) {
      logger.warn(`extractSVGDefs: #${id} not found.`);
      continue;
    }
    if (!SVG_DEF_TAGS.has(el.tagName.toLowerCase())) {
      logger.warn(`extractSVGDefs: #${id} is not a supported SVG def element.`);
      continue;
    }
    parts.push(serializer.serializeToString(el));
  }

  return parts.join('');
}

async function fetchAsBase64 (url: string): Promise<string> {
  // eslint-disable-next-line compat/compat -- Web 平台专用
  const res = await fetch(url);

  if (!res.ok) { throw new Error(`HTTP ${res.status} ${res.statusText}`); }
  const blob = await res.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => { resolve(reader.result as string); };
    reader.onerror = () => { reject(new Error('FileReader failed.')); };
    reader.readAsDataURL(blob);
  });
}

function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) { return; }
      settled = true;
      img.onload = img.onerror = null;
      reject(new Error('DOM to image failed: loading timed out after 10s.'));
    }, 10000);

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
      reject(new Error('DOM to image failed: SVG data URL could not be loaded.'));
    };
    img.src = url;
  });
}