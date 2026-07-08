import { spec, Engine, TextComponent, TextLayout, TextStyle } from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/text/text-item', () => {
  let engine: Engine;
  let textComponent: TextComponent;

  beforeEach(() => {
    engine = new Engine(document.createElement('canvas'));
    textComponent = new TextComponent(engine);
  });

  afterEach(() => {
    textComponent.dispose();
    engine.dispose();
  });

  it('构造后持有默认值', () => {
    expect(textComponent.isDirty).to.be.true;
    expect(textComponent.lineCount).to.equal(0);
    expect(textComponent.textStyle).to.be.an.instanceOf(TextStyle);
    expect(textComponent.canvas).to.be.an.instanceOf(HTMLCanvasElement);
    expect(textComponent.context).to.be.an.instanceOf(CanvasRenderingContext2D);
    expect(textComponent.textLayout).to.be.an.instanceOf(TextLayout);
    // 默认 props 的 text 为"默认文本"，非空串
    expect(textComponent.text).to.equal('默认文本');
  });

  it('updateWithOptions 写入样式与布局', () => {
    const options: spec.TextContentOptions = {
      fontSize: 16,
      fontWeight: spec.TextWeight.bold,
      fontStyle: spec.FontStyle.italic,
      text: 'Hello, World!',
      textAlign: spec.TextAlignment.middle,
      textColor: [1, 0, 0, 1],
      fontFamily: 'Arial',
    };

    textComponent.updateWithOptions(options);

    expect(textComponent.textStyle.fontSize).to.equal(options.fontSize);
    expect(textComponent.textStyle.textWeight).to.equal(options.fontWeight);
    expect(textComponent.textStyle.fontStyle).to.equal(options.fontStyle);
    expect(textComponent.text).to.equal(options.text);
    expect(textComponent.textLayout.textAlign).to.equal(options.textAlign);
    expect(textComponent.textStyle.textColor).to.deep.equal(options.textColor);
    expect(textComponent.textStyle.fontFamily).to.equal(options.fontFamily);
  });

  // 换行集成测试：打桩 measureText 返回固定宽度（CJK=10 / 西文与标点=5 / 空格=3），
  // letterSpace 默认 0、keepWordIntact 默认 true。通过调整 textLayout.width 吸收 fontOffset，
  // 使 getLineCount 内部 width = textLayout.width + fontOffset 等于目标值，得到确定性行数。
  describe('getLineCount 换行机会', () => {
    type MeasureFn = (text: string) => TextMetrics;

    const stubMeasure: MeasureFn = s => {
      const cp = s.codePointAt(0) ?? 0;
      let width = 5;

      if (s === ' ') {
        width = 3;
      } else if (
        (cp >= 0x3400 && cp <= 0x9FFF) // CJK 统一表意 + 扩展 A
        || (cp >= 0x3040 && cp <= 0x30FF) // 假名
        || (cp >= 0xAC00 && cp <= 0xD7AF) // 韩文音节
        || cp >= 0x20000 // CJK 扩展 B+（代理对）
      ) {
        width = 10;
      }

      return { width } as unknown as TextMetrics;
    };

    /** 设置目标排版宽度（吸收 fontOffset），并打桩 measureText */
    const setup = (targetWidth: number): void => {
      textComponent.updateWithOptions({ text: '', fontSize: 16 });
      // 吸收 fontOffset：getLineCount 内 width = textLayout.width + fontOffset
      textComponent.textLayout.width = targetWidth - textComponent.textStyle.fontOffset;
      // 打桩测量，避免依赖系统字体
      (textComponent.context as CanvasRenderingContext2D).measureText = stubMeasure;
    };

    it('纯 CJK 文本在字间断行（每行 2 字 → 2 行）', () => {
      setup(25); // 放得下 2 个 CJK（20），第 3 字超宽
      expect(textComponent.getLineCount('您去领取')).to.equal(2);
    });

    it('空格处断行时空格被吞掉（a 与 b 分两行）', () => {
      setup(10); // a(5)+空格(3)=8 放得下，加 b(5) 超宽
      expect(textComponent.getLineCount('a b')).to.equal(2);
    });

    it('CJK 字间断行不拆西文词（ab您 / cd 两行，您留本行末）', () => {
      setup(20); // ab您 = 5+5+10 = 20 刚好
      expect(textComponent.getLineCount('ab您cd')).to.equal(2);
    });

    it('长 CJK 文本多行换行，不整体端走后半句', () => {
      // 回归用例：原实现只认空格断点，会把"去领取支付人群"整体端到第二行。
      // 升级换行机会模型后 CJK 字间断，行数明显增多。
      setup(40);
      expect(textComponent.getLineCount('您有0.01元券 去领取支付人群')).to.equal(4);
    });
  });
});
