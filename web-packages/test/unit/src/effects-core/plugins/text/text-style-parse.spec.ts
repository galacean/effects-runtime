import type { FancyConfig } from '@galacean/effects-core';
import {
  TextStyle,
  NEON_SAMPLE,
  METALLIC_SAMPLE,
  GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE,
  RAINBOW_PRESET,
  FROST_PRESET,
  FLAME_PRESET,
  STEREO_PRESET,
} from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/text-style-parseFancyConfig', () => {
  describe('empty config', () => {
    it('should return default solid-fill when layers is empty', () => {
      const config: FancyConfig = { layers: [] };
      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
      expect((result.layers[0].params as any).color).to.eql([0, 0, 0, 1]);
    });

    it('should return default solid-fill when layers is undefined', () => {
      const config = {} as FancyConfig;
      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
    });

    it('should use fallbackFillColor for empty config', () => {
      const config: FancyConfig = { layers: [] };
      const fallback: [number, number, number, number] = [1, 0.5, 0.25, 0.8];
      const result = TextStyle.parseFancyConfig(config, fallback);

      expect((result.layers[0].params as any).color).to.eql(fallback);
    });
  });
  describe('single layer', () => {
    it('should parse single-stroke layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0]).to.eql({
        kind: 'single-stroke',
        params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
      });
    });

    it('should parse solid-fill layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [0.5, 0.5, 0.5, 1] },
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0]).to.eql({
        kind: 'solid-fill',
        params: { color: [0.5, 0.5, 0.5, 1] },
      });
    });

    it('should parse gradient layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'gradient',
          params: {
            angle: 45,
            colors: [[1, 0, 0, 1], [0, 0, 1, 1]],
          },
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0]).to.eql({
        kind: 'gradient',
        params: { angle: 45, colors: [[1, 0, 0, 1], [0, 0, 1, 1]] },
      });
    });

    it('should parse texture layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'texture',
          params: {
            pattern: { imageUrl: 'https://example.com/texture.png', repeat: 'repeat' },
          },
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('texture');
      expect((result.layers[0].params as any).pattern.imageUrl).to.eql('https://example.com/texture.png');
      expect((result.layers[0] as any).runtimePattern).to.be.null;
    });
  });

  describe('multiple layers', () => {
    it('should preserve layer order', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
          { kind: 'single-stroke', params: { color: [1, 0, 0, 1], width: 2, unit: 'px' } },
          { kind: 'gradient', params: { angle: 0, colors: [[1, 0, 0, 1]] } },
        ],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('solid-fill');
      expect(result.layers[1].kind).to.eql('single-stroke');
      expect(result.layers[2].kind).to.eql('gradient');
    });
  });

  describe('decorations flattening', () => {
    it('should flatten shadow decoration before base layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
          decorations: [{
            kind: 'shadow',
            params: { color: [0, 0, 0, 0.5], blur: 10, offsetX: 2, offsetY: 2 },
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(2);
      // shadow 在前
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[0].params).to.eql({
        color: [0, 0, 0, 0.5],
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      });
      // stroke 在后
      expect(result.layers[1].kind).to.eql('single-stroke');
    });

    it('should flatten multiple decorations (shadow + glow)', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [
            { kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 5, offsetX: 1, offsetY: 1 } },
            { kind: 'glow', params: { color: [1, 0, 0, 1], blur: 3 } },
          ],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[1].kind).to.eql('glow');
      expect(result.layers[2].kind).to.eql('solid-fill');
    });

    it('should flatten decorations for each base layer', () => {
      const config: FancyConfig = {
        layers: [
          {
            kind: 'single-stroke',
            params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
            decorations: [{ kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 5, offsetX: 0, offsetY: 0 } }],
          },
          {
            kind: 'solid-fill',
            params: { color: [1, 1, 1, 1] },
            decorations: [{ kind: 'shadow', params: { color: [1, 0, 0, 1], blur: 3, offsetX: 1, offsetY: 1 } }],
          },
        ],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(4);
      // 第一层的 decoration
      expect(result.layers[0].kind).to.eql('shadow');
      expect((result.layers[0].params as any).blur).to.eql(5);
      // 第一层的 base
      expect(result.layers[1].kind).to.eql('single-stroke');
      // 第二层的 decoration
      expect(result.layers[2].kind).to.eql('shadow');
      expect((result.layers[2].params as any).blur).to.eql(3);
      // 第二层的 base
      expect(result.layers[3].kind).to.eql('solid-fill');
    });
  });

  describe('default values', () => {
    it('should default unit to px for single-stroke', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2 },
        } as any],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).unit).to.eql('px');
    });

    it('should default angle to 0 for gradient', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'gradient',
          params: { colors: [[1, 0, 0, 1]] },
        } as any],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).angle).to.eql(0);
    });

    it('should default blur to 5 for shadow decoration', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [{
            kind: 'shadow',
            params: { color: [0, 0, 0, 1], offsetX: 2, offsetY: 2 } as any,
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).blur).to.eql(5);
    });

    it('should default offsetX/offsetY to 0 for shadow decoration', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [{
            kind: 'shadow',
            params: { color: [0, 0, 0, 1], blur: 10 } as any,
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).offsetX).to.eql(0);
      expect((result.layers[0].params as any).offsetY).to.eql(0);
    });
  });

  describe('presetName', () => {
    it('should not include presetName in result', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
        presetName: 'metallic',
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.presetName).to.be.undefined;
    });
  });

  describe('glow decorations', () => {
    it('should flatten glow decoration before base layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
          decorations: [{
            kind: 'glow',
            params: { color: [1, 1, 0, 1], blur: 8, intensity: 3 },
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('glow');
      expect(result.layers[0].params).to.eql({
        color: [1, 1, 0, 1],
        blur: 8,
        intensity: 3,
      });
      expect(result.layers[1].kind).to.eql('single-stroke');
    });

    it('should default glow intensity to 1', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [{
            kind: 'glow',
            params: { color: [0, 1, 0, 1], blur: 6 } as any,
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).intensity).to.eql(1);
    });

    it('should default glow blur to 5', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [{
            kind: 'glow',
            params: { color: [0, 0, 1, 1] } as any,
          }],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect((result.layers[0].params as any).blur).to.eql(5);
    });
  });

  describe('multiple decorations per layer', () => {
    it('should keep all shadow decorations on a single layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [
            { kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 5, offsetX: 1, offsetY: 1 } },
            { kind: 'shadow', params: { color: [1, 0, 0, 1], blur: 3, offsetX: 0, offsetY: 0 } },
          ],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('shadow');
      expect((result.layers[0].params as any).blur).to.eql(5);
      expect(result.layers[1].kind).to.eql('shadow');
      expect((result.layers[1].params as any).blur).to.eql(3);
      expect(result.layers[2].kind).to.eql('solid-fill');
    });

    it('should keep all glow decorations on a single layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [
            { kind: 'glow', params: { color: [1, 1, 0, 1], blur: 8, intensity: 2 } },
            { kind: 'glow', params: { color: [0, 1, 1, 1], blur: 4, intensity: 5 } },
          ],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('glow');
      expect((result.layers[0].params as any).blur).to.eql(8);
      expect((result.layers[0].params as any).intensity).to.eql(2);
      expect(result.layers[1].kind).to.eql('glow');
      expect((result.layers[1].params as any).blur).to.eql(4);
      expect((result.layers[1].params as any).intensity).to.eql(5);
      expect(result.layers[2].kind).to.eql('solid-fill');
    });

    it('should allow mixed shadow and glow on same layer', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { color: [1, 0, 0, 1], width: 2, unit: 'px' },
          decorations: [
            { kind: 'shadow', params: { color: [0, 0, 0, 0.5], blur: 10, offsetX: 2, offsetY: 2 } },
            { kind: 'glow', params: { color: [1, 1, 0, 1], blur: 6, intensity: 2 } },
          ],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[1].kind).to.eql('glow');
      expect(result.layers[2].kind).to.eql('single-stroke');
    });

    it('should support multiple shadows and glows for layered effects', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'gradient',
          params: { angle: 0, colors: [[1, 0, 0, 1], [0, 0, 1, 1]] },
          decorations: [
            { kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 10, offsetX: 3, offsetY: 3 } },
            { kind: 'shadow', params: { color: [1, 0, 0, 1], blur: 20, offsetX: 5, offsetY: 5 } },
            { kind: 'glow', params: { color: [1, 0, 0, 1], blur: 6, intensity: 3 } },
            { kind: 'glow', params: { color: [0, 1, 0, 1], blur: 12, intensity: 7 } },
          ],
        }],
      };

      const result = TextStyle.parseFancyConfig(config);

      const shadows = result.layers.filter(l => l.kind === 'shadow');
      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(shadows).to.have.lengthOf(2);
      expect((shadows[0].params as any).blur).to.eql(10);
      expect((shadows[1].params as any).blur).to.eql(20);
      expect(glows).to.have.lengthOf(2);
      expect((glows[0].params as any).blur).to.eql(6);
      expect((glows[1].params as any).blur).to.eql(12);
      expect(result.layers[result.layers.length - 1].kind).to.eql('gradient');
    });
  });

  describe('new presets (phase 2)', () => {
    it('should parse rainbow preset correctly', () => {
      const result = TextStyle.parseFancyConfig(RAINBOW_PRESET);

      // 彩虹预设：5层描边 + 1层渐变
      expect(result.layers).to.have.lengthOf(6);
      expect(result.layers[0].kind).to.eql('single-stroke');
      expect(result.layers[5].kind).to.eql('gradient');
    });

    it('should parse frost preset correctly', () => {
      const result = TextStyle.parseFancyConfig(FROST_PRESET);

      // 冰霜预设：2层glow装饰 + 2层描边 + 1层渐变
      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(glows.length).to.eql(2);
      const gradientLayer = result.layers.find(l => l.kind === 'gradient');

      expect(gradientLayer).to.not.be.undefined;
    });

    it('should parse flame preset correctly', () => {
      const result = TextStyle.parseFancyConfig(FLAME_PRESET);

      // 火焰预设：2层glow装饰 + 3层描边 + 1层渐变
      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(glows.length).to.eql(2);
      const gradientLayer = result.layers.find(l => l.kind === 'gradient');

      expect(gradientLayer).to.not.be.undefined;
    });

    it('should parse stereo preset correctly', () => {
      const result = TextStyle.parseFancyConfig(STEREO_PRESET);

      // 立体预设：2层shadow装饰 + 2层描边 + 1层shadow装饰 + 1层填充
      const shadows = result.layers.filter(l => l.kind === 'shadow');

      expect(shadows.length).to.eql(3);
      const fillLayer = result.layers.find(l => l.kind === 'solid-fill');

      expect(fillLayer).to.not.be.undefined;
    });
  });

  describe('updated presets (shadow→glow)', () => {
    it('NEON_SAMPLE should use glow decoration (not shadow offset=0)', () => {
      const result = TextStyle.parseFancyConfig(NEON_SAMPLE);

      // 霓虹预设：第一层描边应有 glow 装饰层，不应出现 offset=0 的 shadow
      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(glows.length).to.be.greaterThan(0);

      const shadowWithZeroOffset = result.layers.filter(
        l => l.kind === 'shadow' && l.params.offsetX === 0 && l.params.offsetY === 0
      );

      // 不应有 offset=0 的 shadow（那是旧版模拟 glow 的方式）
      expect(shadowWithZeroOffset.length).to.eql(0);
    });

    it('GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE should use glow decorations', () => {
      const result = TextStyle.parseFancyConfig(GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE);

      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(glows.length).to.be.greaterThan(0);

      const shadowWithZeroOffset = result.layers.filter(
        l => l.kind === 'shadow' && l.params.offsetX === 0 && l.params.offsetY === 0
      );

      expect(shadowWithZeroOffset.length).to.eql(0);
    });

    it('METALLIC_SAMPLE should retain shadow (offsetY=-2 is genuine highlight)', () => {
      const result = TextStyle.parseFancyConfig(METALLIC_SAMPLE);

      // 金属预设保留 shadow（offsetY=-2 是高光线，非伪 glow）
      const shadows = result.layers.filter(l => l.kind === 'shadow');

      expect(shadows.length).to.eql(1);
      expect((shadows[0].params as Record<string, unknown>).offsetY).to.eql(-2);
    });
  });

  describe('version and adjustableParams fields', () => {
    it('version field should not affect parseFancyConfig result', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
        version: 1,
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
    });

    it('adjustableParams field should not affect parseFancyConfig result', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } }],
        adjustableParams: [
          { path: 'layers.0.params.color', label: '颜色', type: 'color', group: '描边' },
        ],
      };

      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('single-stroke');
    });
  });
});