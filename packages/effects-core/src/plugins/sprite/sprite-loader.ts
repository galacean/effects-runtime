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
}
