import type { InputEventKey } from '@galacean/effects';
import { EditorTextField } from './text-field';

export class EditorInlineRename extends EditorTextField {
  finish?: (cancel: boolean) => void;
  override onLostFocus (): void { super.onLostFocus(); this.finish?.(false); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.finish?.(true); event.accept(); } else { super.onKeyDown(event); }
  }
}
