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
const IMG_TAG_NAMES = new Set(['img']);
const MEDIA_TAG_NAMES = new Set(['video', 'source', 'input', 'audio']);
const CSS_URL_REGEX = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)"']+))\s*\)/gi;

/**
 * 安全提取 HTML 中指定标签名的指定属性值，使用字符级扫描避免 ReDoS。
 * 仅扫描 `<tagName` 后的属性区域，不依赖回溯正则。
 * tagNames 为 null 时匹配任意标签。
 */
function extractTagAttributes (
  html: string,
  tagNames: Set<string> | null,
  attrNames: string[],
  out: Set<string>,
): void {
  let i = 0;
  const len = html.length;

  while (i < len) {
    const lt = html.indexOf('<', i);

    if (lt === -1) { break; }
    const next = html.charCodeAt(lt + 1);
    const isLetter = (next >= 65 && next <= 90) || (next >= 97 && next <= 122);

    if (!isLetter) { i = lt + 1; continue; }

    let nameEnd = lt + 1;

    while (nameEnd < len) {
      const c = html.charCodeAt(nameEnd);

      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62) { break; }
      nameEnd++;
    }
    const tagName = html.slice(lt + 1, nameEnd).toLowerCase();

    if (tagNames !== null && !tagNames.has(tagName)) { i = nameEnd; continue; }

    // 找到本标签的结束 '>'，在引号内的 '>' 不算，避免 style="background:url(>)" 这类干扰
    const tagLimit = Math.min(len, nameEnd + 16000);
    let tagEnd = -1;
    let inDq = false;
    let inSq = false;

    for (let p = nameEnd; p < tagLimit; p++) {
      const c = html.charCodeAt(p);

      if (c === 34 && !inSq) { inDq = !inDq; } else if (c === 39 && !inDq) { inSq = !inSq; } else if (c === 62 && !inDq && !inSq) {
        tagEnd = p;

        break;
      }
    }
    if (tagEnd === -1) { i = nameEnd; continue; }

    const attrSection = html.slice(nameEnd, tagEnd);

    for (const attrName of attrNames) {
      extractAttrValueFromSection(attrSection, attrName, out);
    }

    i = tagEnd + 1;
  }
}

/**
 * 字符级扫描提取所有 <style>...</style> 块的 textContent。
 * 完全不使用回溯正则，最坏线性时间。
 */
function extractStyleBlocks (html: string, out: string[]): void {
  const lower = html.toLowerCase();
  let i = 0;
  const len = html.length;

  while (i < len) {
    const start = lower.indexOf('<style', i);

    if (start === -1) { break; }
    const after = lower.charCodeAt(start + 6);
    const isStyleTag = after === 32 || after === 9 || after === 10 || after === 13 || after === 62 || after === 47;

    if (!isStyleTag) { i = start + 6; continue; }

    // 跳过开标签到 '>' 结束
    const openEnd = lower.indexOf('>', start + 6);

    if (openEnd === -1) { break; }
    const contentStart = openEnd + 1;
    const closeStart = lower.indexOf('</style', contentStart);

    if (closeStart === -1) { break; }
    out.push(html.slice(contentStart, closeStart));
    const closeEnd = lower.indexOf('>', closeStart);

    if (closeEnd === -1) { break; }
    i = closeEnd + 1;
  }
}

/** 从单个标签的属性区域提取指定属性值 */
function extractAttrValueFromSection (section: string, attrName: string, out: Set<string>): void {
  const lower = section.toLowerCase();
  const target = attrName.toLowerCase();
  let pos = 0;

  while (pos < lower.length) {
    const idx = lower.indexOf(target, pos);

    if (idx === -1) { return; }
    const prevChar = idx === 0 ? 32 : lower.charCodeAt(idx - 1);
    const isBoundary = prevChar === 32 || prevChar === 9 || prevChar === 10 || prevChar === 13;

    if (!isBoundary) { pos = idx + target.length; continue; }

    let p = idx + target.length;

    while (p < section.length && /\s/.test(section[p])) { p++; }
    if (section[p] !== '=') { pos = idx + target.length; continue; }
    p++;
    while (p < section.length && /\s/.test(section[p])) { p++; }

    let value = '';
    const quote = section[p];

    if (quote === '"' || quote === '\'') {
      const end = section.indexOf(quote, p + 1);

      if (end === -1) { return; }
      value = section.slice(p + 1, end);
    } else {
      let end = p;

      while (end < section.length && !/[\s>]/.test(section[end])) { end++; }
      value = section.slice(p, end);
    }

    if (value) { out.add(value); }

    return;
  }
}

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
const isInlineUrl = (url: string) => url.startsWith('data:') || url.startsWith('blob:');

