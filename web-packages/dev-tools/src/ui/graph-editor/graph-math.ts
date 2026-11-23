import { math } from '@galacean/effects';

export function add (a: math.Vector2, b: math.Vector2): math.Vector2 {
  return new math.Vector2(a.x + b.x, a.y + b.y);
}

export function subtract (a: math.Vector2, b: math.Vector2): math.Vector2 {
  return new math.Vector2(a.x - b.x, a.y - b.y);
}
