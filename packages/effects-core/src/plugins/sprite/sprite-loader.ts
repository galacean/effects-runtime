import type * as spec from '@galacean/effects-specification';
import type { PrecompileOptions } from '../../plugin-system';
import type { Renderer } from '../../render';
import { createCopyShader } from '../../render';
import { AbstractPlugin } from '../index';
import { maxSpriteMeshItemCount, spriteMeshShaderFromRenderInfo, spriteMeshShaderIdFromRenderInfo } from './sprite-mesh';

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
  override name = 'sprite';

  static override precompile (compositions: spec.Composition[], render: Renderer, options?: PrecompileOptions): Promise<any> {
    const shaderLibrary = render.getShaderLibrary()!;
    const { level, detail } = render.engine.gpuCapability;
    const { env } = options ?? {};

    if (!shaderLibrary.shaderResults[spriteMeshShaderIdFromRenderInfo(defRenderInfo, 2)]) {
      shaderLibrary.addShader(spriteMeshShaderFromRenderInfo(defRenderInfo, 2, 1, env));
      shaderLibrary.addShader(spriteMeshShaderFromRenderInfo(defRenderInfo, maxSpriteMeshItemCount, 1, env));

      if (detail.writableFragDepth) {
        shaderLibrary.addShader(createCopyShader(level, true));
      }
    }

    return Promise.resolve();
  }

  // override onCompositionDestroyed (composition: Composition) {
  //   // const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

  //   // spriteGroup.dispose();
  // }

  // override onCompositionReset (composition: Composition, pipeline: RenderFrame) {
  //   // const spriteGroup = new SpriteGroup(composition);

  //   // composition.loaderData.spriteGroup = spriteGroup;
  //   // spriteGroup.resetMeshSplits();
  // }

  // override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<SpriteComponent>) {
  //   // const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

  //   // if (item.type !== spec.ItemType.composition) {
  //   //   spriteGroup.addItem(item);
  //   // }

  //   // if (item.type == spec.ItemType.sprite || item.type == spec.ItemType.filter) {
  //   //   this.items.push(item);
  //   // }
  // }

  // override onCompositionItemRemoved (composition: Composition, item: VFXItem<SpriteComponent>) {
  //   // const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

  //   // spriteGroup.removeItem(item);
  //   // removeItem(this.items, item);
  // }

  // override onCompositionUpdate (composition: Composition, dt: number) {
  //   // const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;

  //   // spriteGroup.onUpdate(dt);

  //   // for (const item of this.items) {
  //   //   if (!item.content.calculateItem.ended) {
  //   //     item.content.spriteMesh?.updateItem(item.content);
  //   //   }
  //   // }
  // }

  // override prepareRenderFrame (composition: Composition, renderFrame: RenderFrame): boolean {
  //   // for (const item of this.items) {
  //   //   renderFrame.addMeshToDefaultRenderPass(item.getComponent(Mesh));
  //   // }
  //   // const spriteGroup: SpriteGroup = composition.loaderData.spriteGroup;
  //   // const ret = spriteGroup.diffMeshSplits();

  //   // if (ret) {
  //   //   ret.remove?.forEach(mesh => renderFrame.removeMeshFromDefaultRenderPass(mesh));
  //   //   ret.add?.forEach(mesh => renderFrame.addMeshToDefaultRenderPass(mesh));
  //   //   ret.modify?.forEach(mesh => {
  //   //     // reset priority
  //   //     renderFrame.removeMeshFromDefaultRenderPass(mesh);
  //   //     renderFrame.addMeshToDefaultRenderPass(mesh);
  //   //   });

  //   //   return !!(this.layerInfo = ret.layer);
  //   // }

  //   return false;
  // }

  // override postProcessFrame (composition: Composition, pipeline: RenderFrame) {
  //   // this.layerInfo?.layerToAdd?.forEach(layer => {
  //   //   const filterDefine = layer.items[0].filter;

  //   //   if (filterDefine !== undefined) {
  //   //     const options = filterDefine.passSplitOptions as RenderPassSplitOptions;
  //   //     const renderPass = pipeline.splitDefaultRenderPassByMesh(layer.mesh, options);

  //   //     // layer.mesh.material.setUniformSemantic('uSamplerPre', SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_0);
  //   //     if (filterDefine.renderPassDelegate) {
  //   //       renderPass.delegate = filterDefine.renderPassDelegate;
  //   //     }
  //   //     if (filterDefine.onRenderPassCreated) {
  //   //       filterDefine.onRenderPassCreated(renderPass, pipeline);
  //   //     }
  //   //   }
  //   // });
  //   // this.layerInfo = undefined;
  // }
}
