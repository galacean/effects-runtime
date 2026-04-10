import { ImGui } from '../imgui';

/**
 * PushStyleColor 的 RAII 封装，防止 Push/Pop 计数不匹配。
 *
 * @example
 * const sc = new ScopedColor([ImGui.ImGuiCol.Button, EditorColors.button]);
 * ImGui.Button('OK');
 * sc.pop();
 */
export class ScopedColor {
  private count: number;

  constructor (...entries: [number, ImGui.Vec4][]) {
    for (const [col, val] of entries) {
      ImGui.PushStyleColor(col, val);
    }
    this.count = entries.length;
  }

  pop (): void {
    if (this.count > 0) {
      ImGui.PopStyleColor(this.count);
      this.count = 0;
    }
  }
}

/**
 * PushStyleVar 的 RAII 封装。
 *
 * @example
 * const sv = new ScopedVar([ImGui.StyleVar.FrameRounding, 0]);
 * ImGui.Button('OK');
 * sv.pop();
 */
export class ScopedVar {
  private count: number;

  constructor (...entries: [number, number | ImGui.Vec2][]) {
    for (const [sv, val] of entries) {
      ImGui.PushStyleVar(sv, val as number);
    }
    this.count = entries.length;
  }

  pop (): void {
    if (this.count > 0) {
      ImGui.PopStyleVar(this.count);
      this.count = 0;
    }
  }
}

/**
 * 同时管理 color + var 的便捷封装。
 * 回调执行完毕自动 Pop，无需手动管理。
 */
export function withStyle (
  colors: [number, ImGui.Vec4][],
  vars: [number, number | ImGui.Vec2][],
  fn: () => void,
): void {
  const sc = new ScopedColor(...colors);
  const sv = new ScopedVar(...vars);

  fn();
  sv.pop();
  sc.pop();
}
