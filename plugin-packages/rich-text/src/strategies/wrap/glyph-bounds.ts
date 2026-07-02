/**
 * 旋转字形包围盒工具。
 * 字形经 translate + rotate 后角点方向不固定，逐字算真实世界角点取包围盒，
 * 供溢出策略对称外扩画布防裁切。
 */

/** 单个字形的渲染信息（已含位置、旋转、字形度量） */
export interface CurveGlyphInfo {
  /** 字符（调试用） */
  char: string,
  /** 字形基线参考点在世界坐标系的 X（translate 目标点） */
  x: number,
  /** 字形基线参考点在世界坐标系的 Y */
  y: number,
  /** 旋转角弧度（切线角，绕 (x,y) 旋转） */
  rotation: number,
  /** 字形 advance 宽度（measureText(ch).width） */
  advance: number,
  /** 字形 ascent（基线向上，>0） */
  ascent: number,
  /** 字形 descent（基线向下，>0） */
  descent: number,
}

/** 旋转点：(px,py) 绕原点转 θ */
function rotatePoint (px: number, py: number, cos: number, sin: number): [number, number] {
  return [px * cos - py * sin, px * sin + py * cos];
}

/**
 * 计算一组旋转字形的真实包围盒（世界坐标）。
 * 每字局部盒 [0,advance]×[-descent,ascent] 经 rotate(θ)+translate(x,y) 后取 4 角点世界坐标，
 * 全局累加 min/max。
 * @param glyphs - 字形信息（位置/旋转/度量）
 * @param extraPad - 字形盒四向外扩量（如描边宽度）
 * @returns 世界坐标外接盒 { minX, maxX, minY, maxY }
 */
export function computeGlyphsBounds (glyphs: CurveGlyphInfo[], extraPad = 0): {
  minX: number, maxX: number, minY: number, maxY: number,
} {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const g of glyphs) {
    // 局部字形盒 4 角（含 extraPad 向外扩）。canvas y-down 约定：
    // baseline 在 y=0，ascent 向上 = Y 减小(负)，descent 向下 = Y 增加(正)
    const x0 = -extraPad;
    const x1 = g.advance + extraPad;
    const yTop = -g.ascent - extraPad;      // 字顶（向上，负）
    const yBot = g.descent + extraPad;      // 字底（向下，正）

    const corners: Array<[number, number]> = [
      [x0, yTop], [x1, yTop], [x0, yBot], [x1, yBot],
    ];
    const cos = Math.cos(g.rotation);
    const sin = Math.sin(g.rotation);

    for (const [lx, ly] of corners) {
      // 局部 → 平移 → 旋转（空间变换）
      const [wx, wy] = rotatePoint(lx, ly, cos, sin);
      const X = g.x + wx;
      const Y = g.y + wy;

      if (X < minX) { minX = X; }
      if (X > maxX) { maxX = X; }
      if (Y < minY) { minY = Y; }
      if (Y > maxY) { maxY = Y; }
    }
  }

  if (!isFinite(minX)) { minX = maxX = minY = maxY = 0; }

  return { minX, maxX, minY, maxY };
}
