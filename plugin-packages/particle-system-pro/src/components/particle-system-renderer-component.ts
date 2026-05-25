import { RendererComponent, math } from '@galacean/effects';
import type { Renderer } from '@galacean/effects';
import type { ProRenderer } from '../renderers/renderer';
import { ProRibbonRenderer } from '../renderers/ribbon-renderer';
import { ProSpriteRenderer } from '../renderers/sprite-renderer';
import { ProParticleSystemComponent } from './particle-system-component';

const IDENTITY_MATRIX = new math.Matrix4().identity();

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

    // 提取相机位置 + 视方向，给排序 / ribbon facing 用
    let camX = 0, camY = 0, camZ = 8;
    let viewX = 0, viewY = 0, viewZ = -1;
    const composition = this.item.composition;

    if (composition && composition.camera) {
      const camPos = composition.camera.worldPosition;

      if (camPos) {
        camX = camPos.x; camY = camPos.y; camZ = camPos.z;
      }
      // view direction：相机看向的方向，从 view matrix 第三行的负方向（OpenGL 约定）
      const v = composition.camera.getViewMatrix().elements;

      viewX = -v[2]; viewY = -v[6]; viewZ = -v[10];
    }

    for (let i = 0; i < this.renderers.length; i++) {
      const emitter = emitters[i];

      if (!emitter) {
        continue;
      }
      const r = this.renderers[i];
      // World space：粒子位置已是世界坐标，不能再乘 world matrix；用 identity
      const drawMatrix = emitter.simulationSpace === 'world' ? IDENTITY_MATRIX : worldMatrix;

      if (r instanceof ProSpriteRenderer) {
        r.setSortContext(camX, camY, camZ, viewX, viewY, viewZ, worldMatrix);
      } else if (r instanceof ProRibbonRenderer) {
        r.setViewDirection(viewX, viewY, viewZ);
      }
      r.generateDynamicData(emitter);
      if (r instanceof ProSpriteRenderer || r instanceof ProRibbonRenderer) {
        r.draw(renderer, drawMatrix);
      }
    }
  }
}
