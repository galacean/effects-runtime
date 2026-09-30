import { restoreTestState } from '../helpers/spies';
import {
  ConfigManager,
  defineConfig,
  selectionPreviewConfig,
  selectionSnapConfig,
  iconConfig,
} from '../../../../../../plugin-packages/editor-gizmo/src/2d';

const { expect } = chai;

describe('plugin-editor-gizmo/config-manager', () => {
  afterEach(restoreTestState);

  describe('ConfigManager', () => {

    it('merges typed partials and emits effective previous/current values', () => {
      const manager = new ConfigManager();
      const spy = chai.spy();

      manager.onChange(selectionSnapConfig, spy);

      manager.set(selectionSnapConfig, { enabled: false });

      expect(manager.get(selectionSnapConfig).enabled).to.equal(false);
      expect(spy).to.have.been.called.with.exactly({
        partial: { enabled: false },
        previous: selectionSnapConfig.defaults,
        current: { ...selectionSnapConfig.defaults, enabled: false },
      });
    });

    it('does not emit unchanged writes and supports reset', () => {
      const manager = new ConfigManager();
      const spy = chai.spy();

      manager.on('configChange', spy);

      manager.set(selectionSnapConfig, { enabled: false });
      manager.set(selectionSnapConfig, { enabled: false });
      manager.reset(selectionSnapConfig);

      expect(spy).to.have.been.called.exactly(2);
      expect(manager.get(selectionSnapConfig)).to.deep.equal(selectionSnapConfig.defaults);
    });

    it('supports custom typed definitions without a central registry', () => {
      const customConfig = defineConfig({
        id: 'vendor.custom',
        defaults: { size: 1, visible: true },
      });
      const manager = new ConfigManager();

      manager.set(customConfig, { size: 3 });

      expect(manager.get(customConfig)).to.deep.equal({ size: 3, visible: true });
    });

    it('returns the canonical frozen value instead of consumer copies', () => {
      const manager = new ConfigManager();

      const icon = manager.get(iconConfig);

      expect(manager.get(iconConfig)).to.equal(icon);
      expect(Object.isFrozen(icon)).to.equal(true);
      expect(Object.isFrozen(icon.videoPlayShift)).to.equal(true);
      expect(() => {
        icon.videoPlayShift[0] = 99;
      }).to.throw();
    });

    it('rejects different definitions that reuse the same stable id', () => {
      const first = defineConfig({ id: 'vendor.duplicate', defaults: { size: 1 } });
      const second = defineConfig({ id: 'vendor.duplicate', defaults: { size: 2 } });
      const manager = new ConfigManager();

      manager.get(first);

      expect(() => manager.get(second)).to.throw('Duplicate config id');
    });
  });
});
