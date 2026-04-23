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

/** 安全提取 @font-face 块，避免 ReDoS 正则回溯问题 */
function extractFontFaces (html: string): string[] {
  const faces: string[] = [];
  const regex = /@font-face\s*\{/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const start = match.index + match[0].length;
    // 从匹配位置往后找匹配的 }，最多检查 8000 字符
    let braceCount = 1;
    let end = start;

    for (; end < html.length && end < start + 8000; end++) {
      if (html[end] === '{') { braceCount++; } else if (html[end] === '}') {
        braceCount--;
        if (braceCount === 0) { break; }
      }
    }
    faces.push(html.slice(match.index, end + 1));
    // 继续搜索时需要将 lastIndex 设置到 end 之后
    regex.lastIndex = end + 1;
  }

  return faces;
}
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
    || width <= 0 || height <= 0 || scale < 0) {
    throw new Error('renderDOMToImage: width and height must be positive, scale must be non-negative.');
  }

  // scale 为 0 时返回空结果，与 width/height=0 行为保持一致
  if (scale === 0) {
    logger.warn('renderDOMToImage: scale is 0, skipping render.');

    return loadImage('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  }

  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };

  // 先清理危险标记，再内联资源，避免从不安全标记中发现/获取 URL
  let processedHtml = sanitizeSVGContent(html);

  if (opts.inlineFonts) { processedHtml = await inlineFontSources(processedHtml); }
  if (opts.inlineImages) { processedHtml = await inlineImageSources(processedHtml); }

  const svgDefs = opts.extractDefs ? extractSVGDefs(processedHtml) : '';
  const svgWidth = width * scale;
  const svgHeight = height * scale;

  // 将 HTML 转为合规 XHTML，避免未闭合的 void 标签和未转义实体导致 SVG/XML 解析失败
  const xhtmlSafeHtml = convertToXHTML(injectSVGNamespace(processedHtml));
  const defsBlock = svgDefs ? `<defs>${svgDefs}</defs>` : '';
  const svg = (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">` +
    defsBlock +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    xhtmlSafeHtml +
    '</foreignObject></svg>'
  );

  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

/** 危险标签：转义而非移除，保留内容以防布局错位。支持跨行标签 */
const DANGEROUS_TAGS = /<\/?(foreignObject|script|iframe|object|embed|link|base|meta|template|noscript)(?:\s[^>]*)?>/gi;

/** 事件处理器属性：匹配 on* 属性并移除。支持跨行属性值 */
const EVENT_HANDLER_ATTR = /(?:^|[\s"'])on\w+\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^"'\s>]+)/gi;

/** URL 属性匹配：捕获属性名和属性值 */
const URL_ATTR_REGEX = /\b(href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]*))/gi;

/** 不允许的协议列表 */
const DISALLOWED_PROTOCOLS = ['javascript', 'vbscript'];

/** data: URL 中允许的安全 MIME 类型前缀 */
const SAFE_DATA_PREFIXES = ['data:image/', 'data:font/', 'data:application/font', 'data:application/x-font'];

/**
 * 规范化 URL 属性值：解码 HTML 实体和百分号编码，
 * 移除控制字符和空白，转小写后检查是否包含危险协议
 */
function normalizeUrlAttr (value: string): string {
  let normalized = value;

  // 解码 HTML 实体（数字和命名）
  normalized = normalized.replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  normalized = normalized.replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  normalized = normalized.replace(/&(amp|lt|gt|quot|apos);/gi, (match, name) => {
    const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };

    return map[name.toLowerCase()] ?? match;
  });

  // 解码百分号编码
  try { normalized = decodeURIComponent(normalized); } catch { /* 忽略无效编码 */ }

  // 移除控制字符（U+0000-U+001F, U+007F）和空白
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/[\u0000-\u001f\u007f\s]+/g, '');

  // 转小写
  normalized = normalized.toLowerCase();

  // 去除前导非字母字符（如 / 或 \）
  normalized = normalized.replace(/^[^a-z]+/, '');

  return normalized;
}

/** 检查规范化后的 URL 是否使用了危险协议 */
function isDangerousUrl (value: string): boolean {
  const normalized = normalizeUrlAttr(value);

  // 检查 javascript:/vbscript: 等明确危险协议
  if (DISALLOWED_PROTOCOLS.some(proto => normalized.startsWith(`${proto}:`))) {
    return true;
  }

  // 检查 data: URL —— 仅允许安全的 MIME 类型（image/font），其余视为危险
  if (normalized.startsWith('data:')) {
    return !SAFE_DATA_PREFIXES.some(prefix => normalized.startsWith(prefix));
  }

  return false;
}

