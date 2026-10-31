import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { HBoxContainer, VBoxContainer, MarginContainer, Label, SizeFlags, HorizontalAlignment } from '@galacean/effects-plugin-gui';

export function append<T extends Control> (parent: Control, child: T): T {
  child.parent = parent;

  return child;
}

export function expand<T extends Control> (control: T, horizontal = true, vertical = true): T {
  if (horizontal) { control.horizontalSizeFlags = SizeFlags.ExpandFill; }
  if (vertical) { control.verticalSizeFlags = SizeFlags.ExpandFill; }

  return control;
}

export function row (engine: Engine, children: Control[] = [], separation = 4): HBoxContainer {
  const result = new HBoxContainer(engine);

  result.setThemeConstantOverride('separation', separation);
  children.forEach(child => append(result, child));

  return result;
}

export function column (engine: Engine, children: Control[] = [], separation = 0): VBoxContainer {
  const result = new VBoxContainer(engine);

  result.setThemeConstantOverride('separation', separation);
  children.forEach(child => append(result, child));

  return result;
}

export function margin (engine: Engine, child: Control, horizontal = 8, vertical = horizontal): MarginContainer {
  const result = new MarginContainer(engine);

  result.setThemeConstantOverride('marginLeft', horizontal);
  result.setThemeConstantOverride('marginRight', horizontal);
  result.setThemeConstantOverride('marginTop', vertical);
  result.setThemeConstantOverride('marginBottom', vertical);
  append(result, child);

  return result;
}

export function label (engine: Engine, text: string, tint?: math.Color): Label {
  const result = new Label(engine, text);

  result.horizontalAlignment = HorizontalAlignment.Left;
  if (tint) { result.setThemeColorOverride('fontColor', tint); }

  return result;
}

export function place (control: Control, x: number, y: number, width: number, height: number): void {
  control.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(Math.max(0, width), Math.max(0, height)) });
}

export function screenPosition (control: Control, x = 0, y = 0): math.Vector2 {
  const m = control.getGlobalTransform2D().elements;

  return new math.Vector2(m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]);
}

export function disposeChildren (control: Control): void {
  for (const child of control.children.slice()) { child.dispose(); }
}
