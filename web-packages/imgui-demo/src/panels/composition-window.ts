import { editorWindow, menuItem } from '../core/decorators';
import { UIManager } from '../core/ui-manager';
import { EditorWindow } from './panel';

@editorWindow()
export class CompositionWindow extends EditorWindow {
  @menuItem('Editor/Composition')
  static showWindow () {
    UIManager.getWindow(CompositionWindow).open();
  }

  constructor () {
    super();
    this.title = 'Composition Window';
  }
}