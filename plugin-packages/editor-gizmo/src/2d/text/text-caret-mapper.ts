/** 视图坐标点。 */
export type ViewPoint = {
  /** X 坐标。 */
  x: number,
  /** Y 坐标。 */
  y: number,
};

/** 文本插入点计算所需的 DOM 布局样式。 */
export type TextCaretLayout = {
  /** 文本框左坐标。 */
  left: number,
  /** 文本框上坐标。 */
  top: number,
  /** 文本框宽度。 */
  width: number,
  /** 文本框高度。 */
  height: number,
  /** 文本框旋转弧度。 */
  rotation: number,
  /** 文本内容。 */
  text: string,
  /** 字体。 */
  fontFamily: string,
  /** 字号。 */
  fontSize: number,
  /** 字重。 */
  fontWeight: string | number,
  /** 字间距。 */
  letterSpacing: number,
  /** 行高。 */
  lineHeight: number,
  /** 文本对齐方式。 */
  textAlign: 'left' | 'center' | 'right',
  /** 是否保持单词完整换行。 */
  keepWordIntact: boolean,
};

/** 单个文本插入点的局部位置。 */
type CaretPosition = {
  /** 文本偏移。 */
  index: number,
  /** 局部 X 坐标。 */
  x: number,
  /** 局部 Y 坐标。 */
  y: number,
  /** 插入点高度。 */
  height: number,
};

/** 已测量的文本框和插入点位置。 */
type ResolvedLayout = Pick<TextCaretLayout, 'left' | 'top' | 'width' | 'height' | 'rotation'> & {
  /** 全部文本插入点。 */
  caretPositions: CaretPosition[],
};

/** 使用浏览器文本布局将视图坐标映射为文本插入点。 */
export class TextCaretMapper {
  private layout: ResolvedLayout | undefined;
  private layoutKey = '';
  private caretPositions: CaretPosition[] = [];

  /** 清除当前布局。 */
  reset (): void {
    this.layout = undefined;
  }

  /**
   * 同步文本框样式并按需重新测量插入点。
   * @param style 文本框布局样式
   */
  sync (style: TextCaretLayout): void {
    const key = JSON.stringify([
      style.text,
      style.width,
      style.fontFamily,
      style.fontSize,
      style.fontWeight,
      style.letterSpacing,
      style.lineHeight,
      style.textAlign,
      style.keepWordIntact,
    ]);

    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.caretPositions = this.measureCaretPositions(style);
    }
    this.layout = {
      left: style.left,
      top: style.top,
      width: style.width,
      height: style.height,
      rotation: style.rotation,
      caretPositions: this.caretPositions,
    };
  }

  /**
   * 查找最接近视图坐标的文本插入点。
   * @param point 视图坐标
   * @returns 文本偏移；布局尚未同步时返回 undefined
   */
  resolve (point: ViewPoint): number | undefined {
    const layout = this.layout;

    if (!layout || layout.caretPositions.length === 0) {
      return undefined;
    }

    const dx = point.x - layout.left;
    const dy = point.y - layout.top;
    const cos = Math.cos(layout.rotation);
    const sin = Math.sin(layout.rotation);
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

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

    return closest.index;
  }

  /**
   * 使用离屏 DOM 测量全部文本插入点。
   * @param style 文本框布局样式
   * @returns 插入点位置列表
   */
  private measureCaretPositions (style: TextCaretLayout): CaretPosition[] {
    // 1. 创建与画布文本样式一致的离屏镜像节点。
    const mirror = document.createElement('div');

    Object.assign(mirror.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      width: `${style.width}px`,
      margin: '0',
      padding: '0',
      border: '0',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      wordBreak: style.keepWordIntact ? 'normal' : 'break-all',
      fontFamily: style.fontFamily,
      fontSize: `${style.fontSize}px`,
      fontWeight: `${style.fontWeight}`,
      letterSpacing: `${style.letterSpacing}px`,
      lineHeight: `${style.lineHeight}px`,
      textAlign: style.textAlign,
      fontVariantLigatures: 'none',
      fontKerning: 'none',
    });
    const textNode = document.createTextNode(style.text || '\u200b');

    mirror.appendChild(textNode);
    document.body.appendChild(mirror);

    // 2. 逐个文本偏移读取浏览器排版位置。
    const positions: CaretPosition[] = [];
    const range = document.createRange();
    const mirrorRect = mirror.getBoundingClientRect();

    for (let index = 0; index <= style.text.length; index++) {
      range.setStart(textNode, index);
      range.collapse(true);
      const rect = range.getBoundingClientRect();

      positions.push({
        index,
        x: rect.left - mirrorRect.left,
        y: rect.top - mirrorRect.top,
        height: rect.height,
      });
    }
    // 3. 移除临时节点并返回测量结果。
    mirror.remove();

    return positions;
  }
}
