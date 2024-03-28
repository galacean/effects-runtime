import type { spec } from '@galacean/effects';
import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { ModelPlugin, ModelTreePlugin } from './plugin';

registerPlugin<void>('tree', ModelTreePlugin, VFXItem, true);
registerPlugin<void>('model', ModelPlugin, VFXItem);

export const version = __VERSION__;

export type BaseTransform = spec.BaseItemTransform;
export type ModelBaseItem = spec.BaseItem;
export type ModelItemCamera = spec.ModelCameraItem;
export type ModelItemLight = spec.ModelLightItem;
export type ModelCameraContent = spec.ModelCameraContent;
export type ModelLightContent = spec.ModelLightContent;
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
export type ModelMeshContent = spec.ModelMeshItemContent<'studio'>;
export type ModelSkyboxContent = spec.SkyboxContent<'studio'>;
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

export type ModelMeshComponentData = spec.ModelMeshComponentData;
export type ModelMeshComponentOptions = spec.ModelMeshComponentOptions;
export type ModelPrimitiveComponentOptions = spec.PrimitiveComponentOptions;
export type ModelSkyboxComponentData = spec.SkyboxComponentData;
export type ModelLightComponentData = spec.ModelLightComponentData;
export type ModelCameraComponentData = spec.ModelCameraComponentData;

export * from './gesture';
export * from './gltf';
export * from './plugin';
export * from './runtime';
export * from './utility';

logger.info('plugin model version: ' + version);
