import { spec } from '@galacean/effects';
import type { RichTextComponent, RichTextLayoutProperties } from '@galacean/effects-plugin-rich-text';
import { RichTextDocument } from './rich-text-document';

/** 一次拖拽只读取按下时的内容和属性，避免累计缩放误差。 */
export type RichTextResizeSnapshot = {
  component: RichTextComponent,
  mode: 'font' | 'width',
  document: RichTextDocument,
  minimumFontSize: number,
  frameWidth: number,
  frameHeight: number,
  renderedWidth: number,
  renderedHeight: number,
  properties: Required<RichTextLayoutProperties>,
};

/** 布局帧在渲染画布中的归一化尺寸；visible 溢出时画布会更大。 */
export function getRichTextFrameRatio (component: RichTextComponent): { x: number, y: number } {
  component.ensureLayout();
  const layout = component.textLayout;

  return {
    x: Math.min(1, Math.max(0, layout.maxTextWidth / Math.max(1, layout.width))),
    y: Math.min(1, Math.max(0, layout.maxTextHeight / Math.max(1, layout.height))),
  };
}

export function createRichTextResizeSnapshot (
  component: RichTextComponent,
  mode: RichTextResizeSnapshot['mode'],
): RichTextResizeSnapshot {
  component.ensureLayout();
  const layout = component.textLayout;
  const document = new RichTextDocument(component.text);
  const fontSize = component.textStyle.fontSize;

  return {
    component, mode, document, minimumFontSize: document.getMinimumFontSize(fontSize),
    frameWidth: layout.maxTextWidth,
    frameHeight: layout.maxTextHeight,
    renderedWidth: layout.width, renderedHeight: layout.height,
    properties: {
      text: component.text, fontSize, lineHeight: layout.lineHeight, letterSpace: layout.letterSpace,
      maxTextWidth: layout.maxTextWidth,
      maxTextHeight: layout.maxTextHeight,
      autoResize: layout.autoResize, wrapEnabled: layout.wrapEnabled,
    },
  };
}

/** 比例相对按下时的快照；正尺寸和跨越方向分别由属性与位置表达。 */
export function applyRichTextResize (snapshot: RichTextResizeSnapshot, scalarX: number, scalarY = scalarX): void {
  const { component, properties, document, minimumFontSize, mode } = snapshot;

  if (component.textLayout.useLegacyRichText) { return; }
  if (mode === 'width') {
    component.setLayoutProperties({
      ...properties,
      maxTextWidth: Math.max(1, snapshot.frameWidth * Math.abs(scalarX)),
      autoResize: properties.autoResize === spec.TextSizeMode.fixed ? spec.TextSizeMode.fixed : spec.TextSizeMode.autoHeight,
      wrapEnabled: true,
    });
  } else {
    const ratio = Math.max(Math.abs(scalarX), Math.abs(scalarY), 1 / minimumFontSize);

    component.setLayoutProperties({
      ...properties,
      text: document.scaleFontSizes(ratio),
      fontSize: properties.fontSize * ratio,
      lineHeight: properties.lineHeight * ratio,
      letterSpace: properties.letterSpace * ratio,
      maxTextWidth: Math.max(1, properties.maxTextWidth * ratio),
      maxTextHeight: Math.max(1, properties.maxTextHeight * ratio),
    });
  }
  component.ensureLayout();
}

/** 属性面板显示布局帧宽；溢出画布仍由 item.size 表达。 */
export function getRichTextFrameWidth (component: RichTextComponent): number {
  const frameRatio = getRichTextFrameRatio(component);
  const { size, scale } = component.item.transform;

  return Math.abs(size.x * scale.x) * frameRatio.x;
}
