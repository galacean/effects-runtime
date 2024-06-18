import { ImGuiWindowFlags } from 'maoan-imgui-js';
import { editorWindow, menuItem } from '../core/decorators';
import { UIManager } from '../core/ui-manager';
import { ImGui } from '../imgui';

export class EditorWindow {
  title = 'New Window';

  private opened = false;

  draw () {
    if (!this.opened) {
      return;
    }
    ImGui.Begin(this.title, (value = this.opened) => this.opened = value);
    this.onGUI();
    ImGui.End();
  }

  open () {
    this.opened = true;
  }

  close () {
    this.opened = false;
  }

  onGUI () {

  }
}

@editorWindow('TestWindow')
export class TestWindow extends EditorWindow {

  @menuItem('Editor/Test/Test2')
  static showWindow () {
    UIManager.getWindow(TestWindow).open();
  }

  constructor () {
    super();
    this.title = 'Test Window';
  }
}