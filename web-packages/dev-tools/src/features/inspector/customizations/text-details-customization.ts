import { TextComponent, TextComponentBase, spec, math } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { detailsCustomization } from '../../../framework/registry/editor-registry';
import { DefaultObjectDetails } from '../../../ui/property-editor/default-object-details';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';

const FONT_FAMILIES = ['Inter', 'Arial', 'Helvetica', 'sans-serif', 'serif', 'monospace'];
const FONT_WEIGHTS = [spec.TextWeight.normal, spec.TextWeight.bold, spec.TextWeight.lighter];
const FONT_STYLES = [spec.FontStyle.normal, spec.FontStyle.italic, spec.FontStyle.oblique];
const TEXT_PROPERTIES = {
  Typography: ['Text', 'Font Family', 'Font Weight', 'Font Style', 'Font Size', 'Color'],
  Layout: ['Auto Resize', 'Width', 'Height', 'Max Width', 'Max Height', 'Line Height', 'Letter Spacing', 'Horizontal Alignment', 'Vertical Alignment'],
  Outline: ['Enabled', 'Width', 'Color'],
  Shadow: ['Enabled', 'Color', 'Blur', 'Offset X', 'Offset Y'],
  Rendering: ['Color', 'Render Order'],
};

@detailsCustomization(TextComponentBase)
@detailsCustomization(TextComponent)
@detailsCustomization(RichTextComponent)
export class TextDetailsCustomization extends DefaultObjectDetails {
  private hasTextBounds (layout: any): layout is { maxTextWidth: number, maxTextHeight: number } {
    return typeof layout?.maxTextWidth === 'number' && typeof layout?.maxTextHeight === 'number';
  }

  private getEditableWidth (layout: any): number {
    return this.hasTextBounds(layout) ? layout.maxTextWidth : layout.width;
  }

  private getEditableHeight (layout: any): number {
    return this.hasTextBounds(layout) ? layout.maxTextHeight : layout.height;
  }

  private setEditableWidth (textComponent: TextComponentBase, layout: any, value: number): void {
    const nextWidth = Math.max(0.01, Number(value) || 0.01);

    if (this.hasTextBounds(layout)) {
      if (layout.maxTextWidth !== nextWidth) {
        layout.maxTextWidth = nextWidth;
        textComponent.isDirty = true;
      }

      return;
    }

    if ('setTextWidth' in textComponent && typeof textComponent.setTextWidth === 'function') {
      textComponent.setTextWidth(nextWidth);

      return;
    }

    if (layout.width !== nextWidth) {
      layout.width = nextWidth;
      textComponent.isDirty = true;
    }
  }

  private setEditableHeight (textComponent: TextComponentBase, layout: any, value: number): void {
    const nextHeight = Math.max(0.01, Number(value) || 0.01);

    if (this.hasTextBounds(layout)) {
      if (layout.maxTextHeight !== nextHeight) {
        layout.maxTextHeight = nextHeight;
        textComponent.isDirty = true;
      }

      return;
    }

    if ('setTextHeight' in textComponent && typeof textComponent.setTextHeight === 'function') {
      textComponent.setTextHeight(nextHeight);

      return;
    }

    if (layout.height !== nextHeight) {
      layout.height = nextHeight;
      textComponent.isDirty = true;
    }
  }

  override getSearchTerms (): string[] {
    return Object.entries(TEXT_PROPERTIES).flatMap(([name, properties]) => [name, ...properties]);
  }

