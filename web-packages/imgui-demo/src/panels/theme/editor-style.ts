import { ImGui } from '../../imgui';
import { Palette, lighten, darken, withAlpha } from './editor-palette';

// ─── 语义颜色令牌 ────────────────────────────────────────
// panel 代码只引用这一层；所有值从 Palette 派生。

export const EditorColors = {
  // 背景梯度（从 base 上下偏移）
  windowBg:         Palette.base,                                // #242424
  childBg:          darken(Palette.base, 0.039),                 // #1A1A1A
  titleBarBg:       darken(Palette.base, 0.023),                 // #1E1E1E
  inputBg:          Palette.surface,                             // #0D0D0D
  popupBg:          withAlpha(darken(Palette.base, 0.023), 0.98),
  rowBgEven:        darken(Palette.base, 0.023),                 // #1E1E1E
  rowBgOdd:         darken(Palette.base, 0.004),                 // #232323
  toolbarBg:        lighten(Palette.base, 0.079),                // #3A3A3A

  // 强调/选中（从 accent 派生）
  accentPrimary:    Palette.accent,                              // #0960D1
  accentDim:        withAlpha(Palette.accent, 0.35),
  accentActive:     new ImGui.Vec4(0.149, 0.310, 0.471, 1.0),   // #264F78

  // 悬浮/高亮
  hoverOverlay:     new ImGui.Vec4(1, 1, 1, 0.06),
  selectedOverlay:  new ImGui.Vec4(1, 1, 1, 0.10),

  // 文本（从 text 派生）
  textPrimary:      Palette.text,                                // #C8C8C8
  textSecondary:    darken(Palette.text, 0.282),                 // #808080
  textWeak:         darken(Palette.text, 0.431),                 // #5A5A5A
  textDisabled:     darken(Palette.text, 0.431),

  // 边框/分割线
  border:           darken(Palette.base, 0.039),                 // #1A1A1A
  borderStrong:     withAlpha(lighten(Palette.base, 0.059), 0.80),
  separator:        darken(Palette.base, 0.039),

  // 按钮
  button:           lighten(Palette.base, 0.059),                // #333333
  buttonHovered:    lighten(Palette.base, 0.098),                // #3D3D3D
  buttonActive:     new ImGui.Vec4(0.149, 0.310, 0.471, 1.0),   // #264F78

  // 滚动条
  scrollbarBg:      withAlpha(Palette.surface, 0.70),
  scrollbarGrab:    lighten(Palette.base, 0.059),
  scrollbarHovered: lighten(Palette.base, 0.159),
  scrollbarActive:  lighten(Palette.base, 0.259),

  // 图标
  iconDefault:      new ImGui.Vec4(0.502, 0.502, 0.502, 1.0),
  iconActive:       new ImGui.Vec4(0.720, 0.720, 0.720, 1.0),

  // 控件标记
  checkMark:        Palette.accent,
  sliderGrab:       Palette.accent,

  // Tab
  tab:              withAlpha(darken(Palette.base, 0.061), 0.90),
  tabHovered:       lighten(Palette.base, 0.039),
  tabActive:        Palette.base,

  // Header（TreeNode, CollapsingHeader）
  header:           darken(Palette.base, 0.023),
  headerHovered:    lighten(Palette.base, 0.039),
  headerActive:     Palette.accent,

  // 列表/树选中状态
  selectionFocused:   Palette.accent,                              // #0960D1
  selectionUnfocused: new ImGui.Vec4(0.25, 0.30, 0.35, 1.0),      // 灰蓝色
  selectionHovered:   new ImGui.Vec4(1, 1, 1, 0.06),               // 微透明

  // Splitter
  splitterNormal:   darken(Palette.base, 0.004),
  splitterHovered:  new ImGui.Vec4(0.45, 0.65, 0.95, 1.0),
  splitterActive:   new ImGui.Vec4(0.45, 0.65, 0.95, 1.0),

  // 危险
  danger:           Palette.danger,
} as const;

// ─── 布局令牌 ────────────────────────────────────────────

export const EditorLayout = {
  frameRounding:     2.0,
  windowRounding:    0.0,
  childRounding:     0.0,
  popupRounding:     4.0,
  scrollbarRounding: 6.0,
  grabRounding:      1.0,
  tabRounding:       2.0,
  framePadding:      new ImGui.Vec2(4, 2),
  itemSpacing:       new ImGui.Vec2(8, 4),
  itemInnerSpacing:  new ImGui.Vec2(4, 4),
  indentSpacing:     20.0,
  scrollbarSize:     14.0,
  grabMinSize:       8.0,
  windowBorderSize:  1.0,
  childBorderSize:   1.0,
  frameBorderSize:   0.0,
  tabBorderSize:     0.0,
  toolbarHeight:     22,
} as const;
