import { EditorWindow } from '../core/decorators';
import { ImGui } from '../imgui';

export class Panel {
  title = 'New Window';

  private opened = true;

  draw () {
    if (!this.opened) {
      return;
    }
    ImGui.Begin(this.title);
    this.onGUI();
    ImGui.End();
  }

  onGUI () {

  }
}

// @EditorWindow('TestWindow')
// export class TestWindow extends Panel {

//   constructor () {
//     super();
//     this.title = 'Test Window';
//   }
// }