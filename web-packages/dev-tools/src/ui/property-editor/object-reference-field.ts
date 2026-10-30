import type { Texture } from '@galacean/effects';
import type { PropertyHeaderIcon } from './property-grid';

export type ObjectReferenceRenderer = (object: object, property: string, width: number, expectedType?: string,
  readOnly?: boolean, icon?: PropertyHeaderIcon, onAssetDrop?: (texture: Texture) => void) => boolean;

let renderer: ObjectReferenceRenderer | undefined;

export function registerObjectReferenceRenderer (next: ObjectReferenceRenderer): void { renderer = next; }

export const objectReferenceField: ObjectReferenceRenderer = (...args) => {
  if (!renderer) { throw new Error('The object reference renderer has not been registered.'); }

  return renderer(...args);
};