/** 安全移除 HTML 中所有内联 <svg>...</svg> 块，使用字符级扫描避免 ReDoS */
function stripInlineSVG (html: string): string {
  let result = '';
  let i = 0;
  const len = html.length;
  const lowerHtml = html.toLowerCase();

  while (i < len) {
    const start = lowerHtml.indexOf('<svg', i);

    if (start === -1) {
      result += html.slice(i);

      break;
    }
    const after = lowerHtml.charCodeAt(start + 4);
    const isSvgTag = after === 32 || after === 9 || after === 10 || after === 13 || after === 62 || after === 47;

    if (!isSvgTag) {
      result += html.slice(i, start + 4);
      i = start + 4;
      continue;
    }

    result += html.slice(i, start);
    const closeIdx = lowerHtml.indexOf('</svg', start + 4);

    if (closeIdx === -1) { break; }
    const gt = lowerHtml.indexOf('>', closeIdx);

    if (gt === -1) { break; }
    i = gt + 1;
  }

  return result;
}

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

/** 危险标签名集合（小写）：将这些标签的 < > 转义为 &lt; &gt;，保留内容防止布局错位 */
const DANGEROUS_TAG_NAMES = new Set([
  'foreignobject', 'script', 'iframe', 'object', 'embed',
  'link', 'base', 'meta', 'template', 'noscript',
]);

/** 需要进行 URL 协议安全检查的属性名（小写） */
const URL_ATTR_NAMES = new Set(['href', 'src', 'action', 'formaction']);

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

/**
 * 清理 HTML：转义危险标签，移除事件处理器和危险协议 URL 属性。
 * 使用字符级扫描代替回溯正则，避免 ReDoS 漏洞。
 */
export function sanitizeSVGContent (html: string): string {
  return scanAndSanitize(html);
}

/**
 * 单遍字符级扫描：
 * - 识别危险标签（DANGEROUS_TAG_NAMES），将其 < > 转义为 &lt; &gt;
 * - 在普通标签的属性区域内：移除 on* 事件处理器属性，移除值为危险 URL 的 href/src/action/formaction 属性
 */
function scanAndSanitize (html: string): string {
  let out = '';
  let i = 0;
  const len = html.length;

  while (i < len) {
    const ch = html.charCodeAt(i);

    if (ch !== 60 /* < */) {
      out += html[i++];
      continue;
    }

    const next = html.charCodeAt(i + 1);
    const isLetter = (next >= 65 && next <= 90) || (next >= 97 && next <= 122);
    const nextNext = html.charCodeAt(i + 2);
    const isSlashLetter = next === 47 /* / */
      && ((nextNext >= 65 && nextNext <= 90) || (nextNext >= 97 && nextNext <= 122));

    if (!isLetter && !isSlashLetter) {
      out += html[i++];
      continue;
    }

    const isClose = isSlashLetter;
    const nameStart = isClose ? i + 2 : i + 1;
    let nameEnd = nameStart;

    while (nameEnd < len) {
      const c = html.charCodeAt(nameEnd);

      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62) { break; }
      nameEnd++;
    }
    const tagName = html.slice(nameStart, nameEnd).toLowerCase();

    // 找到标签的结束 '>'，识别引号区域避免误判 '>'
    const tagLimit = Math.min(len, nameEnd + 16000);
    let tagEnd = -1;
    let inDoubleQuote = false;
    let inSingleQuote = false;

    for (let p = nameEnd; p < tagLimit; p++) {
      const c = html.charCodeAt(p);

      if (c === 34 /* " */ && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; } else if (c === 39 /* ' */ && !inDoubleQuote) { inSingleQuote = !inSingleQuote; } else if (c === 62 /* > */ && !inDoubleQuote && !inSingleQuote) {
        tagEnd = p;

        break;
      }
    }
    if (tagEnd === -1) {
      out += html[i++];
      continue;
    }

    if (DANGEROUS_TAG_NAMES.has(tagName)) {
      out += '&lt;' + html.slice(i + 1, tagEnd) + '&gt;';
      i = tagEnd + 1;
      continue;
    }

    const tagOpen = html.slice(i, nameEnd);
    const attrSection = html.slice(nameEnd, tagEnd);
    const cleanedAttrs = sanitizeAttrSection(attrSection);

    out += tagOpen + cleanedAttrs + '>';
    i = tagEnd + 1;
  }

  return out;
}

