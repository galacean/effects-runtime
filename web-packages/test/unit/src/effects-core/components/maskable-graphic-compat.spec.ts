import {
  RendererComponent, ColorPlayable, Engine, Geometry, HitTestType, MaskableGraphic, ParticleSystemRenderer, ShapeComponent,
  TextureLoadAction, VFXItem, math, spec,
} from '@galacean/effects';
import type { ItemRenderer, MaskReference, TrackMatteReference } from '@galacean/effects';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

declare module '@galacean/effects-core' {
  interface MaskReference {
    compatibilityLabel?: string,
  }
}

class CustomGraphic extends MaskableGraphic {
  restoreDefaultDrawing (): void {
    this.geometry = this.defaultGeometry;
    this.visible = true;
  }
}

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`core/components/maskable-graphic-compat/${glType}`, () => {
    let engine: Engine;
    let item: VFXItem;

    beforeEach(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 8;
      engine = new Engine(canvas, { glType });
      engine.renderer.setViewport(0, 0, 8, 8);
      engine.renderer.setGlobalMatrix('effects_MatrixVP', math.Matrix4.IDENTITY);
      item = new VFXItem(engine);
      item.duration = 5;
      item.transform.setSize(2, 2);
    });
    afterEach(() => {
      item.dispose();
      engine.dispose();
    });

    function render (graphic: MaskableGraphic): number[][] {
      engine.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      graphic.render(engine.renderer);
      const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
      const pixels = new Uint8Array(8 * 8 * 4);

      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      expect(gl.getError()).equals(gl.NO_ERROR);
      expect(engine.renderErrors.size).equals(0);

      return Array.from({ length: 64 }, (_, index) => Array.from(pixels.slice(index * 4, index * 4 + 4)));
    }

    it('preserves drawing, texture overloads and protected fields for existing subclasses', async () => {
      const graphic = item.addComponent(CustomGraphic);

      graphic.fromData({
        id: graphic.getInstanceId(), item: { id: item.getInstanceId() }, dataType: spec.DataType.SpriteComponent,
        renderer: { renderMode: spec.RenderMode.MESH }, mask: { isMask: false },
      });
      const renderer: ItemRenderer = graphic.renderer;
      const legacyReference: MaskReference = { maskable: graphic, inverted: false, compatibilityLabel: 'source' };
      const reference: TrackMatteReference = legacyReference;

      expect(renderer.texture).equals(engine.assetServer.whiteTexture);
      expect(reference.compatibilityLabel).equals('source');
      graphic.onUpdate(0);
      graphic.setColor([1, 0, 0, 1]);
      expect(graphic.color.toArray()).deep.equals([1, 0, 0, 1]);
      expect(render(graphic)).deep.equals(Array.from({ length: 64 }, () => [255, 0, 0, 255]));
      graphic.setVisible(false);
      expect(graphic.getVisible()).equals(false);
      expect(render(graphic).every(pixel => pixel[3] === 0)).equals(true);
      const replacement = Geometry.create(engine, { attributes: {}, drawCount: 0 });

      graphic.geometry = replacement;
      graphic.restoreDefaultDrawing();
      replacement.dispose();
      expect(graphic.getVisible()).equals(true);
      graphic.setColor(new math.Color(0, 0, 1, 1));
      expect(render(graphic)).deep.equals(Array.from({ length: 64 }, () => [0, 0, 255, 255]));
      graphic.color = new math.Color(1, 1, 1, 1);
      graphic.setTexture(engine.assetServer.whiteTexture);
      expect(render(graphic)).deep.equals(Array.from({ length: 64 }, () => [255, 255, 255, 255]));
      const image = document.createElement('canvas');

      image.width = image.height = 1;
      const context = image.getContext('2d')!;

      context.fillStyle = '#00ff00';
      context.fillRect(0, 0, 1, 1);
      await graphic.setTexture(image.toDataURL());
      expect(render(graphic)).deep.equals(Array.from({ length: 64 }, () => [0, 255, 0, 255]));
      graphic.interaction = { behavior: 0 };
      graphic.onStart();
      expect(item.getHitTestParams?.()?.type).equals(HitTestType.triangle);
      expect(graphic.getHitTestParams()?.triangles).has.length(2);
      expect(graphic.getBoundingBox().area).has.length(2);
      const bounds = graphic.getBoundingBoxInfo().boundingBox;

      expect(bounds.minimum.toArray()).deep.equals([-1, -1, 0]);
      expect(bounds.maximum.toArray()).deep.equals([1, 1, 0]);
    });

    it('keeps legacy component lookup and color animation binding limited to textured graphics', () => {
      const shape = item.addComponent(ShapeComponent);
      const graphic = item.addComponent(CustomGraphic);
      const playable = new ColorPlayable();
      const bound: MaskableGraphic = playable.getActiveComponent(item);

      expect(graphic).instanceOf(MaskableGraphic);
      expect(item.getComponent(MaskableGraphic)).equals(graphic);
      expect(item.getComponents(MaskableGraphic)).deep.equals([graphic]);
      expect(bound).equals(graphic);
      expect(item.getComponents(RendererComponent)).deep.equals([shape, graphic]);
    });

    it('preserves renderer input fields alongside clipping fields for particle renderers', () => {
      const graphic = item.addComponent(CustomGraphic);
      const particle = item.addComponent(ParticleSystemRenderer);

      particle.fromData({
        id: particle.getInstanceId(), item: { id: item.getInstanceId() }, dataType: spec.DataType.ParticleSystem,
        materials: [{ id: graphic.material.getInstanceId() }], _priority: 17,
      });
      expect(particle.materials).deep.equals([graphic.material]);
      expect(particle.priority).equals(17);

      particle.fromData({
        id: particle.getInstanceId(), item: { id: item.getInstanceId() }, dataType: spec.DataType.ParticleSystem,
        materials: [], _priority: 3,
        trackMatte: { references: [{ source: { id: graphic.getInstanceId() } }] },
      });
      expect(particle.materials).deep.equals([]);
      expect(particle.priority).equals(3);
      expect(particle.maskManager.getMaskReferences()).deep.equals([{ maskable: graphic, inverted: false }]);
    });

  });
}
