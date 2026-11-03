import {
  Engine, SpriteComponent, TextureLoadAction, VFXItem, math, spec,
} from '@galacean/effects';
import type { RendererComponent } from '@galacean/effects';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { SpineComponent, TextureAtlas, createSkeletonData } from '@galacean/effects-plugin-spine';
import type { Texture as SpineTexture } from '@galacean/effects-plugin-spine';

const { expect } = chai;

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`core/mask-rendering-regressions/${glType}`, () => {
    let engine: Engine;
    const items: VFXItem[] = [];

    beforeEach(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 8;
      engine = new Engine(canvas, { glType });
      engine.renderer.setViewport(0, 0, 8, 8);
      engine.renderer.setGlobalMatrix('effects_MatrixVP', math.Matrix4.IDENTITY);
      engine.renderer.setGlobalMatrix('effects_MatrixV', math.Matrix4.IDENTITY);
    });
    afterEach(() => {
      for (const item of items.splice(0)) { item.dispose(); }
      engine.dispose();
    });

    function item (): VFXItem {
      const result = new VFXItem(engine);

      result.duration = 5;
      result.endBehavior = spec.EndBehavior.freeze;
      items.push(result);

      return result;
    }

    function render (components: RendererComponent[]): boolean[] {
      engine.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      engine.renderer.renderMeshes(components);
      const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
      const pixels = new Uint8Array(8 * 8 * 4);

      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      expect(gl.getError()).equals(gl.NO_ERROR);
      expect(engine.renderErrors.size).equals(0);

      return Array.from({ length: 64 }, (_, index) => pixels[index * 4 + 3] > 127);
    }

    function sprite (): SpriteComponent {
      const result = item().addComponent(SpriteComponent);

      result.transform.setSize(2, 2);
      result.onUpdate(0);

      return result;
    }

    it('renders runtime-only structural matte sources alongside component sources', () => {
      const source = sprite();
      const target = sprite();
      const runtimeSource = {
        item: source.item,
        drawStencilMask: source.drawStencilMask.bind(source),
      };

      source.transform.setSize(1, 2);
      source.transform.setPosition(-0.5, 0, 0);
      source.onUpdate(0);
      target.maskManager.addMaskReference(runtimeSource);
      target.maskManager.addMaskReference(source);
      expect(render([target]).filter(Boolean)).has.length(32);
      expect(target.maskManager.getMaskReferences().map(reference => reference.maskable)).deep.equals([runtimeSource, source]);
    });

    for (const sourceMode of ['legacy-data', 'legacy-api', 'visible-fields', 'track-matte', 'visible-track-matte'] as const) {
      it(`preserves source visibility for ${sourceMode}`, () => {
        const source = sprite();
        const target = sprite();

        if (sourceMode === 'legacy-data') {
          source.maskManager.fromData(engine, { mask: { isMask: true } });
        } else if (sourceMode === 'legacy-api') {
          source.maskManager.setMaskOptions(engine, { isMask: true });
        } else if (sourceMode === 'visible-fields') {
          source.maskManager.sourceVisible = true;
          source.maskManager.isTrackMatte = true;
        } else if (sourceMode === 'visible-track-matte') {
          source.maskManager.fromData(engine, { trackMatte: { isTrackMatte: true, sourceVisible: true } });
        } else {
          source.maskManager.isTrackMatte = true;
        }
        source.setColor([1, 0, 0, 1]);
        target.transform.setSize(1, 1);
        target.onUpdate(0);
        target.maskManager.addMaskReference(source);
        const visible = sourceMode !== 'track-matte';

        expect(render([source]).filter(Boolean)).has.length(visible ? 64 : 0);
        source.maskManager.isTrackMatte = false;
        expect(render([source]).filter(Boolean)).has.length(64);
        source.maskManager.isTrackMatte = true;
        expect(render([source]).filter(Boolean)).has.length(visible ? 64 : 0);
        expect(render([source, target]).filter(Boolean)).has.length(visible ? 64 : 16);

        source.maskManager.fromData(engine, { trackMatte: { isTrackMatte: true } });
        expect(render([source]).filter(Boolean)).has.length(0);
        source.maskManager.fromData(engine, { mask: { isMask: true } });
        expect(render([source]).filter(Boolean)).has.length(64);
      });
    }

    it('uses current Spine size as a matte source without a preceding color draw', () => {
      const source = item().addComponent(SpineComponent);
      const atlas = new TextureAtlas('texture.png\nsize: 1,1\nfilter: Nearest,Nearest\nrepeat: none\nquad\nbounds: 0,0,1,1\n');

      atlas.pages[0].texture = engine.assetServer.whiteTexture as unknown as SpineTexture;
      const skeletonData = createSkeletonData(atlas, {
        bones: [{ name: 'root' }],
        slots: [{ name: 'slot', bone: 'root', attachment: 'quad' }],
        skins: [{ name: 'default', attachments: { slot: { quad: { type: 'region', path: 'quad', width: 1, height: 1 } } } }],
        animations: { idle: {} },
      }, 'json');

      source.fromData({
        id: source.getInstanceId(), item: { id: source.item.getInstanceId() }, dataType: spec.DataType.SpineComponent,
        cache: { atlas, skeletonData },
        options: { activeAnimation: 'idle', activeSkin: 'default', spine: 0, resizeRule: 0, startSize: 1, speed: 1 },
        trackMatte: { isTrackMatte: true },
      } as Parameters<SpineComponent['fromData']>[0]);
      source.initialize();
      source.scaleFactor = 1;
      const target = item().addComponent(SpriteComponent);

      target.transform.setSize(2, 2);
      target.onUpdate(0);
      target.maskManager.addMaskReference(source);
      let colorDraws = 0;
      const draw = source.render.bind(source);

      source.render = renderer => { colorDraws++; draw(renderer); };
      expect(render([source, target]).filter(Boolean)).has.length(16);
      source.scaleFactor = 0.5;
      expect(render([source, target]).filter(Boolean)).has.length(4);
      source.startSize = 4;
      expect(render([source, target]).filter(Boolean)).has.length(64);
      expect(colorDraws).equals(0);
    });

  });
}
