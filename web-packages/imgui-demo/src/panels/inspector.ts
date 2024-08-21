import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { UIManager } from '../core/ui-manager';
import { ImGui } from '../imgui';
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