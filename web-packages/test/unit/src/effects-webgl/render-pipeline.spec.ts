import {
  ContextContainer, ContextItem, Composition, Player, PostProcessVolume, RenderPass, RendererComponent, TextureLoadAction,
  FilterMode, Material, RendererFeature, RenderPassEvent, RenderTextureFormat, VFXItem,
} from '@galacean/effects';
import type { Renderer, RenderingData } from '@galacean/effects';
import type { GLEngine } from '@galacean/effects-webgl';
import { ThreeRenderer } from '../../../../../packages/effects-threejs/src/three-renderer';

const { expect } = chai;

describe('render-pipeline/ContextContainer', () => {
  class EffectData extends ContextItem {
    value?: object;

    override reset (): void {
      this.value = undefined;
    }
  }

  it('enforces typed creation and resets entries before reuse', () => {
    const frameData = new ContextContainer();

    expect(frameData.contains(EffectData)).equals(false);
    expect(() => frameData.get(EffectData)).to.throw('has not been created');
    const effect = frameData.create(EffectData);

    effect.value = {};
    expect(frameData.get(EffectData)).equals(effect);
    expect(frameData.getOrCreate(EffectData)).equals(effect);
    expect(() => frameData.create(EffectData)).to.throw('has already been created');
    frameData.dispose();
    expect(frameData.contains(EffectData)).equals(false);
    expect(effect.value).equals(undefined);
    expect(frameData.getOrCreate(EffectData)).equals(effect);
  });

  it('keeps extension data isolated between render invocations', () => {
    const outer = new ContextContainer();
    const inner = new ContextContainer();
    const value = {};

    outer.create(EffectData).value = value;
    inner.create(EffectData).value = {};
    inner.dispose();
    expect(outer.get(EffectData).value).equals(value);
    outer.dispose();
  });
});

