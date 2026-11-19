import type { Scene } from '@galacean/effects';
import {
  Asset, Component, Texture, Geometry, Engine, RenderingDevice, EffectsObjectServer, AssetServer, Composition,
  EngineServer, Player, Renderer, SceneServer, VFXItem, effectsClass, effectsClassStore, spec,
} from '@galacean/effects';
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

  function createPlayer (doNotHandleContextLost = true) {
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true, doNotHandleContextLost });

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
        expect(this.engine.sceneServer).to.be.instanceOf(SceneServer);
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

  it('dispatches fixed callbacks after updates, scales dt, and respects component registration', () => {
    const calls: string[] = [];
    const deltas: number[] = [];

    class Server extends EngineServer {
      override onUpdate () { calls.push('update'); }
      override onLateUpdate () { calls.push('late'); }
      override onFixedUpdate (dt: number) { calls.push('fixed'); deltas.push(dt); }
      override onLateFixedUpdate () { calls.push('lateFixed'); }
      override onDraw () { calls.push('draw'); }
    }
    class Probe extends Component {
      override onFixedUpdate () { calls.push('componentFixed'); }
      override onLateFixedUpdate () { calls.push('componentLateFixed'); }
    }
    register('fixed', Server);
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true });

    players.push(player);
    const engine = player.engine;
    const composition = new Composition(engine);
    const probe = new Probe(engine);

    probe.setParent(composition.root);
    probe.enable();
    engine.speed = 2;
    player.tick(1000 / 120);
    expect(calls).to.deep.equal(['update', 'late', 'draw']);
    calls.length = 0;
    player.tick(1000 / 120);
    expect(calls).to.deep.equal(['update', 'late', 'fixed', 'componentFixed', 'lateFixed', 'componentLateFixed', 'draw']);
    expect(deltas).to.deep.equal([1000 / 30]);
    calls.length = 0;
    probe.disable();
    player.tick(1000 / 60);
    expect(calls).to.deep.equal(['update', 'late', 'fixed', 'lateFixed', 'draw']);
    calls.length = 0;
    engine.onDraw();
    player.tick(0);
    expect(calls).not.to.include('fixed');
    engine.speed = 0;
    player.tick(1000);
    expect(deltas[deltas.length - 1]).to.equal(0);
    engine.speed = 1;
    calls.length = 0;
    probe.enable();
    composition.sceneTicking.setTicking(false);
    player.tick(1000 / 60);
    expect(calls).not.to.include('componentFixed');
    expect(deltas[deltas.length - 1]).to.be.closeTo(1000 / 60, 1e-7);
    probe.dispose();
  });

  it('runs only fixed stages when update and draw are not due', () => {
    const calls: string[] = [];

    class Server extends EngineServer {
      override onUpdate () { calls.push('update'); }
      override onLateUpdate () { calls.push('late'); }
      override onFixedUpdate () { calls.push('fixed'); }
      override onLateFixedUpdate () { calls.push('lateFixed'); }
      override onDraw () { calls.push('draw'); }
    }
    register('independent-fixed', Server);
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true, fps: 30 });

    players.push(player);
    player.engine.mainLoop(1000 / 60, true);
    expect(calls).to.deep.equal(['fixed', 'lateFixed']);
    calls.length = 0;
    player.engine.mainLoop(1000 / 60, true);
    expect(calls).to.deep.equal(['update', 'late', 'fixed', 'lateFixed', 'draw']);
  });

  it('emits Player update only with Engine Update, after servers and before LateUpdate', () => {
    const calls: string[] = [];

    class Server extends EngineServer {
      override onUpdate () { calls.push('server'); }
      override onLateUpdate () { calls.push('late'); }
    }
    register('update-event', Server);
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true, fps: 30 });

    players.push(player);
    player.play();
    const offUpdate = player.on('update', event => {
      expect(event.player).to.equal(player);
      expect(event.playing).to.equal(true);
      calls.push('player');
    });
    const deltas: number[] = [];

    player.engine.on('update', dt => deltas.push(dt));
    player.engine.speed = 2;
    player.engine.mainLoop(1000 / 60, true);
    expect(calls).to.deep.equal([]);
    player.engine.mainLoop(1000 / 60, true);
    expect(calls).to.deep.equal(['server', 'player', 'late']);
    expect(deltas).to.deep.equal([1000 / 30 * 2]);
    calls.length = 0;
    player.engine.onDraw();
    expect(calls).to.deep.equal([]);
    player.tick(10);
    expect(calls).to.deep.equal(['server', 'player', 'late']);
    calls.length = 0;
    player.gotoAndStop(0);
    expect(calls).to.deep.equal(['server', 'late']);
    offUpdate();
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
    const server = engine.sceneServer;
    const first = new Composition(engine);
    const second = new Composition(engine);

    expect(server.engine).to.equal(engine);
    expect(server).to.equal(engine.getServer(SceneServer));
    expect(server).not.to.equal(other.sceneServer);
    expect(first.root.parent).to.equal(undefined);
    expect(first.root.composition).to.equal(first);
    first.setIndex(2);
    second.setIndex(1);
    server.addComposition(first);
    expect(engine.sceneServer.compositions).to.deep.equal([second, first]);
    first.setIndex(0);
    expect(engine.sceneServer.compositions).to.deep.equal([first, second]);
    engine.displayServer.setSize(200, 100);
    expect(first.camera.aspect).to.equal(2);
    expect(second.camera.aspect).to.equal(2);
    first.dispose();
    expect(engine.sceneServer.compositions).to.deep.equal([second]);
    expect(other.sceneServer.compositions).to.have.length(0);
  });

  it('initializes registered asset servers per engine with built-in object lookup', () => {
    expect(effectsClassStore.AssetServer).to.equal(AssetServer);
    register('asset-alias', AssetServer);
    const engine = createPlayer().engine;
    const other = createPlayer().engine;
    const assets = engine.assetServer;

    expect(assets).to.be.instanceOf(AssetServer);
    expect(engine.assetServer).to.equal(engine.getServer(AssetServer));
    expect(assets).not.to.equal(other.assetServer);
    expect(assets.objectsDataCache).to.deep.equal({});
    expect(engine.assetServer.whiteTexture.isRegistered).to.equal(true);
    expect(engine.effectsObjectServer.objectsCache[engine.assetServer.whiteTexture.getInstanceId()]).to.equal(engine.assetServer.whiteTexture);
    expect(engine.effectsObjectServer.objectsCache[engine.assetServer.transparentTexture.getInstanceId()]).to.equal(engine.assetServer.transparentTexture);
    const whiteTexturePath = { id: spec.BuiltinObjectGUID.WhiteTexture };

    expect(engine.effectsObjectServer.findObject(whiteTexturePath)).to.equal(engine.assetServer.whiteTexture);
    expect(other.effectsObjectServer.findObject(whiteTexturePath)).to.equal(other.assetServer.whiteTexture);
    expect(other.assetServer.whiteTexture).not.to.equal(engine.assetServer.whiteTexture);
  });

  it('prepares text overrides and degraded precompositions before creating scene objects', () => {
    const engine = createPlayer().engine;
    const text = { id: 'text', dataType: spec.DataType.TextComponent, options: { text: 'original' } };
    const richText = { id: 'rich-text', dataType: spec.DataType.RichTextComponent, options: { text: 'original' } };
    const degraded = {
      id: 'degraded', name: 'degraded', dataType: spec.DataType.VFXItemData, type: spec.ItemType.composition,
      renderLevel: spec.RenderLevel.S, refId: 'missing-template', components: [{ id: 'missing-component' }],
    };
    const scene: Scene = {
      jsonScene: {
        compositionId: 'scene',
        compositions: [{ id: 'scene', name: 'scene', duration: 1, endBehavior: spec.EndBehavior.freeze,
          children: [{ id: degraded.id }] }],
        items: [degraded, { id: 'label', name: 'label', components: [{ id: text.id }, { id: richText.id }] }],
        components: [text, richText],
      } as unknown as spec.JSONScene,
      bins: [], textureOptions: [], images: [], videos: [], audios: [], storage: {}, timeInfos: {}, url: '', renderLevel: spec.RenderLevel.B,
    };

    engine.assetServer.prepareAssets(scene);
    expect(degraded.refId).to.equal('missing-template');
    expect(text.options.text).to.equal('original');

    engine.sceneServer.prepareScene(scene, { variables: { label: 'replacement' } });
    const composition = new Composition(engine, {}, scene);
    const item = composition.getItemByName('degraded')!;

    expect(text.options.text).to.equal('replacement');
    expect(richText.options.text).to.equal('replacement');
    expect(engine.assetServer.findEffectsObjectData(text.id)).to.equal(text);
    expect(VFXItem.isNull(item)).to.equal(true);
    expect(item.components).to.have.length(0);
    expect(degraded).not.to.have.property('refId');
  });

  it('applies per-scene options and releases the previous batch through the asset server', async () => {
    const player = createPlayer();
    const createScene = (): Scene => ({
      jsonScene: {
        compositionId: 'scene', items: [],
        compositions: [{ id: 'scene', name: 'scene', duration: 1, endBehavior: spec.EndBehavior.freeze }],
      } as unknown as spec.JSONScene,
      bins: [], textureOptions: [], images: [], videos: [], audios: [], storage: {}, timeInfos: {}, url: '',
    });
    const firstScene = Object.assign(createScene(), { options: { speed: 2, autoplay: false } });
    const secondScene = Object.assign(createScene(), { options: { speed: 3, autoplay: true } });
    const [first, second] = await player.loadScene([firstScene, secondScene], { speed: 1, autoplay: false });

    expect(first.getSpeed()).to.equal(2);
    expect(first.getPaused()).to.equal(true);
    expect(second.getSpeed()).to.equal(3);
    expect(second.getPaused()).to.equal(false);
    expect(player.getAssetManager()).to.have.length(2);

    let disposals = 0;

    for (const manager of player.getAssetManager()) {
      const dispose = manager.dispose.bind(manager);

      manager.dispose = () => { disposals++; dispose(); };
    }
    await player.loadScene(createScene(), { autoplay: false });
    expect(disposals).to.equal(2);
    expect(player.getAssetManager()).to.have.length(1);
    expect(first.getSpeed()).to.equal(2);
  });

  it('releases load sessions once and keeps other engines independent', () => {
    const assets = createPlayer().engine.assetServer;
    const other = createPlayer().engine.assetServer;
    const first = assets.createAssetManager({});
    const second = assets.createAssetManager({});
    const otherManager = other.createAssetManager({});
    const calls: string[] = [];

    first.dispose = () => calls.push('first');
    second.dispose = () => calls.push('second');
    otherManager.dispose = () => calls.push('other');
    assets.releaseAssetManagers();
    assets.releaseAssetManagers();
    expect(assets.assetManagers).to.have.length(0);
    expect(other.assetManagers).to.deep.equal([otherManager]);
    expect(calls).to.deep.equal(['first', 'second']);
  });

  it('owns object lookup per engine and falls back to asset loading for unregistered objects', () => {
    register('objects-alias', EffectsObjectServer);
    const engine = createPlayer().engine;
    const other = createPlayer().engine;
    const server = engine.getServer(EffectsObjectServer);
    const assets = engine.assetServer;
    const texture = engine.assetServer.whiteTexture;
    const path = { id: texture.getInstanceId() };
    const otherPath = { id: other.assetServer.whiteTexture.getInstanceId() };
    let loads = 0;

    expect(server).to.equal(engine.effectsObjectServer);
    expect(server).not.to.equal(other.effectsObjectServer);
    assets.loadGUID = <T>() => {
      loads++;

      return texture as T;
    };
    expect(server.findObject(path)).to.equal(texture);
    expect(server.findObject(texture as unknown as typeof path)).to.equal(texture);
    expect(texture.findObject<Texture>(path)).to.equal(texture);
    expect(texture.findObject<Texture>(texture as unknown as typeof path)).to.equal(texture);
    expect(other.assetServer.whiteTexture.findObject<Texture>(otherPath)).to.equal(other.assetServer.whiteTexture);
    expect(loads).to.equal(0);

    texture.unregisterObject();
    expect(texture.isRegistered).to.equal(false);
    expect(texture.isDestroyed).to.equal(false);
    expect(other.effectsObjectServer.findObject(otherPath)).to.equal(other.assetServer.whiteTexture);
    expect(texture.findObject<Texture>(path)).to.equal(texture);
    expect(loads).to.equal(1);

    texture.registerObject();
    expect(server.findObject(path)).to.equal(texture);
    expect(loads).to.equal(1);
  });

  it('resolves assets that refer back to each other in the same context', () => {
    const { engine } = createPlayer();
    const { assetServer, effectsObjectServer } = engine;
    const { sceneRoot } = new Composition(engine);
    const dataType = 'test-linked-asset' as spec.DataType;
    const first = { id: 'first' }, second = { id: 'second' };
    const definitions = [{ ...first, dataType, peer: second }, { ...second, dataType, peer: first }];

    class LinkedAsset extends Asset {
      peer: LinkedAsset;

      override fromData (data: spec.EffectsObjectData & { peer: spec.DataPath }): void {
        this.peer = this.findObject(data.peer, LinkedAsset);
      }
    }

    registrations.push(dataType);
    effectsClass(dataType)(LinkedAsset);
    definitions.forEach(data => assetServer.addEffectsObjectData(data));

    const sceneAssets = new Set<Asset>();
    const instance = effectsObjectServer.withDeserializationContext({ root: sceneRoot, idsMapping: new Map(), sceneAssets }, () =>
      effectsObjectServer.findObject(first, LinkedAsset));

    sceneRoot.addSceneAssets(sceneAssets);
    expect(instance.peer.peer).to.equal(instance);
  });

  it('preserves item name searches alongside inherited object reference lookup', () => {
    const engine = createPlayer().engine;
    const parent = new VFXItem(engine);
    const child = new VFXItem(engine);

    parent.name = 'parent';
    child.name = 'child';
    child.setParent(parent);

    expect(parent.find('parent')).to.equal(parent);
    expect(parent.find('child')).to.equal(child);
    expect(parent.find('missing')).to.equal(undefined);
    expect(parent.findObject<VFXItem>({ id: child.getInstanceId() })).to.equal(child);
    expect(parent.findObject<Texture>({ id: engine.assetServer.whiteTexture.getInstanceId() })).to.equal(engine.assetServer.whiteTexture);
    parent.dispose();
    child.dispose();
  });

  it('tracks unregistered GPU resources until their owners or the server dispose them', () => {
    const player = createPlayer(false);
    const engine = player.engine;
    const server = engine.effectsObjectServer;
    const texture = Texture.createWithData(engine);
    const geometry = new Geometry(engine, {
      attributes: { aPosition: { data: new Float32Array([0, 0, 1, 0, 0, 1]), size: 2 } },
      drawCount: 3,
    });

    texture.initialize();
    geometry.initialize();
    texture.unregisterObject();
    geometry.unregisterObject();
    expect(texture.isRegistered).to.equal(false);
    expect(geometry.isRegistered).to.equal(false);
    expect(texture.isDestroyed).to.equal(false);
    expect(geometry.isDisposed()).to.equal(false);

    let restores = 0;

    geometry.restore = () => { restores++; };
    server.restoreGraphicsResources();
    expect(restores).to.equal(1);
    geometry.dispose();
    server.restoreGraphicsResources();
    expect(restores).to.equal(1);

    let disposals = 0;
    const disposeTexture = texture.dispose.bind(texture);

    texture.dispose = () => {
      expect(engine.displayServer.renderingDevice.disposed).to.equal(false);
      disposals++;
      disposeTexture();
    };
    player.dispose();
    engine.dispose();
    expect(texture.isDestroyed).to.equal(true);
    expect(disposals).to.equal(1);
    expect(server.objectsCache).to.deep.equal({});
  });

  it('keeps built-in textures alive until scenes unload and disposes the asset server once', () => {
    const player = createPlayer();
    const engine = player.engine;
    const other = createPlayer().engine;
    const assets = engine.assetServer;
    const composition = new Composition(engine);
    const manager = assets.createAssetManager({});
    const disposeManager = manager.dispose.bind(manager);
    const disposeComposition = composition.dispose.bind(composition);
    const disposeAssets = assets.onDispose.bind(assets);
    const calls: string[] = [];

    manager.dispose = () => {
      expect(engine.sceneServer.compositions).to.have.length(0);
      calls.push('manager');
      disposeManager();
    };
    composition.dispose = () => {
      expect(engine.assetServer.whiteTexture.isDestroyed).to.equal(false);
      expect(engine.assetServer.transparentTexture.isDestroyed).to.equal(false);
      calls.push('scene');
      disposeComposition();
    };
    assets.onDispose = () => {
      expect(engine.sceneServer.compositions).to.have.length(0);
      calls.push('assets');
      disposeAssets();
    };
    player.dispose();
    engine.dispose();
    expect(calls).to.deep.equal(['scene', 'assets', 'manager']);
    expect(assets.assetManagers).to.have.length(0);
    expect(engine.assetServer.whiteTexture.isDestroyed).to.equal(true);
    expect(engine.assetServer.transparentTexture.isDestroyed).to.equal(true);
    expect(other.assetServer.whiteTexture.isDestroyed).to.equal(false);
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
    engine.renderingServer.renderTargetPool.flush = () => calls.push('flush');
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

    engine.renderingServer.renderTargetPool.flush = () => calls.push('flush');
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
        expect(this.engine.sceneServer.compositions).to.have.length(0);
      }
      override onDispose () {
        expect(this.engine.sceneServer.compositions).to.have.length(0);
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
    expect(engine.sceneServer.compositions).to.have.length(0);
    expect(engine.getServer(SceneServer)).to.equal(undefined);
  });

  it('creates the shared Renderer with a Three device before other servers initialize', () => {
    let renderer: Renderer | undefined;

    class Server extends EngineServer {
      override onInit () {
        renderer = this.engine.renderer;
        expect(renderer.constructor).to.equal(Renderer);
        expect(this.engine.displayServer.renderingDevice).to.be.instanceOf(RenderingDeviceThree);
      }
    }

    register('three-device', Server);
    const canvas = document.createElement('canvas');

    canvas.width = 333;
    canvas.height = 111;

    const gl = canvas.getContext('webgl2')!;
    const createDevice = RenderingDevice.create;
    let engine: Engine;

    try {
      RenderingDevice.create = owner => new RenderingDeviceThree(owner);
      engine = new Engine(canvas, { manualRender: true, ownsCanvas: false });
    } finally {
      RenderingDevice.create = createDevice;
    }

    expect([canvas.width, canvas.height]).to.deep.equal([333, 111]);
    expect(canvas.style.width).to.equal('');
    expect(engine.renderer).to.equal(renderer);
    engine.dispose();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
});
