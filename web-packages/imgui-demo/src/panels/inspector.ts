import { EffectsObject, math } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { UIManager } from '../core/ui-manager';
import { ImGui } from '../imgui';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { EditorWindow } from './editor-window';

@editorWindow()
export class Inspector extends EditorWindow {

  private locked: boolean;
  private lockedObject: object;

  @menuItem('Window/Inspector')
  static showWindow () {
    EditorWindow.getWindow(Inspector).open();
  }

  constructor () {
    super();
    this.title = 'Inspector';
    this.open();
  }

  protected override onGUI (): void {
    if (!Selection.activeObject) {
      ImGui.End();

      return;
    }
    let activeObject = Selection.activeObject;

    if (this.locked) {
      activeObject = this.lockedObject;
    }

    const objectInspector = UIManager.objectInpectors.get(activeObject.constructor);

    if (objectInspector) {
      this.drawObjectTitle(objectInspector.title);
      objectInspector.activeObject = activeObject;
      objectInspector.onGUI();
    } else {
      this.drawDefaultInspector(activeObject);
    }
  }

  drawDefaultInspector (activeObject: object) {
    for (const propertyName of Object.keys(activeObject)) {
      const key = propertyName as keyof object;
      const property: any = activeObject[key];

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, activeObject, key);
      } else if (typeof property === 'string') {
        EditorGUILayout.TextField(propertyName, activeObject, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, activeObject, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        EditorGUILayout.ObjectField(propertyName, activeObject, key);
      }
    }
  }

  drawObjectTitle (title: string) {
    ImGui.Text(title);
    // draw Lock check box
    const rightOffset = ImGui.GetWindowWidth() - 85 - ImGui.GetStyle().ItemSpacing.x;

    ImGui.SameLine(rightOffset);
    ImGui.Text('Lock');
    ImGui.SameLine();
    if (ImGui.Checkbox('##Lock', (value = this.locked)=>this.locked = value)) {
      if (Selection.activeObject) {
        this.lockedObject = Selection.activeObject;
      }
    }
    ImGui.Separator();
  }
}