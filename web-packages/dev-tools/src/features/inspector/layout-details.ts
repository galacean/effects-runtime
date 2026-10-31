import { math } from '@galacean/effects';
import type { Engine, InputEventMouseButton } from '@galacean/effects';
import { Button, GridContainer } from '@galacean/effects-plugin-gui';
import type { Control, LayoutPreset } from '@galacean/effects-plugin-gui';
import { append, screenPosition } from '../../ui/controls/layout';
import { EditorPopupPanel } from '../../ui/controls/popup-panel';
import { editorColors as C } from '../../ui/theme/control-theme';
import type { PropertyGroup } from '../../ui/property-editor/property-sheet';

class AnchorPresetButton extends Button {
  private keepRect = false;
  constructor (engine: Engine, readonly preset: LayoutPreset, private readonly row: number, private readonly column: number,
    apply: (keepRect: boolean) => void) {
    super(engine); this.setCustomMinimumSize(38, 38); this.on('pressed', () => apply(this.keepRect));
  }
  override onMouseDown (event: InputEventMouseButton): void { this.keepRect = event.shiftPressed; super.onMouseDown(event); }
  protected override drawDecoration (): void {
    this.drawRect(8, 8, 22, 22, C.muted);
    const x = this.column === 0 ? 9 : this.column === 2 ? 25 : 17;
    const y = this.row === 0 ? 9 : this.row === 2 ? 25 : 17;

    this.fillRect(this.column === 3 ? 10 : x, this.row === 3 ? 10 : y, this.column === 3 ? 18 : 4, this.row === 3 ? 18 : 4, C.primary);
  }
}

export function buildControlLayout (group: PropertyGroup, control: Control): void {
  const vector = (title: string, read: () => { x: number, y: number }, write: (x: number, y: number) => void, normalized = false): void => {
    group.vector(title, { read: () => [read().x, read().y], write: values => {
      const clamp = (value: number) => normalized ? Math.max(0, Math.min(1, value)) : value;

      write(clamp(values[0]), clamp(values[1]));
    } }, 2);
  };

  vector('Rect Position', () => control.position, (x, y) => control.setPosition(x, y));
  vector('Rect Size', () => control.size, (x, y) => control.setSize(Math.max(0, x), Math.max(0, y)));
  vector('Anchor Min', () => control.anchorMin, (x, y) => control.setAnchorMin(x, y), true);
  vector('Anchor Max', () => control.anchorMax, (x, y) => control.setAnchorMax(x, y), true);
  vector('Offset Min', () => control.offsetMin, (x, y) => control.setOffsetMin(x, y));
  vector('Offset Max', () => control.offsetMax, (x, y) => control.setOffsetMax(x, y));
  vector('Pivot', () => control.pivot, (x, y) => control.setPivot(x, y), true);
  group.readOnly('Pivot Offset', () => (control.pivot.x * control.size.x).toFixed(2) + ', ' + (control.pivot.y * control.size.y).toFixed(2));
  const popup = new EditorPopupPanel(group.engine), grid = append(popup, new GridContainer(group.engine));

  grid.columns = 4;
  const presets: LayoutPreset[][] = [
    ['topLeft', 'centerTop', 'topRight', 'topWide'], ['centerLeft', 'center', 'centerRight', 'hcenterWide'],
    ['bottomLeft', 'centerBottom', 'bottomRight', 'bottomWide'], ['leftWide', 'vcenterWide', 'rightWide', 'fullRect'],
  ];
  const button = group.button('Anchor Preset', 'Presets...', () => popup.popup(screenPosition(button, 0, button.height), button));

  presets.forEach((row, y) => row.forEach((preset, x) => append(grid, new AnchorPresetButton(group.engine, preset, y, x, keepRect => {
    group.sheet.edit.change('Anchor Preset', button, () => {
      if (keepRect) { control.setAnchorsPreset(preset, false); } else { control.setAnchorsAndOffsetsPreset(preset); }
    });
    group.sheet.edit.finish(button); popup.hidePopup();
  }))));
  const destroy = button.onDestroy.bind(button);

  button.onDestroy = () => { popup.dispose(); destroy(); };
}
