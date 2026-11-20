/** 视图坐标点。 */
export type RichTextPoint = { x: number, y: number };

/** 文本投影的视图几何，不包含内容或字体参数。 */
export type RichTextViewport = {
  width: number,
  height: number,
  /** 排版逻辑像素到视口的完整二维变换。 */
  transform: { a: number, b: number, c: number, d: number, e: number, f: number },
};

export function richTextViewportTransform (viewport: RichTextViewport): string {
  const { a, b, c, d, e, f } = viewport.transform;

  return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
}

/** 单个文本插入点的局部位置。 */
export type RichTextCaretPosition = {
  /** 文本偏移。 */
  index: number,
  /** 局部 X 坐标。 */
  x: number,
  /** 局部 Y 坐标。 */
  y: number,
  /** 插入点高度。 */
  height: number,
};

/** 将视图坐标映射到已排版的插入点；坐标来源由各编辑器决定。 */
export function resolveRichTextCaretPosition (
  layout: RichTextViewport & { caretPositions: RichTextCaretPosition[] },
  point: RichTextPoint,
): RichTextCaretPosition | undefined {
  if (!layout.caretPositions.length) { return; }
  const { a, b, c, d, e, f } = layout.transform;
  const determinant = a * d - b * c;

  if (Math.abs(determinant) < 1e-10) { return; }
  const dx = point.x - e;
  const dy = point.y - f;
  const localX = (d * dx - c * dy) / determinant;
  const localY = (a * dy - b * dx) / determinant;

  let closestLineDistance = Number.POSITIVE_INFINITY;

  for (const caret of layout.caretPositions) {
    closestLineDistance = Math.min(
      closestLineDistance,
      Math.abs(localY - (caret.y + caret.height / 2)),
    );
  }

  let closest = layout.caretPositions[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const caret of layout.caretPositions) {
    const lineDistance = Math.abs(localY - (caret.y + caret.height / 2));

    if (lineDistance > closestLineDistance + 1) {
      continue;
    }
    const distance = Math.abs(localX - caret.x);

    if (distance < closestDistance) {
      closest = caret;
      closestDistance = distance;
    }
  }

  return closest;
}
