import type { TextComponent } from '@galacean/effects';
import { spec, TextComponentBase } from '@galacean/effects';
import { editor } from '../core/decorators';
import { Editor } from './editor';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { ImGui } from '../imgui';

// 字体家族选项
const FONT_FAMILY_OPTIONS = ['Inter', 'Arial', 'Helvetica', 'sans-serif', 'serif', 'monospace'];

// 字重选项
const FONT_WEIGHT_OPTIONS: { label: string, value: spec.TextWeight }[] = [
  { label: 'Regular', value: spec.TextWeight.normal },
  { label: 'Bold', value: spec.TextWeight.bold },
  { label: 'Lighter', value: spec.TextWeight.lighter },
];

// 字体样式选项
const FONT_STYLE_OPTIONS: { label: string, value: spec.FontStyle }[] = [
  { label: 'Normal', value: spec.FontStyle.normal },
  { label: 'Italic', value: spec.FontStyle.italic },
  { label: 'Oblique', value: spec.FontStyle.oblique },
];

@editor(TextComponentBase)
export class TextComponentEditor extends Editor {
  private fontFamilyIndex = 0;
  private fontWeightIndex = 0;
  private fontStyleIndex = 0;
  private textAlignIndex = 0;
  private verticalAlignIndex = 1; // 默认 middle
  private letterSpacingPercent = 0;

  override onInspectorGUI (): void {
    const textComponent = this.target as TextComponent;

    if (!textComponent || !textComponent.textStyle || !textComponent.textLayout) {
      return;
    }

    const style = textComponent.textStyle;
    const layout = textComponent.textLayout;

    // 同步当前值到编辑器状态
    this.syncFromComponent(style, layout);

    ImGui.Spacing();
    ImGui.Separator();
    ImGui.Spacing();

    // Typography 标题区域 - 对齐到 Label 位置
    ImGui.PushStyleColor(ImGui.Col.Text, new ImGui.Vec4(0.7, 0.7, 0.7, 1.0));
    ImGui.Text('       TYPOGRAPHY');
    ImGui.PopStyleColor();

    // 按钮颜色定义 - 使用更深的蓝色
    const buttonWidth = 100;
    const buttonHeight = 24;
    const buttonSize = new ImGui.Vec2(buttonWidth, buttonHeight);
    const activeColor = new ImGui.Vec4(0.2, 0.47, 0.86, 1.0); // 更深的蓝色
    const hoverColor = new ImGui.Vec4(0.26, 0.59, 0.98, 1.0); // hover 时稍亮
    const inactiveColor = new ImGui.Vec4(0.2, 0.2, 0.2, 1.0);
    const inactiveHoverColor = new ImGui.Vec4(0.3, 0.3, 0.3, 1.0);

    // 字体家族
    EditorGUILayout.Label('Font Family');
    ImGui.SetNextItemWidth(-1);
    if (ImGui.BeginCombo('##FontFamily', FONT_FAMILY_OPTIONS[this.fontFamilyIndex])) {
      for (let i = 0; i < FONT_FAMILY_OPTIONS.length; i++) {
        const isSelected = this.fontFamilyIndex === i;

        if (ImGui.Selectable(FONT_FAMILY_OPTIONS[i], isSelected)) {
          this.fontFamilyIndex = i;
          style.fontFamily = FONT_FAMILY_OPTIONS[i];
          textComponent.isDirty = true;
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }

    ImGui.Spacing();

    // 字重按钮组
    EditorGUILayout.Label('Font Weight');
    for (let i = 0; i < FONT_WEIGHT_OPTIONS.length; i++) {
      if (i > 0) {
        ImGui.SameLine();
      }
      const isActive = this.fontWeightIndex === i;

      ImGui.PushStyleColor(ImGui.Col.Button, isActive ? activeColor : inactiveColor);
      ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isActive ? hoverColor : inactiveHoverColor);
      ImGui.PushStyleColor(ImGui.Col.ButtonActive, isActive ? activeColor : inactiveColor);
      if (ImGui.Button(FONT_WEIGHT_OPTIONS[i].label + '##FontWeight' + i, buttonSize)) {
        this.fontWeightIndex = i;
        style.textWeight = FONT_WEIGHT_OPTIONS[i].value;
        textComponent.isDirty = true;
      }
      ImGui.PopStyleColor(3);
    }

    ImGui.Spacing();

    // 字体样式按钮组
    EditorGUILayout.Label('Font Style');
    for (let i = 0; i < FONT_STYLE_OPTIONS.length; i++) {
      if (i > 0) {
        ImGui.SameLine();
      }
      const isActive = this.fontStyleIndex === i;

      ImGui.PushStyleColor(ImGui.Col.Button, isActive ? activeColor : inactiveColor);
      ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isActive ? hoverColor : inactiveHoverColor);
      ImGui.PushStyleColor(ImGui.Col.ButtonActive, isActive ? activeColor : inactiveColor);
      if (ImGui.Button(FONT_STYLE_OPTIONS[i].label + '##FontStyle' + i, buttonSize)) {
        this.fontStyleIndex = i;
        style.fontStyle = FONT_STYLE_OPTIONS[i].value;
        textComponent.isDirty = true;
      }
      ImGui.PopStyleColor(3);
    }

    ImGui.Spacing();

    // 字号 - 可拖动控件
    EditorGUILayout.Label('Font Size');
    const fontSizeAccess = (value?: number): number => {
      if (value !== undefined) {
        style.fontSize = Math.round(value);
        textComponent.isDirty = true;
      }

      return style.fontSize;
    };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat('##FontSize', fontSizeAccess, 0.5, 8, 200, '%.0f')) {
      // 字号已在 access 函数中更新
    }

