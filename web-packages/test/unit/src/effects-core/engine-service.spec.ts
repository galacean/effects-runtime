import { Composition, EngineService, Player, SceneService, effectsClass, effectsClassStore } from '@galacean/effects';
import type { Renderer } from '@galacean/effects';
import { ThreeEngine } from '../../../../../packages/effects-threejs/src/three-engine';
import { ThreeRenderer } from '../../../../../packages/effects-threejs/src/three-renderer';

const { expect } = chai;

describe('core/engine/services', () => {
  const players: Player[] = [];
  const registrations: string[] = [];

  function register (name: string, service: typeof EngineService) {
    const key = `test-engine-service-${name}`;

    registrations.push(key);
    effectsClass(key)(service);
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

    class Early extends EngineService {
      override readonly order: number = -10;
      override onInit () {
        expect(this.engine.getService(SceneService)).to.exist;
        expect(this.engine.renderer).to.exist;
        expect(this.engine.renderer.engine).to.equal(this.engine);
        expect(this.engine.getService(Late)).to.be.instanceOf(Late);
        calls.push(`${this.order}:init`);
      }
      override onUpdate (dt: number) { calls.push(`${this.order}:update:${dt}`); }
      override onLateUpdate (dt: number) { calls.push(`${this.order}:lateUpdate:${dt}`); }
      override onDraw () { calls.push(`${this.order}:draw`); }
      override onBeforeExit () { calls.push(`${this.order}:beforeExit`); }
      override onDispose () { calls.push(`${this.order}:dispose`); }
    }
    class Late extends Early {
      override readonly order = 300;
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
    composition.renderContent = () => calls.push('composition:render');
    engine.speed = 2;
    engine.mainLoop(50);
    engine.dispose();
    engine.dispose();

    expect(calls).to.deep.equal([
      '-10:init', '300:init',
      '-10:update:100', 'composition:update', '300:update:100',
      '-10:lateUpdate:100', 'composition:lateUpdate', '300:lateUpdate:100',
      'composition:preRender',
      '-10:draw', 'composition:render', '300:draw',
      '300:beforeExit', '-10:beforeExit', '300:dispose', '-10:dispose',
    ]);
    expect(engine.getService(Early)).to.equal(undefined);
  });

  it('keeps service instances separate for each engine and snapshots registrations', () => {
    class Service extends EngineService {}
    class LaterService extends EngineService {}

    register('separate', Service);
    const first = createPlayer().engine;

    register('later', LaterService);
    const second = createPlayer().engine;

    expect(first.getService(Service)).not.to.equal(second.getService(Service));
    expect(first.getService(Service)?.engine).to.equal(first);
    expect(second.getService(Service)?.engine).to.equal(second);
    expect(first.getService(LaterService)).to.equal(undefined);
    expect(second.getService(LaterService)).to.be.instanceOf(LaterService);
  });

  it('owns one built-in scene service per engine and preserves composition ordering', () => {
    // Explicit registration must not create a second built-in service.
    register('scene-alias', SceneService);
    const engine = createPlayer().engine;
    const other = createPlayer().engine;
    const service = engine.getService(SceneService)!;
    const first = new Composition(engine);
    const second = new Composition(engine);

    expect(service).to.equal(engine.sceneService);
    expect(service).not.to.equal(other.getService(SceneService));
    expect(first.root.parent).to.equal(undefined);
    expect(first.root.composition).to.equal(first);
    first.setIndex(2);
    second.setIndex(1);
    engine.addComposition(first);
    expect(engine.compositions).to.deep.equal([second, first]);
    first.setIndex(0);
    expect(service.compositions).to.deep.equal([first, second]);
    engine.setSize(200, 100);
    expect(first.camera.aspect).to.equal(2);
    expect(second.camera.aspect).to.equal(2);
    first.dispose();
    expect(service.compositions).to.deep.equal([second]);
    expect(other.compositions).to.have.length(0);
  });

  it('redraws the scene without advancing update lifecycles', () => {
    const calls: string[] = [];

    class Observer extends EngineService {
      override readonly order = 300;
      override onLateUpdate () { calls.push('service:lateUpdate'); }
      override onDraw () { calls.push('service:draw'); }
    }
    register('redraw-observer', Observer);
    const engine = createPlayer().engine;
    const composition = new Composition(engine);

    composition.sceneTicking.update.tick = () => calls.push('update');
    composition.sceneTicking.lateUpdate.tick = () => calls.push('lateUpdate');
    composition.camera.updateMatrix = () => calls.push('camera');
    composition.sceneTicking.preRender.tick = dt => calls.push(`preRender:${dt}`);
    composition.renderContent = () => calls.push('render');
    engine.renderTargetPool.flush = () => calls.push('flush');
    engine.renderFrame();
    expect(calls).to.deep.equal(['camera', 'preRender:0', 'render', 'service:draw', 'flush']);
  });

  it('rejects offloaded scenes before advancing any service or composition', () => {
    const calls: string[] = [];

    class Observer extends EngineService {
      override onUpdate () { calls.push('service:update'); }
      override onDraw () { calls.push('service:draw'); }
    }
    register('offloaded-observer', Observer);
    const engine = createPlayer().engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    first.sceneTicking.update.tick = () => calls.push('composition:update');
    second.textureOffloaded = true;
    engine.on('rendererror', () => calls.push('rendererror'));
    engine.mainLoop(16);
    expect(calls).to.deep.equal(['rendererror']);
  });

  it('disposes all scenes once before lower-order resource services', () => {
    const calls: string[] = [];

    class Resources extends EngineService {
      override onBeforeExit () {
        expect(this.engine.compositions).to.have.length(0);
      }
      override onDispose () {
        expect(this.engine.compositions).to.have.length(0);
        calls.push('resources');
      }
    }
    register('scene-resources', Resources);
    const engine = createPlayer().engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    for (const [index, composition] of [first, second].entries()) {
      const dispose = composition.dispose.bind(composition);

      composition.dispose = () => {
        calls.push(`scene:${index}`);
        dispose();
      };
    }
    engine.dispose();
    engine.dispose();
    expect(calls).to.deep.equal(['scene:0', 'scene:1', 'resources']);
    expect(engine.getService(SceneService)).to.equal(undefined);
  });

  it('creates the ThreeRenderer before services initialize and keeps the same instance', () => {
    let renderer: Renderer | undefined;

    class Service extends EngineService {
      override onInit () {
        renderer = this.engine.renderer;
        expect(renderer).to.be.instanceOf(ThreeRenderer);
      }
    }

    register('three-renderer', Service);
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2')!;
    const engine = new ThreeEngine(gl, { manualRender: true });

    expect(engine.renderer).to.equal(renderer);
    engine.dispose();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
});
