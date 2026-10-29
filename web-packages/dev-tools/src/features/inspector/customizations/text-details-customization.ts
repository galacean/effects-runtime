import { TextComponent, TextComponentBase, spec } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { detailsCustomization } from '../../../framework/registry/editor-registry';
import { ImGui } from '../../../platform/imgui/index';
import { DefaultObjectDetails } from '../../../ui/property-editor/default-object-details';
import { PropertyFields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';

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

  override onInspectorGUI (): void {
    const component = this.target as TextComponent;

    if (!component?.textStyle || !component.textLayout) { return; }
    const style = component.textStyle, layout = component.textLayout;
    const dirty = () => { component.isDirty = true; };

    this.group('Typography', () => {
      PropertyFields.Property('Text', width => ImGui.InputTextMultiline('##Text', next => {
        if (next !== undefined && next !== component.text) { component.setText(next); }

        return component.text ?? '';
      }, undefined, new ImGui.Vec2(width, 84)));
      const families = FONT_FAMILIES.includes(style.fontFamily) ? FONT_FAMILIES : [style.fontFamily, ...FONT_FAMILIES];

      PropertyFields.ComboField('Font Family', next => {
        if (next !== undefined && families[next] !== style.fontFamily) { component.setFontFamily(families[next]); }

        return Math.max(0, families.indexOf(style.fontFamily));
      }, families);
      PropertyFields.ComboField('Font Weight', next => {
        if (next !== undefined) { component.setFontWeight(FONT_WEIGHTS[next]); }

        return Math.max(0, FONT_WEIGHTS.indexOf(style.textWeight));
      }, ['Regular', 'Bold', 'Lighter']);
      PropertyFields.ComboField('Font Style', next => {
        if (next !== undefined) { component.setFontStyle(FONT_STYLES[next]); }

        return Math.max(0, FONT_STYLES.indexOf(style.fontStyle));
      }, ['Normal', 'Italic', 'Oblique']);
      PropertyFields.NumberField('Font Size', next => {
        if (next !== undefined && style.fontSize !== Math.round(next)) { style.fontSize = Math.max(1, Math.round(next)); dirty(); }

        return style.fontSize;
      }, 0.5, 1, 1000, '%.0f');
      if (PropertyFields.ColorField('Color', style.textColor)) { dirty(); }
    });
    this.group('Layout', () => {
      const modes = [spec.TextSizeMode.fixed, spec.TextSizeMode.autoWidth, spec.TextSizeMode.autoHeight];

      PropertyFields.ComboField('Auto Resize', next => {
        if (next !== undefined && layout.autoResize !== modes[next]) { layout.autoResize = modes[next]; dirty(); }

        return Math.max(0, modes.indexOf(layout.autoResize));
      }, ['Fixed', 'Auto Width', 'Auto Height']);
      PropertyFields.NumberField(this.hasTextBounds(layout) ? 'Max Width' : 'Width', next => {
        if (next !== undefined) { this.setEditableWidth(component, layout, next); }

        return this.getEditableWidth(layout);
      }, 0.1, 0.01, 10000, '%.2f');
      PropertyFields.NumberField(this.hasTextBounds(layout) ? 'Max Height' : 'Height', next => {
        if (next !== undefined) { this.setEditableHeight(component, layout, next); }

        return this.getEditableHeight(layout);
      }, 0.1, 0.01, 10000, '%.2f');
      PropertyFields.NumberField('Line Height', next => {
        if (next !== undefined && layout.lineHeight !== next) { layout.lineHeight = next; dirty(); }

        return layout.lineHeight;
      }, 0.5, 1, 1000, '%.1f');
      let spacing = style.fontSize ? layout.letterSpace / style.fontSize * 100 : 0;

      if (PropertyFields.NumberField('Letter Spacing', next => {
        if (next !== undefined) { spacing = next; }

        return spacing;
      }, 0.1, -100, 1000, '%.1f%%')) { layout.letterSpace = spacing / 100 * style.fontSize; dirty(); }
      const horizontal = [spec.TextAlignment.left, spec.TextAlignment.middle, spec.TextAlignment.right];
      const vertical = [spec.TextVerticalAlign.top, spec.TextVerticalAlign.middle, spec.TextVerticalAlign.bottom];

      PropertyFields.ComboField('Horizontal Alignment', next => {
        if (next !== undefined) { component.setTextAlign(horizontal[next]); }

        return Math.max(0, horizontal.indexOf(layout.textAlign));
      }, ['Left', 'Center', 'Right']);
      PropertyFields.ComboField('Vertical Alignment', next => {
        if (next !== undefined) { component.setTextVerticalAlign(vertical[next]); }

        return Math.max(0, vertical.indexOf(layout.textVerticalAlign));
      }, ['Top', 'Center', 'Bottom']);
    });
    this.group('Outline', () => {
      if (PropertyFields.Checkbox('Enabled', style, 'isOutlined')) { dirty(); }
      ImGui.BeginDisabled(!style.isOutlined);
      if (PropertyFields.FloatField('Width', style, 'outlineWidth')) { dirty(); }
      if (PropertyFields.ColorField('Color', style.outlineColor)) { dirty(); }
      ImGui.EndDisabled();
    }, false);
    this.group('Shadow', () => {
      if (PropertyFields.Checkbox('Enabled', style, 'hasShadow')) { dirty(); }
      ImGui.BeginDisabled(!style.hasShadow);
      if (PropertyFields.ColorField('Color', style.shadowColor)) { dirty(); }
      if (PropertyFields.FloatField('Blur', style, 'shadowBlur')) { dirty(); }
      if (PropertyFields.FloatField('Offset X', style, 'shadowOffsetX')) { dirty(); }
      if (PropertyFields.FloatField('Offset Y', style, 'shadowOffsetY')) { dirty(); }
      ImGui.EndDisabled();
    }, false);
    this.group('Rendering', () => this.drawRenderingProperties(), false);
  }

  private group (name: keyof typeof TEXT_PROPERTIES, draw: () => void, defaultOpen = true): void {
    if (!PropertyGrid.matches(name, ...TEXT_PROPERTIES[name])) { return; }
    if (PropertyFields.BeginFoldoutHeaderGroup(name, defaultOpen)) { draw(); }
    PropertyFields.EndFoldoutHeaderGroup();
  }
}