    ImGui.Spacing();

    // Text 输入框 - 支持多行换行
    EditorGUILayout.Label('Text');
    const textAccess = (value?: string): string => {
      if (value !== undefined) {
        textComponent.setText(value);
      }

      return textComponent.text || '';
    };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.InputTextMultiline('##Text', textAccess)) {
      // 文本已在 access 函数中更新
    }

    ImGui.Spacing();

    // Auto Resize 按钮组
    EditorGUILayout.Label('Auto Resize');
    const autoResizeButtonSize = new ImGui.Vec2(80, buttonHeight);

    // Fixed 按钮
    const isFixedActive = layout.autoResize === spec.TextSizeMode.fixed;

    ImGui.PushStyleColor(ImGui.Col.Button, isFixedActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isFixedActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isFixedActive ? activeColor : inactiveColor);
    if (ImGui.Button('Fixed##AutoResizeFixed', autoResizeButtonSize)) {
      layout.autoResize = spec.TextSizeMode.fixed;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Auto Width 按钮
    const isAutoWidthActive = layout.autoResize === spec.TextSizeMode.autoWidth;

    ImGui.PushStyleColor(ImGui.Col.Button, isAutoWidthActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isAutoWidthActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isAutoWidthActive ? activeColor : inactiveColor);
    if (ImGui.Button('Auto Width##AutoResizeAutoWidth', autoResizeButtonSize)) {
      layout.autoResize = spec.TextSizeMode.autoWidth;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Auto Height 按钮
    const isAutoHeightActive = layout.autoResize === spec.TextSizeMode.autoHeight;

    ImGui.PushStyleColor(ImGui.Col.Button, isAutoHeightActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isAutoHeightActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isAutoHeightActive ? activeColor : inactiveColor);
    if (ImGui.Button('Auto Height##AutoResizeAutoHeight', autoResizeButtonSize)) {
      layout.autoResize = spec.TextSizeMode.autoHeight;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.Spacing();

    // Line height - 直接数值输入
    EditorGUILayout.Label('Line Height');
    const lineHeightAccess = (value?: number): number => {
      if (value !== undefined) {
        layout.lineHeight = value;
        textComponent.isDirty = true;
      }

      return layout.lineHeight;
    };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat('##LineHeightValue', lineHeightAccess, 0.5, 1, 200, '%.0f')) {
      // 行高已在 access 函数中更新
    }

    ImGui.Spacing();

    // Letter spacing
    EditorGUILayout.Label('Letter Spacing');
    const letterSpacingAccess = (value?: number): number => {
      if (value !== undefined) {
        this.letterSpacingPercent = value;
      }

      return this.letterSpacingPercent;
    };

    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragFloat('##LetterSpacing', letterSpacingAccess, 0.1, -50, 100, '%.0f%%')) {
      // 将百分比转换为实际像素值 (基于字号)
      layout.letterSpace = (this.letterSpacingPercent / 100) * style.fontSize;
      textComponent.isDirty = true;
    }

    ImGui.Spacing();
    ImGui.Separator();
    ImGui.Spacing();

    // 对齐设置标签 - 对齐到 Label 位置
    ImGui.PushStyleColor(ImGui.Col.Text, new ImGui.Vec4(0.7, 0.7, 0.7, 1.0));
    ImGui.Text('       ALIGNMENT');
    ImGui.PopStyleColor();
    ImGui.Spacing();

    // 水平对齐按钮组
    EditorGUILayout.Label('Horizontal');
    const alignButtonWidth = 80;
    const alignButtonSize = new ImGui.Vec2(alignButtonWidth, buttonHeight);

    // Left 按钮
    const isLeftActive = this.textAlignIndex === 0;

    ImGui.PushStyleColor(ImGui.Col.Button, isLeftActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isLeftActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isLeftActive ? activeColor : inactiveColor);
    if (ImGui.Button('Left##AlignLeft', alignButtonSize)) {
      this.textAlignIndex = 0;
      layout.textAlign = spec.TextAlignment.left;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Center 按钮
    const isCenterActive = this.textAlignIndex === 1;

    ImGui.PushStyleColor(ImGui.Col.Button, isCenterActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isCenterActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isCenterActive ? activeColor : inactiveColor);
    if (ImGui.Button('Center##AlignCenter', alignButtonSize)) {
      this.textAlignIndex = 1;
      layout.textAlign = spec.TextAlignment.middle;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Right 按钮
    const isRightActive = this.textAlignIndex === 2;

    ImGui.PushStyleColor(ImGui.Col.Button, isRightActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isRightActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isRightActive ? activeColor : inactiveColor);
    if (ImGui.Button('Right##AlignRight', alignButtonSize)) {
      this.textAlignIndex = 2;
      layout.textAlign = spec.TextAlignment.right;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.Spacing();

    // 垂直对齐按钮组
    EditorGUILayout.Label('Vertical');

    // Top 按钮
    const isTopActive = this.verticalAlignIndex === 0;

    ImGui.PushStyleColor(ImGui.Col.Button, isTopActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isTopActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isTopActive ? activeColor : inactiveColor);
    if (ImGui.Button('Top##AlignTop', alignButtonSize)) {
      this.verticalAlignIndex = 0;
      layout.textVerticalAlign = spec.TextVerticalAlign.top;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Middle 按钮
    const isMiddleActive = this.verticalAlignIndex === 1;

    ImGui.PushStyleColor(ImGui.Col.Button, isMiddleActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isMiddleActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isMiddleActive ? activeColor : inactiveColor);
    if (ImGui.Button('Middle##AlignMiddle', alignButtonSize)) {
      this.verticalAlignIndex = 1;
      layout.textVerticalAlign = spec.TextVerticalAlign.middle;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);

    ImGui.SameLine();

    // Bottom 按钮
    const isBottomActive = this.verticalAlignIndex === 2;

    ImGui.PushStyleColor(ImGui.Col.Button, isBottomActive ? activeColor : inactiveColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isBottomActive ? hoverColor : inactiveHoverColor);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, isBottomActive ? activeColor : inactiveColor);
    if (ImGui.Button('Bottom##AlignBottom', alignButtonSize)) {
      this.verticalAlignIndex = 2;
      layout.textVerticalAlign = spec.TextVerticalAlign.bottom;
      textComponent.isDirty = true;
    }
    ImGui.PopStyleColor(3);
  }

  /**
   * 从组件同步状态到编辑器
   */
  private syncFromComponent (style: any, layout: any): void {
    // 同步字体家族
    const familyIndex = FONT_FAMILY_OPTIONS.indexOf(style.fontFamily);

    if (familyIndex >= 0) {
      this.fontFamilyIndex = familyIndex;
    }

    // 同步字重
    const weightIndex = FONT_WEIGHT_OPTIONS.findIndex(opt => opt.value === style.textWeight);

    if (weightIndex >= 0) {
      this.fontWeightIndex = weightIndex;
    }

    // 同步字体样式
    const styleIndex = FONT_STYLE_OPTIONS.findIndex(opt => opt.value === style.fontStyle);

    if (styleIndex >= 0) {
      this.fontStyleIndex = styleIndex;
    }

    // 字号现在直接从 style.fontSize 读取，不需要同步索引

    // 同步字间距 (转换为百分比)
    if (style.fontSize > 0) {
      this.letterSpacingPercent = (layout.letterSpace / style.fontSize) * 100;
    }

    // 同步水平对齐
    switch (layout.textAlign) {
      case spec.TextAlignment.left:
        this.textAlignIndex = 0;

        break;
      case spec.TextAlignment.middle:
        this.textAlignIndex = 1;

        break;
      case spec.TextAlignment.right:
        this.textAlignIndex = 2;

        break;
    }

    // 同步垂直对齐
    switch (layout.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
        this.verticalAlignIndex = 0;

        break;
      case spec.TextVerticalAlign.middle:
        this.verticalAlignIndex = 1;

        break;
      case spec.TextVerticalAlign.bottom:
        this.verticalAlignIndex = 2;

        break;
    }
  }
}
