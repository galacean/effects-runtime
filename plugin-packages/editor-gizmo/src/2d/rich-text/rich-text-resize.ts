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
    frameWidth: layout.useLegacyRichText ? layout.width : layout.maxTextWidth,
    frameHeight: layout.useLegacyRichText ? layout.height : layout.maxTextHeight,
    renderedWidth: layout.width, renderedHeight: layout.height,
    properties: {
      text: component.text, fontSize, lineHeight: layout.lineHeight, letterSpace: layout.letterSpace,
      maxTextWidth: layout.useLegacyRichText ? layout.width : layout.maxTextWidth,
      maxTextHeight: layout.useLegacyRichText ? layout.height : layout.maxTextHeight,
      autoResize: layout.autoResize, wrapEnabled: layout.wrapEnabled,
    },
  };
}

/** 比例相对按下时的快照；正尺寸和跨越方向分别由属性与位置表达。 */
export function applyRichTextResize (snapshot: RichTextResizeSnapshot, scalarX: number, scalarY = scalarX): void {
  const { component, properties, document, minimumFontSize, mode } = snapshot;

  if (mode === 'width') {
    if (component.textLayout.useLegacyRichText) { return; }
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
  component.ensureLayout();
  const layout = component.textLayout;
  const { size, scale } = component.item.transform;
  const frameWidth = layout.useLegacyRichText ? layout.width : layout.maxTextWidth;

  return Math.abs(size.x * scale.x) * frameWidth / Math.max(1, layout.width);
}
