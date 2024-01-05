import './polyfill';
import { EffectComponent } from './components';
import { Deserializer, DataType } from './deserializer';
import { registerPlugin } from './plugin-system';
import type { TextComponent, TimelineComponent } from './plugins';
import { CameraController, InteractComponent } from './plugins';
import {
  CalculateLoader, CameraVFXItemLoader, InteractLoader, ParticleLoader, SpriteLoader, TextLoader,
  ParticleSystem, SpriteComponent,
} from './plugins';
import { VFXItem } from './vfx-item';

export * as math from '@galacean/effects-math/es/core/index';
export * as spec from '@galacean/effects-specification';
export {
  getStandardComposition, getStandardImage, getStandardItem, getStandardJSON,
} from '@galacean/effects-specification/dist/fallback';
export * from './asset-manager';
export * from './camera';
export * from './components';
export * from './composition';
export * from './comp-vfx-item';
export * from './composition-source-manager';
export * from './config';
export * from './constants';
export * from './deserializer';
export * from './downloader';
export * from './engine';
export * from './gl';
export * from './material';
export * from './math';
export * from './paas-texture-cache';
export * from './plugin-system';
export * from './plugins';
export * from './render';
export * from './scene';
export * from './semantic-map';
export * from './shader';
export * from './shape';
export * from './template-image';
export * from './texture';
export * from './ticker';
export * from './transform';
export * from './utils';
export * from './vfx-item';
export * from './deserializer';

registerPlugin<CameraController>('camera', CameraVFXItemLoader, VFXItem, true);
registerPlugin<TextComponent>('text', TextLoader, VFXItem, true);
registerPlugin<SpriteComponent>('sprite', SpriteLoader, VFXItem, true);
registerPlugin<ParticleSystem>('particle', ParticleLoader, VFXItem, true);
registerPlugin<TimelineComponent>('cal', CalculateLoader, VFXItem, true);
registerPlugin<InteractComponent>('interact', InteractLoader, VFXItem, true);
// registerFilters(filters);

Deserializer.addConstructor(VFXItem, DataType.VFXItemData);
Deserializer.addConstructor(EffectComponent, DataType.EffectComponent);
Deserializer.addConstructor(SpriteComponent, DataType.SpriteComponent);
Deserializer.addConstructor(ParticleSystem, DataType.ParticleSystem);
Deserializer.addConstructor(InteractComponent, DataType.InteractComponent);
Deserializer.addConstructor(CameraController, DataType.CameraController);
