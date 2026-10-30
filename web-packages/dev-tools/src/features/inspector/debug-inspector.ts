import { EffectsObject } from '@galacean/effects';
import { ImGui } from '../../platform/imgui/index';
import { inspectedObjectHeaderIcon } from './inspected-object-icons';
import { PropertyFields as Fields } from '../../ui/property-editor/property-fields';
import { reflectProperties } from '../../ui/property-editor/property-handle';
import { PropertyTree } from '../../ui/property-editor/property-tree';

const PAGE_SIZE = 100;

/** Reflects runtime fields without applying the normal property editor's visibility rules. */
export class DebugInspector {
  target: object;
  private readonly pages = new WeakMap<object, number>();
  private readonly tree = new PropertyTree({
    properties: object => reflectProperties(object, true),
    inline: (value): value is object => this.isInlineObject(value),
    reference: (value): value is object => !!value && typeof value === 'object',
    readOnlyReferences: true, fallbackText: true,
    referenceIcon: value => value instanceof EffectsObject ? inspectedObjectHeaderIcon(value) : undefined,
    collection: object => this.isCollection(object),
    drawCollection: (object, ancestors) => this.drawCollection(object, ancestors),
  });

  getSearchTerms (object = this.target, visited = new Set<object>(), depth = 0): string[] { return this.tree.searchTerms(object, visited, depth); }

  onInspectorGUI (firstProperties: readonly PropertyKey[] = []): void { this.tree.draw(this.target, new Set(), firstProperties); }

  private isInlineObject (value: unknown): value is object {
    return !!value && typeof value === 'object' &&
      (this.isCollection(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }

  private isCollection (object: object): boolean {
    return Array.isArray(object) || ArrayBuffer.isView(object) || object instanceof Map || object instanceof Set;
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

          this.tree.drawProperty({ [index]: value }, { key: String(index), value, writable: false }, ancestors);
        }
        index++;
      }
    } else {
      for (let index = start; index < end; index++) {
        this.tree.drawProperty(view, { key: String(index), value: sequence[index], writable: !Object.isFrozen(view) }, ancestors);
      }
    }
  }
}
