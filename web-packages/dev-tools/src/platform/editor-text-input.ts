import { InputEvent, InputEventKey, KeyLocation } from '@galacean/effects';

/** Routes commands from DOM text inputs through the same input path as canvas keys. */
export class EditorTextInput {
  private readonly pressedKeys = new Set<string>();

  constructor (
    private readonly ownsTarget: (target: HTMLTextAreaElement) => boolean,
    private readonly dispatch: (event: InputEventKey) => void,
  ) {
    window.addEventListener('keydown', this.key, true);
    window.addEventListener('keyup', this.key, true);
    window.addEventListener('blur', this.reset);
  }

  private readonly key = (native: KeyboardEvent): void => {
    if (native.isComposing ||
      (native.key !== 'Tab' && native.key !== 'Escape')) { return; }
    const pressed = native.type === 'keydown';

    if (pressed) {
      if (!this.pressedKeys.has(native.code) &&
        (!(native.target instanceof HTMLTextAreaElement) || !this.ownsTarget(native.target))) { return; }
      this.pressedKeys.add(native.code);
    } else if (!this.pressedKeys.delete(native.code)) { return; }
    const event = new InputEventKey();

    event.device = InputEvent.deviceIdKeyboard;
    event.pressed = pressed;
    event.echo = event.pressed && native.repeat;
    event.keycode = event.keyLabel = native.key;
    event.physicalKeycode = native.code;
    event.location = native.location === 1 ? KeyLocation.Left : native.location === 2 ? KeyLocation.Right : KeyLocation.Unspecified;
    event.shiftPressed = native.shiftKey; event.altPressed = native.altKey;
    event.ctrlPressed = native.ctrlKey; event.metaPressed = native.metaKey;
    this.dispatch(event);
    if (event.isAccepted()) { native.preventDefault(); }
    native.stopImmediatePropagation();
  };

  private readonly reset = (): void => { this.pressedKeys.clear(); };

  dispose (): void {
    window.removeEventListener('keydown', this.key, true);
    window.removeEventListener('keyup', this.key, true);
    window.removeEventListener('blur', this.reset);
    this.reset();
  }
}
