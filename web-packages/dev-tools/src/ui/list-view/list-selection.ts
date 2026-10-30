export interface SelectionModifiers { additive?: boolean, range?: boolean }

export class ListSelection<T> {
  selected = new Set<T>();
  anchor?: T;
  focused?: T;

  replace (values: Iterable<T>, anchor = this.anchor): void {
    this.selected = new Set(values); this.anchor = anchor;
  }

  choose (value: T, order: readonly T[], modifiers: SelectionModifiers = {}): void {
    if (modifiers.range && this.anchor !== undefined) {
      const start = order.indexOf(this.anchor), end = order.indexOf(value);

      if (end < 0) { return; }
      if (start < 0) {
        this.choose(value, order, { additive: modifiers.additive });

        return;
      }
      if (!modifiers.additive) { this.selected.clear(); }
      order.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(item => this.selected.add(item));
    } else if (modifiers.additive) {
      if (this.selected.has(value)) { this.selected.delete(value); } else { this.selected.add(value); }
      this.anchor = value;
    } else { this.selected = new Set([value]); this.anchor = value; }
    this.focused = value;
  }
}

interface PressedItem<T> { id: T, modifiers: SelectionModifiers, deferred: boolean, dragged: boolean }

export class ListItemInteraction<T> {
  private pressed?: PressedItem<T>;

  press (id: T, modifiers: SelectionModifiers, defer: boolean): boolean {
    this.pressed = { id, modifiers: { ...modifiers }, deferred: defer, dragged: false };

    return !defer;
  }

  drag (id: T): void { if (this.pressed?.id === id) { this.pressed.dragged = true; } }

  release (id: T): SelectionModifiers | undefined {
    const pressed = this.pressed;

    if (pressed?.id !== id) { return; }
    this.pressed = undefined;

    return pressed.deferred && !pressed.dragged ? pressed.modifiers : undefined;
  }

  reset (): void { this.pressed = undefined; }
}
