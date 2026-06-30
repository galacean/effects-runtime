/**
 * 通用「任意旋转字形包围盒 → 画布对称外扩」工具。
 *
 * 解决：曲线文本/任意旋转排版的字形经 rotate(θ) 后，外溢方向不固定（非上下两轴），
 * 需逐字算旋转后真实角点世界坐标，全局累加得到真实包围盒，再对称外扩画布防裁切。
 *
 * 设计原则：
 * - 纯几何，不依赖曲线/渲染；直线文本(θ=0)与曲线文本同构，富文本 expanding 将来可复用。
 * - 对称外扩（expand = max(溢出左,溢出右)），保持元素中心点稳定（学富文本 expanding 策略）。
 * - 字形盒用字体级 fontBoundingBoxAscent/Descent（兼容性优于 actualBoundingBox*）。
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

/** 画布外扩结果 */
export interface ExpandedCanvas {
  /** 画布宽（原 frame + 水平扩展*2） */
  canvasWidth: number,
  /** 画布高（原 frame + 垂直扩展*2） */
  canvasHeight: number,
  /** 渲染偏移 X（画字时整体平移，= 水平扩展量） */
  renderOffsetX: number,
  /** 渲染偏移 Y（画字时整体平移，= 垂直扩展量） */
  renderOffsetY: number,
}

/** 旋转点：(px,py) 绕原点转 θ */
function rotatePoint (px: number, py: number, cos: number, sin: number): [number, number] {
  return [px * cos - py * sin, px * sin + py * cos];
}

/**
 * 计算一组旋转字形的真实包围盒（世界坐标，未含 padding）。
 * 每字局部盒 = [0, advance] × [-descent, ascent]（baseline=alphabetic，(0,0) 为基线左端），
 * 经 translate(x,y) + rotate(θ) 后取 4 角点世界坐标，全局累加 min/max。
 *
 * extraPad：额外把字形盒四向外扩的量（如描边 outlineWidth*2），均匀加到 advance/ascent/descent 上。
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
      // 局部 → 平移 → 旋转
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

/**
 * 给定字形集合与原画布帧尺寸，算出对称外扩后的画布尺寸 + 渲染偏移。
 *
 * @param glyphs 字形信息数组（位置/旋转/度量）
 * @param frameWidth 原逻辑帧宽（直线态文本框宽）
 * @param frameHeight 原逻辑帧高
 * @param extraPad 字形额外外扩（描边/阴影等，>=0）
 * @returns ExpandedCanvas：canvasWidth/Height + renderOffsetX/Y
 *
 * 用法：画字时每个字平移 (renderOffsetX, renderOffsetY) 把内容移进扩好的画布。
 * 对称扩展 = max(溢出左,溢出右) 双侧扩，保持中心稳定（同富文本 expanding）。
 */
export function computeExpandedCanvas (
  glyphs: CurveGlyphInfo[],
  frameWidth: number,
  frameHeight: number,
  extraPad = 0,
): ExpandedCanvas {
  const { minX, maxX, minY, maxY } = computeGlyphsBounds(glyphs, extraPad);

  // 各向溢出（内容相对 [0,frameW]×[0,frameH] 帧探出的量）
  const overflowLeft = Math.max(0, -minX);
  const overflowRight = Math.max(0, maxX - frameWidth);
  const overflowTop = Math.max(0, -minY);
  const overflowBottom = Math.max(0, maxY - frameHeight);

  // 对称扩展：取同轴两侧最大值双侧扩
  const expandH = Math.max(overflowLeft, overflowRight);
  const expandV = Math.max(overflowTop, overflowBottom);

  return {
    canvasWidth: Math.max(1, Math.ceil(frameWidth + expandH * 2)),
    canvasHeight: Math.max(1, Math.ceil(frameHeight + expandV * 2)),
    renderOffsetX: expandH,
    renderOffsetY: expandV,
  };
}
