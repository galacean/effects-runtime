import { editorWindow, menuItem } from '../core/decorators';
import { EditorWindow } from './panel';

@editorWindow()
export class Sequencer extends EditorWindow {

  @menuItem('Window/Sequencer')
  static showWindow () {
    EditorWindow.getWindow(Sequencer).open();
  }

  constructor () {
    super();
    this.title = 'Sequencer';
    this.open();
  }

  protected override onGUI (): void {

  }
}