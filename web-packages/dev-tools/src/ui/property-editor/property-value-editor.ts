import { math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { PropertyHandle } from './property-handle';
import type { PropertyGroup, ValueBinding } from './property-sheet';

export interface PropertyValueEditor {
  accepts(value: unknown): boolean,
  create(handle: PropertyHandle<any>, group: PropertyGroup): Control,
}
const editors: PropertyValueEditor[] = [
  { accepts: value => typeof value === 'number' && Number.isFinite(value), create: (handle, group) => group.number(handle.label, binding(handle)) },
  { accepts: value => typeof value === 'string', create: (handle, group) => group.text(handle.label, binding(handle)) },
  { accepts: value => typeof value === 'boolean', create: (handle, group) => group.boolean(handle.label, binding(handle)) },
  { accepts: value => value instanceof math.Vector2 || value instanceof math.Vector3 || value instanceof math.Vector4, create: (handle, group) => {
    const count = handle.value instanceof math.Vector4 ? 4 : handle.value instanceof math.Vector3 ? 3 : 2;
    const keys = ['x', 'y', 'z', 'w'].slice(0, count);

    return group.vector(handle.label, { read: () => keys.map(key => Reflect.get(handle.value, key) as number),
      write: values => handle.mutate(() => keys.forEach((key, index) => Reflect.set(handle.value, key, values[index]))) }, count);
  } },
  { accepts: value => value instanceof math.Color, create: (handle, group) => group.color(handle.label, {
    read: () => handle.value as math.Color, write: value => handle.mutate(() => (handle.value as math.Color).copyFrom(value)),
  }) },
];

function binding<T> (handle: PropertyHandle<T>): ValueBinding<T> { return { read: () => handle.value, write: value => handle.set(value) }; }
export function registerPropertyValueEditor (editor: PropertyValueEditor): void { editors.unshift(editor); }
export function createPropertyValue (handle: PropertyHandle, group: PropertyGroup): Control | undefined {
  const editor = editors.find(candidate => candidate.accepts(handle.value));

  if (!editor) { return; }
  const control = editor.create(handle, group);

  control.enabled = handle.writable;

  return control;
}
