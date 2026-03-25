import type { FancyConfig, FancyRenderLayer, FancyRenderStyle } from '@galacean/effects-core';
import { flattenFancyConfigToLayers, flattenFancyConfigToRenderStyle, TextStyle } from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/flatten-fancy-config', () => {
  describe('flattenFancyConfigToRenderStyle', () => {
    it('should return FancyRenderStyle with layers', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'solid-fill', params: { color: [1, 0, 0, 1] } },
        ],
      };

      const result = flattenFancyConfigToRenderStyle(config);

      expect(result).to.have.property('layers');
      expect(result.layers).to.be.an('array');
    });

    it('should return same result as TextStyle.parseFancyConfig', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { color: [0, 0, 0, 1], width: 2 } },
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
        ],
      };

      const result1 = flattenFancyConfigToRenderStyle(config);
      const result2 = TextStyle.parseFancyConfig(config);

      expect(result1).to.eql(result2);
    });

    it('should pass fallbackFillColor', () => {
      const config: FancyConfig = { layers: [] };
      const fallback: [number, number, number, number] = [1, 0.5, 0.25, 0.8];

      const result = flattenFancyConfigToRenderStyle(config, fallback);

      expect((result.layers[0].params as any).color).to.eql(fallback);
    });
  });

  describe('flattenFancyConfigToLayers', () => {
    it('should return layers array directly', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'gradient', params: { angle: 45, colors: [[1, 0, 0, 1], [0, 0, 1, 1]] } },
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
        ],
      };

      const result = flattenFancyConfigToLayers(config);

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
    });

    it('should return same layers as parseFancyConfig result', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { color: [1, 0, 0, 1], width: 3 } },
        ],
      };

      const layers1 = flattenFancyConfigToLayers(config);
      const layers2 = TextStyle.parseFancyConfig(config).layers;

      expect(layers1).to.eql(layers2);
    });

    it('should handle empty config', () => {
      const config: FancyConfig = { layers: [] };

      const result = flattenFancyConfigToLayers(config);

      expect(result).to.have.lengthOf(1);
      expect(result[0].kind).to.eql('solid-fill');
    });
  });

  describe('integration with decorations flattening', () => {
    it('should flatten decorations in config', () => {
      const config: FancyConfig = {
        layers: [
          {
            kind: 'solid-fill',
            params: { color: [1, 1, 1, 1] },
            decorations: [
              { kind: 'shadow', params: { color: [0, 0, 0, 0.5], blur: 10, offsetX: 2, offsetY: 2 } },
            ],
          },
        ],
      };

      const result = flattenFancyConfigToLayers(config);

      // decorations 应该被展开到 layers 数组中
      expect(result).to.have.lengthOf(2);
      expect(result[0].kind).to.eql('shadow');
      expect(result[1].kind).to.eql('solid-fill');
    });

    it('should handle multiple decorations', () => {
      const config: FancyConfig = {
        layers: [
          {
            kind: 'gradient',
            params: { angle: 0, colors: [[1, 0, 0, 1]] },
            decorations: [
              { kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 5, offsetX: 1, offsetY: 1 } },
              { kind: 'shadow', params: { color: [1, 0, 0, 1], blur: 3, offsetX: 0, offsetY: 0 } },
            ],
          },
        ],
      };

      const result = flattenFancyConfigToLayers(config);

      expect(result).to.have.lengthOf(3);
      expect(result[0].kind).to.eql('shadow');
      expect(result[1].kind).to.eql('shadow');
      expect(result[2].kind).to.eql('gradient');
    });
  });

  describe('return type validation', () => {
    it('flattenFancyConfigToRenderStyle should return FancyRenderStyle', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
      };

      const result: FancyRenderStyle = flattenFancyConfigToRenderStyle(config);

      expect(result.layers).to.be.an('array');
    });

    it('flattenFancyConfigToLayers should return FancyRenderLayer[]', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
      };

      const result: FancyRenderLayer[] = flattenFancyConfigToLayers(config);

      expect(result).to.be.an('array');
    });
  });
});