/** 清理 HTML：转义危险标签，移除事件处理器和危险协议 URL 属性 */
export function sanitizeSVGContent (html: string): string {
  let result = html.replace(
    DANGEROUS_TAGS,
    match => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );

  let previous: string;

  do {
    previous = result;
    result = result.replace(EVENT_HANDLER_ATTR, '');
  } while (result !== previous);

  // 统一处理危险协议：原子化移除整个属性（包括编码/混淆的变体）
  result = result.replace(URL_ATTR_REGEX, (match, _attr, dq, sq, uq) => {
    const value = dq ?? sq ?? uq ?? '';

    if (isDangerousUrl(value)) { return ''; }

    return match;
  });

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

/**
 * 将 HTML 字符串转为合规 XHTML，确保 void 标签被正确闭合、实体被转义，
 * 使其可安全嵌入 SVG foreignObject（image/svg+xml 要求严格 XML 格式）
 */
function convertToXHTML (html: string): string {
  if (typeof document === 'undefined') {
    // 非浏览器环境回退：手动闭合常见 void 标签
    return `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`;
  }

  const doc = document.implementation.createHTMLDocument('');
  const container = doc.createElement('div');

  container.innerHTML = html;
  container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  return new XMLSerializer().serializeToString(container);
}

/**
 * 从 HTML 中提取 CSS 上下文的 URL：仅扫描 <style> 元素的 textContent 和元素的 style 属性，
 * 避免从普通文本/注释中误提取 URL。在无 DOMParser 环境下回退到正则但限制扫描范围。
 */
function collectCssUrls (html: string, urlSet: Set<string>): void {
  const cssTexts: string[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      // 使用 inert document 解析，避免触发资源加载
      const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, 'text/html');

      doc.querySelectorAll('style').forEach(styleEl => {
        if (styleEl.textContent) { cssTexts.push(styleEl.textContent); }
      });
      doc.querySelectorAll('[style]').forEach(el => {
        const styleAttr = el.getAttribute('style');

        if (styleAttr) { cssTexts.push(styleAttr); }
      });
    } catch {
      /* 解析失败则回退到下方正则扫描 */
    }
  }

  // 回退路径：仅匹配 <style>...</style> 块和 style="..." 属性，缩小扫描范围
  if (cssTexts.length === 0) {
    const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
    const styleAttrRegex = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    let m: RegExpExecArray | null;

    while ((m = styleBlockRegex.exec(html)) !== null) {
      if (m[1]) { cssTexts.push(m[1]); }
    }
    while ((m = styleAttrRegex.exec(html)) !== null) {
      const text = m[1] ?? m[2];

      if (text) { cssTexts.push(text); }
    }
  }

  for (const text of cssTexts) {
    CSS_URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CSS_URL_REGEX.exec(text)) !== null) {
      const url = match[1] ?? match[2] ?? match[3];

      if (url && !isInlineUrl(url) && !url.startsWith('#')) { urlSet.add(url); }
    }
  }
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

  // 仅扫描真正的 CSS 上下文（<style> 内容和 style 属性），避免从文本/注释中误提取 URL
  collectCssUrls(html, urlSet);

  if (urlSet.size === 0) { return html; }

  const urlToBase64 = new Map<string, string>();
  const urls = [...urlSet].slice(0, MAX_URLS);

  if (urlSet.size > MAX_URLS) {
    logger.warn(`inlineImageSources: URL count (${urlSet.size}) exceeds limit (${MAX_URLS}), only processing first ${MAX_URLS}.`);
  }

  await promisePool(urls.map(url => async () => {
    try { urlToBase64.set(url, await fetchAsBase64(url)); } catch (e) { logger.warn(`inlineImageSources: Failed to fetch "${url}".`, e); }
  }), MAX_FETCH_CONCURRENCY);

  return replaceUrls(html, urlToBase64);
}

/** 将 @font-face 中的外部字体 URL 转为 base64 内联 */
export async function inlineFontSources (html: string): Promise<string> {
  const urlSet = new Set<string>();

  // 使用安全的逐字符解析代替正则
  const fontFaces = extractFontFaces(html);

  for (const face of fontFaces) {
    FONT_URL_REGEX.lastIndex = 0;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = FONT_URL_REGEX.exec(face)) !== null) {
      const url = urlMatch[1] ?? urlMatch[2] ?? urlMatch[3];

      if (url && !isInlineUrl(url)) { urlSet.add(url); }
    }
  }

  if (urlSet.size === 0) { return html; }

  const urlToBase64 = new Map<string, string>();
  const urls = [...urlSet].slice(0, MAX_URLS);

  if (urlSet.size > MAX_URLS) {
    logger.warn(`inlineFontSources: URL count (${urlSet.size}) exceeds limit (${MAX_URLS}), only processing first ${MAX_URLS}.`);
  }

  await promisePool(urls.map(url => async () => {
    try { urlToBase64.set(url, await fetchAsBase64(url)); } catch (e) { logger.warn(`inlineFontSources: Failed to fetch font "${url}".`, e); }
  }), MAX_FETCH_CONCURRENCY);

  return replaceUrls(html, urlToBase64);
}

