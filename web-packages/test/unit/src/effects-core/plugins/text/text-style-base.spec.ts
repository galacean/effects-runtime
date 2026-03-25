import { TextStyle } from '@galacean/effects-core';

const { expect } = chai;

describe('core/plugins/text/text-style-base', () => {
  describe('getBaseRenderStyle', () => {
    it('should return solid-fill only when no effects', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
      expect((result.layers[0].params as any).color).to.eql([1, 1, 1, 1]);
    });

    it('should include shadow layer when hasShadow is true', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        shadow: {
          shadowColor: [0, 0, 0, 0.5],
          shadowBlur: 10,
          shadowOffsetX: 2,
          shadowOffsetY: 3,
        },
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[1].kind).to.eql('solid-fill');
    });

    it('should include stroke layer when isOutlined is true', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        outline: {
          outlineColor: [1, 0, 0, 1],
          outlineWidth: 2,
        },
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('single-stroke');
      expect(result.layers[1].kind).to.eql('solid-fill');
    });

    it('should include all layers in correct order (shadow -> stroke -> fill)', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        shadow: {
          shadowColor: [0, 0, 0, 0.5],
          shadowBlur: 5,
          shadowOffsetX: 1,
          shadowOffsetY: 1,
        },
        outline: {
          outlineColor: [1, 0, 0, 1],
          outlineWidth: 2,
        },
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(3);
      expect(result.layers[0].kind).to.eql('shadow');
      expect(result.layers[1].kind).to.eql('single-stroke');
      expect(result.layers[2].kind).to.eql('solid-fill');
    });

    it('should not include stroke layer when outlineWidth is 0', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        outline: {
          outlineColor: [1, 0, 0, 1],
          outlineWidth: 0,
        },
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
    });

    it('should not include stroke layer when isOutlined is false', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
      });

      // isOutlined 默认为 false
      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers.find(l => l.kind === 'single-stroke')).to.be.undefined;
    });
  });

  describe('shadow parameters', () => {
    it('should use default shadow values when not specified', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        shadow: {},
      });

      const result = style.getBaseRenderStyle();

      expect(result.layers).to.have.lengthOf(2);
      expect(result.layers[0].kind).to.eql('shadow');
      const shadowParams = result.layers[0].params as any;

      expect(shadowParams.blur).to.eql(2); // default
      expect(shadowParams.offsetX).to.eql(0); // default
      expect(shadowParams.offsetY).to.eql(0); // default
    });

    it('should correctly pass shadow color', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        shadow: {
          shadowColor: [0.5, 0.25, 0.75, 0.8],
          shadowBlur: 10,
        },
      });

      const result = style.getBaseRenderStyle();
      const shadowParams = result.layers[0].params as any;

      expect(shadowParams.color).to.eql([0.5, 0.25, 0.75, 0.8]);
    });
  });

  describe('stroke parameters', () => {
    it('should correctly pass stroke width and color', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        outline: {
          outlineColor: [0.2, 0.4, 0.6, 0.9],
          outlineWidth: 3.5,
        },
      });

      const result = style.getBaseRenderStyle();
      const strokeParams = result.layers[0].params as any;

      expect(strokeParams.width).to.eql(3.5);
      expect(strokeParams.color).to.eql([0.2, 0.4, 0.6, 0.9]);
      expect(strokeParams.unit).to.eql('px');
    });

    it('should use default outline color when not specified', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
        outline: {
          outlineWidth: 2,
        },
      });

      const result = style.getBaseRenderStyle();
      const strokeParams = result.layers[0].params as any;

      expect(strokeParams.color).to.eql([1, 1, 1, 1]); // default
    });
  });

  describe('text color', () => {
    it('should use textColor for solid-fill', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [0.8, 0.6, 0.4, 0.7],
        fontSize: 24,
      });

      const result = style.getBaseRenderStyle();
      const fillParams = result.layers[0].params as any;

      expect(fillParams.color).to.eql([0.8, 0.6, 0.4, 0.7]);
    });

    it('should use default color when textColor not specified', () => {
      const style = new TextStyle({
        text: 'test',
        fontSize: 24,
      });

      const result = style.getBaseRenderStyle();
      const fillParams = result.layers[0].params as any;

      expect(fillParams.color).to.eql([1, 1, 1, 1]); // default
    });
  });

  describe('getCurrentFancyTextConfig', () => {
    it('should return fancyRenderStyle when set', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [1, 1, 1, 1],
        fontSize: 24,
      });

      const result = style.getCurrentFancyTextConfig();

      expect(result.layers).to.have.lengthOf(1);
      expect(result.layers[0].kind).to.eql('solid-fill');
    });
  });

  describe('color normalization', () => {
    it('should normalize RGB values > 1 (255 format)', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [255, 128, 64, 1],
        fontSize: 24,
      });

      const result = style.getBaseRenderStyle();
      const fillParams = result.layers[0].params as any;

      // 应该被归一化为 0-1 范围
      expect(fillParams.color[0]).to.be.approximately(1, 0.01);
      expect(fillParams.color[1]).to.be.approximately(0.5, 0.01);
      expect(fillParams.color[2]).to.be.approximately(0.25, 0.01);
    });

    it('should handle alpha channel with default value', () => {
      const style = new TextStyle({
        text: 'test',
        textColor: [0.5, 0.5, 0.5, 1],
        fontSize: 24,
      });

      const result = style.getBaseRenderStyle();
      const fillParams = result.layers[0].params as any;

      expect(fillParams.color[3]).to.eql(1); // alpha
    });
  });
});