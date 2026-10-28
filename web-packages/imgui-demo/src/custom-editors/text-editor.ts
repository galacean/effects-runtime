import { TextComponent, TextComponentBase, spec } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { editor } from '../core/decorators';
import { Editor } from './editor';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { PropertyGrid } from '../widgets/property-grid';
import { ImGui } from '../imgui';

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

@editor(TextComponentBase)
@editor(TextComponent)
@editor(RichTextComponent)
export class TextComponentEditor extends Editor {
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
      EditorGUILayout.Property('Text', width => ImGui.InputTextMultiline('##Text', next => {
        if (next !== undefined && next !== component.text) { component.setText(next); }

        return component.text ?? '';
      }, undefined, new ImGui.Vec2(width, 84)));
      const families = FONT_FAMILIES.includes(style.fontFamily) ? FONT_FAMILIES : [style.fontFamily, ...FONT_FAMILIES];

      EditorGUILayout.ComboField('Font Family', next => {
        if (next !== undefined && families[next] !== style.fontFamily) { component.setFontFamily(families[next]); }

        return Math.max(0, families.indexOf(style.fontFamily));
      }, families);
      EditorGUILayout.ComboField('Font Weight', next => {
        if (next !== undefined) { component.setFontWeight(FONT_WEIGHTS[next]); }

        return Math.max(0, FONT_WEIGHTS.indexOf(style.textWeight));
      }, ['Regular', 'Bold', 'Lighter']);
      EditorGUILayout.ComboField('Font Style', next => {
        if (next !== undefined) { component.setFontStyle(FONT_STYLES[next]); }

        return Math.max(0, FONT_STYLES.indexOf(style.fontStyle));
      }, ['Normal', 'Italic', 'Oblique']);
      EditorGUILayout.NumberField('Font Size', next => {
        if (next !== undefined && style.fontSize !== Math.round(next)) { style.fontSize = Math.max(1, Math.round(next)); dirty(); }

        return style.fontSize;
      }, 0.5, 1, 1000, '%.0f');
      if (EditorGUILayout.ColorField('Color', style.textColor)) { dirty(); }
    });
    this.group('Layout', () => {
      const modes = [spec.TextSizeMode.fixed, spec.TextSizeMode.autoWidth, spec.TextSizeMode.autoHeight];

      EditorGUILayout.ComboField('Auto Resize', next => {
        if (next !== undefined && layout.autoResize !== modes[next]) { layout.autoResize = modes[next]; dirty(); }

        return Math.max(0, modes.indexOf(layout.autoResize));
      }, ['Fixed', 'Auto Width', 'Auto Height']);
      EditorGUILayout.NumberField(this.hasTextBounds(layout) ? 'Max Width' : 'Width', next => {
        if (next !== undefined) { this.setEditableWidth(component, layout, next); }

        return this.getEditableWidth(layout);
      }, 0.1, 0.01, 10000, '%.2f');
      EditorGUILayout.NumberField(this.hasTextBounds(layout) ? 'Max Height' : 'Height', next => {
        if (next !== undefined) { this.setEditableHeight(component, layout, next); }

        return this.getEditableHeight(layout);
      }, 0.1, 0.01, 10000, '%.2f');
      EditorGUILayout.NumberField('Line Height', next => {
        if (next !== undefined && layout.lineHeight !== next) { layout.lineHeight = next; dirty(); }

        return layout.lineHeight;
      }, 0.5, 1, 1000, '%.1f');
      let spacing = style.fontSize ? layout.letterSpace / style.fontSize * 100 : 0;

      if (EditorGUILayout.NumberField('Letter Spacing', next => {
        if (next !== undefined) { spacing = next; }

        return spacing;
      }, 0.1, -100, 1000, '%.1f%%')) { layout.letterSpace = spacing / 100 * style.fontSize; dirty(); }
      const horizontal = [spec.TextAlignment.left, spec.TextAlignment.middle, spec.TextAlignment.right];
      const vertical = [spec.TextVerticalAlign.top, spec.TextVerticalAlign.middle, spec.TextVerticalAlign.bottom];

      EditorGUILayout.ComboField('Horizontal Alignment', next => {
        if (next !== undefined) { component.setTextAlign(horizontal[next]); }

        return Math.max(0, horizontal.indexOf(layout.textAlign));
      }, ['Left', 'Center', 'Right']);
      EditorGUILayout.ComboField('Vertical Alignment', next => {
        if (next !== undefined) { component.setTextVerticalAlign(vertical[next]); }

        return Math.max(0, vertical.indexOf(layout.textVerticalAlign));
      }, ['Top', 'Center', 'Bottom']);
    });
    this.group('Outline', () => {
      if (EditorGUILayout.Checkbox('Enabled', style, 'isOutlined')) { dirty(); }
      ImGui.BeginDisabled(!style.isOutlined);
      if (EditorGUILayout.FloatField('Width', style, 'outlineWidth')) { dirty(); }
      if (EditorGUILayout.ColorField('Color', style.outlineColor)) { dirty(); }
      ImGui.EndDisabled();
    }, false);
    this.group('Shadow', () => {
      if (EditorGUILayout.Checkbox('Enabled', style, 'hasShadow')) { dirty(); }
      ImGui.BeginDisabled(!style.hasShadow);
      if (EditorGUILayout.ColorField('Color', style.shadowColor)) { dirty(); }
      if (EditorGUILayout.FloatField('Blur', style, 'shadowBlur')) { dirty(); }
      if (EditorGUILayout.FloatField('Offset X', style, 'shadowOffsetX')) { dirty(); }
      if (EditorGUILayout.FloatField('Offset Y', style, 'shadowOffsetY')) { dirty(); }
      ImGui.EndDisabled();
    }, false);
    this.group('Rendering', () => this.drawRenderingProperties(), false);
  }

  private group (name: keyof typeof TEXT_PROPERTIES, draw: () => void, defaultOpen = true): void {
    if (!PropertyGrid.matches(name, ...TEXT_PROPERTIES[name])) { return; }
    if (EditorGUILayout.BeginFoldoutHeaderGroup(name, defaultOpen)) { draw(); }
    EditorGUILayout.EndFoldoutHeaderGroup();
  }
}
