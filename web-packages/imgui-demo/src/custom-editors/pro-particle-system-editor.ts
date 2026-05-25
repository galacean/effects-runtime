import { ProParticleSystemComponent, ProParticleSystemRendererComponent } from '@galacean/effects';
import { editor } from '../core/decorators';
import { drawProParticleStack } from '../panels/pro-particle-editor';
import { Editor } from './editor';

/**
 * Inspector 里编 ProParticleSystemComponent，直接复用 Pro Particle 面板
 * 的 stack 视图，让 Inspector 和 Window/Pro Particle 内容一致。
 */
@editor(ProParticleSystemComponent)
export class ProParticleSystemComponentEditor extends Editor {
  override onInspectorGUI (): void {
    const system = this.target as ProParticleSystemComponent;
    const renderer = system.item?.getComponent(ProParticleSystemRendererComponent) ?? null;

    drawProParticleStack(system, renderer);
  }
}
