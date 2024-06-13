import type * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import { createShaderWithMacros, ShaderType } from '../../material';
import type { Renderer, SharedShaderWithSource } from '../../render';
import { GLSLVersion } from '../../render';
import { Item } from '../../vfx-item';
import { AbstractPlugin } from '../index';
import { getParticleMeshShader, modifyMaxKeyframeShader } from './particle-mesh';
import { getTrailMeshShader } from './trail-mesh';
import type { PrecompileOptions } from '../../plugin-system';

export class ParticleLoader extends AbstractPlugin {
  engine: Engine;

  static override precompile (compositions: spec.Composition[], renderer: Renderer, options?: PrecompileOptions): Promise<any> {
    const gpuCapability = renderer.engine.gpuCapability;
    const { level } = gpuCapability;
    const { env } = options ?? {};
    const shaderLibrary = renderer.getShaderLibrary()!;
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

        shader.vertex = createShaderWithMacros(shader.macros ?? [], shader.vertex, ShaderType.vertex, level);
        shader.fragment = createShaderWithMacros(shader.macros ?? [], shader.fragment, ShaderType.fragment, level);
        shader.glslVersion = level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1;
        shaderLibrary.addShader(shader);
      }
    });
    shaders.forEach(shader => {
      if (level === 2) {
        modifyMaxKeyframeShader(shader, maxVertexCount, maxFragmentCount);
        shader.glslVersion = GLSLVersion.GLSL3;
      } else {
        shader.glslVersion = GLSLVersion.GLSL1;
      }
      shader.vertex = createShaderWithMacros(shader.macros ?? [], shader.vertex, ShaderType.vertex, level);
      shader.fragment = createShaderWithMacros(shader.macros ?? [], shader.fragment, ShaderType.fragment, level);
      shaderLibrary.addShader(shader);
    });
    if (level === 2) {
      items.forEach(item => {
        // @ts-expect-error
        item.content.options.meshSlots = [maxVertexCount, maxFragmentCount];
      });
    }

    return Promise.resolve();
  }

  // override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<ParticleSystem>) {
  //   // if (VFXItem.isParticle(item)) {
  //   //   this.add(item.content);
  //   // }
  // }

  // override onCompositionItemRemoved (composition: Composition, item: VFXItem<ParticleSystem>) {
  //   // if (VFXItem.isParticle(item)) {
  //   //   if (item.content) {
  //   //     this.remove(item.content, composition.renderFrame);
  //   //   }
  //   // }
  // }

  // override prepareRenderFrame (composition: Composition, pipeline: RenderFrame): boolean {
  //   // this.meshes.forEach(mesh => pipeline.addMeshToDefaultRenderPass(mesh));

  //   return false;
  // }

  // private add (particle: ParticleSystem) {
  //   // particle.meshes.forEach(mesh => addItem(this.meshes, mesh));
  // }

  // private remove (particle: ParticleSystem, frame: RenderFrame) {
  //   // particle.meshes.forEach(mesh => {
  //   //   removeItem(this.meshes, mesh);
  //   // });
  // }
}
