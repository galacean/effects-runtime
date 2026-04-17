/**
 * DOM → Texture 转换工具
 * 通过 SVG foreignObject 将 HTML/CSS 渲染为 Image
 * 安全性依赖 <img> 沙箱机制，禁止改为 iframe/object/embed 加载
 */

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
  const safeHtml = sanitizeSVGContent(html);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">` +
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${safeHtml}</div>` +
    '</foreignObject>' +
    '</svg>'
  );
}

/**
 * 转义 HTML 中的 svg/foreignObject 标签，防止破坏外层 SVG 结构
 */
export function sanitizeSVGContent (html: string): string {
  return html
    .replace(/<\/?foreignObject(?=[\s>/]|$)/gi, match => match.replace(/</g, '&lt;'))
    .replace(/<\/?svg(?=[\s>/]|$)/gi, match => match.replace(/</g, '&lt;'));
}

/**
 * 加载 data URL 为 Image 对象
 */
function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      resolve(img);
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      reject(new Error('DOM to image failed: SVG data URL could not be loaded as image.'));
    };
    img.src = url;
  });
}
