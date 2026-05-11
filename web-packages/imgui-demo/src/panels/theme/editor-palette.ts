import { ImGui } from '../../imgui';

/**
 * 基础调色板 — 所有语义色从这里派生。
 * 换肤只需修改这 5 个原子色值。
 */
export const Palette = {
  /** 窗口背景基准灰度 */
  base:    new ImGui.Vec4(0.141, 0.141, 0.141, 1.0),   // #242424
  /** 强调色（选中、活跃控件的主色调） */
  accent:  new ImGui.Vec4(0.035, 0.376, 0.820, 1.0),   // #0960D1
  /** 前景文本色 */
  text:    new ImGui.Vec4(0.784, 0.784, 0.784, 1.0),   // #C8C8C8
  /** 深层背景（输入框等凹陷区域） */
  surface: new ImGui.Vec4(0.051, 0.051, 0.051, 1.0),   // #0D0D0D
  /** 危险/错误色 */
  danger:  new ImGui.Vec4(0.900, 0.200, 0.200, 1.0),
} as const;

// ── 色彩工具函数 ─────────────────────────────────────────

/** 提亮：RGB 各分量加 amount（保留 alpha） */
export function lighten (c: ImGui.Vec4, amount: number): ImGui.Vec4 {
  return new ImGui.Vec4(
    Math.min(c.x + amount, 1),
    Math.min(c.y + amount, 1),
    Math.min(c.z + amount, 1),
    c.w,
  );
}

/** 压暗：RGB 各分量减 amount（保留 alpha） */
export function darken (c: ImGui.Vec4, amount: number): ImGui.Vec4 {
  return new ImGui.Vec4(
    Math.max(c.x - amount, 0),
    Math.max(c.y - amount, 0),
    Math.max(c.z - amount, 0),
    c.w,
  );
}

/** 替换 alpha 通道 */
export function withAlpha (c: ImGui.Vec4, a: number): ImGui.Vec4 {
  return new ImGui.Vec4(c.x, c.y, c.z, a);
}

/** Vec4 转 ImGui U32（用于 DrawList 调用） */
export function vec4ToU32 (c: ImGui.Vec4): number {
  return ImGui.GetColorU32(c);
}

/** 线性插值 */
export function lerpColor (a: ImGui.Vec4, b: ImGui.Vec4, t: number): ImGui.Vec4 {
  return new ImGui.Vec4(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
    a.w + (b.w - a.w) * t,
  );
}
