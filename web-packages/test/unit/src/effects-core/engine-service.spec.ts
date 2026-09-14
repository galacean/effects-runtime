import { Composition, EngineService, Player, effectsClass, effectsClassStore } from '@galacean/effects';
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
        expect(this.engine.root).to.exist;
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
      override readonly order = 10;
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
      '-10:init', '10:init',
      '-10:update:100', '10:update:100', 'composition:update', 'composition:lateUpdate',
      '-10:lateUpdate:100', '10:lateUpdate:100', 'composition:preRender',
      '-10:draw', '10:draw', 'composition:render',
      '10:beforeExit', '-10:beforeExit', '10:dispose', '-10:dispose',
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
