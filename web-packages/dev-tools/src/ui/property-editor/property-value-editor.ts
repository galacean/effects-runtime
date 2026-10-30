import { math } from '@galacean/effects';
import { ImGui } from '../../platform/imgui';
import { PropertyFields as Fields } from './property-fields';
import type { PropertyHandle } from './property-handle';

export interface PropertyValueEditor {
  accepts(value: unknown): boolean,
  draw(handle: PropertyHandle<any>): boolean,
}

const editors: PropertyValueEditor[] = [
  { accepts: value => typeof value === 'number' && Number.isFinite(value), draw: handle => Fields.NumberField(handle.label, handle.access) },
  { accepts: value => typeof value === 'string', draw: handle => Fields.Property(handle.label, width => {
    ImGui.SetNextItemWidth(width);

    return ImGui.InputText('##Value', handle.access);
  }) },
  { accepts: value => typeof value === 'boolean', draw: handle => Fields.Property(handle.label, () => ImGui.Checkbox('##Value', handle.access)) },
  { accepts: value => value instanceof math.Vector3, draw: handle => handle.mutate(() => Fields.Vector3Field(handle.label, handle.value)) },
  { accepts: value => value instanceof math.Vector2, draw: handle => handle.mutate(() => Fields.Vector2Field(handle.label, handle.value)) },
  { accepts: value => value instanceof math.Color, draw: handle => handle.mutate(() => Fields.ColorField(handle.label, handle.value)) },
];

export function registerPropertyValueEditor (editor: PropertyValueEditor): void { editors.unshift(editor); }

export function drawPropertyValue (handle: PropertyHandle): boolean {
  const editor = editors.find(candidate => candidate.accepts(handle.value));

  if (!editor) { return false; }
  ImGui.BeginDisabled(!handle.writable);
  editor.draw(handle);
  ImGui.EndDisabled();

  return true;
}
