import { Button, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { append, row, label } from '../../ui/controls/layout';
import { reflectProperties } from '../../ui/property-editor/property-handle';
import type { PropertyGroup } from '../../ui/property-editor/property-sheet';
import { PropertyTree } from '../../ui/property-editor/property-tree';

const PAGE_SIZE = 100;

export class DebugInspector {
  target: object;
  private readonly pages = new WeakMap<object, number>();
  private readonly tree = new PropertyTree({
    properties: object => reflectProperties(object, true),
    inline: (value): value is object => !!value && typeof value === 'object' &&
      (Array.isArray(value) || ArrayBuffer.isView(value) || value instanceof Map || value instanceof Set || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    reference: (value): value is object => !!value && typeof value === 'object',
    readOnlyReferences: true, fallbackText: true, maxDepth: 4,
    collection: (group, object, ancestors, depth) => this.collection(group, object, ancestors, depth),
  });

  getSearchTerms (): string[] { return this.tree.searchTerms(this.target); }
  build (group: PropertyGroup, firstProperties: readonly PropertyKey[] = []): void { this.tree.build(group, this.target, new Set(), firstProperties); }

  private collection (group: PropertyGroup, object: object, ancestors: Set<object>, depth: number): boolean {
    if (!Array.isArray(object) && !ArrayBuffer.isView(object) && !(object instanceof Map) && !(object instanceof Set)) { return false; }
    const view = object instanceof DataView ? new Uint8Array(object.buffer, object.byteOffset, object.byteLength) : object;
    const sequence = view as ArrayLike<unknown>;
    const length = view instanceof Map || view instanceof Set ? view.size : sequence.length;
    const page = Math.min(this.pages.get(object) ?? 0, Math.max(0, Math.ceil(length / PAGE_SIZE) - 1));
    const start = page * PAGE_SIZE, end = Math.min(length, start + PAGE_SIZE);

    group.readOnly('Length', () => String(length));
    if (length > PAGE_SIZE) {
      const pager = row(group.engine), previous = append(pager, new Button(group.engine, '‹'));
      const range = append(pager, label(group.engine, (start + 1) + '–' + end));
      const next = append(pager, new Button(group.engine, '›'));

      range.verticalAlignment = VerticalAlignment.Center;
      previous.disabled = page === 0; next.disabled = end === length;
      const move = (delta: number): void => { this.pages.set(object, page + delta); group.clear(); this.collection(group, object, ancestors, depth); };

      previous.on('pressed', () => move(-1)); next.on('pressed', () => move(1));
      group.add('Elements', pager);
    }
    if (view instanceof Map || view instanceof Set) {
      let index = 0;

      for (const [key] of view.entries()) {
        if (index >= end) { break; }
        if (index >= start) {
          const value: unknown = view instanceof Map ? { get key () { return key; }, get value (): unknown { return view.get(key); }, set value (next: unknown) { view.set(key, next); } } : key;

          this.tree.buildProperty(group, { [index]: value }, { key: String(index), value, writable: false }, ancestors, depth);
        }
        index++;
      }
    } else {
      for (let index = start; index < end; index++) { this.tree.buildProperty(group, view, { key: String(index), value: sequence[index], writable: !Object.isFrozen(view) }, ancestors, depth); }
    }

    return true;
  }
}
