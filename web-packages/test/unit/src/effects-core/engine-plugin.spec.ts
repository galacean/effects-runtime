import type { Engine } from '@galacean/effects';
import { Player, Plugin, registerPlugin, unregisterPlugin } from '@galacean/effects';

const { expect } = chai;

describe('core/engine/plugin-engine-lifetime', () => {
  it('triggers onEngineCreated on construction and onEngineDestroy on dispose', () => {
    let createdEngine: Engine | undefined;
    let destroyedEngine: Engine | undefined;

    // 传入带类型函数，保留 spy 的调用签名（可带参调用）。
    const createdSpy = chai.spy((engine: Engine) => {
      // 引擎基类构造结束时触发，此时子类 renderer 等可能尚未初始化，
      // 仅校验拿到的是有效的引擎实例（canvas 已就绪）。
      expect(engine.canvas).to.be.an.instanceOf(HTMLCanvasElement);
      createdEngine = engine;
    });
    const destroySpy = chai.spy((engine: Engine) => {
      // 在引擎释放资源前触发，此时 disposed 已置位（避免重入），
      // 但引擎及子类资源（renderer/gl 等）仍可访问。
      expect(engine.disposed).to.eql(true);
      destroyedEngine = engine;
    });

    class TestEnginePlugin extends Plugin {
      override onEngineCreated (engine: Engine) {
        createdSpy(engine);
      }

      override onEngineDestroy (engine: Engine) {
        destroySpy(engine);
      }
    }

    registerPlugin('test-engine-plugin', TestEnginePlugin);

    const player = new Player({ canvas: document.createElement('canvas') });
    const engine = player.engine;

    expect(createdSpy).to.have.been.called.once;
    expect(createdEngine).to.eql(engine);

    player.dispose();

    expect(destroySpy).to.have.been.called.once;
    expect(destroyedEngine).to.eql(engine);

    unregisterPlugin('test-engine-plugin');
  });

  afterEach(() => {
    unregisterPlugin('test-engine-plugin');
  });
});
