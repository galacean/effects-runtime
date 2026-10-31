import { math } from '@galacean/effects';
import { StyleBoxFlat, Theme } from '@galacean/effects-plugin-gui';

export const EDITOR_FONT = 'Alibaba PuHuiTi';
export const EDITOR_FONT_SIZE = 40 / 3;
export const EDITOR_COMPACT_FONT_SIZE = 12;
export const EDITOR_SMALL_FONT_SIZE = 32 / 3;
export const EDITOR_TINY_FONT_SIZE = 28 / 3;
export const editorMetrics = { menuHeight: 25, tabHeight: 25, windowTitleHeight: 28, splitter: 2, toolbarHeight: 34, fieldHeight: 22, propertyRowHeight: 27, categoryHeight: 27, nestedCategoryHeight: 27 };

export function color (hex: string, alpha = 1): math.Color {
  return new math.Color(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha);
}

export const editorColors = {
  background: color('151515'), recessed: color('1A1A1A'), panel: color('242424'), title: color('151515'),
  header: color('2F2F2F'), secondary: color('383838'), input: color('0F0F0F'), outline: color('383838'),
  hover: color('575757'), primary: color('0070E0'), primaryHover: color('0E86FF'), primaryPress: color('0050A0'),
  selectedInactive: color('40576F'), selectedParent: color('2C323A'), foreground: color('C0C0C0'),
  foregroundHover: color('FFFFFF'), muted: color('808080'), disabled: color('5A5A5A'), clear: color('000000', 0),
  toolbar: color('242424'), inputActive: color('264F78'), rowEven: color('1E1E1E'), rowOdd: color('232323'),
  dropdown: color('383838'), dropdownOutline: color('4C4C4C'), foregroundHeader: color('C8C8C8'),
  positive: color('8BC24A'),
  dropTarget: color('26BBFF'), error: color('EF3535'),
  axes: [color('E34B42'), color('83BA36'), color('4C9FE6'), color('B7B7B7')],
};

export function editorBox (background: math.Color, padding = 0, radius = 0, border = editorColors.clear): StyleBoxFlat {
  const box = new StyleBoxFlat();

  box.setBackgroundColor(background);
  box.setBorderColor(border);
  const width = border.a ? 1 : 0;

  box.setBorderWidths(width, width, width, width);
  box.setCornerRadii(radius, radius, radius, radius);
  box.setContentMargins(padding, padding, padding, padding);

  return box;
}

export function editorDetailBackground (depth: number, hovered = false): math.Color {
  const base = hovered ? editorColors.header : editorColors.panel, offset = [0, 4, 6, 10, 6, 4][depth % 6] / 255;

  return new math.Color(base.r + offset, base.g + offset, base.b + offset, 1);
}

