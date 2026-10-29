import type { ImGui } from '../imgui';
import { drawEditorIcon } from './editor-icons';

/** Draw a centered caret within a fixed square slot. */
export function drawEditorArrow (x: number, y: number, size: number, direction: 'down' | 'right', tint: ImGui.Vec4): void {
  drawEditorIcon(direction === 'down' ? 'caretDown' : 'caretRight', x, y, size, tint);
}

/** Draw the wider chevron used by dropdown controls. */
export function drawEditorChevron (x: number, y: number, size: number, tint: ImGui.Vec4): void {
  drawEditorIcon('chevronDown', x, y, size, tint);
}
