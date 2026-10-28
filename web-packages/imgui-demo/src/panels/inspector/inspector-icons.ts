import { ImGui } from '../../imgui';
import { PROPERTY_COLORS as C } from '../../widgets/property-grid';

export type InspectorIcon = 'object' | 'component' | 'lock' | 'unlock' | 'settings' | 'material' | 'transform';

export function drawInspectorIcon (icon: InspectorIcon, x: number, y: number, size: number, tint = C.text): void {
  const dl = ImGui.GetWindowDrawList(), color = ImGui.GetColorU32(tint);
  const point = (px: number, py: number) => new ImGui.Vec2(x + px * size, y + py * size);
  const line = (x1: number, y1: number, x2: number, y2: number) => dl.AddLine(point(x1, y1), point(x2, y2), color, 1.4);

  if (icon === 'object') {
    const vertices = [[0.5, 0.08], [0.91, 0.29], [0.91, 0.72], [0.5, 0.94], [0.09, 0.72], [0.09, 0.29]].map(([px, py]) => point(px, py));

    dl.AddPolyline(vertices, vertices.length, color, ImGui.DrawFlags.Closed, 1.3);
    line(0.09, 0.29, 0.5, 0.51); line(0.91, 0.29, 0.5, 0.51); line(0.5, 0.51, 0.5, 0.94); line(0.3, 0.18, 0.71, 0.4);
  } else if (icon === 'lock' || icon === 'unlock') {
    dl.AddRectFilled(point(0.18, 0.43), point(0.76, 0.91), color, 1.5);
    const vertices: ImGui.Vec2[] = [];
    const centerX = icon === 'lock' ? 0.47 : 0.73;

    for (let index = 0; index <= 12; index++) {
      const angle = Math.PI + index / 12 * Math.PI;

      vertices.push(point(centerX + Math.cos(angle) * 0.23, 0.34 + Math.sin(angle) * 0.25));
    }
    dl.AddPolyline(vertices, vertices.length, color, 0, 1.8);
    line(centerX - 0.23, 0.33, centerX - 0.23, 0.52);
    if (icon === 'lock') { line(centerX + 0.23, 0.33, centerX + 0.23, 0.5); }
  } else if (icon === 'settings') {
    const vertices: ImGui.Vec2[] = [];

    for (let index = 0; index < 32; index++) {
      const angle = index / 32 * Math.PI * 2;
      const radius = index % 4 === 0 || index % 4 === 3 ? 0.31 : 0.44;

      vertices.push(point(0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius));
    }
    dl.AddPolyline(vertices, vertices.length, color, ImGui.DrawFlags.Closed, 1.4);
    dl.AddCircle(point(0.5, 0.5), size * 0.12, color, 12, 1.5);
  } else if (icon === 'material') {
    dl.AddCircle(point(0.5, 0.5), size * 0.38, color, 20, 1.4);
    for (const [rx, ry] of [[0.17, 0.38], [0.38, 0.14]]) {
      const vertices = Array.from({ length: 20 }, (_, index) => {
        const angle = index / 20 * Math.PI * 2;

        return point(0.5 + Math.cos(angle) * rx, 0.5 + Math.sin(angle) * ry);
      });

      dl.AddPolyline(vertices, vertices.length, color, ImGui.DrawFlags.Closed, 1);
    }
  } else if (icon === 'transform') {
    line(0.5, 0.08, 0.5, 0.92); line(0.08, 0.5, 0.92, 0.5);
    line(0.5, 0.08, 0.34, 0.24); line(0.5, 0.08, 0.66, 0.24);
    line(0.5, 0.92, 0.34, 0.76); line(0.5, 0.92, 0.66, 0.76);
    line(0.08, 0.5, 0.24, 0.34); line(0.08, 0.5, 0.24, 0.66);
    line(0.92, 0.5, 0.76, 0.34); line(0.92, 0.5, 0.76, 0.66);
  } else {
    dl.AddRect(point(0.24, 0.24), point(0.76, 0.76), color, 1.5, 0, 1.4);
    for (const offset of [0.35, 0.65]) {
      line(offset, 0.08, offset, 0.24); line(offset, 0.76, offset, 0.92);
      line(0.08, offset, 0.24, offset); line(0.76, offset, 0.92, offset);
    }
  }
}

export function inspectorIconButton (id: string, icon: InspectorIcon, hint: string): boolean {
  const origin = ImGui.GetCursorScreenPos();
  const clicked = ImGui.InvisibleButton(id, new ImGui.Vec2(28, 26));

  if (ImGui.IsItemHovered()) {
    ImGui.GetWindowDrawList().AddRectFilled(origin, new ImGui.Vec2(origin.x + 28, origin.y + 26), ImGui.GetColorU32(C.hover), 3);
    ImGui.SetTooltip(hint);
  }
  drawInspectorIcon(icon, origin.x + 6, origin.y + 5, 16);

  return clicked;
}
