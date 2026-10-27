import { ImGui } from '../imgui';

/** Draw a centered caret within a fixed square slot. */
export function drawEditorArrow (x: number, y: number, size: number, direction: 'down' | 'right', tint: ImGui.Vec4): void {
  const point = (dx: number, dy: number) => new ImGui.Vec2(Math.round(x + dx * size), Math.round(y + dy * size));
  const points = direction === 'down'
    ? [point(0.25, 0.375), point(0.75, 0.375), point(0.5, 0.625)]
    : [point(0.375, 0.25), point(0.625, 0.5), point(0.375, 0.75)];

  ImGui.GetWindowDrawList().AddTriangleFilled(points[0], points[1], points[2], ImGui.GetColorU32(tint));
}

/** Draw the wider chevron used by dropdown controls. */
export function drawEditorChevron (x: number, y: number, size: number, tint: ImGui.Vec4): void {
  const point = (dx: number, dy: number) => new ImGui.Vec2(Math.round(x + dx * size), Math.round(y + dy * size));
  const points = [point(0.25, 0.375), point(0.5, 0.625), point(0.75, 0.375)];
  const dl = ImGui.GetWindowDrawList(), color = ImGui.GetColorU32(tint);

  dl.AddLine(points[0], points[1], color, 1.5);
  dl.AddLine(points[1], points[2], color, 1.5);
}
