import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin } from '@galacean/effects';
import { ProParticleSystemLoader } from './particle-system-pro-loader';

registerPlugin('particleSystemPro', ProParticleSystemLoader);

export * from './types';
export * from './utils/random-stream';
export * from './utils/id-table';
export * from './parameters/parameter-store';
export * from './parameters/parameter-binding';
export * from './data/data-set-layout';
export * from './data/data-buffer';
export * from './data/data-set';
export * from './data/data-accessor';
export * from './modules/stage';
export * from './modules/module-context';
export * from './modules/module';
export * from './modules/system-module';
export * from './modules/builtin';
export * from './simulation/emitter-instance';
export * from './simulation/system-instance';
export * from './simulation/module-serialization';
export * from './curves';
export * from './distribution';
export * from './builtin';
export * from './renderers/renderer-properties';
export * from './renderers/renderer';
export * from './renderers/sprite-renderer-properties';
export * from './renderers/sprite-renderer';
export * from './renderers/ribbon-renderer-properties';
export * from './renderers/ribbon-renderer';
export * from './components/particle-system-component';
export * from './components/particle-system-renderer-component';
export * from './particle-system-pro-loader';

/**
 * 插件版本号
 */
export const version = __VERSION__;

logger.info(`Plugin particle-system-pro version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Particle System Pro 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Particle System Pro plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
