import { Engine, EngineServer, GraphicsServer, RenderingDevice, effectsClass, effectsClassStore } from '@galacean/effects';
import { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/graphics-server', () => {
  const engines: Engine[] = [];
  const createDevice = RenderingDevice.create;

  afterEach(() => {
    RenderingDevice.create = createDevice;
    engines.splice(0).forEach(engine => engine.dispose());
    delete effectsClassStore['test-graphics-observer'];
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
        const device = this.engine.renderingDevice as RenderingDeviceWebGL;

        expect(this.engine.constructor).to.equal(Engine);
        expect(this.engine.getServer(GraphicsServer)).to.be.instanceOf(GraphicsServer);
        expect(device).to.be.instanceOf(RenderingDevice);
        expect(device).to.be.instanceOf(RenderingDeviceWebGL);
        expect(device.engine).to.equal(this.engine);
        expect(device.gl.isContextLost()).to.equal(false);
        expect(this.engine.getShaderLibrary()).to.equal(device.shaderLibrary);
        expect(this.engine.gpuCapability).to.equal(device.gpuCapability);
        devices.push(device);
      }
    }
    effectsClass('test-graphics-observer')(Observer);
    createEngine();
    createEngine();
    expect(devices).to.have.length(2);
    expect(devices[0]).not.to.equal(devices[1]);
  });

  it('releases engine resources and other servers before disposing the device once', () => {
    const calls: string[] = [];

    class Observer extends EngineServer {
      override onDispose (): void {
        expect(this.engine.renderingDevice.disposed).to.equal(false);
        calls.push('server');
      }
    }
    class Device extends RenderingDeviceWebGL {
      override initialize (): void {
        expect(this.engine.renderingDevice).to.equal(this);
        super.initialize();
        calls.push('initialize');
      }
      override dispose (): void {
        calls.push('device');
        super.dispose();
      }
    }
    effectsClass('test-graphics-observer')(Observer);
    RenderingDevice.create = owner => new Device(owner);
    const engine = new Engine(document.createElement('canvas'), { manualRender: true });

    engines.push(engine);
    const disposeRenderer = engine.renderer.dispose.bind(engine.renderer);

    engine.renderer.dispose = () => {
      expect(engine.renderingDevice.disposed).to.equal(false);
      calls.push('resources');
      disposeRenderer();
    };
    engine.dispose();
    engine.dispose();
    expect(engine.renderingDevice.disposed).to.equal(true);
    expect(calls).to.deep.equal(['initialize', 'resources', 'server', 'device']);
  });
});
