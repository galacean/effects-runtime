import type { Engine } from '@galacean/effects';
import { GUIServer, PopupPanel } from '@galacean/effects-plugin-gui';

export class EditorPopupPanel extends PopupPanel {
  constructor (engine: Engine) {
    super(engine);
    // Detached popups need the complete theme before their first measurement.
    this.theme = engine.getServer(GUIServer).windowRoot.theme;
  }
}
