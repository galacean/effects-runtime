import * as spec from '@galacean/effects-specification';
import type { Composition } from '../../composition';
import { createShaderWithMarcos, ShaderType } from '../../material';
import type { Mesh, Renderer, RenderFrame, SharedShaderWithSource } from '../../render';
import { GLSLVersion } from '../../render';
import { addItem, removeItem } from '../../utils';
import { Item, type VFXItem } from '../../vfx-item';
import { AbstractPlugin } from '../index';
import { getParticleMeshShader, modifyMaxKeyframeShader } from './particle-mesh';
import type { ParticleSystem } from './particle-system';
import { ParticleVFXItem } from './particle-vfx-item';
import { getTrailMeshShader } from './trail-mesh';
import type { PrecompileOptions } from '../../plugin-system';
import type { Engine } from '../../engine';

export class ParticleLoader extends AbstractPlugin {
  private meshes: Mesh[] = [];
  engine: Engine;

  static override precompile (compositions: spec.Composition[], renderer: Renderer, options?: PrecompileOptions): Promise<any> {
    const composition = compositions[0];
    // 计算Shader编译的最大合集
    const compileOptions: Record<string, Record<string, boolean>> = {
      rotationOverLifetime: {
        x: false,
        y: false,
        z: false,
      },
      positionOverLifetime: {
        speedOverLifetime: false,
        linearX: false,
        linearY: false,
        linearZ: false,
        orbitalX: false,
        orbitalY: false,
        orbitalZ: false,
        forceCurve: false,
      },
      colorOverLifetime: {
        opacity: false,
        color: false,
      },
      sizeOverLifetime: {
        x: false,
        y: false,
      },
    };
    const defValue: Record<string, any> = {
      colorOverLifetime: {
        opacity: 1,
        color: [spec.ValueType.RGBA_COLOR, [255, 255, 255, 255]],
      },
      positionOverLifetime: {
        speedOverLifetime: 1,
      },
      sizeOverLifetime: {
        x: 1,
        y: 1,
      },
    };
    const gpuCapability = renderer.engine.gpuCapability;
    const { level } = gpuCapability;
    const { env } = options ?? {};
    const shaderLibrary = renderer.getShaderLibrary()!;
    const pros: string[] = [];
    const items: spec.ParticleItem[] = [];
    const shaders: SharedShaderWithSource[] = [];
    let maxFragmentCount = 0;
    let maxVertexCount = 0;

    composition.items.forEach(item => {
      if (Item.isParticle(item)) {
        items.push(item);
        assignDefValue(item);
        if (level === 2) {
          Object.keys(compileOptions).forEach(name => {
            const content = compileOptions[name];
            const target = item.content[name as keyof spec.ParticleContent];

            if (target) {
              Object.keys(content).forEach(pro => {
                // @ts-expect-error
                if (target[pro]) {
                  content[pro] = true;
                  addItem(pros, name);
                }
              });
            }
          });
        }
      }
    });
    items.forEach(item => {
      const options = item.content;

      if (level === 2) {
        pros.forEach(name => {
          const content = compileOptions[name];
          // @ts-expect-error
          const target = options[name] || (options[name] = {});

          Object.keys(content).forEach(pro => {
            if (content[pro] && !target[pro]) {
              const df = (defValue[name] && defValue[name][pro]) || 0;

              target[pro] = isNaN(df) ? df : [spec.ValueType.CONSTANT, df];
            }
          });
        });
        if (compileOptions.positionOverLifetime.forceCurve) {
          // @ts-expect-error
          options.positionOverLifetime.forceTarget = true;
        }
        if (compileOptions.rotationOverLifetime.x || compileOptions.rotationOverLifetime.y) {
          // @ts-expect-error
          options.rotationOverLifetime.separateAxes = true;
        }
        if (compileOptions.sizeOverLifetime.y) {
          // @ts-expect-error
          options.sizeOverLifetime.separateAxes = true;
        }
      }

      const { shader, fragment, vertex } = getParticleMeshShader(item, env, gpuCapability);

      shaders.push(shader);
      maxFragmentCount = Math.max(maxFragmentCount, fragment);
      maxVertexCount = Math.max(maxVertexCount, vertex);

      // TODO 此处add是否有意义？shader变量似乎没有加到this.shaders数组。
      if (item.content.trails) {
        const shader = getTrailMeshShader(item.content.trails, item.content.options.maxCount, item.name, env, gpuCapability);

        shader.vertex = createShaderWithMarcos(shader.marcos ?? [], shader.vertex, ShaderType.vertex, level);
        shader.fragment = createShaderWithMarcos(shader.marcos ?? [], shader.fragment, ShaderType.fragment, level);
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
      shader.vertex = createShaderWithMarcos(shader.marcos ?? [], shader.vertex, ShaderType.vertex, level);
      shader.fragment = createShaderWithMarcos(shader.marcos ?? [], shader.fragment, ShaderType.fragment, level);
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

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<ParticleSystem>) {
    if (item instanceof ParticleVFXItem) {
      this.add(item.content);
    }
  }

  override onCompositionItemRemoved (composition: Composition, item: VFXItem<ParticleSystem>) {
    if (item instanceof ParticleVFXItem) {
      if (item.content) {
        this.remove(item.content, composition.renderFrame);
      }
    }
  }

  override prepareRenderFrame (composition: Composition, pipeline: RenderFrame): boolean {
    this.meshes.forEach(mesh => pipeline.addMeshToDefaultRenderPass(mesh));
    this.meshes.length = 0;

    return false;
  }

  private add (particle: ParticleSystem) {
    particle.meshes.forEach(mesh => addItem(this.meshes, mesh));
  }

  private remove (particle: ParticleSystem, frame: RenderFrame) {
    particle.meshes.forEach(mesh => {
      removeItem(this.meshes, mesh);
      frame.removeMeshFromDefaultRenderPass(mesh);
    });
  }
}

function assignDefValue (item: spec.ParticleItem) {
  if (Item.isParticle(item)) {
    const options = item.content;

    if (!options.rotationOverLifetime) {
      options.rotationOverLifetime = {};
    }
    const rot = options.rotationOverLifetime;

    if (!rot.z) {
      rot.z = [spec.ValueType.CONSTANT, 0];
    }
    if (!rot.separateAxes) {
      delete rot.y;
      delete rot.x;
    }
    if (!options.sizeOverLifetime) {
      options.sizeOverLifetime = {};
    }
    const size = options.sizeOverLifetime;

    if (!size.separateAxes) {
      delete size.y;
    }
    if (size.size) {
      size.x = size.size;
      delete size.size;
    }
    if (!size.x) {
      size.x = [spec.ValueType.CONSTANT, 1];
    }
  }
}
