import { restoreTestState } from '../helpers/spies';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { maskConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import { MaskGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/mask-gizmo';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

const { expect } = chai;

describe('plugin-editor-gizmo/mask-gizmo-config', () => {
  afterEach(restoreTestState);

  class FakeImage {
    static instances: FakeImage[] = [];

    crossOrigin: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    private _src = '';

    constructor () {
      FakeImage.instances.push(this);
    }

    get src (): string {
      return this._src;
    }

    set src (value: string) {
      this._src = value;
    }

    resolve (): void {
      this.onload?.();
    }
  }

  function createOwner (configs: ConfigManager): GizmoOwner {
    return {
      getConfigManager: () => configs,
    } as GizmoOwner;
  }

  function getLoadedMaskImage (gizmo: MaskGizmo): HTMLImageElement | undefined {
    return (gizmo as unknown as { maskImage?: HTMLImageElement }).maskImage;
  }

  describe('MaskGizmo maskImage config', () => {
    const originalImage = globalThis.Image;

    beforeEach(() => {
      FakeImage.instances = [];
      globalThis.Image = FakeImage as unknown as typeof globalThis.Image;
    });

    afterEach(() => {
      globalThis.Image = originalImage;
    });

    it('创建时按已有 config.maskImage URL 加载图片', async () => {
      const configs = new ConfigManager();

      configs.set(maskConfig, { maskImage: 'https://example.com/initial.png' });

      const gizmo = new MaskGizmo(createOwner(configs));
      const image = FakeImage.instances[0];

      expect(image?.src).to.equal('https://example.com/initial.png');
      expect(image?.crossOrigin).to.equal('anonymous');
      image?.resolve();
      await Promise.resolve();
      expect(getLoadedMaskImage(gizmo)).to.equal(image);
    });

    it('URL 连续变化时只接受最新加载结果，空 URL 会清空图片', async () => {
      const configs = new ConfigManager();
      const gizmo = new MaskGizmo(createOwner(configs));

      configs.set(maskConfig, { maskImage: 'https://example.com/old.png' });
      const oldImage = FakeImage.instances[0];

      configs.set(maskConfig, { maskImage: 'https://example.com/new.png' });
      const newImage = FakeImage.instances[1];

      oldImage?.resolve();
      await Promise.resolve();
      expect(getLoadedMaskImage(gizmo)).to.equal(undefined);

      newImage?.resolve();
      await Promise.resolve();
      expect(getLoadedMaskImage(gizmo)).to.equal(newImage);

      configs.set(maskConfig, { maskImage: '' });
      expect(getLoadedMaskImage(gizmo)).to.equal(undefined);
    });

    it('销毁后退订配置并丢弃尚未完成的加载结果', async () => {
      const configs = new ConfigManager();
      const gizmo = new MaskGizmo(createOwner(configs));

      configs.set(maskConfig, { maskImage: 'https://example.com/pending.png' });
      const pendingImage = FakeImage.instances[0];

      gizmo.dispose();
      pendingImage?.resolve();
      await Promise.resolve();
      configs.set(maskConfig, { maskImage: 'https://example.com/ignored.png' });

      expect(getLoadedMaskImage(gizmo)).to.equal(undefined);
      expect(FakeImage.instances).to.have.lengthOf(1);
    });
  });
});
