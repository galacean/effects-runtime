import type { Engine } from '../../engine';
import { Plugin } from '../plugin';

/**
 * particle-system-pro 插件入口。
 *
 * Phase 1 仅占位注册，让 plugin-system 知道这个 plugin 存在；后续
 * Phase 2 会在这里挂上资源加载和合成生命周期钩子。
 */
export class ProParticleSystemLoader extends Plugin {
  override name = 'particleSystemPro';
  engine: Engine;
}
