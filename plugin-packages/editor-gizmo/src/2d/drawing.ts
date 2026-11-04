import { TextCache } from '@galacean/effects';
import { ellipsizeText } from '@galacean/effects-plugin-gui';
import type { Control, TextMeasure } from '@galacean/effects-plugin-gui';
import { type Box2 } from '@galacean/effects-math/es/extension/index';
import type { Vector2 } from './math';
import { Color, Matrix3, Vector3, getBoxCorners } from './math';

/** 信息标签默认字号。 */
export const INFO_TEXT_FONT_SIZE = 14;
/** 信息标签默认字体。 */
export const INFO_TEXT_FONT_FAMILY = 'sans-serif';

/**
 * 颜色缓存：`hex_alpha` → effects Color。键到颜色映射不可变，全局缓存无需清理。
 */
const colorCache = new Map<string, Color>();

/**
 * 将十六进制色值 + alpha 转为 effects Color（带全局缓存）。
 * @param hex 0xRRGGBB 颜色
 * @param alpha 透明度 0..1
 * @returns effects Color
 */
export function toColor (hex: number, alpha = 1): Color {
  const key = `${hex}_${alpha}`;
  const cached = colorCache.get(key);

  if (cached) {
    return cached;
  }
  const color = new Color(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  );

  colorCache.set(key, color);

  return color;
}

/**
 * 按完整 grapheme 截断，并将省略号计入最终宽度。
 * @param text 文本内容
 * @param maxWidth 可用宽度
 * @param measure 绘制文本所用的测量函数
 * @returns 截断后的文本
 */
export function truncateText (text: string, maxWidth: number, measure: TextMeasure): string {
  return ellipsizeText(text, maxWidth, measure, '...');
}

/**
 * 多行逐字符折行：行宽超出 maxWidth 时换行；行数达到 maxLines 时末行用省略号收尾。
 * @param text 文本内容
 * @param maxWidth 单行可用宽度
 * @param maxLines 最大行数
 * @param measure 绘制文本所用的测量函数
 * @returns 折行后的文本行数组
 */
export function wrapText (text: string, maxWidth: number, maxLines: number, measure: TextMeasure): string[] {
  if (maxLines <= 0 || !text) {return [];}
  const lines: string[] = [];

  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let currentLine = '';

    for (const char of TextCache.graphemeSegmenter(paragraph)) {
      if (currentLine && measure(currentLine + char).width > maxWidth) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine += char;
      }
    }
    lines.push(currentLine);
  }
  if (lines.length > maxLines) {
    lines[maxLines - 1] = ellipsizeText(lines[maxLines - 1], maxWidth, measure, '...', true);
  }

  return lines.slice(0, maxLines);
}

/**
 * 绘制由 4 个角点构成的（可能非正交的）包围盒边框。
 * @param control 绘制控制器
 * @param corners 4 个角点（视图坐标，Y 向下）
 * @param color 边框颜色
 * @param width 线宽
 */
export function drawCorners (control: Control, corners: Vector2[], color: Color, width: number): void {
  if (corners.length < 4) {
    return;
  }
  for (let i = 0; i < 4; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % 4];

    control.drawLine(start.x, start.y, end.x, end.y, color, width);
  }
}

/**
 * 绘制虚线包围盒，并在相邻边之间保持连续虚线相位。
 * @param control 绘制控制器
 * @param corners 四个视图角点
 * @param color 虚线颜色
 * @param width 线宽
 * @param dashLength 实线段长度
 * @param gapLength 间隔长度
 */
export function drawDashedCorners (
  control: Control,
  corners: Vector2[],
  color: Color,
  width: number,
  dashLength: number,
  gapLength: number,
): void {
  // 1. 校验角点和虚线参数。
  if (corners.length < 4 || dashLength <= 0 || gapLength < 0) {
    return;
  }

  const patternLength = dashLength + gapLength;
  let perimeterOffset = 0;

  // 2. 逐边计算虚线相位，并继承上一条边的周长偏移。
  for (let i = 0; i < 4; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % 4];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const edgeLength = Math.hypot(dx, dy);

    if (edgeLength <= Number.EPSILON) {
      continue;
    }

    let edgeOffset = 0;

    while (edgeOffset < edgeLength) {
      const patternOffset = perimeterOffset % patternLength;
      const drawingDash = gapLength === 0 || patternOffset < dashLength;
      const phaseRemaining = drawingDash
        ? dashLength - patternOffset
        : patternLength - patternOffset;
      const segmentLength = Math.min(phaseRemaining, edgeLength - edgeOffset);

      // 3. 仅绘制当前相位中的实线段。
      if (drawingDash && segmentLength > Number.EPSILON) {
        const startRatio = edgeOffset / edgeLength;
        const endRatio = (edgeOffset + segmentLength) / edgeLength;

        control.drawLine(
          start.x + dx * startRatio,
          start.y + dy * startRatio,
          start.x + dx * endRatio,
          start.y + dy * endRatio,
          color,
          width,
        );
      }

      edgeOffset += segmentLength;
      perimeterOffset += segmentLength;
    }
  }
}

