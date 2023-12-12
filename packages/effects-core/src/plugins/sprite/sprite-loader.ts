import * as spec from '@galacean/effects-specification';
import type { Composition } from '../../composition';
import type { SpriteItem } from '../index';
import { AbstractPlugin } from '../index';
import { Item, type VFXItem } from '../../vfx-item';
import type { LayerInfo } from './sprite-group';
import { SpriteGroup } from './sprite-group';
import type { RenderFrame, Renderer, RenderPassSplitOptions } from '../../render';
import { createCopyShader } from '../../render';
import { maxSpriteMeshItemCount, spriteMeshShaderFromFilter, spriteMeshShaderFromRenderInfo, spriteMeshShaderIdFromRenderInfo } from './sprite-mesh';
import { createFilterShaders } from '../../filter';
import type { PrecompileOptions } from '../../plugin-system';

const defRenderInfo = {
  blending: 0,
  cacheId: '-',
  mask: 0,
  maskMode: 0,
  occlusion: false,
  side: 0,
  cachePrefix: '-',
};

export class SpriteLoader extends AbstractPlugin {
  layerInfo?: LayerInfo;
  override name = 'sprite';

  static override precompile (compositions: spec.Composition[], render: Renderer, options?: PrecompileOptions): Promise<any> {
    const shaderLibrary = render.getShaderLibrary()!;
    const { level, detail } = render.engine.gpuCapability;
    const { env } = options ?? {};

    if (!shaderLibrary.shaderResults[spriteMeshShaderIdFromRenderInfo(defRenderInfo, 2)]) {
      shaderLibrary.addShader(spriteMeshShaderFromRenderInfo(defRenderInfo, 2, level, env));
      shaderLibrary.addShader(spriteMeshShaderFromRenderInfo(defRenderInfo, maxSpriteMeshItemCount, level, env));
      let hasFilter = false;

      compositions[0]?.items.forEach(item => {
        if (Item.isFilter(item) && item.content.filter) {
          hasFilter = true;
          const shaderDefs = createFilterShaders(item.content.filter);

          shaderDefs.forEach(function (def) {
            if (!def.isParticle) {
              const shader = spriteMeshShaderFromFilter(level, def, def);

              if (def.shaderCacheId) {
                shader.cacheId = `${def.shaderCacheId}_effects_filter`;
              }
              shaderLibrary.addShader(shader);
            }
          });
        }
      });
      if (hasFilter) {
        shaderLibrary.addShader(createCopyShader(level, false));
      }
      if (detail.writableFragDepth) {
        shaderLibrary.addShader(createCopyShader(level, true));
      }
    }

    return Promise.resolve();
  }

  override onCompositionDestroyed (composition: Composition) {
    const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

    spriteGroup.dispose();
    delete composition.loaderData.spriteGroup;
  }

  override onCompositionReset (composition: Composition, pipeline: RenderFrame) {
    if (!composition.loaderData.spriteGroup) {
      const spriteGroup = new SpriteGroup(composition);

      composition.loaderData.spriteGroup = spriteGroup;
      spriteGroup.resetMeshSplits();
    }
  }

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<SpriteItem>) {
    const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

    if (item.type !== spec.ItemType.composition) {
      spriteGroup.addItem(item);
    }
  }

  override onCompositionItemRemoved (composition: Composition, item: VFXItem<SpriteItem>) {
    const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

    spriteGroup.removeItem(item);
  }

  override onCompositionUpdate (composition: Composition, dt: number) {
    const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

    spriteGroup.onUpdate(dt);
  }

  override prepareRenderFrame (composition: Composition, renderFrame: RenderFrame): boolean {
    const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;
    const ret = spriteGroup.diffMeshSplits();

    if (ret) {
      ret.remove?.forEach(mesh => renderFrame.removeMeshFromDefaultRenderPass(mesh));
      ret.add?.forEach(mesh => renderFrame.addMeshToDefaultRenderPass(mesh));
      ret.modify?.forEach(mesh => {
        // reset priority
        renderFrame.removeMeshFromDefaultRenderPass(mesh);
        renderFrame.addMeshToDefaultRenderPass(mesh);
      });

      return !!(this.layerInfo = ret.layer);
    }

    return false;
  }

  override postProcessFrame (composition: Composition, pipeline: RenderFrame) {
    this.layerInfo?.layerToAdd?.forEach(layer => {
      const filterDefine = layer.items[0].filter;

      if (filterDefine !== undefined) {
        const options = filterDefine.passSplitOptions as RenderPassSplitOptions;
        const renderPass = pipeline.splitDefaultRenderPassByMesh(layer.mesh, options);

        // layer.mesh.material.setUniformSemantic('uSamplerPre', SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_0);
        if (filterDefine.renderPassDelegate) {
          renderPass.delegate = filterDefine.renderPassDelegate;
        }
        if (filterDefine.onRenderPassCreated) {
          filterDefine.onRenderPassCreated(renderPass, pipeline);
        }
      }
    });
    this.layerInfo = undefined;
  }
}
