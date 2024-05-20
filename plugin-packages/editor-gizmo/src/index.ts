import type { VFXItemContent } from '@galacean/effects';
import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { EditorGizmoPlugin } from './gizmo-loader';
import { GizmoSubType } from './define';
import { GeometryType, createGeometry } from './geometry';

registerPlugin('editor-gizmo', EditorGizmoPlugin, VFXItem<VFXItemContent>);

export { DirectionLightData } from './geometry/direction-light';
export {
  GizmoSubType,
  GeometryType,
  createGeometry,
};

export const version = __VERSION__;

logger.info('plugin editor gizmo version: ' + version);
