import { Composition, Control, Player, math } from '@galacean/effects';

const { expect } = chai;

class FilledControl extends Control {
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, math.Color.WHITE);
  }
}

describe('core/Graphics clip stack', () => {
  it('flushes around a rotated child clip and restores scissor state', () => {
    const canvas = document.createElement('canvas');

    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    const player = new Player({ canvas, pixelRatio: 2, manualRender: true });

    canvas.width = 200;
    canvas.height = 200;
    const composition = new Composition(player.engine);
    const clipped = new FilledControl(player.engine);
    const child = new FilledControl(player.engine);
    const sibling = new FilledControl(player.engine);
    const scissorRects: number[][] = [];
    const drawScissorStates: boolean[] = [];
    let scissorEnabled = false;
    const originalSetScissorTest = player.engine.setScissorTest.bind(player.engine);
    const originalSetScissor = player.engine.setScissor.bind(player.engine);
    const originalDrawGeometry = player.engine.renderer.drawGeometry.bind(player.engine.renderer);

    player.engine.setScissorTest = enabled => {
      scissorEnabled = enabled;
      originalSetScissorTest(enabled);
    };
    player.engine.setScissor = (x, y, width, height) => {
      scissorRects.push([x, y, width, height]);
      originalSetScissor(x, y, width, height);
    };
    player.engine.renderer.drawGeometry = (...args) => {
      drawScissorStates.push(scissorEnabled);
      originalDrawGeometry(...args);
    };

    try {
      composition.root.awake();
      composition.root.beginPlay();
      clipped.parent = composition.uiCanvas.rootControl;
      clipped.setRect({ position: new math.Vector2(20, 20), size: new math.Vector2(20, 20) });
      clipped.setRotation(45);
      clipped.clipContents = true;
      clipped.addChild(child);
      child.setSize(40, 40);
      sibling.parent = composition.uiCanvas.rootControl;
      sibling.setRect({ position: new math.Vector2(60, 60), size: new math.Vector2(10, 10) });

      player.engine.windowRoot.render();

      expect(drawScissorStates).deep.equals([false, true, false]);
      expect(scissorRects).length(1);
      expect(scissorRects[0][2]).greaterThan(40);
      expect(scissorEnabled).equals(false);
    } finally {
      player.engine.setScissorTest = originalSetScissorTest;
      player.engine.setScissor = originalSetScissor;
      player.engine.renderer.drawGeometry = originalDrawGeometry;
      player.dispose();
    }
  });

  it('intersects nested clips and restores the parent clip', () => {
    const canvas = document.createElement('canvas');

    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    const player = new Player({ canvas, pixelRatio: 2, manualRender: true });

    canvas.width = 200;
    canvas.height = 200;
    const scissorRects: number[][] = [];
    const originalSetScissor = player.engine.setScissor.bind(player.engine);

    player.engine.setScissor = (x, y, width, height) => {
      scissorRects.push([x, y, width, height]);
      originalSetScissor(x, y, width, height);
    };

    try {
      const graphics = player.engine.graphics;

      graphics.begin();
      graphics.pushClipRect(10, 10, 50, 50);
      graphics.fillRectangle(10, 10, 10, 10);
      graphics.pushClipRect(80, 80, 10, 10);
      graphics.fillRectangle(80, 80, 10, 10);
      graphics.popClipRect();
      graphics.popClipRect();
      graphics.end();

      expect(scissorRects).length(3);
      expect(scissorRects[0][2]).equals(100);
      expect(scissorRects[0][3]).equals(100);
      expect(scissorRects[1][2]).equals(0);
      expect(scissorRects[1][3]).equals(0);
      expect(scissorRects[2]).deep.equals(scissorRects[0]);
    } finally {
      player.engine.setScissor = originalSetScissor;
      player.dispose();
    }
  });
});
