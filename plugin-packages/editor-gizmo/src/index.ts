export const version = __VERSION__;

console.info('[Galacean Effects Plugin Editor Gizmo] version: ' + version);

import { registerPlugin } from '@galacean/effects';
import { EditorGizmoPlugin } from './gizmo-loader';
import { GizmoVFXItem } from './gizmo-vfx-item';
import { GizmoSubType } from './define';
import { GeometryType, createGeometry } from './geometry';

registerPlugin('editor-gizmo', EditorGizmoPlugin, GizmoVFXItem);

export { DirectionLightData } from './geometry/direction-light';
export {
  GizmoSubType,
  GeometryType,
  createGeometry,
  GizmoVFXItem,
};
