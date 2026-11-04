import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton } from '@galacean/effects';
import { ScrollContainer, ScrollMode } from '@galacean/effects-plugin-gui';

export class EditorVerticalScrollContainer extends ScrollContainer {
  constructor (engine: Engine) {
    super(engine); this.horizontalScrollMode = ScrollMode.Disabled;
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    // Horizontal trackpad input must not be converted into vertical movement.
    if (event.buttonIndex === MouseButton.WheelUp || event.buttonIndex === MouseButton.WheelDown) {
      super.onMouseWheel(event);
    }
    event.accept();
  }
}
