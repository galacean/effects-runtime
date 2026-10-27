import { Component, Material, VFXItem, math } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { EditorGUILayout as Fields } from '../../widgets/editor-gui-layout';
import { PropertyGrid } from '../../widgets/property-grid';
import { drawInspectorIcon } from './inspector-icons';

interface DebugProperty {
  key: PropertyKey,
  value: unknown,
  writable: boolean,
  error?: string,
}

const PAGE_SIZE = 100;

/** Reflects runtime fields without applying the normal property editor's visibility rules. */
export class DebugInspector {
  target: object;
  private readonly pages = new WeakMap<object, number>();

  getSearchTerms (object = this.target, visited = new Set<object>(), depth = 0): string[] {
    if (visited.has(object) || depth > 4) { return []; }
    visited.add(object);
    if (this.isCollection(object)) { return ['Elements', 'Length', object.constructor.name]; }

    return this.properties(object).flatMap(property => {
      const value = property.value;

      return [String(property.key), ...(this.isInlineObject(value) ? this.getSearchTerms(value, visited, depth + 1) : [])];
    });
  }

  onInspectorGUI (firstProperties: readonly PropertyKey[] = []): void { this.drawObject(this.target, new Set(), firstProperties); }

  private properties (object: object): DebugProperty[] {
    const properties: DebugProperty[] = [], seen = new Set<PropertyKey>();
    let owner: object | null = object;

    while (owner && owner !== Object.prototype) {
      for (const key of Reflect.ownKeys(owner)) {
        if (key === 'constructor' || seen.has(key)) { continue; }
        seen.add(key);
        const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;

        if (typeof descriptor.value === 'function') { continue; }
        try {
          const value: unknown = Reflect.get(object, key);

          if (typeof value !== 'function') { properties.push({ key, value, writable: !!(descriptor.set || descriptor.writable) }); }
        } catch (error) {
          properties.push({ key, value: undefined, writable: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      owner = Object.getPrototypeOf(owner) as object | null;
    }

    return properties;
  }

  private isInlineObject (value: unknown): value is object {
    return !!value && typeof value === 'object' &&
      (this.isCollection(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }

  private isCollection (object: object): boolean {
    return Array.isArray(object) || ArrayBuffer.isView(object) || object instanceof Map || object instanceof Set;
  }

  private drawObject (object: object, ancestors: Set<object>, firstProperties: readonly PropertyKey[] = []): void {
    ancestors.add(object);
    if (this.isCollection(object)) {
      this.drawCollection(object, ancestors);
    } else {
      const properties = this.properties(object);

      for (const key of [...firstProperties].reverse()) {
        const index = properties.findIndex(property => property.key === key);

        if (index >= 0) { properties.unshift(...properties.splice(index, 1)); }
      }
      for (const property of properties) { this.drawProperty(object, property, ancestors); }
    }
    ancestors.delete(object);
  }

  private drawProperty (object: object, property: DebugProperty, ancestors: Set<object>): void {
    const label = String(property.key), value = property.value;

    ImGui.PushID(label);
    if (property.error) {
      Fields.Text(label, 'Unavailable: ' + property.error);
    } else if (typeof value === 'number' && Number.isFinite(value) && property.writable) {
      Fields.NumberField(label, next => {
        if (next !== undefined && Number.isFinite(next)) { Reflect.set(object, property.key, next); }

        return Reflect.get(object, property.key) as number;
      });
    } else if (typeof value === 'string' && property.writable) {
      Fields.Property(label, width => {
        ImGui.SetNextItemWidth(width);

        return ImGui.InputText('##Value', next => {
          if (next !== undefined) { Reflect.set(object, property.key, next); }

          return Reflect.get(object, property.key) as string;
        });
      });
    } else if (typeof value === 'boolean' && property.writable) {
      Fields.Property(label, () => ImGui.Checkbox('##Value', next => {
        if (next !== undefined) { Reflect.set(object, property.key, next); }

        return Reflect.get(object, property.key) as boolean;
      }));
    } else if (value instanceof math.Vector3 && property.writable) {
      Fields.Vector3Field(label, value);
    } else if (value instanceof math.Vector2 && property.writable) {
      Fields.Vector2Field(label, value);
    } else if (value instanceof math.Color && property.writable) {
      Fields.ColorField(label, value);
    } else if (this.isInlineObject(value) && !ancestors.has(value)) {
      if (PropertyGrid.matches(label, ...this.getSearchTerms(value))) {
        if (Fields.BeginFoldoutHeaderGroup(label, false)) { this.drawObject(value, ancestors); }
        Fields.EndFoldoutHeaderGroup();
      }
    } else if (value && typeof value === 'object') {
      const icon = value instanceof Material ? 'material' : value instanceof Component ? 'component' : value instanceof VFXItem ? 'object' : undefined;

      Fields.ObjectField(label, { value }, 'value', undefined, true, icon ? drawInspectorIcon.bind(undefined, icon) : undefined);
    } else {
      Fields.Text(label, String(value));
    }
    ImGui.PopID();
  }

  private drawCollection (object: object, ancestors: Set<object>): void {
    const view = object instanceof DataView ? new Uint8Array(object.buffer, object.byteOffset, object.byteLength) : object;
    const sequence = view as ArrayLike<unknown>;
    const length = view instanceof Map || view instanceof Set ? view.size : sequence.length;
    const page = Math.min(this.pages.get(object) ?? 0, Math.max(0, Math.ceil(length / PAGE_SIZE) - 1));
    const start = page * PAGE_SIZE, end = Math.min(length, start + PAGE_SIZE);

    Fields.Text('Length', String(length));
    if (length > PAGE_SIZE) {
      Fields.Property('Elements', width => {
        const origin = ImGui.GetCursorScreenPos();

        ImGui.BeginDisabled(page === 0);
        if (ImGui.Button('<##Previous', new ImGui.Vec2(28, 0))) { this.pages.set(object, page - 1); }
        ImGui.EndDisabled(); ImGui.SameLine(0, 4);
        ImGui.Text((start + 1) + '–' + end);
        ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + width - 28, origin.y));
        ImGui.BeginDisabled(end === length);
        if (ImGui.Button('>##Next', new ImGui.Vec2(28, 0))) { this.pages.set(object, page + 1); }
        ImGui.EndDisabled();
      });
    }
    if (view instanceof Map || view instanceof Set) {
      let index = 0;

      for (const entry of view.entries()) {
        if (index >= end) { break; }
        if (index >= start) {
          const key: unknown = entry[0];
          const value: unknown = view instanceof Map ? {
            get key () { return key; },
            get value (): unknown { return view.get(key); },
            set value (next: unknown) { view.set(key, next); },
          } : entry[0];

          this.drawProperty({ [index]: value }, { key: String(index), value, writable: false }, ancestors);
        }
        index++;
      }
    } else {
      for (let index = start; index < end; index++) {
        this.drawProperty(view, { key: String(index), value: sequence[index], writable: !Object.isFrozen(view) }, ancestors);
      }
    }
  }
}
