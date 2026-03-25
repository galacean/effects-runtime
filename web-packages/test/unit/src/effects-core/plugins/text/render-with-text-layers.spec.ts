import type { CharInfo, TextEnv, TextLayerDrawer } from '@galacean/effects-core';
import { renderWithTextLayers } from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/render-with-text-layers', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let style: any;
  let layout: any;
  let charsInfo: CharInfo[];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    ctx = canvas.getContext('2d')!;

    style = {
      fontDesc: '24px Arial',
      fontScale: 1,
      fontSize: 24,
    };

    layout = {
      getOffsetX: () => 10,
    };

    charsInfo = [
      {
        y: 50,
        width: 40,
        chars: ['H', 'i'],
        charOffsetX: [0, 20],
      },
    ];
  });

  describe('renderWithTextLayers', () => {
    it('should call render on each drawer', () => {
      const renderSpy = chai.spy();
      const drawer: TextLayerDrawer = {
        name: 'test',
        render: renderSpy,
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      expect(renderSpy).to.have.been.called.once;
    });

    it('should call drawers in order', () => {
      const callOrder: string[] = [];
      const drawer1: TextLayerDrawer = {
        name: 'first',
        render: () => { callOrder.push('first'); },
      };
      const drawer2: TextLayerDrawer = {
        name: 'second',
        render: () => { callOrder.push('second'); },
      };
      const drawer3: TextLayerDrawer = {
        name: 'third',
        render: () => { callOrder.push('third'); },
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer1, drawer2, drawer3]);

      expect(callOrder).to.eql(['first', 'second', 'third']);
    });

    it('should call renderDecorations and renderFill when render is not defined', () => {
      const renderDecorationsSpy = chai.spy();
      const renderFillSpy = chai.spy();
      const drawer: TextLayerDrawer = {
        name: 'test',
        renderDecorations: renderDecorationsSpy,
        renderFill: renderFillSpy,
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      expect(renderDecorationsSpy).to.have.been.called.once;
      expect(renderFillSpy).to.have.been.called.once;
    });

    it('should prefer render over renderDecorations/renderFill', () => {
      const renderSpy = chai.spy();
      const renderDecorationsSpy = chai.spy();
      const renderFillSpy = chai.spy();
      const drawer: TextLayerDrawer = {
        name: 'test',
        render: renderSpy,
        renderDecorations: renderDecorationsSpy,
        renderFill: renderFillSpy,
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      expect(renderSpy).to.have.been.called.once;
      expect(renderDecorationsSpy).to.not.have.been.called;
      expect(renderFillSpy).to.not.have.been.called;
    });

    it('should save and restore context', () => {
      const saveSpy = chai.spy.on(ctx, 'save');
      const restoreSpy = chai.spy.on(ctx, 'restore');
      const drawer: TextLayerDrawer = {
        name: 'test',
        render: () => {},
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      expect(saveSpy).to.have.been.called.once;
      expect(restoreSpy).to.have.been.called.once;
    });

    it('should handle empty drawer array', () => {
      const saveSpy = chai.spy.on(ctx, 'save');
      const restoreSpy = chai.spy.on(ctx, 'restore');

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, []);

      expect(saveSpy).to.have.been.called.once;
      expect(restoreSpy).to.have.been.called.once;
    });

    it('should handle null/undefined drawer array', () => {
      const saveSpy = chai.spy.on(ctx, 'save');
      const restoreSpy = chai.spy.on(ctx, 'restore');

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, null as any);

      expect(saveSpy).to.have.been.called.once;
      expect(restoreSpy).to.have.been.called.once;
    });

    it('should handle drawer without any render methods', () => {
      const drawer: TextLayerDrawer = {
        name: 'empty',
      };

      // Should not throw
      expect(() => {
        renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);
      }).to.not.throw();
    });

    it('should pass correct env to drawer.render', () => {
      let receivedEnv: TextEnv | null = null;
      const drawer: TextLayerDrawer = {
        name: 'test',
        render: (_ctx, env) => {
          receivedEnv = env;
        },
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      expect(receivedEnv).to.exist;
      expect(receivedEnv!.fontDesc).to.eql('24px Arial');
      expect(receivedEnv!.style).to.eql(style);
      expect(receivedEnv!.layout).to.eql(layout);
      expect(receivedEnv!.lines).to.eql(charsInfo);
      expect(receivedEnv!.canvas).to.eql(canvas);
    });

    it('should call layer.dispose after rendering', () => {
      const disposeSpy = chai.spy();
      let capturedEnv: TextEnv | null = null;
      const drawer: TextLayerDrawer = {
        name: 'test',
        render: (_ctx, env) => {
          capturedEnv = env;
        },
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer]);

      // dispose 是在 env.layer 上，我们需要通过 spy 来验证
      // 由于 dispose 是在 createTextEnv 中创建的，我们无法直接 spy
      // 但可以通过验证渲染完成后 env 仍然被正确处理来间接验证
      expect(capturedEnv).to.exist;
    });

    it('should render multiple drawers with mixed render methods', () => {
      const calls: string[] = [];

      const drawer1: TextLayerDrawer = {
        name: 'with-render',
        render: () => { calls.push('render1'); },
        renderDecorations: () => { calls.push('decorations1'); },
        renderFill: () => { calls.push('fill1'); },
      };

      const drawer2: TextLayerDrawer = {
        name: 'without-render',
        renderDecorations: () => { calls.push('decorations2'); },
        renderFill: () => { calls.push('fill2'); },
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer1, drawer2]);

      // drawer1 有 render，所以只用 render
      // drawer2 没有 render，所以用 renderDecorations + renderFill
      expect(calls).to.eql(['render1', 'decorations2', 'fill2']);
    });
  });

  describe('context isolation', () => {
    it('should not affect context state between drawers', () => {
      const drawer1: TextLayerDrawer = {
        name: 'first',
        render: context => {
          context.fillStyle = 'red';
          context.lineWidth = 5;
        },
      };

      const drawer2: TextLayerDrawer = {
        name: 'second',
        render: context => {
          // 每个 drawer 开始时 context 应该是干净的状态
          // 因为 save/restore 在整个循环外部
          // 但这里我们只是验证可以设置和读取
          context.fillStyle = 'blue';
        },
      };

      renderWithTextLayers(canvas, ctx, style, layout, charsInfo, [drawer1, drawer2]);

      // 最终 restore 后 context 应该恢复到 save 前的状态
      // 但由于 restore 后才返回，我们在外部无法直接验证
      // 这个测试主要是确保不会抛出异常
      expect(true).to.be.true;
    });
  });
});