import type { KeySelection } from './sequencer-document';

/** A serial changes only when the set contents change. */
export class SequencerIdSet extends Set<string> {
  revision = 0;

  override add (id: string): this {
    if (!this.has(id)) { super.add(id); this.revision++; }

    return this;
  }

  override delete (id: string): boolean {
    if (!super.delete(id)) { return false; }
    this.revision++;

    return true;
  }

  override clear (): void {
    if (this.size) { super.clear(); this.revision++; }
  }
}

/** Like Sequencer's key selection, store the handle and its owning channel together. */
export class SequencerKeySelection extends Map<string, KeySelection> {
  revision = 0;

  select (item: KeySelection): void { this.set(item.key.id, item); }

  override set (id: string, item: KeySelection): this {
    const current = this.get(id);

    if (current?.key === item.key && current.channel === item.channel && current.section === item.section) { return this; }
    super.set(id, item); this.revision++;

    return this;
  }

  override delete (id: string): boolean {
    if (!super.delete(id)) { return false; }
    this.revision++;

    return true;
  }

  override clear (): void {
    if (this.size) { super.clear(); this.revision++; }
  }

  replace (items: Iterable<KeySelection>): void {
    const next = new Map(Array.from(items, item => [item.key.id, item]));

    for (const id of this.keys()) { if (!next.has(id)) { this.delete(id); } }
    next.forEach(item => this.select(item));
  }
}
