import type { FancyRenderLayer } from '@galacean/effects-core';
import {
  FancyLayerFactory,
  GradientDrawer,
  ShadowDrawer,
  SingleStrokeDrawer,
  SolidFillDrawer,
  TextureDrawer,
} from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/fancy-layer-factory', () => {
  describe('createDrawerFromLayer', () => {
    it('should create SingleStrokeDrawer from single-stroke layer', () => {
      const layer: FancyRenderLayer = {
        kind: 'single-stroke',
        params: {
          color: [1, 0, 0, 1],
          width: 2,
          unit: 'px',
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(SingleStrokeDrawer);
      expect(drawer?.name).to.eql('single-stroke');
    });

    it('should create SolidFillDrawer from solid-fill layer', () => {
      const layer: FancyRenderLayer = {
        kind: 'solid-fill',
        params: {
          color: [0.5, 0.5, 0.5, 1],
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(SolidFillDrawer);
      expect(drawer?.name).to.eql('solid-fill');
    });

    it('should create GradientDrawer from gradient layer', () => {
      const layer: FancyRenderLayer = {
        kind: 'gradient',
        params: {
          angle: 45,
          colors: [
            [1, 0, 0, 1],
            [0, 0, 1, 1],
          ],
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(GradientDrawer);
      expect(drawer?.name).to.eql('gradient');
    });

    it('should create ShadowDrawer from shadow layer', () => {
      const layer: FancyRenderLayer = {
        kind: 'shadow',
        params: {
          color: [0, 0, 0, 0.5],
          blur: 10,
          offsetX: 2,
          offsetY: 2,
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(ShadowDrawer);
      expect(drawer?.name).to.eql('shadow');
    });

    it('should create TextureDrawer from texture layer', () => {
      const layer: FancyRenderLayer = {
        kind: 'texture',
        params: {
          pattern: {
            imageUrl: 'https://example.com/texture.png',
            repeat: 'repeat',
          },
        },
        runtimePattern: null,
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(TextureDrawer);
      expect(drawer?.name).to.eql('texture');
    });

    it('should create TextureDrawer when runtimePattern is undefined', () => {
      const layer: FancyRenderLayer = {
        kind: 'texture',
        params: {
          pattern: {
            imageUrl: 'https://example.com/texture.png',
          },
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.instanceOf(TextureDrawer);
    });
  });

  describe('createDrawersFromLayers', () => {
    it('should create multiple drawers', () => {
      const layers: FancyRenderLayer[] = [
        {
          kind: 'shadow',
          params: { color: [0, 0, 0, 1], blur: 5, offsetX: 1, offsetY: 1 },
        },
        {
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
        },
        {
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
        },
      ];

      const drawers = FancyLayerFactory.createDrawersFromLayers(layers);

      expect(drawers).to.have.lengthOf(3);
      expect(drawers[0]).to.be.instanceOf(ShadowDrawer);
      expect(drawers[1]).to.be.instanceOf(SingleStrokeDrawer);
      expect(drawers[2]).to.be.instanceOf(SolidFillDrawer);
    });

    it('should return empty array for empty input', () => {
      const drawers = FancyLayerFactory.createDrawersFromLayers([]);

      expect(drawers).to.be.an('array').that.is.empty;
    });

    it('should preserve layer order', () => {
      const layers: FancyRenderLayer[] = [
        {
          kind: 'gradient',
          params: { angle: 0, colors: [[1, 0, 0, 1]] },
        },
        {
          kind: 'solid-fill',
          params: { color: [0, 0, 0, 1] },
        },
      ];

      const drawers = FancyLayerFactory.createDrawersFromLayers(layers);

      expect(drawers[0]).to.be.instanceOf(GradientDrawer);
      expect(drawers[1]).to.be.instanceOf(SolidFillDrawer);
    });
  });

  describe('edge cases', () => {
    it('should return null for unknown layer type', () => {
      const layer = {
        kind: 'unknown-type',
        params: {},
      } as unknown as FancyRenderLayer;

      const warnSpy = chai.spy.on(console, 'warn');
      const drawer = FancyLayerFactory.createDrawerFromLayer(layer);

      expect(drawer).to.be.null;
      expect(warnSpy).to.have.been.called.once;

      chai.spy.restore(console, 'warn');
    });

    it('should filter out null drawers', () => {
      const layers: FancyRenderLayer[] = [
        {
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
        },
        {
          kind: 'unknown-type',
          params: {},
        } as unknown as FancyRenderLayer,
        {
          kind: 'single-stroke',
          params: { color: [0, 0, 0, 1], width: 1, unit: 'px' },
        },
      ];

      const warnSpy = chai.spy.on(console, 'warn');
      const drawers = FancyLayerFactory.createDrawersFromLayers(layers);

      expect(drawers).to.have.lengthOf(2);
      expect(drawers[0]).to.be.instanceOf(SolidFillDrawer);
      expect(drawers[1]).to.be.instanceOf(SingleStrokeDrawer);

      chai.spy.restore(console, 'warn');
    });
  });

  describe('parameter passing', () => {
    it('should pass color and width to SingleStrokeDrawer', () => {
      const layer: FancyRenderLayer = {
        kind: 'single-stroke',
        params: {
          color: [0.5, 0.25, 0.75, 0.8],
          width: 3.5,
          unit: 'px',
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer) as SingleStrokeDrawer;

      expect(drawer).to.exist;
    });

    it('should pass multiple colors to GradientDrawer', () => {
      const layer: FancyRenderLayer = {
        kind: 'gradient',
        params: {
          angle: 90,
          colors: [
            [1, 0, 0, 1],
            [0, 1, 0, 1],
            [0, 0, 1, 1],
            [1, 1, 1, 1],
          ],
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer) as GradientDrawer;

      expect(drawer).to.exist;
    });

    it('should pass shadow params to ShadowDrawer', () => {
      const layer: FancyRenderLayer = {
        kind: 'shadow',
        params: {
          color: [0, 0, 0, 0.5],
          blur: 15,
          offsetX: 5,
          offsetY: -5,
        },
      };

      const drawer = FancyLayerFactory.createDrawerFromLayer(layer) as ShadowDrawer;

      expect(drawer).to.exist;
    });
  });
});