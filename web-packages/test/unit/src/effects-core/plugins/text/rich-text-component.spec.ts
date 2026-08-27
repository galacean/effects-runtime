import { GLEngine, VFXItem, spec } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const { expect } = chai;

const makeOptions = (text: string): Parameters<RichTextComponent['updateWithOptions']>[0] => ({
  text,
  fontFamily: 'Arial',
  fontSize: 40,
  textColor: [1, 1, 1, 1],
  textAlign: spec.TextAlignment.middle,
  textVerticalAlign: spec.TextVerticalAlign.middle,
  textOverflow: spec.TextOverflow.display,
  wrapEnabled: false,
  maxTextWidth: 350,
  maxTextHeight: 1000,
  autoResize: spec.TextSizeMode.autoWidth,
  lineHeight: 40,
});

describe('plugin/rich-text/rich-text-component', () => {
  let engine: GLEngine;
  let richText: RichTextComponent;

  beforeEach(() => {
    engine = new GLEngine(document.createElement('canvas'));
    richText = new VFXItem(engine).addComponent(RichTextComponent);
  });

  afterEach(() => {
    richText.dispose();
    engine.dispose();
  });

  it('does not collapse the surface when rich-text markup has no renderable content', () => {
    richText.updateWithOptions(makeOptions('A'));
    richText.onUpdate(0);

    const before = {
      canvasWidth: richText.canvas.width,
      canvasHeight: richText.canvas.height,
      transformWidth: richText.item.transform.size.x,
      transformHeight: richText.item.transform.size.y,
    };

    richText.updateWithOptions(makeOptions('<b></b>'));
    richText.onUpdate(0);

    expect(richText.canvas.width).to.equal(before.canvasWidth);
    expect(richText.canvas.height).to.equal(before.canvasHeight);
    expect(richText.item.transform.size.x).to.equal(before.transformWidth);
    expect(richText.item.transform.size.y).to.equal(before.transformHeight);
  });

  it('uses the text color as the default fill when default fancy layers are omitted', () => {
    richText.updateWithOptions({
      ...makeOptions('A'),
      fancyConfig: {},
    });
    richText.onUpdate(0);

    const plan = richText.getRenderPlan();
    const defaultFill = plan?.effects.defaultRangeLayers.find(layer => layer.layer.kind === 'solid-fill');

    expect(defaultFill?.layer).to.have.property('params').that.deep.includes({ color: [1, 1, 1, 1] });
  });

  it('requires rangeStacks and rangeOverrides to be provided together', () => {
    expect(() => richText.updateWithOptions({
      ...makeOptions('A'),
      fancyConfig: { rangeStacks: [] } as unknown as NonNullable<Parameters<RichTextComponent['updateWithOptions']>[0]['fancyConfig']>,
    })).to.throw('fancyConfig.rangeStacks and rangeOverrides must be provided together.');
  });

  it('derives and stabilizes fancy padding from runtime layers without a caller budget', () => {
    const makeFancyOptions = (text: string, shadowBlur: number) => ({
      ...makeOptions(text),
      fancyConfig: {
        layers: [
          {
            kind: 'single-stroke' as const,
            category: 'base' as const,
            params: { color: [0, 0, 0, 1] as [number, number, number, number], width: 8, unit: 'px' as const },
            decorations: [{
              kind: 'shadow' as const,
              category: 'decorative' as const,
              params: { color: [0, 0, 0, 1] as [number, number, number, number], blur: shadowBlur, offsetX: 5, offsetY: 5 },
            }],
          },
          {
            kind: 'solid-fill' as const,
            category: 'base' as const,
            params: { color: [1, 1, 1, 1] as [number, number, number, number] },
          },
        ],
      },
    });

    richText.updateWithOptions(makeFancyOptions('A', 15));
    richText.onUpdate(0);
    const highPadding = richText.getRenderPlan()?.geometry.padding.left;

    expect(highPadding).to.equal(33);

    richText.updateWithOptions(makeFancyOptions('A', 1));
    richText.onUpdate(0);

    expect(richText.getRenderPlan()?.geometry.padding.left).to.equal(highPadding);

    richText.updateWithOptions(makeFancyOptions('B', 1));
    richText.onUpdate(0);

    expect(richText.getRenderPlan()?.geometry.padding.left).to.equal(19);

    richText.updateWithOptions(makeOptions('B'));
    richText.onUpdate(0);

    expect(richText.getRenderPlan()?.geometry.padding.left).to.equal(0);
  });

  it('still updates the display surface when valid content changes size', () => {
    richText.updateWithOptions(makeOptions('A'));
    richText.onUpdate(0);

    const before = {
      canvasWidth: richText.canvas.width,
      transformWidth: richText.item.transform.size.x,
    };

    richText.updateWithOptions(makeOptions('AAAA'));
    richText.onUpdate(0);

    expect(richText.canvas.width).to.be.greaterThan(before.canvasWidth);
    expect(richText.item.transform.size.x).to.be.greaterThan(before.transformWidth);
  });
});
