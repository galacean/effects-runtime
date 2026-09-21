import { Composition, Engine, Graphics, RenderingServer, effectsClassStore } from '@galacean/effects';

const { expect } = chai;

describe('webgl/rendering-server', () => {
  const engines: Engine[] = [];

  function createEngine () {
    const engine = new Engine(document.createElement('canvas'), { manualRender: true });

    engines.push(engine);

    return engine;
  }

  afterEach(() => {
    engines.splice(0).forEach(engine => engine.dispose());
  });

  it('owns separate renderers and shared drawing contexts for each engine', () => {
    const first = createEngine();
    const second = createEngine();
    const server = first.renderingServer;

    expect(effectsClassStore.RenderingServer).to.equal(RenderingServer);
    expect(server).not.to.equal(second.renderingServer);
    expect(server.renderer).to.equal(first.renderer);
    expect(server.renderer.engine).to.equal(first);
    expect(server.renderTargetPool.engine).to.equal(first);
    expect(server.renderTargetPool).not.to.equal(second.renderingServer.renderTargetPool);
    expect(server.renderer).not.to.equal(second.renderer);
    expect(server.graphics).to.be.instanceOf(Graphics);
    expect(server.graphics).to.equal(first.renderingServer.graphics);
    expect(server.graphics).not.to.equal(second.renderingServer.graphics);
  });

  it('releases drawing resources once after scenes unload and before the device', () => {
    const engine = createEngine();
    const server = engine.renderingServer;
    const composition = new Composition(engine);
    const graphics = server.graphics;
    const calls: string[] = [];
    const disposeScene = composition.dispose.bind(composition);
    const disposeGraphics = graphics.dispose.bind(graphics);
    const disposeRenderer = server.renderer.dispose.bind(server.renderer);
    const disposeDevice = engine.graphicsServer.renderingDevice.dispose.bind(engine.graphicsServer.renderingDevice);

    composition.dispose = () => {
      expect(server.graphics).to.equal(graphics);
      calls.push('scene');
      disposeScene();
    };
    graphics.dispose = () => {
      expect(engine.graphicsServer.renderingDevice.disposed).to.equal(false);
      calls.push('graphics');
      disposeGraphics();
    };
    server.renderer.dispose = () => {
      expect(engine.graphicsServer.renderingDevice.disposed).to.equal(false);
      calls.push('renderer');
      disposeRenderer();
    };
    engine.graphicsServer.renderingDevice.dispose = () => {
      calls.push('device');
      disposeDevice();
    };

    engine.dispose();
    engine.dispose();
    expect(calls).to.deep.equal(['scene', 'graphics', 'renderer', 'device']);
    expect(() => server.graphics).to.throw('RenderingServer is disposed.');
  });

  it('does not allocate the 2D context during initialization or shutdown', () => {
    const engine = createEngine();
    const server = engine.renderingServer;

    Object.defineProperty(server, 'graphics', {
      get () { throw new Error('Unexpected 2D context allocation.'); },
    });
    expect((server as unknown as { _graphics?: Graphics })._graphics).to.equal(undefined);
    engine.dispose();
  });
});