/**
 * 清理标签的属性区域：
 * - 移除 on* 事件处理器属性
 * - 移除值为危险 URL 的 href/src/action/formaction 属性
 */
function sanitizeAttrSection (section: string): string {
  let out = '';
  let i = 0;
  const len = section.length;

  while (i < len) {
    const c = section.charCodeAt(i);

    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47) {
      out += section[i++];
      continue;
    }

    const nameStart = i;

    while (i < len) {
      const cc = section.charCodeAt(i);

      if (cc === 61 /* = */ || cc === 32 || cc === 9 || cc === 10 || cc === 13 || cc === 47 || cc === 62) { break; }
      i++;
    }
    if (i === nameStart) {
      out += section[i++];
      continue;
    }
    const attrName = section.slice(nameStart, i);
    const lowerName = attrName.toLowerCase();

    let p = i;

    while (p < len && /\s/.test(section[p])) { p++; }

    let attrEnd = p;
    let value: string | null = null;
    let hasValue = false;

    if (section[p] === '=') {
      hasValue = true;
      p++;
      while (p < len && /\s/.test(section[p])) { p++; }
      const q = section[p];

      if (q === '"' || q === '\'') {
        const end = section.indexOf(q, p + 1);

        if (end === -1) {
          out += section.slice(nameStart);

          return out;
        }
        value = section.slice(p + 1, end);
        attrEnd = end + 1;
      } else {
        let end = p;

        while (end < len && !/[\s>]/.test(section[end])) { end++; }
        value = section.slice(p, end);
        attrEnd = end;
      }
    }

    const isEventHandler = lowerName.length > 2
      && lowerName.charCodeAt(0) === 111 /* o */
      && lowerName.charCodeAt(1) === 110 /* n */;
    const isDangerousUrlAttr = hasValue && value !== null
      && URL_ATTR_NAMES.has(lowerName) && isDangerousUrl(value);

    if (isEventHandler || isDangerousUrlAttr) {
      i = attrEnd;
      continue;
    }

    out += section.slice(nameStart, attrEnd);
    i = attrEnd;
  }

  return out;
}

