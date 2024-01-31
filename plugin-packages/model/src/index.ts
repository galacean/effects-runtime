import type { spec } from '@galacean/effects';
import { logger, registerPlugin } from '@galacean/effects';
import { ModelTreePlugin, ModelTreeVFXItem } from './plugin';
import { ModelPlugin } from './plugin/model-plugin';
import { ModelVFXItem } from './plugin/model-vfx-item';

registerPlugin<void>('tree', ModelTreePlugin, ModelTreeVFXItem, true);
registerPlugin<void>('model', ModelPlugin, ModelVFXItem);

export const version = __VERSION__;

export type BaseTransform = spec.BaseItemTransform;
export type ModelBaseItem = spec.BaseItem;
export type ModelItemCamera = spec.ModelCameraItem;
export type ModelItemLight = spec.ModelLightItem;
export type ModelTextureTransform = spec.ModelTextureTransform;
export type ModelItemBoundingBox = spec.ModelItemBoundingBox;
export type ModelItemBoundingSphere = spec.ModelItemBoundingSphere;
export type ModelItemBounding = spec.ModelItemBounding;
export type ModelCameraOptions = spec.ModelCameraOptions;
export type ModelLightBaseOptions = spec.ModelLightBaseOptions;
export type ModelLightPointOptions = spec.ModelLightPointOptions;
export type ModelLightSpotOptions = spec.ModelLightSpotOptions;
export type ModelLightDirOptions = spec.ModelLightDirOptions;
export type ModelAmbientLightOptions = spec.ModelAmbientLightOptions;
export type ModelLightOptions = spec.ModelLightOptions;

export type ModelItemMesh = spec.ModelMeshItem<'studio'>;
export type ModelItemSkybox = spec.ModelSkyboxItem<'studio'>;
export type ModelItemTree = spec.ModelTreeItem<'studio'>;
export type ModelMeshOptions = spec.ModelMeshOptions<'studio'>;
export type ModelSkinOptions = spec.SkinOptions<'studio'>;
export type ModelPrimitiveOptions = spec.PrimitiveOptions<'studio'>;
export type ModelMaterialUnlitOptions = spec.MaterialUnlitOptions<'studio'>;
export type ModelMaterialPBROptions = spec.MaterialPBROptions<'studio'>;
export type ModelMaterialHariOptions = spec.MaterialHairOptions<'studio'>;
export type ModelMaterialOptions = spec.MaterialOptions<'studio'>;
export type ModelSkyboxOptions = spec.SkyboxOptions<'studio'>;
export type ModelTreeOptions = spec.ModelTreeOptions<'studio'>;
export type ModelTreeContent = spec.ModelTreeContent<'studio'>;
export type ModelAnimTrackOptions = spec.ModelAnimTrackOptions<'studio'>;
export type ModelAnimationOptions = spec.ModelAnimationOptions<'studio'>;

export * from './gesture';
export * from './gltf';
export * from './plugin';
export * from './runtime';
export * from './utility';

logger.info('plugin model version: ' + version);
