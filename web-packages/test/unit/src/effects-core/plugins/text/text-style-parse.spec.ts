import type { FancyConfig } from '@galacean/effects-core';
import { TextStyle } from '@galacean/effects-core';

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

  describe('decoration constraints', () => {
    it('should warn and ignore duplicate shadow decorations', () => {
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

      const warnSpy = chai.spy.on(console, 'warn');
      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('shadow');
      expect((result.layers[0].params as any).blur).to.eql(5);
      expect(result.layers[1].kind).to.eql('solid-fill');
      expect(warnSpy).to.have.been.called.once;

      chai.spy.restore(console, 'warn');
    });

    it('should warn and ignore duplicate glow decorations', () => {
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

      const warnSpy = chai.spy.on(console, 'warn');
      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('glow');
      expect((result.layers[0].params as any).blur).to.eql(8);
      expect((result.layers[0].params as any).intensity).to.eql(2);
      expect(result.layers[1].kind).to.eql('solid-fill');
      expect(warnSpy).to.have.been.called.once;

      chai.spy.restore(console, 'warn');
    });

    it('should allow one shadow and one glow on same layer', () => {
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

      const warnSpy = chai.spy.on(console, 'warn');
      const result = TextStyle.parseFancyConfig(config);

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[1].kind).to.eql('glow');
      expect(result.layers[2].kind).to.eql('single-stroke');
      expect(warnSpy).to.not.have.been.called();

      chai.spy.restore(console, 'warn');
    });

    it('should only keep first shadow when multiple provided', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'gradient',
          params: { angle: 0, colors: [[1, 0, 0, 1], [0, 0, 1, 1]] },
          decorations: [
            { kind: 'shadow', params: { color: [0, 0, 0, 1], blur: 10, offsetX: 3, offsetY: 3 } },
            { kind: 'shadow', params: { color: [1, 0, 0, 1], blur: 20, offsetX: 5, offsetY: 5 } },
          ],
        }],
      };

      const warnSpy = chai.spy.on(console, 'warn');
      const result = TextStyle.parseFancyConfig(config);

      // 只保留第一个 shadow
      const shadows = result.layers.filter(l => l.kind === 'shadow');

      expect(shadows).to.have.lengthOf(1);
      expect((shadows[0].params as any).blur).to.eql(10);
      expect((shadows[0].params as any).offsetX).to.eql(3);

      chai.spy.restore(console, 'warn');
    });

    it('should only keep first glow when multiple provided', () => {
      const config: FancyConfig = {
        layers: [{
          kind: 'solid-fill',
          params: { color: [1, 1, 1, 1] },
          decorations: [
            { kind: 'glow', params: { color: [1, 0, 0, 1], blur: 6, intensity: 3 } },
            { kind: 'glow', params: { color: [0, 1, 0, 1], blur: 12, intensity: 7 } },
          ],
        }],
      };

      const warnSpy = chai.spy.on(console, 'warn');
      const result = TextStyle.parseFancyConfig(config);

      const glows = result.layers.filter(l => l.kind === 'glow');

      expect(glows).to.have.lengthOf(1);
      expect((glows[0].params as any).blur).to.eql(6);
      expect((glows[0].params as any).intensity).to.eql(3);

      chai.spy.restore(console, 'warn');
    });
  });
});