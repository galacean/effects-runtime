import { Plugin } from '@galacean/effects';
import type { Composition, Engine } from '@galacean/effects';
import { GUIWindowComponent } from '../components/gui-window-component';
import { UICanvas } from '../components/ui-canvas';

export class GUIPlugin extends Plugin {
  override order = 0;
  override name = 'gui';

  override onEngineCreated (engine: Engine): void {
    engine.root.addComponent(GUIWindowComponent);
  }

  override onCompositionCreating (composition: Composition): void {
    composition.sceneRoot.addComponent(UICanvas);
  }
}
