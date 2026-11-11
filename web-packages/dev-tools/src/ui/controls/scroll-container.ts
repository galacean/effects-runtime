import type { Engine, InputEventMouseButton } from '@galacean/effects';
import { ScrollContainer, ScrollMode } from '@galacean/effects-plugin-gui';

export class EditorVerticalScrollContainer extends ScrollContainer {
  constructor (engine: Engine) {
    super(engine); this.horizontalScrollMode = ScrollMode.Disabled;
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    super.onMouseWheel(event);
    event.accept();
  }
}
