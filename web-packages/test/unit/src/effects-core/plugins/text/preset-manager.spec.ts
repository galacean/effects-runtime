import {
  BUILTIN_FANCY_PRESETS,
  PresetManager,
  TextStyle,
} from '@galacean/effects-core';
import type { FancyConfig } from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/preset-manager', () => {
  afterEach(() => {
    PresetManager.clearCustomPresets();
  });

  describe('getBuiltinPresets', () => {
    it('should return all builtin presets', () => {
      const presets = PresetManager.getBuiltinPresets();

      expect(Object.keys(presets).length).to.be.greaterThan(0);
      // 验证关键预设存在
      expect(presets).to.have.property('none');
      expect(presets).to.have.property('single-stroke');
      expect(presets).to.have.property('glow');
      expect(presets).to.have.property('neon');
      expect(presets).to.have.property('metallic');
      expect(presets).to.have.property('rainbow');
      expect(presets).to.have.property('frost');
      expect(presets).to.have.property('flame');
      expect(presets).to.have.property('stereo');
    });

    it('should return deep copies (modifying result does not affect source)', () => {
      const presets = PresetManager.getBuiltinPresets();
      const neon = presets['neon'];

      neon.layers = [];

      const neonAgain = PresetManager.getPreset('neon');

      expect(neonAgain?.layers.length).to.be.greaterThan(0);
    });
  });

  describe('getPreset', () => {
    it('should return neon preset with correct structure', () => {
      const neon = PresetManager.getPreset('neon');

      expect(neon).to.not.be.undefined;
      expect(neon!.presetName).to.eql('neon');
      expect(neon!.layers.length).to.eql(3);
      // 第一层描边应带 glow 装饰层（而非 shadow offset=0）
      const firstLayer = neon!.layers[0];

      expect(firstLayer.kind).to.eql('single-stroke');
      expect(firstLayer.decorations?.[0]?.kind).to.eql('glow');
    });

    it('should return undefined for nonexistent preset', () => {
      const result = PresetManager.getPreset('nonexistent');

      expect(result).to.be.undefined;
    });

    it('should return deep copy (modifying result does not affect source)', () => {
      const neon1 = PresetManager.getPreset('neon')!;

      (neon1.layers[0].params as Record<string, unknown>).color = [1, 1, 1, 1];

      const neon2 = PresetManager.getPreset('neon')!;
      const neon2Color = (neon2.layers[0].params as Record<string, unknown>).color;

      expect(neon2Color).to.not.eql([1, 1, 1, 1]);
    });
  });

  describe('registerPreset / unregisterPreset', () => {
    it('should register and retrieve custom preset', () => {
      const customConfig: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 0, 0, 1] } }],
        presetName: 'custom-red',
      };

      PresetManager.registerPreset('custom-red', customConfig);

      const result = PresetManager.getPreset('custom-red');

      expect(result).to.not.be.undefined;
      expect(result!.presetName).to.eql('custom-red');
    });

    it('should unregister custom preset', () => {
      const customConfig: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 0, 0, 1] } }],
        presetName: 'custom-red',
      };

      PresetManager.registerPreset('custom-red', customConfig);
      PresetManager.unregisterPreset('custom-red');

      const result = PresetManager.getPreset('custom-red');

      expect(result).to.be.undefined;
    });

    it('should override existing preset with same name', () => {
      PresetManager.registerPreset('test-override', {
        layers: [{ kind: 'solid-fill', params: { color: [1, 0, 0, 1] } }],
        presetName: 'test-override',
      });
      PresetManager.registerPreset('test-override', {
        layers: [{ kind: 'solid-fill', params: { color: [0, 0, 1, 1] } }],
        presetName: 'test-override',
      });

      const result = PresetManager.getPreset('test-override');

      expect((result?.layers[0].params as Record<string, unknown>).color).to.eql([0, 0, 1, 1]);
    });

    it('custom preset should take priority over builtin', () => {
      PresetManager.registerPreset('glow', {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
        presetName: 'glow',
      });

      const result = PresetManager.getPreset('glow');

      expect(result?.layers.length).to.eql(1);
    });
  });

  describe('serializeConfig / deserializeConfig', () => {
    it('should roundtrip correctly', () => {
      const original: FancyConfig = {
        layers: [{
          kind: 'single-stroke',
          params: { width: 3, color: [1, 0, 0, 1] },
          decorations: [{ kind: 'glow', params: { color: [0, 1, 1, 0.8], blur: 10, intensity: 2 } }],
        }],
        presetName: 'test',
        version: 1,
      };

      const serialized = PresetManager.serializeConfig(original);
      const deserialized = PresetManager.deserializeConfig(serialized);

      expect(deserialized.layers).to.eql(original.layers);
      expect(deserialized.presetName).to.eql(original.presetName);
      expect(deserialized.version).to.eql(original.version);
    });

    it('should strip undefined properties during serialization', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
      };

      const serialized = PresetManager.serializeConfig(config);

      // undefined 字段在 JSON.stringify 后会消失
      expect(serialized).to.not.have.property('presetName');
      expect(serialized).to.not.have.property('version');
    });
  });

  describe('migrateConfig', () => {
    it('should treat no-version config as v1 and add version', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
      };

      const migrated = PresetManager.migrateConfig(config);

      expect(migrated.version).to.eql(1);
      expect(migrated.layers).to.eql(config.layers);
    });

    it('should return deep copy for current version config', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
        version: 1,
      };

      const migrated = PresetManager.migrateConfig(config);

      expect(migrated).to.not.equal(config);
      expect(migrated.layers).to.eql(config.layers);
    });
  });

  describe('getAdjustableParams', () => {
    it('should use adjustableParams metadata when present', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
        ],
        adjustableParams: [
          { path: 'layers.0.params.color', label: '描边颜色', type: 'color', group: '描边' },
          { path: 'layers.0.params.width', label: '描边宽度', type: 'number', min: 1, max: 20, step: 0.5, group: '描边' },
        ],
      };

      const params = PresetManager.getAdjustableParams(config);

      expect(params.length).to.eql(2);
      expect(params[0].path).to.eql('layers.0.params.color');
      expect(params[0].type).to.eql('color');
      expect(params[0].value).to.eql([1, 0, 0, 1]);
      expect(params[1].path).to.eql('layers.0.params.width');
      expect(params[1].type).to.eql('number');
      expect(params[1].value).to.eql(3);
    });

    it('should infer adjustable params when no adjustableParams present', () => {
      const config: FancyConfig = {
        layers: [
          {
            kind: 'single-stroke',
            params: { width: 5, color: [1, 0, 0, 1] },
            decorations: [{ kind: 'glow', params: { color: [0, 1, 1, 0.8], blur: 10, intensity: 3 } }],
          },
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
        ],
      };

      const params = PresetManager.getAdjustableParams(config);

      // 应该推断出描边颜色、宽度、glow颜色/模糊/强度、填充颜色
      expect(params.length).to.be.greaterThan(0);
      const colorParams = params.filter(p => p.type === 'color');

      expect(colorParams.length).to.be.greaterThan(0);

      const glowParams = params.filter(p => p.group === '发光');

      expect(glowParams.length).to.be.greaterThan(0);
    });

    it('should return correct path and value for each param', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
        ],
        adjustableParams: [
          { path: 'layers.0.params.width', label: '宽度', type: 'number', group: '描边' },
        ],
      };

      const params = PresetManager.getAdjustableParams(config);

      expect(params[0].value).to.eql(3);
    });
  });

  describe('updateParamByPath', () => {
    it('should update layers.0.params.color and return new config', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
        ],
      };

      const newConfig = PresetManager.updateParamByPath(config, 'layers.0.params.color', [0, 1, 0, 1]);

      expect((newConfig.layers[0].params as Record<string, unknown>).color).to.eql([0, 1, 0, 1]);
    });

    it('should not modify original config (immutability)', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
        ],
      };

      PresetManager.updateParamByPath(config, 'layers.0.params.color', [0, 1, 0, 1]);

      expect((config.layers[0].params as Record<string, unknown>).color).to.eql([1, 0, 0, 1]);
    });

    it('should update nested decorations property', () => {
      const config: FancyConfig = {
        layers: [
          {
            kind: 'single-stroke',
            params: { width: 3, color: [1, 0, 0, 1] },
            decorations: [{ kind: 'glow', params: { color: [0, 1, 1, 0.8], blur: 10, intensity: 2 } }],
          },
        ],
      };

      const newConfig = PresetManager.updateParamByPath(config, 'layers.0.decorations.0.params.blur', 20);

      expect((newConfig.layers[0].decorations![0].params as Record<string, unknown>).blur).to.eql(20);
      // 原始不变
      expect((config.layers[0].decorations![0].params as Record<string, unknown>).blur).to.eql(10);
    });

    it('should update array element within params', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'gradient', params: { colors: [[1, 0, 0, 1], [0, 0, 1, 1]], angle: 0 } },
        ],
      };

      const newConfig = PresetManager.updateParamByPath(config, 'layers.0.params.colors.1', [0, 1, 0, 1]);

      expect(((newConfig.layers[0].params as Record<string, unknown>).colors as unknown[])[1]).to.eql([0, 1, 0, 1]);
    });

    it('should warn and return original config when path does not exist', () => {
      const config: FancyConfig = {
        layers: [
          { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
        ],
      };

      const result = PresetManager.updateParamByPath(config, 'layers.5.params.color', [0, 0, 0, 1]);

      // 应返回原 config 的深拷贝（layers 不变）
      expect(result.layers).to.eql(config.layers);
    });

    it('should update presetName top-level property', () => {
      const config: FancyConfig = {
        layers: [{ kind: 'solid-fill', params: { color: [1, 1, 1, 1] } }],
        presetName: 'original',
      };

      const newConfig = PresetManager.updateParamByPath(config, 'presetName', 'updated');

      expect(newConfig.presetName).to.eql('updated');
    });
  });
});