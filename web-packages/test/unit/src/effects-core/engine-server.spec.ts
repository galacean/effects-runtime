import type { Scene } from '@galacean/effects';
import { Engine, RenderingDevice, AssetServer, Composition, EngineServer, Player, Renderer, SceneServer, effectsClass, effectsClassStore } from '@galacean/effects';
import { RenderingDeviceThree } from '../../../../../packages/effects-threejs/src/rendering-device-three';

const { expect } = chai;

describe('core/engine/servers', () => {
  const players: Player[] = [];
  const registrations: string[] = [];

  function register (name: string, server: typeof EngineServer) {
    const key = `test-engine-server-${name}`;

    registrations.push(key);
    effectsClass(key)(server);
  }

  function createPlayer () {
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true });

    players.push(player);

    return player;
  }

  afterEach(() => {
    players.splice(0).forEach(player => player.dispose());
    registrations.splice(0).forEach(key => delete effectsClassStore[key]);
  });

  it('initializes and ticks in order, and shuts down in reverse order', () => {
    const calls: string[] = [];

    class Early extends EngineServer {
      constructor (engine: Engine, order = -10) {
        super(engine, order);
      }
      override onInit () {
        expect(this.engine.getServer(SceneServer)).to.be.instanceOf(SceneServer);
        expect(this.engine.renderer).to.exist;
        expect(this.engine.renderer.engine).to.equal(this.engine);
        expect(this.engine.getServer(Late)).to.be.instanceOf(Late);
        calls.push(`${this.order}:init`);
      }
      override onUpdate (dt: number) { calls.push(`${this.order}:update:${dt}`); }
      override onLateUpdate (dt: number) { calls.push(`${this.order}:lateUpdate:${dt}`); }
      override onDraw () { calls.push(`${this.order}:draw`); }
      override onBeforeExit () { calls.push(`${this.order}:beforeExit`); }
      override onDispose () { calls.push(`${this.order}:dispose`); }
    }
    class Late extends Early {
      constructor (engine: Engine) {
        super(engine, 300);
      }
    }

    register('late', Late);
    register('early', Early);
    register('early-alias', Early);

    const player = createPlayer();
    const engine = player.engine;
    const composition = new Composition(engine);

    composition.sceneTicking.update.tick = () => calls.push('composition:update');
    composition.sceneTicking.lateUpdate.tick = () => calls.push('composition:lateUpdate');
    composition.sceneTicking.preRender.tick = () => calls.push('composition:preRender');
    composition.renderer.renderComposition = () => calls.push('composition:render');
    engine.speed = 2;
    engine.mainLoop(50);
    player.dispose();
    engine.dispose();

    expect(calls).to.deep.equal([
      '-10:init', '300:init',
      '-10:update:100', 'composition:update', '300:update:100',
      '-10:lateUpdate:100', 'composition:lateUpdate', '300:lateUpdate:100',
      '-10:draw', '300:draw', 'composition:preRender', 'composition:render',
      '300:beforeExit', '-10:beforeExit', '300:dispose', '-10:dispose',
    ]);
    expect(engine.getServer(Early)).to.equal(undefined);
  });

  it('keeps server instances separate for each engine and snapshots registrations', () => {
    class Server extends EngineServer {}
    class LaterServer extends EngineServer {}

    register('separate', Server);
    const first = createPlayer().engine;

    register('later', LaterServer);
    const second = createPlayer().engine;

    expect(first.getServer(Server)).not.to.equal(second.getServer(Server));
    expect(first.getServer(Server).engine).to.equal(first);
    expect(second.getServer(Server).engine).to.equal(second);
    expect(first.getServer(LaterServer)).to.equal(undefined);
    expect(second.getServer(LaterServer)).to.be.instanceOf(LaterServer);
  });

  it('creates one registered scene server per engine and preserves composition ordering', () => {
    expect(effectsClassStore.SceneServer).to.equal(SceneServer);
    // Aliases use the same class deduplication as other servers.
    register('scene-alias', SceneServer);
    const engine = createPlayer().engine;
    const other = createPlayer().engine;
    const server = engine.getServer(SceneServer);
    const first = new Composition(engine);
    const second = new Composition(engine);

    expect(server.engine).to.equal(engine);
    expect(server).not.to.equal(other.getServer(SceneServer));
    expect(first.root.parent).to.equal(undefined);
    expect(first.root.composition).to.equal(first);
    first.setIndex(2);
    second.setIndex(1);
    server.addComposition(first);
    expect(engine.getServer(SceneServer).compositions).to.deep.equal([second, first]);
    first.setIndex(0);
    expect(engine.getServer(SceneServer).compositions).to.deep.equal([first, second]);
    engine.setSize(200, 100);
    expect(first.camera.aspect).to.equal(2);
    expect(second.camera.aspect).to.equal(2);
    first.dispose();
    expect(engine.getServer(SceneServer).compositions).to.deep.equal([second]);
    expect(other.getServer(SceneServer).compositions).to.have.length(0);
  });

  it('initializes registered asset servers per engine and restores built-in object lookup', () => {
    expect(effectsClassStore.AssetServer).to.equal(AssetServer);
    register('asset-alias', AssetServer);
    const engine = createPlayer().engine;
    const other = createPlayer().engine;
    const assets = engine.getServer(AssetServer);
    const scene = { jsonScene: { compositions: [] }, bins: [] } as unknown as Scene;

    expect(assets).to.be.instanceOf(AssetServer);
    expect(assets).not.to.equal(other.getServer(AssetServer));
    const previousData = assets.jsonSceneData;

    engine.clearResources();
    expect(assets.jsonSceneData).not.to.equal(previousData);
    expect(assets.jsonSceneData).to.deep.equal({});
    expect(engine.whiteTexture.isRegistered).to.equal(false);
    assets.prepareAssets(scene, {});
    expect(engine.objectInstance[engine.whiteTexture.getInstanceId()]).to.equal(engine.whiteTexture);
    expect(engine.objectInstance[engine.transparentTexture.getInstanceId()]).to.equal(engine.transparentTexture);
    expect(other.objectInstance[engine.whiteTexture.getInstanceId()]).to.equal(other.whiteTexture);
    expect(other.whiteTexture).not.to.equal(engine.whiteTexture);
  });

  it('keeps built-in textures alive until scenes unload and disposes the asset server once', () => {
    const player = createPlayer();
    const engine = player.engine;
    const other = createPlayer().engine;
    const assets = engine.getServer(AssetServer);
    const composition = new Composition(engine);
    const manager = assets.createAssetManager({});
    const disposeManager = manager.dispose.bind(manager);
    const disposeComposition = composition.dispose.bind(composition);
    const disposeAssets = assets.onDispose.bind(assets);
    const calls: string[] = [];

    manager.dispose = () => {
      expect(engine.getServer(SceneServer).compositions).to.have.length(0);
      calls.push('manager');
      disposeManager();
    };
    composition.dispose = () => {
      expect(engine.whiteTexture.isDestroyed).to.equal(false);
      expect(engine.transparentTexture.isDestroyed).to.equal(false);
      calls.push('scene');
      disposeComposition();
    };
    assets.onDispose = () => {
      expect(engine.getServer(SceneServer).compositions).to.have.length(0);
      calls.push('assets');
      disposeAssets();
    };
    player.dispose();
    engine.dispose();
    expect(calls).to.deep.equal(['scene', 'assets', 'manager']);
    expect(assets.assetManagers).to.have.length(0);
    expect(engine.whiteTexture.isDestroyed).to.equal(true);
    expect(engine.transparentTexture.isDestroyed).to.equal(true);
    expect(other.whiteTexture.isDestroyed).to.equal(false);
    expect(engine.getServer(AssetServer)).to.equal(undefined);
  });

  it('redraws the scene without advancing update lifecycles', () => {
    const calls: string[] = [];

    class Observer extends EngineServer {
      constructor (engine: Engine) {
        super(engine, 300);
      }
      override onLateUpdate () { calls.push('server:lateUpdate'); }
      override onDraw () { calls.push('server:draw'); }
    }
    register('redraw-observer', Observer);
    const engine = createPlayer().engine;
    const composition = new Composition(engine);

    composition.sceneTicking.update.tick = () => calls.push('update');
    composition.sceneTicking.lateUpdate.tick = () => calls.push('lateUpdate');
    composition.camera.updateMatrix = () => calls.push('camera');
    composition.sceneTicking.preRender.tick = dt => calls.push(`preRender:${dt}`);
    composition.renderer.renderComposition = () => calls.push('render');
    engine.renderTargetPool.flush = () => calls.push('flush');
    engine.onDraw();
    expect(calls).to.deep.equal(['server:draw', 'camera', 'preRender:0', 'render', 'flush']);
  });

  it('renders every composition before overlays and frame cleanup', () => {
    const engine = createPlayer().engine;
    const first = new Composition(engine);
    const second = new Composition(engine);
    const calls: string[] = [];

    first.setIndex(2);
    second.setIndex(1);
    for (const [index, composition] of [first, second].entries()) {
      composition.camera.updateMatrix = () => calls.push(`camera:${index}`);
      composition.sceneTicking.preRender.tick = () => calls.push(`prepare:${index}`);
    }
    engine.renderer.renderComposition = composition => calls.push(`scene:${[first, second].indexOf(composition)}`);
    engine.renderer.setFramebuffer = () => calls.push('framebuffer');
    engine.renderer.clear = () => calls.push('clear');
    const overlay = { render: () => calls.push('overlay') };

    engine.renderer.addOverlayRenderer(overlay);

    engine.renderTargetPool.flush = () => calls.push('flush');
    engine.onDraw();
    expect(calls).to.deep.equal([
      'camera:1', 'prepare:1', 'camera:0', 'prepare:0',
      'framebuffer', 'clear', 'scene:1', 'scene:0', 'overlay', 'flush',
    ]);
    engine.renderer.removeOverlayRenderer(overlay);
  });

  it('isolates overlay registrations and releases them without owning the overlay', () => {
    const engine = createPlayer().engine;
    // A plain renderer works without any GUI registration.
    const first = new Renderer(engine);
    const second = new Renderer(engine);
    const calls: string[] = [];
    const overlay = { render: () => calls.push('overlay') };

    first.addOverlayRenderer(overlay);
    first.addOverlayRenderer(overlay);
    second.renderOverlays();
    expect(calls).to.deep.equal([]);
    first.renderOverlays();
    expect(calls).to.deep.equal(['overlay']);
    first.removeOverlayRenderer(overlay);
    first.removeOverlayRenderer(overlay);
    first.renderOverlays();
    expect(calls).to.deep.equal(['overlay']);
    first.addOverlayRenderer(overlay);
    first.dispose();
    first.renderOverlays();
    first.addOverlayRenderer(overlay);
    first.renderOverlays();
    expect(calls).to.deep.equal(['overlay']);
    first.removeOverlayRenderer(overlay);
    second.dispose();
  });

  it('reports pending render errors before advancing any server or composition', () => {
    const calls: string[] = [];

    class Observer extends EngineServer {
      override onUpdate () { calls.push('server:update'); }
      override onDraw () { calls.push('server:draw'); }
    }
    register('render-error-observer', Observer);
    const engine = createPlayer().engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    first.sceneTicking.update.tick = () => calls.push('composition:update');
    second.sceneTicking.update.tick = () => calls.push('second:update');
    engine.renderErrors.add(new Error('render failed'));
    engine.on('rendererror', () => calls.push('rendererror'));
    engine.mainLoop(16);
    expect(calls).to.deep.equal(['rendererror']);
  });

  it('disposes all scenes once before lower-order resource servers', () => {
    const calls: string[] = [];

    class Resources extends EngineServer {
      override onBeforeExit () {
        expect(this.engine.getServer(SceneServer).compositions).to.have.length(0);
      }
      override onDispose () {
        expect(this.engine.getServer(SceneServer).compositions).to.have.length(0);
        calls.push('resources');
      }
    }
    register('scene-resources', Resources);
    const player = createPlayer();
    const engine = player.engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    for (const [index, composition] of [first, second].entries()) {
      const dispose = composition.dispose.bind(composition);

      composition.dispose = () => {
        calls.push(`scene:${index}`);
        dispose();
      };
    }
    player.dispose();
    engine.dispose();
    expect(calls).to.deep.equal(['scene:0', 'scene:1', 'resources']);
    expect(engine.getServer(SceneServer)).to.equal(undefined);
  });

  it('creates the shared Renderer with a Three device before other servers initialize', () => {
    let renderer: Renderer | undefined;

    class Server extends EngineServer {
      override onInit () {
        renderer = this.engine.renderer;
        expect(renderer.constructor).to.equal(Renderer);
        expect(this.engine.graphicsServer.renderingDevice).to.be.instanceOf(RenderingDeviceThree);
      }
    }

    register('three-device', Server);
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2')!;
    const createDevice = RenderingDevice.create;
    let engine: Engine;

    try {
      RenderingDevice.create = owner => new RenderingDeviceThree(owner);
      engine = new Engine(canvas, { manualRender: true, ownsCanvas: false });
    } finally {
      RenderingDevice.create = createDevice;
    }

    expect(engine.renderer).to.equal(renderer);
    engine.dispose();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
});
