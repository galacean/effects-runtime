import type { EngineOptions } from '@galacean/effects';
import { Composition, Engine, InputServer, Player } from '@galacean/effects';

const { expect } = chai;

describe('core/engine/input-server', () => {
  const engines: Engine[] = [];

  function createEngine (options: EngineOptions = {}) {
    const engine = Engine.create(document.createElement('canvas'), { manualRender: true, ...options });

    engines.push(engine);

    return engine;
  }

  afterEach(() => {
    engines.splice(0).forEach(engine => engine.dispose());
  });

  it('isolates input per engine and preserves composition references and options', () => {
    const first = createEngine({ interactive: true, notifyTouch: true });
    const second = createEngine();
    const composition = new Composition(first);

    expect(first.getServer(InputServer)).to.equal(first.inputServer);
    expect(composition.event).to.equal(first.inputServer);
    expect(first.inputServer).not.to.equal(second.inputServer);
    expect(first.inputServer.enabled).to.equal(true);
    expect(first.inputServer.allowPropagation).to.equal(true);
    expect(second.inputServer.enabled).to.equal(false);
    expect(second.inputServer.allowPropagation).to.equal(false);
  });

  it('preserves player.event as the engine input server', () => {
    const player = new Player({ canvas: document.createElement('canvas'), manualRender: true });

    try {
      //@ts-expect-error
      expect(player.event).to.equal(player.engine.inputServer);
      //@ts-expect-error
      player.event.enabled = true;
      expect(player.interactive).to.equal(true);
      player.skipPointerMovePicking = false;
      //@ts-expect-error
      expect(player.event.skipPointerMovePicking).to.equal(false);
    } finally {
      player.dispose();
    }
  });

  it('delivers native input once and removes listeners before display disposal', () => {
    const engine = createEngine({ interactive: true });
    const canvas = engine.canvas;
    let inputs = 0;

    engine.inputServer.on('input', event => {
      inputs++;
      event.accept();
    });
    const pressKey = () => canvas.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a', code: 'KeyA', cancelable: true,
    }));

    expect(pressKey()).to.equal(false);
    expect(inputs).to.equal(1);
    const disposeDisplay = engine.displayServer.onDispose.bind(engine.displayServer);

    engine.displayServer.onDispose = () => {
      expect(pressKey()).to.equal(true);
      expect(inputs).to.equal(1);
      expect(canvas.hasAttribute('tabindex')).to.equal(false);
      disposeDisplay();
    };
    engine.dispose();
    engine.dispose();
    expect(pressKey()).to.equal(true);
    expect(inputs).to.equal(1);
  });
});