  override build (group: PropertyGroup): void {
    const component = this.target as TextComponent;

    if (!component?.textStyle || !component.textLayout) { return; }
    const style = component.textStyle, layout = component.textLayout;
    const dirty = () => { component.isDirty = true; };
    const typography = group.group('Typography', 'Typography');

    typography.text('Text', { read: () => component.text ?? '', write: value => component.setText(value) }, true);
    const families = FONT_FAMILIES.includes(style.fontFamily) ? FONT_FAMILIES : [style.fontFamily, ...FONT_FAMILIES];

    typography.choice('Font Family', { read: () => Math.max(0, families.indexOf(style.fontFamily)), write: index => component.setFontFamily(families[index]) }, families);
    typography.choice('Font Weight', { read: () => Math.max(0, FONT_WEIGHTS.indexOf(style.textWeight)), write: index => component.setFontWeight(FONT_WEIGHTS[index]) }, ['Regular', 'Bold', 'Lighter']);
    typography.choice('Font Style', { read: () => Math.max(0, FONT_STYLES.indexOf(style.fontStyle)), write: index => component.setFontStyle(FONT_STYLES[index]) }, ['Normal', 'Italic', 'Oblique']);
    typography.number('Font Size', { read: () => style.fontSize, write: value => { style.fontSize = Math.max(1, Math.round(value)); dirty(); } }, { step: .5, min: 1, max: 1000, precision: 0 });
    typography.color('Color', { read: () => new math.Color(...style.textColor), write: color => { style.textColor = [color.r, color.g, color.b, color.a]; dirty(); } });
    const section = group.group('Layout', 'Layout');
    const modes = [spec.TextSizeMode.fixed, spec.TextSizeMode.autoWidth, spec.TextSizeMode.autoHeight];

    section.choice('Auto Resize', { read: () => Math.max(0, modes.indexOf(layout.autoResize)), write: index => { layout.autoResize = modes[index]; dirty(); } }, ['Fixed', 'Auto Width', 'Auto Height']);
    section.number(this.hasTextBounds(layout) ? 'Max Width' : 'Width', { read: () => this.getEditableWidth(layout), write: value => this.setEditableWidth(component, layout, value) }, { step: .1, min: .01, max: 10000, precision: 2 });
    section.number(this.hasTextBounds(layout) ? 'Max Height' : 'Height', { read: () => this.getEditableHeight(layout), write: value => this.setEditableHeight(component, layout, value) }, { step: .1, min: .01, max: 10000, precision: 2 });
    section.number('Line Height', { read: () => layout.lineHeight, write: value => { layout.lineHeight = value; dirty(); } }, { step: .5, min: 1, max: 1000, precision: 1 });
    section.number('Letter Spacing', { read: () => style.fontSize ? layout.letterSpace / style.fontSize * 100 : 0,
      write: value => { layout.letterSpace = value / 100 * style.fontSize; dirty(); } }, { step: .1, min: -100, max: 1000, precision: 1, suffix: '%' });
    const horizontal = [spec.TextAlignment.left, spec.TextAlignment.middle, spec.TextAlignment.right];
    const vertical = [spec.TextVerticalAlign.top, spec.TextVerticalAlign.middle, spec.TextVerticalAlign.bottom];

    section.choice('Horizontal Alignment', { read: () => Math.max(0, horizontal.indexOf(layout.textAlign)), write: index => component.setTextAlign(horizontal[index]) }, ['Left', 'Center', 'Right']);
    section.choice('Vertical Alignment', { read: () => Math.max(0, vertical.indexOf(layout.textVerticalAlign)), write: index => component.setTextVerticalAlign(vertical[index]) }, ['Top', 'Center', 'Bottom']);
    const outline = group.group('Outline', 'Outline', false);

    outline.boolean('Enabled', { read: () => style.isOutlined, write: value => { style.isOutlined = value; dirty(); } });
    outline.number('Width', { read: () => style.outlineWidth, write: value => { style.outlineWidth = value; dirty(); } }, {}, { enabled: () => style.isOutlined });
    outline.color('Color', { read: () => new math.Color(...style.outlineColor), write: value => { style.outlineColor = [value.r, value.g, value.b, value.a]; dirty(); } }, { enabled: () => style.isOutlined });
    const shadow = group.group('Shadow', 'Shadow', false);

    shadow.boolean('Enabled', { read: () => style.hasShadow, write: value => { style.hasShadow = value; dirty(); } });
    shadow.color('Color', { read: () => new math.Color(...style.shadowColor), write: value => { style.shadowColor = [value.r, value.g, value.b, value.a]; dirty(); } }, { enabled: () => style.hasShadow });
    for (const [title, key] of [['Blur', 'shadowBlur'], ['Offset X', 'shadowOffsetX'], ['Offset Y', 'shadowOffsetY']] as const) {
      shadow.number(title, { read: () => style[key], write: value => { style[key] = value; dirty(); } }, {}, { enabled: () => style.hasShadow });
    }
    this.buildRenderingProperties(group.group('Rendering', 'Rendering', false));
  }
}
