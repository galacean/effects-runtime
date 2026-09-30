import { restoreTestState } from '../helpers/spies';
import { TextCaretMapper, type TextCaretLayout } from '../../../../../../plugin-packages/editor-gizmo/src/2d/text/text-caret-mapper';

const { expect } = chai;

describe('plugin-editor-gizmo/text-caret-mapper', () => {
  afterEach(restoreTestState);

  beforeEach(() => {
    // Range fixtures use local coordinates; keep the mirror origin deterministic.
    chai.spy.on(HTMLElement.prototype, 'getBoundingClientRect', () => (new DOMRect(0, 0, 100, 20)));
  });

  const layout: TextCaretLayout = {
    left: 10,
    top: 20,
    width: 100,
    height: 20,
    rotation: 0,
    text: 'text',
    fontFamily: 'sans-serif',
    fontSize: 16,
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'left',
    keepWordIntact: true,
  };

  describe('TextCaretMapper', () => {
    it('使用浏览器 Range 排版把视口坐标映射为字符位置', () => {
      let offset = 0;

      chai.spy.on(document, 'createRange', () => ({
        setStart: (_node: Node, nextOffset: number) => {
          offset = nextOffset;
        },
        collapse: () => {},
        getBoundingClientRect: () => ({
          left: offset * 10,
          top: 0,
          width: 0,
          height: 20,
          right: offset * 10,
          bottom: 20,
          x: offset * 10,
          y: 0,
          toJSON: () => {},
        }),
      } as unknown as Range));

      const mapper = new TextCaretMapper();

      mapper.sync(layout);

      expect(mapper.resolve({ x: 11, y: 30 })).to.equal(0);
      expect(mapper.resolve({ x: 29, y: 30 })).to.equal(2);
      expect(mapper.resolve({ x: 49, y: 30 })).to.equal(4);
    });

    it('reset 后不再使用上一目标的布局', () => {
      chai.spy.on(document, 'createRange', () => ({
        setStart: () => {},
        collapse: () => {},
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 0,
          height: 20,
          right: 0,
          bottom: 20,
          x: 0,
          y: 0,
          toJSON: () => {},
        }),
      } as unknown as Range));

      const mapper = new TextCaretMapper();

      mapper.sync(layout);
      mapper.reset();

      expect(mapper.resolve({ x: 10, y: 20 })).to.equal(undefined);
    });

    it('按 Box2 左上角逆变换旋转后的视图坐标', () => {
      let offset = 0;

      chai.spy.on(document, 'createRange', () => ({
        setStart: (_node: Node, nextOffset: number) => {
          offset = nextOffset;
        },
        collapse: () => {},
        getBoundingClientRect: () => ({
          left: offset * 10,
          top: 0,
          width: 0,
          height: 20,
          right: offset * 10,
          bottom: 20,
          x: offset * 10,
          y: 0,
          toJSON: () => {},
        }),
      } as unknown as Range));

      const mapper = new TextCaretMapper();

      mapper.sync({ ...layout, left: 100, top: 50, rotation: Math.PI / 2 });

      expect(mapper.resolve({ x: 90, y: 70 })).to.equal(2);
    });
  });
});