/** 为缺少 xmlns 的内嵌 <svg> 自动注入命名空间，使用字符级扫描，线性时间且无回溯 */
function injectSVGNamespace (html: string): string {
  let out = '';
  let i = 0;
  const len = html.length;
  const lower = html.toLowerCase();

  while (i < len) {
    const start = lower.indexOf('<svg', i);

    if (start === -1) {
      out += html.slice(i);

      break;
    }
    const after = lower.charCodeAt(start + 4);
    const isSvgTag = after === 32 || after === 9 || after === 10 || after === 13 || after === 62 || after === 47;

    if (!isSvgTag) {
      out += html.slice(i, start + 4);
      i = start + 4;
      continue;
    }

    const tagEnd = lower.indexOf('>', start + 4);

    if (tagEnd === -1) {
      out += html.slice(i);

      break;
    }
    const tagSlice = lower.slice(start, tagEnd);
    // 严格判断是否已有 xmlns 属性（前面有空白边界，后接 = 或空白）
    const hasXmlns = /[\s][\s]*xmlns\s*=/i.test(' ' + tagSlice);

    out += html.slice(i, start + 4);
    if (!hasXmlns) { out += ' xmlns="http://www.w3.org/2000/svg"'; }
    out += html.slice(start + 4, tagEnd + 1);
    i = tagEnd + 1;
  }

  return out;
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
function collectCSSUrls (html: string, urlSet: Set<string>): void {
  const cssTexts: string[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      // 直接解析输入 HTML（inert document），避免通过模板拼接构造新 HTML 文档字符串
      const doc = new DOMParser().parseFromString(html, 'text/html');

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

  // 回退路径：使用字符级扫描提取 <style>...</style> 块和 style="..." 属性，避免 ReDoS
  if (cssTexts.length === 0) {
    extractStyleBlocks(html, cssTexts);
    const styleAttrSet = new Set<string>();

    extractTagAttributes(html, null, ['style'], styleAttrSet);
    for (const v of styleAttrSet) { cssTexts.push(v); }
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

/**
 * 将 HTML 中外部资源 URL 转为 base64 内联，失败时保留原 URL
 */
export async function inlineImageSources (html: string): Promise<string> {
  const rawUrlSet = new Set<string>();

  // 使用安全的字符级解析提取 src/poster 属性，避免 ReDoS
  extractTagAttributes(html, IMG_TAG_NAMES, ['src'], rawUrlSet);
  extractTagAttributes(html, MEDIA_TAG_NAMES, ['src', 'poster'], rawUrlSet);

  const urlSet = new Set<string>();

  for (const url of rawUrlSet) {
    if (url && !isInlineUrl(url)) { urlSet.add(url); }
  }

  // 仅扫描真正的 CSS 上下文（<style> 内容和 style 属性），避免从文本/注释中误提取 URL
  collectCSSUrls(html, urlSet);

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

/**
 * 将 @font-face 中的外部字体 URL 转为 base64 内联
 */
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

/**
 * 替换 URL 为 base64：
 *  - 标签属性（src/poster）使用字符级扫描定位后做精确字符串替换，避免回溯正则 ReDoS
 *  - CSS url() 替换使用线性时间的简单正则（无嵌套量词、无回溯陷阱）
 *  - 全程区分大小写匹配 URL，确保通过 Map 精准查找
 */
function replaceUrls (html: string, urlToBase64: Map<string, string>): string {
  // 1) 替换 <img>/<video>/<source>/<input>/<audio> 的 src/poster 属性
  const html1 = replaceTagAttrUrls(
    html,
    new Set(['img', 'video', 'source', 'input', 'audio']),
    ['src', 'poster'],
    urlToBase64,
  );

  // 2) 替换 CSS url("...") / url('...')，正则不含嵌套量词，线性时间
  let result = html1.replace(
    /url\(\s*(["'])([^"'\n\r)]*)\1\s*\)/g,
    (match, quote, url) => {
      const base64 = urlToBase64.get(url);

      return base64 ? `url(${quote}${base64}${quote})` : match;
    },
  );

  // 3) 替换 CSS url(...) 不带引号的 URL，线性时间
  result = result.replace(
    /url\(\s*([^\s)"'\n\r]+)\s*\)/g,
    (match, url) => {
      const base64 = urlToBase64.get(url);

      return base64 ? `url(${base64})` : match;
    },
  );

  return result;
}

/**
 * 字符级扫描定位指定标签的指定属性，并将属性值替换为 Map 中的 base64。
 * 完全不使用回溯正则，最坏情况是线性时间。
 */
function replaceTagAttrUrls (
  html: string,
  tagNames: Set<string>,
  attrNames: string[],
  urlToBase64: Map<string, string>,
): string {
  if (urlToBase64.size === 0) { return html; }
  const targetAttrs = attrNames.map(a => a.toLowerCase());
  let out = '';
  let i = 0;
  const len = html.length;

  while (i < len) {
    const lt = html.indexOf('<', i);

    if (lt === -1) {
      out += html.slice(i);

      break;
    }
    const next = html.charCodeAt(lt + 1);
    const isLetter = (next >= 65 && next <= 90) || (next >= 97 && next <= 122);

    if (!isLetter) {
      out += html.slice(i, lt + 1);
      i = lt + 1;
      continue;
    }

    let nameEnd = lt + 1;

    while (nameEnd < len) {
      const c = html.charCodeAt(nameEnd);

      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62) { break; }
      nameEnd++;
    }
    const tagName = html.slice(lt + 1, nameEnd).toLowerCase();

    if (!tagNames.has(tagName)) {
      out += html.slice(i, nameEnd);
      i = nameEnd;
      continue;
    }

    // 找到本标签的结束 '>'，在引号内的 '>' 不算
    const tagLimit = Math.min(len, nameEnd + 16000);
    let tagEnd = -1;
    let inDq = false;
    let inSq = false;

    for (let p = nameEnd; p < tagLimit; p++) {
      const c = html.charCodeAt(p);

      if (c === 34 && !inSq) { inDq = !inDq; } else if (c === 39 && !inDq) { inSq = !inSq; } else if (c === 62 && !inDq && !inSq) {
        tagEnd = p;

        break;
      }
    }
    if (tagEnd === -1) {
      out += html.slice(i, lt + 1);
      i = lt + 1;
      continue;
    }

    // 在 [nameEnd, tagEnd) 区间内，逐属性替换目标 src/poster
    out += html.slice(i, nameEnd);
    out += replaceAttrsInSection(html.slice(nameEnd, tagEnd), targetAttrs, urlToBase64);
    out += '>';
    i = tagEnd + 1;
  }

  return out;
}

/** 在单个标签的属性区域内，将匹配 targetAttrs 的属性值替换为 Map 中的 base64 */
function replaceAttrsInSection (
  section: string,
  targetAttrs: string[],
  urlToBase64: Map<string, string>,
): string {
  let out = '';
  let i = 0;
  const len = section.length;

  while (i < len) {
    const c = section.charCodeAt(i);

    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47) {
      out += section[i++];
      continue;
    }

    const nameStart = i;

    while (i < len) {
      const cc = section.charCodeAt(i);

      if (cc === 61 /* = */ || cc === 32 || cc === 9 || cc === 10 || cc === 13 || cc === 47 || cc === 62) { break; }
      i++;
    }
    if (i === nameStart) {
      out += section[i++];
      continue;
    }
    const lowerName = section.slice(nameStart, i).toLowerCase();
    let p = i;

    while (p < len && /\s/.test(section[p])) { p++; }

    if (section[p] !== '=') {
      out += section.slice(nameStart, p);
      i = p;
      continue;
    }
    p++;
    while (p < len && /\s/.test(section[p])) { p++; }

    let valueStart = p;
    let valueEnd = p;
    let attrEnd = p;
    let quote: string | null = null;

    if (section[p] === '"' || section[p] === '\'') {
      quote = section[p];
      const end = section.indexOf(quote, p + 1);

      if (end === -1) {
        out += section.slice(nameStart);

        return out;
      }
      valueStart = p + 1;
      valueEnd = end;
      attrEnd = end + 1;
    } else {
      let end = p;

      while (end < len && !/[\s>]/.test(section[end])) { end++; }
      valueStart = p;
      valueEnd = end;
      attrEnd = end;
    }

    const value = section.slice(valueStart, valueEnd);

    if (targetAttrs.includes(lowerName)) {
      const base64 = urlToBase64.get(value);

      if (base64) {
        out += section.slice(nameStart, valueStart) + base64 + (quote ?? '') + section.slice(attrEnd, attrEnd);
        // 上一行末尾追加的 '' 是为了清晰；attrEnd 之后的内容由外层循环继续处理
        // 注意：当 quote 不为 null 时，前缀 section.slice(nameStart, valueStart) 已经包含开引号；
        // 我们追加 base64 + 闭合引号 即可。
        i = attrEnd;
        continue;
      }
    }

    out += section.slice(nameStart, attrEnd);
    i = attrEnd;
  }

  return out;
}

/**
 * 从宿主文档提取 CSS url(#id) 引用的 SVG 定义，支持 filter/clipPath/mask/gradient/pattern/marker
 */
export function extractSVGDefs (html: string): string {
  if (typeof document === 'undefined') { return ''; }

  // 使用安全的字符级扫描移除内联 <svg> 块，避免 ReDoS
  const htmlWithoutInlineSVG = stripInlineSVG(html);
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
