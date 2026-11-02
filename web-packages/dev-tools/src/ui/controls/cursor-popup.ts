import type { Control } from '@galacean/effects-plugin-gui';

/** Cursor previews share edge fitting and pointer avoidance. */
export function placeCursorPopup (popup: Control, width: number, height: number, offsetX = 16, offsetY = 12): void {
  const root = popup.root;

  if (!root) { return; }
  const cursor = root.getMousePosition();
  let x = Math.max(0, Math.min(root.width - width, cursor.x + offsetX));
  let y = Math.max(0, Math.min(root.height - height, cursor.y + offsetY));

  if (x <= cursor.x && cursor.x <= x + width && y <= cursor.y && cursor.y <= y + height) {
    x = cursor.x - width - 16;
    y = cursor.y - height - 12;
    if (x < 0) { x += width + 32; }
    if (y < 0) { y += height + 24; }
  }
  popup.setPosition(x, y); popup.setSize(width, height);
}
