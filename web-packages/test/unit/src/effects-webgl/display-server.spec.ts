import { Engine, EngineServer, DisplayServer, RenderingDevice, effectsClass, effectsClassStore } from '@galacean/effects';
import { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/display-server', () => {
  const engines: Engine[] = [];
  const createDevice = RenderingDevice.create;

  afterEach(() => {
    RenderingDevice.create = createDevice;
    engines.splice(0).forEach(engine => engine.dispose());
    delete effectsClassStore['test-display-observer'];
  });

  function createEngine () {
    const engine = new Engine(document.createElement('canvas'), { manualRender: true });

    engines.push(engine);

    return engine;
  }

  it('initializes a separate WebGL device before other servers', () => {
    const devices: RenderingDevice[] = [];

    class Observer extends EngineServer {
      override onInit (): void {
        const device = this.engine.displayServer.renderingDevice as RenderingDeviceWebGL;

        expect(this.engine.constructor).to.equal(Engine);
        expect(this.engine.getServer(DisplayServer)).to.be.instanceOf(DisplayServer);
        expect(device).to.be.instanceOf(RenderingDevice);
        expect(device).to.be.instanceOf(RenderingDeviceWebGL);
        expect(device.engine).to.equal(this.engine);
        expect(device.gl.isContextLost()).to.equal(false);
        expect(this.engine.displayServer.renderingDevice.getShaderLibrary()).to.equal(device.shaderLibrary);
        expect(this.engine.displayServer.renderingDevice.gpuCapability).to.equal(device.gpuCapability);
        devices.push(device);
      }
    }
    effectsClass('test-display-observer')(Observer);
    createEngine();
    createEngine();
    expect(devices).to.have.length(2);
    expect(devices[0]).not.to.equal(devices[1]);
  });

  it('releases engine resources and other servers before disposing the device once', () => {
    const calls: string[] = [];

    class Observer extends EngineServer {
      override onDispose (): void {
        expect(this.engine.displayServer.renderingDevice.disposed).to.equal(false);
        calls.push('server');
      }
    }
    class Device extends RenderingDeviceWebGL {
      constructor (engine: Engine) {
        super(engine);
        expect(this.gl.isContextLost()).to.equal(false);
        calls.push('initialize');
      }
      override dispose (): void {
        calls.push('device');
        super.dispose();
      }
    }
    effectsClass('test-display-observer')(Observer);
    RenderingDevice.create = owner => new Device(owner);
    const engine = new Engine(document.createElement('canvas'), { manualRender: true });

    engines.push(engine);
    const disposeRenderer = engine.renderer.dispose.bind(engine.renderer);
    const disposeObjects = engine.effectsObjectServer.onDispose.bind(engine.effectsObjectServer);
    const disposePool = engine.renderingServer.renderTargetPool.dispose.bind(engine.renderingServer.renderTargetPool);

    engine.renderer.dispose = () => {
      expect(engine.displayServer.renderingDevice.disposed).to.equal(false);
      calls.push('resources');
      disposeRenderer();
    };
    engine.effectsObjectServer.onDispose = () => {
      expect(engine.displayServer.renderingDevice.disposed).to.equal(false);
      calls.push('objects');
      disposeObjects();
    };
    engine.renderingServer.renderTargetPool.dispose = () => {
      expect(engine.displayServer.renderingDevice.disposed).to.equal(false);
      calls.push('remaining-resources');
      disposePool();
    };
    engine.dispose();
    engine.dispose();
    expect(engine.displayServer.renderingDevice.disposed).to.equal(true);
    expect(calls).to.deep.equal(['initialize', 'server', 'resources', 'remaining-resources', 'objects', 'device']);
  });
});
