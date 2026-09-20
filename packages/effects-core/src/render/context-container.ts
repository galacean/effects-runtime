/** Data stored by type in a ContextContainer. reset clears references, not GPU resources. */
export abstract class ContextItem {
  abstract reset (): void;
}

type ContextItemType<T extends ContextItem> = new () => T;

/** Per-render data with Unity's typed data contract using project naming conventions. */
export class ContextContainer {
  private readonly items = new Map<ContextItemType<ContextItem>, ContextItem>();
  private readonly active = new Set<ContextItemType<ContextItem>>();

  create<T extends ContextItem> (type: ContextItemType<T>): T {
    if (this.contains(type)) {
      throw new Error(`Type ${type.name} has already been created.`);
    }
    let item = this.items.get(type);

    if (!item) {
      item = new type();
      this.items.set(type, item);
    }
    this.active.add(type);

    return item as T;
  }

  get<T extends ContextItem> (type: ContextItemType<T>): T {
    if (!this.contains(type)) {
      throw new Error(`Type ${type.name} has not been created yet.`);
    }

    return this.items.get(type) as T;
  }

  getOrCreate<T extends ContextItem> (type: ContextItemType<T>): T {
    return this.contains(type) ? this.get(type) : this.create(type);
  }

  contains<T extends ContextItem> (type: ContextItemType<T>): boolean {
    return this.active.has(type);
  }

  dispose (): void {
    for (const type of this.active) {
      this.items.get(type)!.reset();
    }
    this.active.clear();
  }
}
