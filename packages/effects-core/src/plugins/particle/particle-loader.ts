import type * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import type { Renderer, SharedShaderWithSource } from '../../render';
import { GLSLVersion } from '../../render';
import { Item } from '../../vfx-item';
import type { ParticleSystemOptions } from './particle-system';
import { AbstractPlugin } from '../plugin';
import { getParticleMeshShader, modifyMaxKeyframeShader } from './particle-mesh';
import { getTrailMeshShader } from './trail-mesh';
import type { PrecompileOptions } from '../../plugin-system';

export class ParticleLoader extends AbstractPlugin {
  engine: Engine;

  static override precompile (compositions: spec.Composition[], renderer: Renderer, options?: PrecompileOptions): Promise<any> {
    const gpuCapability = renderer.engine.gpuCapability;
    const { level } = gpuCapability;
    const { env } = options ?? {};
    const shaderLibrary = renderer.getShaderLibrary();
    const items: spec.ParticleItem[] = [];
    const shaders: SharedShaderWithSource[] = [];
    let maxFragmentCount = 0;
    let maxVertexCount = 0;

    // 增加预合成中的粒子处理
    compositions.forEach(comp => {
      comp.items.forEach(item => {
        if (Item.isParticle(item)) {
          items.push(item);
        }
      });
    });

    items.forEach(item => {
      const { shader, fragment, vertex } = getParticleMeshShader(item, gpuCapability, env);

      shaders.push(shader);
      maxFragmentCount = Math.max(maxFragmentCount, fragment);
      maxVertexCount = Math.max(maxVertexCount, vertex);

      // TODO 此处add是否有意义？shader变量似乎没有加到this.shaders数组。
      if (item.content.trails) {
        const shader = getTrailMeshShader(item.content.trails, item.content.options.maxCount, item.name, gpuCapability, env);

        shader.glslVersion = level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1;
        shaderLibrary?.addShader(shader);
      }
    });
    shaders.forEach(shader => {
      if (level === 2) {
        modifyMaxKeyframeShader(shader, maxVertexCount, maxFragmentCount);
        shader.glslVersion = GLSLVersion.GLSL3;
      } else {
        shader.glslVersion = GLSLVersion.GLSL1;
      }
      shaderLibrary?.addShader(shader);
    });
    if (level === 2) {
      items.forEach(item => {
        (item.content.options as ParticleSystemOptions).meshSlots = [maxVertexCount, maxFragmentCount];
      });
    }

    return Promise.resolve();
  }
}
