import { Plugin } from '@galacean/effects';
import type { Composition } from '@galacean/effects';
import { UICanvas } from '../components/ui-canvas';

export class GUIPlugin extends Plugin {
  override order = 0;
  override name = 'gui';

  override onCompositionCreating (composition: Composition): void {
    composition.sceneRoot.addComponent(UICanvas);
  }
}
