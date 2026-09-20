import { Composition, Player, PostProcessVolume, RendererComponent, TextureLoadAction } from '@galacean/effects';
import type { Material } from '@galacean/effects';
import type { GLEngine } from '@galacean/effects-webgl';

const { expect } = chai;

for (const renderFramework of ['webgl', 'webgl2'] as const) {
  describe(`core/post-processing-regressions/${renderFramework}`, () => {
    let player: Player;

    beforeEach(() => {
      player = new Player({ canvas: document.createElement('canvas'), manualRender: true, renderFramework });
      player.canvas.width = 100;
      player.canvas.height = 100;
    });

    afterEach(() => player.dispose());

    function createComposition (postProcessingEnabled = false, volume?: PostProcessVolume) {
      const composition = new Composition(player.engine);

      composition.postProcessingEnabled = postProcessingEnabled;
      composition.globalVolume = volume;

      return composition;
    }

    function setSceneDraw (composition: Composition, render: () => void) {
      const component = new RendererComponent(player.engine);

      component.render = render;
      composition.sceneRendering.addRenderer(component);
    }

    function readPixel () {
      const gl = (player.engine as GLEngine).gl;
      const pixel = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      expect(gl.getError()).equals(gl.NO_ERROR);
      expect(player.engine.renderErrors.size).equals(0);

      return Array.from(pixel);
    }

    for (const translucent of [false, true]) {
      it(`preserves previous compositions with ${translucent ? 'translucent' : 'transparent'} post-processing output`, () => {
        const first = createComposition();
        const second = createComposition(true);
        const renderer = player.renderer;

        setSceneDraw(first, () => renderer.clear({
          colorAction: TextureLoadAction.clear, clearColor: [1, 0, 0, 1],
        }));
        if (translucent) {
          setSceneDraw(second, () => renderer.clear({
            colorAction: TextureLoadAction.clear, clearColor: [0, 0.5, 0, 0.5],
          }));
        }
        renderer.renderCompositions([first, second], {
          colorAction: TextureLoadAction.clear, clearColor: [0, 0, 1, 1],
        });
        const pixel = readPixel();

        if (translucent) {
          expect(pixel[0]).closeTo(128, 1);
          expect(pixel[1]).closeTo(128, 1);
          expect(pixel[2]).equals(0);
          expect(pixel[3]).equals(255);
        } else {
          expect(pixel).deep.equals([255, 0, 0, 255]);
        }
      });
    }

    it('clears depth and stencil for each non-post-processed composition without clearing color', () => {
      const first = createComposition();
      const second = createComposition();
      const actions: Parameters<typeof player.renderer.clear>[0][] = [];

      player.renderer.clear = action => actions.push(action);
      player.renderer.renderCompositions([first, second], {});
      expect(actions).to.have.length(3);
      for (const action of actions.slice(1)) {
        expect(action.colorAction).not.equals(TextureLoadAction.clear);
        expect(action.depthAction).equals(TextureLoadAction.clear);
        expect(action.stencilAction).equals(TextureLoadAction.clear);
      }
    });

    for (const [width, height] of [[100, 100], [1, 1], [1, 100]]) {
      it(`renders active Bloom at ${width}x${height} without zero-sized targets`, () => {
        player.canvas.width = width;
        player.canvas.height = height;
        const volume = new PostProcessVolume(player.engine);

        volume.bloom.active = true;
        volume.bloom.intensity = 1;
        const composition = createComposition(true, volume);
        const get = player.renderer.getTemporaryRT.bind(player.renderer);
        let allocations = 0;

        player.renderer.getTemporaryRT = (...args) => {
          expect(args[1]).greaterThan(0);
          expect(args[2]).greaterThan(0);
          allocations++;

          return get(...args);
        };
        player.renderer.renderCompositions([composition], { colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
        expect(allocations).greaterThan(1);
        readPixel();
      });
    }

    it('skips Bloom draws and targets after disabling it, while still presenting scene color', () => {
      const volume = new PostProcessVolume(player.engine);
      const composition = createComposition(true, volume);
      const renderer = player.renderer;
      const get = renderer.getTemporaryRT.bind(renderer);
      const blit = renderer.blit.bind(renderer);
      let bloomTargets = 0;
      let blits = 0;

      renderer.getTemporaryRT = (...args) => {
        if (args[0].startsWith('_Bloom')) { bloomTargets++; }

        return get(...args);
      };
      renderer.blit = (...args) => { blits++; blit(...args); };
      setSceneDraw(composition, () => renderer.clear({
        colorAction: TextureLoadAction.clear, clearColor: [0, 1, 0, 1],
      }));
      volume.bloom.active = true;
      composition.render();
      expect(blits).greaterThan(0);
      volume.bloom.active = false;
      blits = bloomTargets = 0;
      composition.render();
      expect(blits).equals(0);
      expect(bloomTargets).equals(0);
      expect(readPixel()).deep.equals([0, 255, 0, 255]);
    });

    it('resets disabled color adjustments and vignette uniforms on every frame', () => {
      const volume = new PostProcessVolume(player.engine);
      const composition = createComposition(true, volume);
      const renderer = player.renderer;
      const renderMeshes = renderer.renderMeshes.bind(renderer);
      let material: Material | undefined;

      renderer.renderMeshes = meshes => {
        const toneMappingMesh = meshes.find(mesh => mesh.name === 'PostProcess');

        if (toneMappingMesh) { material = toneMappingMesh.material; }
        renderMeshes(meshes);
      };
      volume.colorAdjustments = { active: true, brightness: 2, saturation: 50, contrast: 50 };
      volume.vignette = { active: true, intensity: 1, smoothness: 1, roundness: 1 };
      composition.render();
      expect(material?.getFloat('_Brightness')).equals(4);
      expect(material?.getFloat('_VignetteIntensity')).equals(1);
      volume.colorAdjustments.active = false;
      volume.vignette.active = false;
      composition.render();
      expect(material?.getFloat('_Brightness')).equals(1);
      expect(material?.getFloat('_Saturation')).equals(1);
      expect(material?.getFloat('_Contrast')).equals(1);
      expect(material?.getFloat('_VignetteIntensity')).equals(0);
      volume.vignette.active = true;
      composition.render();
      volume.vignette.intensity = 0;
      composition.render();
      expect(material?.getFloat('_VignetteIntensity')).equals(0);
    });

    for (const unsupported of [{ halfFloatTexture: 0 }, { halfFloatColorAttachment: false }, { halfFloatLinear: false }]) {
      it(`rejects unsupported HDR before allocating passes: ${Object.keys(unsupported)[0]}`, () => {
        const composition = createComposition();
        const capability = player.engine.gpuCapability;
        const original = capability.detail;

        try {
          capability.detail = { ...original, ...unsupported };
          composition.postProcessingEnabled = true;
          expect(() => composition.render()).to.throw('color attachment and linear filtering support');
          composition.postProcessingEnabled = false;
          expect(() => composition.render()).not.to.throw();
        } finally {
          capability.detail = original;
        }
      });
    }
  });
}