/**
 * 绘制包围盒边框（沿 4 个角点连边）。
 * @param control 绘制控制器
 * @param box 包围盒（视图坐标，Y 向下）
 * @param color 边框颜色
 * @param width 线宽
 */
export function drawBox (control: Control, box: Box2, color: Color, width: number): void {
  if (box.isEmpty()) {
    return;
  }
  drawCorners(control, getBoxCorners(box), color, width);
}

/**
 * 填充轴对齐包围盒（实心矩形）。
 * @param control 绘制控制器
 * @param box 包围盒（视图坐标，Y 向下）
 * @param color 填充颜色
 */
export function fillBox (control: Control, box: Box2, color: Color): void {
  if (box.isEmpty()) {
    return;
  }
  const size = box.getSize();

  control.fillRect(box.min.x, box.min.y, size.x, size.y, color);
}

/**
 * 用两个三角形填充 Box2 四角区域。
 * @param control 绘制控件
 * @param corners Box2 四角快照
 * @param color 填充颜色
 */
export function fillBoxByCorners (control: Control, corners: Vector2[], color: Color): void {
  if (corners.length !== 4) {
    return;
  }
  const [a, b, c, d] = corners;

  control.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y, color);
  control.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y, color);
}

/**
 * 构造沿局部轴展开的旋转矩形角点。
 * @param center 矩形中心（视图坐标）
 * @param xAxis 局部 X 轴单位向量（视图坐标，宽方向）
 * @param yAxis 局部 Y 轴单位向量（视图坐标，高方向）
 * @param halfWidth 半宽（沿 xAxis，视图像素）
 * @param halfHeight 半高（沿 yAxis，视图像素）
 * @returns 4 个角点（视图坐标，环绕顺序）
 */
export function getRotatedBoxCorners (
  center: Vector2,
  xAxis: Vector2,
  yAxis: Vector2,
  halfWidth: number,
  halfHeight: number,
): Vector2[] {
  const halfW = xAxis.clone().multiply(halfWidth);
  const halfH = yAxis.clone().multiply(halfHeight);

  return [
    center.clone().subtract(halfW).subtract(halfH),
    center.clone().add(halfW).subtract(halfH),
    center.clone().add(halfW).add(halfH),
    center.clone().subtract(halfW).add(halfH),
  ];
}

/**
 * 填充沿局部轴展开的旋转矩形。
 * @param control 绘制控制器
 * @param center 矩形中心（视图坐标）
 * @param xAxis 局部 X 轴单位向量（视图坐标，宽方向）
 * @param yAxis 局部 Y 轴单位向量（视图坐标，高方向）
 * @param width 宽（沿 xAxis，视图像素）
 * @param height 高（沿 yAxis，视图像素）
 * @param color 填充颜色
 */
export function fillRotatedRect (
  control: Control,
  center: Vector2,
  xAxis: Vector2,
  yAxis: Vector2,
  width: number,
  height: number,
  color: Color,
): void {
  const ex = xAxis.clone();
  const ey = yAxis.clone();
  const anchor = center.clone();

  drawWithBoxTransform(control, anchor, ex, ey, () => {
    control.fillRect(-width / 2, -height / 2, width, height, color);
  });
}

/**
 * 在由锚点和两个基向量定义的局部坐标系内执行绘制。
 * @param control 绘制控制器
 * @param anchor Control 绘制空间锚点（局部原点）
 * @param ex 局部 X 轴基向量（单位向量）
 * @param ey 局部 Y 轴基向量（单位向量）
 * @param drawFn 在局部坐标系内执行的绘制
 */
export function drawWithBoxTransform (control: Control, anchor: Vector2, ex: Vector2, ey: Vector2, drawFn: () => void): void {
  const graphics = control.engine.renderingServer.graphics;
  // 列优先：第一列 = ex，第二列 = ey，第三列 = anchor（平移）
  const matrix = Matrix3.fromColumnVectors(
    new Vector3(ex.x, ex.y, 0),
    new Vector3(ey.x, ey.y, 0),
    new Vector3(anchor.x, anchor.y, 1),
  );

  graphics.pushTransform(matrix);
  drawFn();
  graphics.popTransform();
}
