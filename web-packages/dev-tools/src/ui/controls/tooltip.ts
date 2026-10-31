import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Control, MouseFilter } from '@galacean/effects-plugin-gui';
import { editorBox, editorColors as C, EDITOR_FONT } from '../theme/control-theme';

const tips = new WeakMap<Control, string | (() => string)>();

export function setTooltip (control: Control, text: string | (() => string)): void { tips.set(control, text); }

/** A non-interactive overlay; tooltip ownership follows the visible Control hierarchy. */
export class EditorTooltips extends Control {
  private target?: Control;
  private elapsed = 0;
  private message = '';
  private pointer = new math.Vector2();
  constructor (engine: Engine, private readonly surface: Control) { super(engine); this.mouseFilter = MouseFilter.Ignore; }
  override update (delta: number): void {
    const root = this.surface.root;

    if (!root) { return; }
    const mouse = root.getLocalMousePosition();
    const pick = (control: Control): Control | undefined => {
      if (control === this || !control.visibleInHierarchy || !control.enabledInHierarchy) { return; }
      const inside = control.hasPoint(control.makePositionLocal(mouse));

      if (!inside && control.clipContents) { return; }
      for (const child of control.children.slice().reverse()) {
        const target = pick(child);

        if (target) { return target; }
      }

      return inside && control.mouseFilter !== MouseFilter.Ignore ? control : undefined;
    };
    let target = pick(root);

    while (target && !tips.has(target)) { target = target.parent ?? undefined; }
    if (target !== this.target || Math.hypot(mouse.x - this.pointer.x, mouse.y - this.pointer.y) > 3) { this.target = target; this.elapsed = 0; this.pointer.copyFrom(mouse); }
    this.elapsed += delta;
    const text = target && tips.get(target);

    this.message = this.elapsed > .55 && !root.guiIsDragging() ? typeof text === 'function' ? text() : text ?? '' : '';
    if (!this.message) { return; }
    const lines = this.message.split('\n'), width = Math.max(...lines.map(line => this.measureText(line, 12, EDITOR_FONT).width)) + 16, height = lines.length * 20 + 10;

    this.setPosition(Math.max(0, Math.min(root.width - width, mouse.x + 12)), Math.max(0, Math.min(root.height - height, mouse.y + 20))); this.setSize(width, height);
  }
  override draw (): void {
    if (!this.message) { return; }
    this.drawStyleBox(editorBox(C.header, 0, 3, C.outline), 0, 0, this.width, this.height);
    this.message.split('\n').forEach((line, index) => this.drawText(8, 5 + index * 20, line, 12, C.foreground, EDITOR_FONT));
  }
}
