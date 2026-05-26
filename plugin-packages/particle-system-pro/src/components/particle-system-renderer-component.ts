import { RendererComponent, Texture, math } from '@galacean/effects';
import type { Renderer } from '@galacean/effects';
import type { ProRenderer } from '../renderers/renderer';
import { ProRibbonRenderer } from '../renderers/ribbon-renderer';
import { ProRibbonRendererProperties } from '../renderers/ribbon-renderer-properties';
import { ProSpriteRenderer } from '../renderers/sprite-renderer';
import { ProSpriteRendererProperties } from '../renderers/sprite-renderer-properties';
import type {
  ProParticleSystemRendererComponentData,
  ProRendererSnapshot,
  ProRibbonRendererPropertiesData,
  ProSpriteRendererPropertiesData,
} from '../types/component-data';
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

  /**
   * 序列化所有 renderer 的可配置项；texture 仅记录 URL（GPU 资源不可 JSON）。
   */
  override toData (): ProParticleSystemRendererComponentData {
    const data: ProParticleSystemRendererComponentData = { renderers: [] };

    for (const r of this.renderers) {
      if (r instanceof ProSpriteRenderer) {
        const p = r.properties;
        const snap: ProSpriteRendererPropertiesData = {
          blending: p.blending,
          facingMode: p.facingMode,
          sortMode: p.sortMode,
          subUVRows: p.subUVRows,
          subUVCols: p.subUVCols,
          subUVTotal: p.subUVTotal,
        };
        const url = getDebugTextureUrl(p);

        if (url) {
          snap.textureUrl = url;
        }
        data.renderers!.push({ type: 'sprite', properties: snap });
      } else if (r instanceof ProRibbonRenderer) {
        const p = r.properties;
        const snap: ProRibbonRendererPropertiesData = {
          blending: p.blending,
          widthScale: p.widthScale,
          textureMode: p.textureMode,
          tileLength: p.tileLength,
          facingMode: p.facingMode,
          tessellationMode: p.tessellationMode,
          customSubdivisions: p.customSubdivisions,
          curveTension: p.curveTension,
        };
        const url = getDebugTextureUrl(p);

        if (url) {
          snap.textureUrl = url;
        }
        data.renderers!.push({ type: 'ribbon', properties: snap });
      }
    }

    return data;
  }

  /**
   * 清空现有 renderers，按 data 重建。texture URL 异步加载，不阻塞 fromData 返回。
   */
  override fromData (data: ProParticleSystemRendererComponentData): void {
    super.fromData(data as Parameters<RendererComponent['fromData']>[0]);
    if (!data.renderers) {
      return;
    }

    while (this.renderers.length > 0) {
      const r = this.renderers[0];

      this.removeRenderer(0);
      r.release();
    }

    for (const snap of data.renderers) {
      this.addSnapshot(snap);
    }
  }

  private addSnapshot (snap: ProRendererSnapshot): void {
    const engine = this.item.engine;

    if (snap.type === 'sprite') {
      const sp = snap.properties as ProSpriteRendererPropertiesData;
      const props = new ProSpriteRendererProperties();

      if (sp.blending !== undefined) { props.blending = sp.blending; }
      if (sp.facingMode !== undefined) { props.facingMode = sp.facingMode; }
      if (sp.sortMode !== undefined) { props.sortMode = sp.sortMode; }
      if (sp.subUVRows !== undefined) { props.subUVRows = sp.subUVRows; }
      if (sp.subUVCols !== undefined) { props.subUVCols = sp.subUVCols; }
      if (sp.subUVTotal !== undefined) { props.subUVTotal = sp.subUVTotal; }
      if (sp.textureUrl) {
        setDebugTextureUrl(props, sp.textureUrl);
      }
      const renderer = new ProSpriteRenderer(engine, props);

      this.addRenderer(renderer);
      if (sp.textureUrl) {
        void Texture.fromImage(sp.textureUrl, engine).then(t => renderer.setTexture(t)).catch(err => {
          console.warn('[ProParticleSystemRendererComponent] failed to load sprite texture', sp.textureUrl, err);
        });
      }
    } else if (snap.type === 'ribbon') {
      const rp = snap.properties as ProRibbonRendererPropertiesData;
      const props = new ProRibbonRendererProperties();

      if (rp.blending !== undefined) { props.blending = rp.blending; }
      if (rp.widthScale !== undefined) { props.widthScale = rp.widthScale; }
      // ribbon textureMode / facingMode 是 enum，值与字符串字面量一致，cast 安全
      if (rp.textureMode !== undefined) { props.textureMode = rp.textureMode as typeof props.textureMode; }
      if (rp.tileLength !== undefined) { props.tileLength = rp.tileLength; }
      if (rp.facingMode !== undefined) { props.facingMode = rp.facingMode as typeof props.facingMode; }
      if (rp.tessellationMode !== undefined) { props.tessellationMode = rp.tessellationMode as typeof props.tessellationMode; }
      if (rp.customSubdivisions !== undefined) { props.customSubdivisions = rp.customSubdivisions; }
      if (rp.curveTension !== undefined) { props.curveTension = rp.curveTension; }
      if (rp.textureUrl) {
        setDebugTextureUrl(props, rp.textureUrl);
      }
      const renderer = new ProRibbonRenderer(engine, props);

      this.addRenderer(renderer);
      if (rp.textureUrl) {
        void Texture.fromImage(rp.textureUrl, engine).then(t => renderer.setTexture(t)).catch(err => {
          console.warn('[ProParticleSystemRendererComponent] failed to load ribbon texture', rp.textureUrl, err);
        });
      }
    }
  }
}

// 与 imgui-demo 中 getDebugTextureUrl / setDebugTextureUrl 保持同样的 __debugUrl 约定：
// renderer properties 上挂一个 __debugUrl 字段记录加载用的 URL，纯调试/序列化用。
function getDebugTextureUrl (p: object): string | undefined {
  return (p as Record<string, string | undefined>).__debugUrl;
}

function setDebugTextureUrl (p: object, url: string): void {
  (p as Record<string, string>).__debugUrl = url;
}