for (const renderFramework of ['webgl', 'webgl2'] as const) {
  describe(`webgl/render-pipeline/${renderFramework}`, () => {
    let player: Player;

    beforeEach(() => {
      player = new Player({ canvas: document.createElement('canvas'), manualRender: true, doNotHandleContextLost: false, renderFramework });
      player.canvas.width = player.canvas.height = 32;
    });
    afterEach(() => player.dispose());

    function addDraw (composition: Composition, render: (renderer: Renderer) => void) {
      const component = new RendererComponent(player.engine);

      component.render = render;
      composition.sceneRendering.addRenderer(component);

      return component;
    }

    it('shares pass instances and isolates camera, uniforms and scene lists', () => {
      const first = new Composition(player.engine);
      const second = new Composition(player.engine);
      const seen: RenderPass[] = [];
      const renderer = player.renderer;
      const idle = renderer.renderingData;
      const execute = renderer.renderRenderPass.bind(renderer);

      renderer.renderRenderPass = pass => {
        seen.push(pass);
        execute(pass);
      };

      first.camera.position = first.camera.position.set(2, 0, 8);
      second.camera.position = second.camera.position.set(-3, 0, 8);
      addDraw(first, renderer => {
        expect(renderer.renderingData.options!.camera).equals(first.camera);
        expect(renderer.renderingData.renderList.objects).has.length(1);
        expect(renderer.renderingData.globalUniforms.floats.firstOnly).equals(undefined);
        renderer.setGlobalFloat('firstOnly', 42);
      });
      addDraw(second, renderer => {
        expect(renderer.renderingData.options!.camera).equals(second.camera);
        expect(renderer.renderingData.globalUniforms.vector3s.effects_WorldSpaceCameraPos.x).equals(-3);
        expect(renderer.renderingData.globalUniforms.floats.firstOnly).equals(undefined);
        expect(renderer.renderingData.renderList.objects).has.length(1);
      });
      renderer.renderCompositions([first, second], {});
      renderer.renderCompositions([second, first], {});
      expect(new Set(seen).size).equals(1);
      expect(renderer.renderingData).equals(idle);
    });

    it('uploads each scene camera uniforms to the GPU', () => {
      const first = new Composition(player.engine);
      const second = new Composition(player.engine);
      const gl = (player.engine as GLEngine).gl;
      const material = new Material(player.engine, {
        shader: {
          vertex: `
            precision highp float;
            uniform mat4 effects_MatrixInvV;
            uniform mat4 effects_MatrixV;
            uniform mat4 effects_MatrixVP;
            uniform mat4 _MatrixP;
            uniform vec3 effects_WorldSpaceCameraPos;
            void main() {
              gl_Position = (effects_MatrixInvV + effects_MatrixV + effects_MatrixVP + _MatrixP)
                * vec4(effects_WorldSpaceCameraPos, 1.0);
            }
          `,
          fragment: 'precision highp float; void main() { gl_FragColor = vec4(1.0); }',
        },
      });

      first.camera.position.set(2, 1, 8);
      second.camera.position.set(-3, 4, 6);
      for (const composition of [first, second]) {
        addDraw(composition, renderer => {
          material.initialize();
          material.use(renderer, renderer.renderingData.globalUniforms);
          const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
          const camera = composition.camera;
          const matrices = {
            effects_MatrixInvV: camera.getInverseViewMatrix(),
            effects_MatrixV: camera.getViewMatrix(),
            effects_MatrixVP: camera.getViewProjectionMatrix(),
            _MatrixP: camera.getProjectionMatrix(),
          };

          for (const [name, matrix] of Object.entries(matrices)) {
            const value = gl.getUniform(program, gl.getUniformLocation(program, name)!);

            expect(Array.from(value), name).deep.equals(Array.from(new Float32Array(matrix.elements)));
          }
          const position = gl.getUniform(program, gl.getUniformLocation(program, 'effects_WorldSpaceCameraPos')!);

          expect(Array.from(position)).deep.equals([camera.position.x, camera.position.y, camera.position.z]);
        });
      }
      player.renderer.renderCompositions([first, second], {});
      player.renderer.renderCompositions([second, first], {});
      material.dispose();
    });

    it('keeps shared post-processing passes alive when one composition is destroyed', () => {
      const first = new Composition(player.engine);
      const second = new Composition(player.engine);
      const renderer = player.renderer;
      const execute = renderer.renderRenderPass.bind(renderer);
      const seen: RenderPass[][] = [[], []];
      let index = 0;

      first.postProcessingEnabled = second.postProcessingEnabled = true;
      renderer.renderRenderPass = pass => { seen[index].push(pass); execute(pass); };
      first.render();
      first.dispose();
      index = 1;
      second.render();
      expect(seen[0]).has.length(3);
      expect(seen[1]).deep.equals(seen[0]);
      for (const pass of seen[0]) {
        expect(pass.isDisposed).equals(false);
      }
      player.dispose();
      for (const pass of seen[0]) {
        expect(pass.isDisposed).equals(true);
      }
    });

    it('creates feature passes once and schedules them independently for each camera', () => {
      const first = new Composition(player.engine);
      const second = new Composition(player.engine);
      const renderer = player.renderer;
      const draws: string[] = [];
      let creations = 0;
      let callbacks = 0;
      let disposals = 0;

      class Extension extends RenderPass {
        override execute (renderer: Renderer, data: RenderingData) {
          renderer.renderMeshes(data.renderList.groups.get('extension') ?? []);
        }
      }
      class Feature extends RendererFeature {
        pass: RenderPass;

        override create (renderer: Renderer) {
          creations++;
          this.pass = new Extension(renderer);
        }

        override addRenderPasses (renderer: Renderer, data: RenderingData) {
          callbacks++;
          if (data.options!.camera === first.camera) {
            renderer.enqueuePass(this.pass);
          }
        }

        override dispose () {
          disposals++;
          this.pass.dispose();
        }
      }
      const feature = new Feature();

      renderer.addRendererFeature(feature);
      renderer.addRendererFeature(feature);
      const mesh = new RendererComponent(player.engine);

      mesh.render = () => draws.push('extension');
      first.sceneRendering.addRenderer(mesh, 'extension');
      second.sceneRendering.addRenderer(mesh, 'extension');
      first.render();
      second.render();
      expect(creations).equals(1);
      expect(callbacks).equals(2);
      expect(draws).deep.equals(['extension']);
      feature.active = false;
      first.render();
      expect(draws).has.length(1);
      expect(callbacks).equals(2);
      feature.active = true;
      first.render();
      expect(draws).deep.equals(['extension', 'extension']);
      expect(creations).equals(1);
      renderer.enqueuePass(feature.pass);
      second.render();
      expect(draws).deep.equals(['extension', 'extension']);
      renderer.dispose();
      renderer.dispose();
      expect(disposals).equals(1);
      expect(feature.pass.isDisposed).equals(true);
    });

    it('sorts pass events and preserves enqueue order within an event', () => {
      const composition = new Composition(player.engine);
      const renderer = player.renderer;
      const executed: string[] = [];
      const execute = renderer.renderRenderPass.bind(renderer);

      class Feature extends RendererFeature {
        passes: RenderPass[] = [];

        override create (renderer: Renderer) {
          const events: [string, RenderPassEvent][] = [
            ['overlay', RenderPassEvent.AfterRendering],
            ['after-post', RenderPassEvent.AfterRenderingPostProcessing],
            ['after-objects-first', RenderPassEvent.AfterRenderingObjects],
            ['background', RenderPassEvent.BeforeRendering],
            ['after-objects-second', RenderPassEvent.AfterRenderingObjects],
          ];

          this.passes = events.map(([name, event]) => {
            const pass = new RenderPass(renderer);

            pass.name = name;
            pass.renderPassEvent = event;

            return pass;
          });
        }

        override addRenderPasses (renderer: Renderer) {
          for (const pass of this.passes) {
            renderer.enqueuePass(pass);
          }
        }

        override dispose () {
          for (const pass of this.passes) {
            pass.dispose();
          }
        }
      }

      renderer.addRendererFeature(new Feature());
      renderer.renderRenderPass = pass => {
        executed.push(pass.name);
        execute(pass);
      };
      composition.postProcessingEnabled = true;
      composition.render();
      expect(executed).deep.equals([
        'background', 'DrawObjectPass', 'after-objects-first', 'after-objects-second',
        'BloomPass', 'ToneMappingPass', 'after-post', 'overlay',
      ]);
    });

    it('releases RTs and restores context, framebuffer and viewport after rendering', () => {
      const composition = new Composition(player.engine);
      const renderer = player.renderer;
      const idle = renderer.renderingData;
      const acquired = new Set<unknown>();
      const get = renderer.getTemporaryRT.bind(renderer);
      const release = renderer.releaseTemporaryRT.bind(renderer);

      renderer.getTemporaryRT = (...args) => {
        const rt = get(...args);

        acquired.add(rt);

        return rt;
      };
      renderer.releaseTemporaryRT = rt => { acquired.delete(rt); release(rt); };
      composition.postProcessingEnabled = true;
      const component = addDraw(composition, () => {});

      renderer.setFramebuffer(null);
      player.engine.setViewport(1, 2, 8, 12);
      composition.render();
      expect(acquired.size).equals(0);
      expect(renderer.renderingData).equals(idle);
      expect(renderer.getFramebuffer()).equals(null);
      expect(renderer.getViewport()).deep.equals([1, 2, 8, 12]);
      composition.sceneRendering.removeRenderer(component);
      expect(() => composition.render()).not.to.throw();
      expect(acquired.size).equals(0);
    });

    it('uses the output target dimensions and returns all Bloom targets', () => {
      const composition = new Composition(player.engine);
      const renderer = player.renderer;
      const target = renderer.getTemporaryRT('output', 8, 16, 16, FilterMode.Linear, RenderTextureFormat.RGBA32);
      const acquired = new Set<unknown>();
      const get = renderer.getTemporaryRT.bind(renderer);
      const release = renderer.releaseTemporaryRT.bind(renderer);
      const volume = new PostProcessVolume(player.engine);

      volume.bloom.active = true;
      renderer.getTemporaryRT = (...args) => {
        expect(args[1]).at.most(8);
        expect(args[2]).at.most(16);
        const rt = get(...args);

        acquired.add(rt);

        return rt;
      };
      renderer.releaseTemporaryRT = rt => { acquired.delete(rt); release(rt); };
      addDraw(composition, renderer => {
        expect(renderer.getViewport()).deep.equals([0, 0, 8, 16]);
        renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 1, 0, 1] });
      });
      renderer.renderScene(composition.sceneRendering, {
        camera: composition.camera, target, postProcessingEnabled: true, globalVolume: volume,
      });
      expect(acquired.size).equals(0);
      expect(target.getColorTextures()[0].isDestroyed).equals(false);
      renderer.releaseTemporaryRT(target);
    });

    it('moves enabled components between composition registries and unregisters disabled components', () => {
      const first = new Composition(player.engine);
      const second = new Composition(player.engine);
      const item = new VFXItem(player.engine);
      const component = item.addComponent(RendererComponent);
      const cameras: unknown[] = [];

      component.render = renderer => cameras.push(renderer.renderingData.options!.camera);
      first.addItem(item);
      first.render();
      second.render();
      expect(cameras).deep.equals([first.camera]);
      second.addItem(item);
      cameras.length = 0;
      first.render();
      second.render();
      expect(cameras).deep.equals([second.camera]);
      component.enabled = false;
      second.render();
      expect(cameras).has.length(1);
    });

    it('reuses post-processing passes after resize and WebGL context restoration', async function () {
      this.timeout(5000);
      const engine = player.engine as GLEngine;
      const extension = engine.gl.getExtension('WEBGL_lose_context');

      if (!extension) {
        this.skip();

        return;
      }
      const composition = new Composition(engine);
      const renderer = player.renderer;
      const volume = new PostProcessVolume(engine);
      const passes = new Set<RenderPass>();
      const execute = renderer.renderRenderPass.bind(renderer);

      composition.postProcessingEnabled = true;
      composition.globalVolume = volume;
      volume.bloom.active = true;
      renderer.renderRenderPass = pass => { passes.add(pass); execute(pass); };
      addDraw(composition, renderer => renderer.clear({
        colorAction: TextureLoadAction.clear, clearColor: [0, 1, 0, 1],
      }));
      composition.render();
      player.canvas.width = 17;
      player.canvas.height = 9;
      composition.render();
      const restored = new Promise<void>(resolve => engine.once('contextrestored', () => resolve()));

      player.canvas.addEventListener('webglcontextlost', () => {
        window.setTimeout(() => extension.restoreContext(), 0);
      }, { once: true });
      extension.loseContext();
      await restored;
      composition.render();
      expect(passes.size).equals(3);
      expect(engine.renderErrors.size).equals(0);
      expect(engine.gl.getError()).equals(engine.gl.NO_ERROR);
      const pixel = new Uint8Array(4);

      engine.gl.readPixels(0, 0, 1, 1, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, pixel);
      expect(Array.from(pixel)).deep.equals([0, 255, 0, 255]);
    });

    it('provides the same isolated inputs to the Three.js backend without native passes', () => {
      const composition = new Composition(player.engine);
      const renderer = new ThreeRenderer(player.engine);
      let calls = 0;

      renderer.renderRenderPass = () => { throw new Error('unexpected native pass'); };
      addDraw(composition, render => {
        expect(render).equals(renderer);
        expect(render.renderingData.options!.camera).equals(composition.camera);
        calls++;
      });
      renderer.renderScene(composition.sceneRendering, { camera: composition.camera });
      expect(calls).equals(1);
      renderer.dispose();
    });
  });
}
