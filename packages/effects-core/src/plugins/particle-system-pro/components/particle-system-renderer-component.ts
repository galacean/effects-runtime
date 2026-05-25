import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { RendererComponent } from '../../../components';
import type { Renderer } from '../../../render';
import type { ProRenderer } from '../renderers/renderer';
import { ProRibbonRenderer } from '../renderers/ribbon-renderer';
import { ProSpriteRenderer } from '../renderers/sprite-renderer';
import { ProParticleSystemComponent } from './particle-system-component';

const IDENTITY_MATRIX = new Matrix4().identity();

/**
 * 把 ProSystemInstance 的粒子渲染出来的组件。
 *
 * renderers[i] 对应 systemInstance.emitters[i]。
 * 支持 Sprite 和 Ribbon 两种 renderer 类型。
 */
export class ProParticleSystemRendererComponent extends RendererComponent {
  renderers: ProRenderer[] = [];

  addRenderer (renderer: ProRenderer): void {
    this.renderers.push(renderer);
    if (renderer instanceof ProSpriteRenderer || renderer instanceof ProRibbonRenderer) {
      this.materials.push(renderer.material);
    }
  }

  removeRenderer (index: number): void {
    if (index < 0 || index >= this.renderers.length) {
      return;
    }
    const removed = this.renderers[index];

    this.renderers.splice(index, 1);
    if (removed instanceof ProSpriteRenderer || removed instanceof ProRibbonRenderer) {
      const matIdx = this.materials.indexOf(removed.material);

      if (matIdx >= 0) {
        this.materials.splice(matIdx, 1);
      }
    }
  }

  override render (renderer: Renderer): void {
    const systemComponent = this.item.getComponent(ProParticleSystemComponent);

    if (!systemComponent) {
      return;
    }
    const emitters = systemComponent.systemInstance.emitters;
    const worldMatrix = this.transform.getWorldMatrix();

    for (let i = 0; i < this.renderers.length; i++) {
      const emitter = emitters[i];

      if (!emitter) {
        continue;
      }
      const r = this.renderers[i];
      // World space：粒子位置已是世界坐标，不能再乘 world matrix；用 identity
      const drawMatrix = emitter.simulationSpace === 'world' ? IDENTITY_MATRIX : worldMatrix;

      r.generateDynamicData(emitter);
      if (r instanceof ProSpriteRenderer || r instanceof ProRibbonRenderer) {
        r.draw(renderer, drawMatrix);
      }
    }
  }
}
