import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { ValueBinding } from './property-sheet';

export interface ObjectReferenceOptions {
  expectedType?: string,
  readOnly?: boolean,
  allowEmpty?: boolean,
  changed?: (action: () => void) => void,
}
export type ObjectReferenceFactory = (engine: Engine, binding: ValueBinding<object | null>, options: ObjectReferenceOptions) => Control;
let factory: ObjectReferenceFactory | undefined;

export function registerObjectReferenceFactory (next: ObjectReferenceFactory): void { factory = next; }
export function createObjectReferenceControl (engine: Engine, binding: ValueBinding<object | null>, options: ObjectReferenceOptions = {}): Control {
  if (!factory) { throw new Error('The object reference factory has not been registered.'); }

  return factory(engine, binding, options);
}
