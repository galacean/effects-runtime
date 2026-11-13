import { reflectProperties } from '../../ui/property-editor/property-handle';
import type { PropertyGroup } from '../../ui/property-editor/property-sheet';
import { PropertyTree } from '../../ui/property-editor/property-tree';

export class DebugInspector {
  target: object;
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

    group.readOnly('Length', () => String(length));
    if (view instanceof Map || view instanceof Set) {
      let index = 0;

      for (const [key] of view.entries()) {
        const value: unknown = view instanceof Map ? { get key () { return key; }, get value (): unknown { return view.get(key); }, set value (next: unknown) { view.set(key, next); } } : key;

        this.tree.buildProperty(group, { [index]: value }, { key: String(index), value, writable: false }, ancestors, depth);
        index++;
      }
    } else {
      for (let index = 0; index < length; index++) { this.tree.buildProperty(group, view, { key: String(index), value: sequence[index], writable: !Object.isFrozen(view) }, ancestors, depth); }
    }

    return true;
  }
}
