import { DisplayServer, Engine, Player } from '@galacean/effects';

const { expect } = chai;

describe('core/engine/display-server', () => {
  const engines: Engine[] = [];
  const containers: HTMLElement[] = [];

  function createEngine (width?: number, height?: number, pixelRatio = 2, env = '') {
    const canvas = document.createElement('canvas');

    canvas.width = 320;
    canvas.height = 180;
    if (width !== undefined && height !== undefined) {
      const container = document.createElement('div');

      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      container.appendChild(canvas);
      document.body.appendChild(container);
      containers.push(container);
    }
    const engine = Engine.create(canvas, { manualRender: true, pixelRatio, env });

    engines.push(engine);

    return engine;
  }

  afterEach(() => {
    engines.splice(0).forEach(engine => engine.dispose());
    containers.splice(0).forEach(container => container.remove());
  });

  it('registers one display per engine and isolates display settings', () => {
    const first = createEngine();
    const second = createEngine();

    expect(first.getServer(DisplayServer)).to.equal(first.displayServer);
    expect(first.displayServer).not.to.equal(second.displayServer);
    expect(first.canvas).to.equal(first.displayServer.canvas);
    expect(first.displayServer.ownsCanvas).to.equal(true);
    first.displayServer.pixelRatio = 3;
    first.displayServer.displayAspect = 2;
    first.displayServer.displayScale = 0.5;
    first.displayServer.offscreenMode = true;
    expect(first.displayServer.pixelRatio).to.equal(3);
    expect(first.displayServer.displayAspect).to.equal(2);
    expect(first.displayServer.displayScale).to.equal(0.5);
    expect(first.displayServer.offscreenMode).to.equal(true);
    expect(second.displayServer.pixelRatio).to.equal(2);
  });

  it('preserves initial container sizing, aspect fitting, scaling and DPR rounding', () => {
    const engine = createEngine(301, 201, 1.5);

    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([452, 302]);
    engine.displayServer.displayAspect = 2;
    engine.displayServer.displayScale = 0.5;
    engine.displayServer.resize();
    expect([engine.canvas.style.width, engine.canvas.style.height]).to.deep.equal(['150.5px', '75.25px']);
    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([226, 113]);
    engine.displayServer.displayAspect = 0.5;
    engine.displayServer.resize();
    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([75, 151]);
  });

  it('does not multiply standalone canvas dimensions by DPR', () => {
    const engine = createEngine();

    engine.displayServer.resize();
    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([320, 180]);
    expect([engine.canvas.style.width, engine.canvas.style.height]).to.deep.equal(['320px', '180px']);
  });

  it('keeps CSS dimensions while clamping the backing buffer proportionally', () => {
    const engine = createEngine(1200, 600);

    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([2048, 1024]);
    expect([engine.canvas.style.width, engine.canvas.style.height]).to.deep.equal(['1200px', '600px']);
    const portrait = createEngine(600, 1200);

    expect([portrait.canvas.width, portrait.canvas.height]).to.deep.equal([1024, 2048]);
  });

  it('uses the device size limit when env is set', () => {
    const engine = createEngine(200, 100, 2, 'editor');
    // Override only the reported limit for this sizing test.
    const detail = engine.displayServer.renderingDevice.gpuCapability.detail as { maxTextureSize: number };
    const original = detail.maxTextureSize;

    try {
      detail.maxTextureSize = 256;
      engine.displayServer.resize();
      expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([256, 128]);
    } finally {
      detail.maxTextureSize = original;
    }
  });

  it('preserves invalid-size errors and the offscreen 1x1 fallback', () => {
    const engine = createEngine(200, 100);
    const parent = engine.canvas.parentElement!;

    parent.style.width = '0px';
    parent.style.height = '0px';
    expect(() => engine.displayServer.resize()).to.throw('Invalid container size');
    engine.displayServer.offscreenMode = true;
    engine.displayServer.resize();
    expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([1, 1]);
  });

  it('emits resize after viewport synchronization, including unchanged sizes', () => {
    const engine = createEngine();
    const device = engine.displayServer.renderingDevice;
    const original = device.setViewport.bind(device);
    const calls: string[] = [];

    device.setViewport = (x, y, width, height) => {
      expect([engine.canvas.width, engine.canvas.height]).to.deep.equal([width, height]);
      calls.push('viewport');
      original(x, y, width, height);
    };
    engine.on('resize', owner => {
      expect(owner).to.equal(engine);
      calls.push('resize');
    });
    engine.displayServer.setSize(200, 100);
    engine.displayServer.setSize(200, 100);
    expect(calls).to.deep.equal(['viewport', 'resize', 'resize']);
  });

  it('leaves an externally supplied canvas attached after Player disposal', () => {
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');

    container.appendChild(canvas);
    containers.push(container);
    const player = new Player({ canvas, manualRender: true });

    expect(player.engine.displayServer.ownsCanvas).to.equal(false);
    player.dispose();
    expect(canvas.parentElement).to.equal(container);
  });
});
