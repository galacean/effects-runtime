import * as EFFECTS from '@galacean/effects';
import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { EditorGizmoPlugin } from './gizmo-loader';
import { GizmoSubType } from './define';
import { GeometryType, createGeometry } from './geometry';

registerPlugin('editor-gizmo', EditorGizmoPlugin, VFXItem);

export { DirectionLightData } from './geometry/direction-light';
export {
  GizmoSubType,
  GeometryType,
  createGeometry,
};
export * from './gizmo-component';

/**
 * 插件版本号
 */
export const version = __VERSION__;

logger.info(`Plugin editor gizmo version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Editor Gizmo 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Editor Gizmo plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
