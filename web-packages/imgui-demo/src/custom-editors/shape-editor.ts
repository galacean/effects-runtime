import { ShapeComponent, TrimPathMode } from '@galacean/effects';
import { editor } from '../core/decorators';
import { Editor } from './editor';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { ImGui } from '../imgui';

const trimPathModes: Array<{ label: string, value: TrimPathMode }> = [
  { label: 'Sync', value: TrimPathMode.Synchronized },
  { label: 'Sequence', value: TrimPathMode.Sequential },
];

@editor(ShapeComponent)
export class ShapeComponentEditor extends Editor {
  override onInspectorGUI (): void {
    const shapeComponent = this.target as ShapeComponent;

    if (!shapeComponent) {
      return;
    }

    ImGui.Spacing();
    ImGui.Separator();
    ImGui.Spacing();

    ImGui.PushStyleColor(ImGui.Col.Text, new ImGui.Vec4(0.7, 0.7, 0.7, 1.0));
    ImGui.Text('       TRIM PATH');
    ImGui.PopStyleColor();
    ImGui.Spacing();

    const trimPath = shapeComponent.strokeTrimPath;
    const trimPathEnabled = trimPath !== null;

    if (trimPath) {
      ImGui.Spacing();

      EditorGUILayout.Label('Mode');
      const buttonWidth = 110;
      const buttonHeight = 24;
      const buttonSize = new ImGui.Vec2(buttonWidth, buttonHeight);
      const activeColor = new ImGui.Vec4(0.2, 0.47, 0.86, 1.0);
      const hoverColor = new ImGui.Vec4(0.26, 0.59, 0.98, 1.0);
      const inactiveColor = new ImGui.Vec4(0.2, 0.2, 0.2, 1.0);
      const inactiveHoverColor = new ImGui.Vec4(0.3, 0.3, 0.3, 1.0);

      for (let i = 0; i < trimPathModes.length; i++) {
        const mode = trimPathModes[i];
        const isActive = trimPath.mode === mode.value;

        if (i > 0) {
          ImGui.SameLine();
        }

        ImGui.PushStyleColor(ImGui.Col.Button, isActive ? activeColor : inactiveColor);
        ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isActive ? hoverColor : inactiveHoverColor);
        ImGui.PushStyleColor(ImGui.Col.ButtonActive, isActive ? activeColor : inactiveColor);
        if (ImGui.Button(`${mode.label}##TrimPathMode${i}`, buttonSize)) {
          trimPath.mode = mode.value;
          shapeComponent.onApplyAnimationProperties();
        }
        ImGui.PopStyleColor(3);
      }

      ImGui.Spacing();

      EditorGUILayout.Label('Start');
      const startAccess = (value?: number): number => {
        if (value !== undefined && value !== trimPath.start) {
          trimPath.start = value;
          shapeComponent.onApplyAnimationProperties();
        }

        return shapeComponent.strokeTrimPath?.start ?? 0;
      };

      ImGui.SetNextItemWidth(-1);
      ImGui.SliderFloat('##TrimPathStart', startAccess, 0, 1, '%.3f');

      ImGui.Spacing();

      EditorGUILayout.Label('End');
      const endAccess = (value?: number): number => {
        if (value !== undefined && value !== trimPath.end) {
          trimPath.end = value;
          shapeComponent.onApplyAnimationProperties();
        }

        return shapeComponent.strokeTrimPath?.end ?? 1;
      };

      ImGui.SetNextItemWidth(-1);
      ImGui.SliderFloat('##TrimPathEnd', endAccess, 0, 1, '%.3f');

      ImGui.Spacing();

      EditorGUILayout.Label('Offset');
      const offsetAccess = (value?: number): number => {
        if (value !== undefined && value !== trimPath.offset) {
          trimPath.offset = value;
          shapeComponent.onApplyAnimationProperties();
        }

        return shapeComponent.strokeTrimPath?.offset ?? 0;
      };

      ImGui.SetNextItemWidth(-1);
      ImGui.DragFloat('##TrimPathOffset', offsetAccess, 0.01, -10, 10, '%.3f');
    }

    ImGui.Spacing();
    ImGui.Separator();
    ImGui.Spacing();

    ImGui.PushStyleColor(ImGui.Col.Text, new ImGui.Vec4(0.7, 0.7, 0.7, 1.0));
    ImGui.Text('       COMPONENT PROPERTIES');
    ImGui.PopStyleColor();
    ImGui.Spacing();

    super.onInspectorGUI();
  }
}