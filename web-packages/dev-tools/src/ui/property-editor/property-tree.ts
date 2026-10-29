import { ImGui } from '../../platform/imgui';
import { PropertyFields as Fields } from './property-fields';
import type { PropertyHeaderIcon } from './property-grid';
import { PropertyGrid } from './property-grid';
import type { ReflectedProperty } from './property-handle';
import { PropertyHandle } from './property-handle';
import { drawPropertyValue } from './property-value-editor';

export interface PropertyTreePolicy {
  properties(object: object): ReflectedProperty[],
  inline(value: unknown): value is object,
  reference(value: unknown): value is object,
  label?(key: PropertyKey): string,
  referenceIcon?(value: object): PropertyHeaderIcon | undefined,
  readOnlyReferences?: boolean,
  fallbackText?: boolean,
  maxDepth?: number,
  collection?(object: object): boolean,
  drawCollection?(object: object, ancestors: Set<object>): void,
}

export class PropertyTree {
  constructor (private readonly policy: PropertyTreePolicy) { }

  searchTerms (object: object, visited = new Set<object>(), depth = 0): string[] {
    if (visited.has(object) || depth > 4) { return []; }
    visited.add(object);
    if (this.policy.collection?.(object)) { return ['Elements', 'Length', object.constructor.name]; }

    return this.policy.properties(object).flatMap(property => [this.label(property.key),
      ...(this.policy.inline(property.value) ? this.searchTerms(property.value, visited, depth + 1) : [])]);
  }

  draw (object: object, ancestors = new Set<object>(), firstProperties: readonly PropertyKey[] = [], depth = 0): void {
    if (ancestors.has(object) || depth > (this.policy.maxDepth ?? Infinity)) { return; }
    ancestors.add(object);
    if (this.policy.collection?.(object) && this.policy.drawCollection) { this.policy.drawCollection(object, ancestors); } else {
      const properties = this.policy.properties(object);

      for (const key of [...firstProperties].reverse()) {
        const index = properties.findIndex(property => property.key === key);

        if (index >= 0) { properties.unshift(...properties.splice(index, 1)); }
      }
      properties.forEach(property => this.drawProperty(object, property, ancestors, depth));
    }
    ancestors.delete(object);
  }

  drawProperty (object: object, property: ReflectedProperty, ancestors: Set<object>, depth = 0): void {
    const label = this.label(property.key), value = property.value;
    const handle = new PropertyHandle(object, property.key, label, property.writable);

    ImGui.PushID(String(property.key));
    if (property.error !== undefined) { Fields.Text(label, 'Unavailable: ' + property.error); } else if (drawPropertyValue(handle)) { /* The value editor owns this row. */ } else if (this.policy.inline(value) && !ancestors.has(value)) {
      if (PropertyGrid.matches(label, ...this.searchTerms(value))) {
        if (Fields.BeginFoldoutHeaderGroup(label, false)) { this.draw(value, ancestors, [], depth + 1); }
        Fields.EndFoldoutHeaderGroup();
      }
    } else if (this.policy.reference(value)) {
      const reference = { get value (): unknown { return handle.value; }, set value (next: unknown) { handle.set(next); } };

      Fields.ObjectField(label, reference, 'value', undefined, !property.writable || this.policy.readOnlyReferences, this.policy.referenceIcon?.(value));
    } else if (this.policy.fallbackText) { Fields.Text(label, String(value)); }
    ImGui.PopID();
  }

  private label (key: PropertyKey): string { return this.policy.label?.(key) ?? String(key); }
}
