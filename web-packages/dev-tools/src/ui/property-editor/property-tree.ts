import type { ReflectedProperty } from './property-handle';
import { PropertyHandle } from './property-handle';
import { createPropertyValue } from './property-value-editor';
import type { PropertyGroup } from './property-sheet';
import { createObjectReferenceControl } from './object-reference-field';

export interface PropertyTreePolicy {
  properties(object: object): ReflectedProperty[],
  inline(value: unknown): value is object,
  reference(value: unknown): value is object,
  label?(key: PropertyKey): string,
  readOnlyReferences?: boolean,
  fallbackText?: boolean,
  maxDepth?: number,
  collection?(group: PropertyGroup, object: object, ancestors: Set<object>, depth: number): boolean,
}

export class PropertyTree {
  constructor (private readonly policy: PropertyTreePolicy) {}
  searchTerms (object: object, visited = new Set<object>(), depth = 0): string[] {
    if (visited.has(object) || depth > 4) { return []; }
    visited.add(object);

    return this.policy.properties(object).flatMap(property => [this.label(property.key),
      ...(this.policy.inline(property.value) ? this.searchTerms(property.value, visited, depth + 1) : [])]);
  }
  build (group: PropertyGroup, object: object, ancestors = new Set<object>(), firstProperties: readonly PropertyKey[] = [], depth = 0): void {
    if (ancestors.has(object) || depth > (this.policy.maxDepth ?? 4)) { return; }
    const visited = new Set(ancestors).add(object);

    if (this.policy.collection?.(group, object, visited, depth)) { return; }
    const properties = this.policy.properties(object);

    for (const key of [...firstProperties].reverse()) {
      const index = properties.findIndex(property => property.key === key);

      if (index >= 0) { properties.unshift(...properties.splice(index, 1)); }
    }
    properties.forEach(property => this.buildProperty(group, object, property, visited, depth));
  }
  buildProperty (group: PropertyGroup, object: object, property: ReflectedProperty, ancestors: Set<object>, depth = 0): void {
    const title = this.label(property.key), value = property.value;
    const handle = new PropertyHandle(object, property.key, title, property.writable);

    if (property.error !== undefined) { group.readOnly(title, () => 'Unavailable: ' + property.error); } else if (createPropertyValue(handle, group)) { return; } else if (this.policy.inline(value) && !ancestors.has(value)) {
      this.build(group.group(String(property.key), title, false), value, ancestors, [], depth + 1);
    } else if (this.policy.reference(value)) {
      const reference = createObjectReferenceControl(group.engine, { read: () => handle.value as object, write: next => handle.set(next) }, {
        readOnly: !property.writable || this.policy.readOnlyReferences,
        changed: action => { group.sheet.edit.change(title, group, action); group.sheet.edit.finish(group); },
      });

      group.add(title, reference);
    } else if (this.policy.fallbackText) { group.readOnly(title, () => String(handle.value)); }
  }
  private label (key: PropertyKey): string { return this.policy.label?.(key) ?? String(key); }
}
