import type { Panel } from '../panels/panel';
import { Editor } from '../panels/editor';

export class UIManager {
  private panels: Panel[] = [];
  editor: Editor = new Editor();

  draw () {
    for (const panel of this.panels) {
      panel.draw();
    }
    this.editor.draw();
  }
}