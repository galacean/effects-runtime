import { editorWindow, menuItem } from '../core/decorators';
import { EditorWindow } from './panel';

@editorWindow()
export class Preview extends EditorWindow {

  @menuItem('Window/Preview')
  static showWindow () {
    EditorWindow.getWindow(Preview).open();
  }

  constructor () {
    super();
    this.title = 'Preview';
  }
}