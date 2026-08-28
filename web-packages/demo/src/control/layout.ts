import { math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';

export function attachFullRect (
  control: Control,
  parent: Control,
  left = 0,
  top = 0,
  right = 0,
  bottom = 0,
): void {
  control.parent = parent;
  control.setAnchorMin(0, 0);
  control.setAnchorMax(1, 1);
  control.setOffsetMin(left, top);
  control.setOffsetMax(-right, -bottom);
}

export function attachAnchoredRect (
  control: Control,
  parent: Control,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  left = 0,
  top = 0,
  right = 0,
  bottom = 0,
): void {
  control.parent = parent;
  control.setAnchorMin(minX, minY);
  control.setAnchorMax(maxX, maxY);
  control.setOffsetMin(left, top);
  control.setOffsetMax(-right, -bottom);
}

export function placeNormalized (
  control: Control,
  parent: Control,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  attachAnchoredRect(control, parent, x, y, x + width, y + height);
}

export function setRect (control: Control, x: number, y: number, width: number, height: number): void {
  control.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
}