/** 替换 URL 为 base64：使用通用捕获组精确匹配 URL，通过 Map 查找进行大小写敏感替换 */
function replaceUrls (html: string, urlToBase64: Map<string, string>): string {
  let result = html;

  // 替换 <img>/<video>/<source>/<input>/<audio> 的 src/poster 属性
  result = result.replace(
    /(<(?:img|video|source|input|audio)\s[^>]*?\b(?:src|poster)\s*=\s*(?:"|'))([^"']*)((?:"|'))/gi,
    (match, prefix, url, suffix) => {
      const base64 = urlToBase64.get(url);

      return base64 ? `${prefix}${base64}${suffix}` : match;
    },
  );

  // 替换 CSS url() 中带引号的 URL
  result = result.replace(
    /(url\(\s*(?:"|'))([^"']*)((?:"|')\s*\))/g,
    (match, prefix, url, suffix) => {
      const base64 = urlToBase64.get(url);

      return base64 ? `${prefix}${base64}${suffix}` : match;
    },
  );

  // 替换 CSS url() 中不带引号的 URL
  result = result.replace(
    /(url\(\s*)([^\s)"']+)(\s*\))/g,
    (match, prefix, url, suffix) => {
      const base64 = urlToBase64.get(url);

      return base64 ? `${prefix}${base64}${suffix}` : match;
    },
  );

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

const FETCH_TIMEOUT_MS = 10000; // 10秒超时
const MAX_FETCH_CONCURRENCY = 6; // 最大并发获取数
const MAX_RESOURCE_BYTES = 10 * 1024 * 1024; // 单个资源最大 10MB
const MAX_URLS = 100; // 单次内联处理的最大 URL 数量

/** 有界并发执行异步任务 */
async function promisePool<T> (tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker (): Promise<void> {
    while (index < tasks.length) {
      const i = index++;

      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());

  await Promise.all(workers);

  return results;
}

async function fetchAsBase64 (url: string): Promise<string> {
  // eslint-disable-next-line compat/compat -- Web 平台专用
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);

  try {
    // eslint-disable-next-line compat/compat -- Web 平台专用
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) { throw new Error(`HTTP ${res.status} ${res.statusText}`); }

    // 检查 Content-Length 头，如果声明的大小超过限制则提前拒绝
    const contentLength = res.headers.get('Content-Length');

    if (contentLength && parseInt(contentLength, 10) > MAX_RESOURCE_BYTES) {
      throw new Error(`fetchAsBase64: Resource "${url}" exceeds max size (${MAX_RESOURCE_BYTES} bytes), Content-Length: ${contentLength}.`);
    }

    // 流式读取响应体，边读边累积字节大小，超限则中止
    const blob = await readBlobWithLimit(res, url, MAX_RESOURCE_BYTES, controller);

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => { resolve(reader.result as string); };
      reader.onerror = () => { reject(new Error('FileReader failed.')); };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`fetchAsBase64: Request to "${url}" timed out or aborted after ${FETCH_TIMEOUT_MS}ms.`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 流式读取 Response body，累积字节超过 maxBytes 时立即中止读取并抛出错误，
 * 避免缓冲未知长度的完整响应。如果环境不支持 ReadableStream 则回退到 blob()。
 */
async function readBlobWithLimit (
  res: Response,
  url: string,
  maxBytes: number,
  controller: AbortController,
): Promise<Blob> {
  const contentType = res.headers.get('Content-Type') ?? '';

  // 不支持流式读取时回退到 blob()，仍做一次大小校验
  if (!res.body || typeof res.body.getReader !== 'function') {
    const blob = await res.blob();

    if (blob.size > maxBytes) {
      throw new Error(`fetchAsBase64: Resource "${url}" exceeds max size (${maxBytes} bytes), actual: ${blob.size}.`);
    }

    return blob;
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let total = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) { break; }
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          controller.abort();
          throw new Error(`fetchAsBase64: Resource "${url}" exceeds max size (${maxBytes} bytes) while streaming.`);
        }
        // 复制到独立的 ArrayBuffer，规避 ReadableStream 返回的 Uint8Array<ArrayBufferLike> 与 BlobPart 的类型不兼容
        const copy = new Uint8Array(value.byteLength);

        copy.set(value);
        chunks.push(copy.buffer);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* 忽略已释放的情况 */ }
  }

  return new Blob(chunks, contentType ? { type: contentType } : undefined);
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