/** Editor appearance is inherited by the persistent Control tree. */
export function createEditorTheme (): Theme {
  const theme = new Theme();
  const c = editorColors;

  theme.setFont('Control', 'font', { family: EDITOR_FONT, weight: 'normal', style: 'normal' });
  theme.setFontSize('Control', 'fontSize', EDITOR_FONT_SIZE);
  theme.setColor('Label', 'fontColor', c.foreground);
  theme.setStyleBox('PanelContainer', 'panel', editorBox(c.panel));
  theme.setStyleBox('Panel', 'panel', editorBox(c.panel));
  theme.setConstant('BoxContainer', 'separation', 4);
  theme.setConstant('GridContainer', 'horizontalSeparation', 4);
  theme.setConstant('GridContainer', 'verticalSeparation', 4);
  theme.setStyleBox('Separator', 'separator', editorBox(c.recessed));

  for (const [state, background] of Object.entries({ normal: c.secondary, hover: c.hover, pressed: c.header, hoverPressed: c.header, disabled: c.dropdown })) {
    const box = editorBox(background, 0, 4, state === 'disabled' ? c.recessed : c.input);

    box.setContentMargins(16, state === 'pressed' || state === 'hoverPressed' ? 4.5 : 3.5, 16, state === 'pressed' || state === 'hoverPressed' ? 2.5 : 3.5);
    theme.setStyleBox('Button', state, box);
  }
  theme.setStyleBox('Button', 'focus', editorBox(c.clear, 0, 2, c.primary));
  for (const name of ['fontColor', 'fontFocusColor', 'fontHoverColor', 'fontPressedColor', 'fontHoverPressedColor']) {
    theme.setColor('Button', name, c.foregroundHover);
  }
  theme.setColor('Button', 'fontDisabledColor', c.disabled);
  theme.setTypeVariation('EditorPrimaryButton', 'Button');
  for (const [state, background] of Object.entries({ normal: c.primary, hover: c.primaryHover, pressed: c.primaryPress, hoverPressed: c.primaryPress, disabled: c.dropdown })) {
    const box = editorBox(background, 0, 4, state === 'disabled' ? c.recessed : c.input);

    box.setContentMargins(14, state === 'pressed' || state === 'hoverPressed' ? 4 : 3, 14, state === 'pressed' || state === 'hoverPressed' ? 2 : 3);
    theme.setStyleBox('EditorPrimaryButton', state, box);
  }
  theme.setFont('EditorPrimaryButton', 'font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' });
  theme.setTypeVariation('EditorDialog', 'PopupPanel');
  theme.setStyleBox('EditorDialog', 'panel', editorBox(c.recessed, 1, 2, c.outline));
  theme.setColor('Checkbox', 'markColor', c.primary);
  theme.setColor('Checkbox', 'markOutlineColor', c.outline);
  theme.setColor('Checkbox', 'markUncheckedColor', c.input);
  theme.setConstant('Checkbox', 'markSize', 18);
  for (const state of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
    theme.setStyleBox('Checkbox', state, editorBox(c.clear));
  }
  for (const state of ['normal', 'readOnly']) {
    const box = editorBox(state === 'readOnly' ? c.header : c.input, 4, 4, c.outline);

    box.setContentMargins(8, 3, 8, 4);
    theme.setStyleBox('TextInput', state, box);
  }
  theme.setStyleBox('TextInput', 'focus', editorBox(c.clear, 0, 4, c.primary));
  theme.setStyleBox('TextInput', 'hover', editorBox(c.clear, 0, 4, c.hover));
  theme.setColor('TextInput', 'fontColor', c.foreground);
  theme.setColor('TextInput', 'fontReadOnlyColor', c.foreground);
  theme.setColor('TextInput', 'fontPlaceholderColor', c.muted);
  theme.setColor('TextInput', 'caretColor', c.foregroundHover);
  theme.setColor('TextInput', 'selectionColor', color('0070E0', .35));
  theme.setStyleBox('Popup', 'panel', editorBox(c.panel, 6, 3, c.outline));
  theme.setTypeVariation('EditorMenu', 'Popup');
  const menuPanel = editorBox(c.dropdown, 0, 0, c.dropdownOutline);

  menuPanel.setContentMargins(0, 4, 0, 4); theme.setStyleBox('EditorMenu', 'panel', menuPanel);
  theme.setTypeVariation('EditorChoiceMenu', 'EditorMenu');
  theme.setStyleBox('EditorChoiceMenu', 'panel', editorBox(c.dropdown, 0, 0, c.dropdownOutline));
  theme.setStyleBox('PopupMenu', 'hover', editorBox(c.primary));
  theme.setColor('PopupMenu', 'fontColor', c.foreground);
  theme.setColor('PopupMenu', 'fontDisabledColor', c.disabled);
  theme.setConstant('PopupMenu', 'itemHeight', 24);
  for (const [name, background] of Object.entries({ scroll: c.recessed, grabber: c.secondary, grabberHighlight: c.hover, grabberPressed: c.muted })) {
    theme.setStyleBox('ScrollBar', name, editorBox(background, 0, 4));
  }
  for (const type of ['HScrollBar', 'VScrollBar']) {
    const scroll = editorBox(c.recessed), focus = editorBox(c.recessed, 0, 0, c.primary);

    for (const box of [scroll, focus]) { box.setContentMargins(type === 'VScrollBar' ? 7 : 0, type === 'HScrollBar' ? 7 : 0, type === 'VScrollBar' ? 7 : 0, type === 'HScrollBar' ? 7 : 0); }
    theme.setStyleBox(type, 'scroll', scroll); theme.setStyleBox(type, 'scrollFocus', focus);
  }
  theme.setTypeVariation('EditorTreeButton', 'Button');
  theme.setStyleBox('EditorTreeButton', 'normal', editorBox(c.clear, 4));
  theme.setStyleBox('EditorTreeButton', 'hover', editorBox(c.clear, 4));
  theme.setTypeVariation('EditorToolbarButton', 'Button');
  theme.setStyleBox('EditorToolbarButton', 'normal', editorBox(c.clear, 4, 2));
  theme.setStyleBox('EditorToolbarButton', 'hover', editorBox(c.dropdown, 4, 4));
  for (const state of ['pressed', 'hoverPressed']) {
    const box = editorBox(c.dropdown, 4, 4);

    box.setContentMargins(4, 5, 4, 3); theme.setStyleBox('EditorToolbarButton', state, box);
  }
  theme.setStyleBox('EditorToolbarButton', 'disabled', editorBox(c.clear, 4, 2));
  theme.setStyleBox('EditorToolbarButton', 'focus', editorBox(c.clear));
  theme.setTypeVariation('EditorToggleButton', 'EditorToolbarButton');
  theme.setStyleBox('EditorToggleButton', 'normal', editorBox(c.clear, 4, 4));
  theme.setStyleBox('EditorToggleButton', 'pressed', editorBox(c.primary, 4, 4));
  theme.setStyleBox('EditorToggleButton', 'hoverPressed', editorBox(c.primaryHover, 4, 4));
  theme.setTypeVariation('EditorSourceRow', 'EditorToolbarButton');
  theme.setStyleBox('EditorSourceRow', 'hover', editorBox(c.panel));
  theme.setStyleBox('EditorSourceRow', 'pressed', editorBox(c.selectedInactive));
  theme.setStyleBox('EditorSourceRow', 'hoverPressed', editorBox(c.selectedInactive));
  theme.setTypeVariation('EditorListRow', 'EditorSourceRow');
  theme.setTypeVariation('EditorListRowActive', 'EditorListRow');
  theme.setStyleBox('EditorListRowActive', 'pressed', editorBox(c.primary));
  theme.setStyleBox('EditorListRowActive', 'hoverPressed', editorBox(c.primary));
  theme.setTypeVariation('EditorViewportMenu', 'EditorToolbarButton');
  for (const [state, background] of Object.entries({ normal: c.clear, hover: c.hover, pressed: c.header, hoverPressed: c.header, disabled: c.clear })) {
    theme.setStyleBox('EditorViewportMenu', state, editorBox(background, 4, 5));
  }
  theme.setTypeVariation('EditorViewportToggleButton', 'EditorViewportMenu');
  for (const type of ['EditorNumericField', 'EditorComboButton']) {
    theme.setTypeVariation(type, 'Button');
    const combo = type === 'EditorComboButton';
    const active = combo ? c.hover : c.primary;

    for (const [state, border] of Object.entries({ normal: c.outline, hover: c.hover, pressed: active, hoverPressed: active, disabled: combo ? c.dropdownOutline : c.recessed })) {
      const background = state === 'disabled' ? combo ? c.dropdown : c.header : c.input;
      const box = editorBox(background, 0, 4, border);

      box.setContentMargins(7, 2.5, 7, 2.5); theme.setStyleBox(type, state, box);
    }
    theme.setStyleBox(type, 'focus', editorBox(c.clear, 0, 4, c.primary));
  }
  theme.setColor('EditorComboButton', 'fontColor', c.foreground);
  theme.setTypeVariation('EditorNumericInput', 'LineEdit');
  const numericInput = editorBox(c.input, 0, 4, c.primary);

  numericInput.setContentMargins(7, 2.5, 7, 2.5);
  theme.setStyleBox('EditorNumericInput', 'normal', numericInput);
  theme.setTypeVariation('EditorPositiveButton', 'Button');
  for (const [state, background] of Object.entries({ normal: c.secondary, hover: c.hover, pressed: c.header, hoverPressed: c.header, disabled: c.dropdown })) {
    const box = editorBox(background, 0, 4, c.input);

    box.setContentMargins(8, 2, 8, 2); theme.setStyleBox('EditorPositiveButton', state, box);
  }
  theme.setColor('EditorPositiveButton', 'fontColor', c.foreground);
  theme.setColor('EditorToolbarButton', 'fontColor', c.foreground);
  for (const [name, background] of Object.entries({ track: c.input, fill: c.input, fillHighlight: c.input, grabber: c.foreground, grabberHighlight: c.foregroundHover, grabberDisabled: c.foreground })) {
    theme.setStyleBox('Slider', name, editorBox(background, 0, name.startsWith('grabber') ? 4 : 2));
  }
  theme.setConstant('Slider', 'grabberSize', 8);
  theme.setTypeVariation('EditorSearchField', 'LineEdit');
  for (const state of ['normal', 'readOnly']) {
    const box = editorBox(state === 'readOnly' ? c.header : c.input, 0, 12, c.outline);

    box.setContentMargins(24, 2, 8, 2); theme.setStyleBox('EditorSearchField', state, box);
  }
  theme.setStyleBox('EditorSearchField', 'focus', editorBox(c.clear, 0, 12, c.primary));
  theme.setStyleBox('EditorSearchField', 'hover', editorBox(c.clear, 0, 12, c.hover));
  theme.setTypeVariation('EditorMenuButton', 'Button');
  theme.setStyleBox('EditorMenuButton', 'normal', editorBox(c.clear, 4));
  theme.setStyleBox('EditorMenuButton', 'hover', editorBox(c.primary, 4));
  theme.setStyleBox('EditorMenuButton', 'pressed', editorBox(c.primary, 4));
  theme.setStyleBox('EditorMenuButton', 'hoverPressed', editorBox(c.primary, 4));
  theme.setStyleBox('EditorMenuButton', 'disabled', editorBox(c.clear, 4));
  theme.setStyleBox('EditorMenuButton', 'focus', editorBox(c.primary));
  theme.setColor('EditorMenuButton', 'fontColor', c.foreground);
  theme.setTypeVariation('EditorChoiceRow', 'EditorMenuButton');
  theme.setStyleBox('EditorChoiceRow', 'focus', editorBox(c.clear, 0, 4, c.primary));
  theme.setColor('EditorChoiceRow', 'fontColor', c.foregroundHover);
  theme.setTypeVariation('EditorColumnHeader', 'Button');
  for (const [state, background] of Object.entries({ normal: c.header, hover: c.dropdown, pressed: c.dropdown, hoverPressed: c.dropdown, disabled: c.header })) {
    const box = editorBox(background);

    box.setContentMargins(6, 0, 6, 0); theme.setStyleBox('EditorColumnHeader', state, box);
  }
  theme.setColor('EditorColumnHeader', 'fontColor', c.foreground);
  theme.setStyleBox('EditorColumnHeader', 'focus', editorBox(c.clear));
  theme.setTypeVariation('EditorMenuBarButton', 'EditorToolbarButton');
  for (const [state, background] of Object.entries({ normal: c.clear, hover: c.hover, pressed: c.primary, hoverPressed: c.primary, disabled: c.clear })) {
    const box = editorBox(background);

    box.setContentMargins(12, 4, 12, 4); theme.setStyleBox('EditorMenuBarButton', state, box);
  }
  theme.setTypeVariation('EditorDockTab', 'EditorToolbarButton');
  for (const state of ['normal', 'hover', 'pressed', 'hoverPressed']) { theme.setStyleBox('EditorDockTab', state, editorBox(c.clear, 4)); }
  theme.setTypeVariation('EditorDockClose', 'EditorToolbarButton');
  for (const state of ['normal', 'hover', 'pressed', 'hoverPressed']) { theme.setStyleBox('EditorDockClose', state, editorBox(c.clear)); }
  theme.setTypeVariation('EditorWindowClose', 'EditorDockClose');
  for (const state of ['hover', 'pressed', 'hoverPressed']) { theme.setStyleBox('EditorWindowClose', state, editorBox(color('FF1414', .59))); }
  theme.setTypeVariation('EditorCategory', 'Button');
  theme.setStyleBox('EditorCategory', 'normal', editorBox(c.header, 6));
  theme.setStyleBox('EditorCategory', 'hover', editorBox(c.hover, 6));
  theme.setStyleBox('EditorCategory', 'pressed', editorBox(c.header, 6));
  theme.setStyleBox('EditorCategory', 'focus', editorBox(c.clear));
  theme.setColor('EditorCategory', 'fontColor', c.foregroundHeader);
  theme.setFont('EditorCategory', 'font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' });

  return theme;
}
