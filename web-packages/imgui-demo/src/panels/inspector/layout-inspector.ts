import type { Control, LayoutPreset } from '@galacean/effects-plugin-gui';
import { ImGui } from '../../imgui';
import { EditorGUILayout as Fields } from '../../widgets/editor-gui-layout';
import { PROPERTY_COLORS as C } from '../../widgets/property-grid';

export const LAYOUT_TERMS = ['Rect Position', 'Rect Size', 'Anchor Min', 'Anchor Max', 'Offset Min', 'Offset Max', 'Pivot', 'Pivot Offset', 'Anchor Preset'];

export function drawControlLayout (control: Control): void {
  const vector = (label: string, value: { x: number, y: number }, set: (x: number, y: number) => void, normalized = false) => {
    const buffer: [number, number] = [value.x, value.y];

    if (Fields.Vector2Field(label, buffer)) {
      set(normalized ? Math.max(0, Math.min(1, buffer[0])) : buffer[0], normalized ? Math.max(0, Math.min(1, buffer[1])) : buffer[1]);
    }
  };

  vector('Rect Position', control.position, (x, y) => control.setPosition(x, y));
  vector('Rect Size', control.size, (x, y) => control.setSize(Math.max(0, x), Math.max(0, y)));
  vector('Anchor Min', control.anchorMin, (x, y) => control.setAnchorMin(x, y), true);
  vector('Anchor Max', control.anchorMax, (x, y) => control.setAnchorMax(x, y), true);
  vector('Offset Min', control.offsetMin, (x, y) => control.setOffsetMin(x, y));
  vector('Offset Max', control.offsetMax, (x, y) => control.setOffsetMax(x, y));
  vector('Pivot', control.pivot, (x, y) => control.setPivot(x, y), true);
  Fields.Text('Pivot Offset', (control.pivot.x * control.size.x).toFixed(2) + ', ' + (control.pivot.y * control.size.y).toFixed(2));
  Fields.Property('Anchor Preset', width => {
    if (ImGui.Button('Presets...##AnchorPresets', new ImGui.Vec2(width, 0))) { ImGui.OpenPopup('##AnchorPresetPopup'); }
    if (ImGui.IsPopupOpen('##AnchorPresetPopup')) {
      const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();

      ImGui.SetNextWindowPos(new ImGui.Vec2(min.x, max.y + 3), ImGui.Cond.Appearing);
    }
    if (ImGui.BeginPopup('##AnchorPresetPopup')) { drawAnchorPresets(control); ImGui.EndPopup(); }
  });
}

function drawAnchorPresets (control: Control): void {
  const presets: LayoutPreset[][] = [
    ['topLeft', 'centerTop', 'topRight', 'topWide'],
    ['centerLeft', 'center', 'centerRight', 'hcenterWide'],
    ['bottomLeft', 'centerBottom', 'bottomRight', 'bottomWide'],
    ['leftWide', 'vcenterWide', 'rightWide', 'fullRect'],
  ];

  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      if (column) { ImGui.SameLine(0, 4); }
      const origin = ImGui.GetCursorScreenPos(), preset = presets[row][column];

      if (ImGui.InvisibleButton(preset, new ImGui.Vec2(38, 38))) {
        if (ImGui.GetIO().KeyShift) { control.setAnchorsPreset(preset, false); } else { control.setAnchorsAndOffsetsPreset(preset); }
        ImGui.CloseCurrentPopup();
      }
      const dl = ImGui.GetWindowDrawList();
      const point = (x: number, y: number) => new ImGui.Vec2(origin.x + x, origin.y + y);

      dl.AddRectFilled(origin, point(38, 38), ImGui.GetColorU32(ImGui.IsItemHovered() ? C.hover : C.input), 3);
      dl.AddRect(point(8, 8), point(30, 30), ImGui.GetColorU32(C.muted));
      const x = column === 0 ? 9 : column === 2 ? 25 : 17;
      const y = row === 0 ? 9 : row === 2 ? 25 : 17;

      dl.AddRectFilled(point(column === 3 ? 10 : x, row === 3 ? 10 : y),
        point(column === 3 ? 28 : x + 4, row === 3 ? 28 : y + 4), ImGui.GetColorU32(C.accent));
      if (ImGui.IsItemHovered()) { ImGui.SetTooltip(preset.replace(/([a-z])([A-Z])/g, '$1 $2') + '\nShift+click keeps the current rectangle.'); }
    }
    ImGui.Dummy(new ImGui.Vec2(0, 4));
  }
}
