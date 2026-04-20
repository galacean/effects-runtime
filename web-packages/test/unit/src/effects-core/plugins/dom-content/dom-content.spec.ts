import { Player, SpriteComponent } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { DomContentComponent, renderDOMToImage, replaceSpriteTexture, inlineImageSources, sanitizeSVGContent } from '@galacean/effects-plugin-dom-content';

const { expect } = chai;

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*1T3xS4Vkrm8AAAAAQDAAAAgAelB4AQ';

/** 轮询等待条件满足 */
async function waitFor (predicate: () => boolean, timeout = 2000, interval = 50): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (predicate()) { return; }
    await new Promise(resolve => { setTimeout(resolve, interval); });
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

describe('plugin/dom-content', () => {
  let player: Player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), pixelRatio: 1, manualRender: true });
  });

  after(() => { player?.dispose(); });

  describe('sanitizeSVGContent', () => {
    it('should preserve safe tags (div, span, svg, img)', () => {
      const html = '<div><span>hi</span><svg><circle/></svg><img src="data:png,abc"/></div>';

      expect(sanitizeSVGContent(html)).to.equal(html);
    });

    it('should escape dangerous tags (script, iframe, object, embed, link, foreignObject)', () => {
      const result = sanitizeSVGContent('<script>alert(1)</script><iframe src="x"></iframe>');

      expect(result).to.not.include('<script');
      expect(result).to.not.include('<iframe');
      expect(result).to.include('&lt;script');
      expect(result).to.include('&lt;iframe');
    });

    it('should remove event handler attributes', () => {
      expect(sanitizeSVGContent('<img src="x" onerror="alert(1)">')).to.not.include('onerror');
      expect(sanitizeSVGContent('<div onclick="a()" onload="b()">')).to.not.include('onclick');
      expect(sanitizeSVGContent('<body onload=alert(1)>')).to.not.include('onload');
    });

    it('should be case-insensitive', () => {
      const result = sanitizeSVGContent('<SCRIPT></SCRIPT><foreignObject></foreignObject>');

      expect(result).to.not.include('<SCRIPT');
      expect(result).to.not.include('<foreignObject');
    });
  });

  describe('renderDOMToImage', () => {
    it('should render HTML to image', async () => {
      const image = await renderDOMToImage('<div style="width:100px;height:100px;background:red;"></div>', 100, 100);

      expect(image).to.be.instanceOf(HTMLImageElement);
      expect(image.width).to.equal(100);
      expect(image.height).to.equal(100);
    });

    it('should support scale parameter', async () => {
      const image = await renderDOMToImage('<div style="background:green;"></div>', 100, 100, 2);

      expect(image.width).to.equal(200);
      expect(image.height).to.equal(200);
    });

    it('should render inline SVG', async () => {
      const html = '<svg width="50" height="50"><circle cx="25" cy="25" r="20" fill="blue"/></svg>';

      expect(await renderDOMToImage(html, 100, 100)).to.be.instanceOf(HTMLImageElement);
    });

    it('should throw on invalid parameters', () => {
      expect(() => renderDOMToImage('<div></div>', 0, 100)).to.throw();
      expect(() => renderDOMToImage('<div></div>', 100, -1)).to.throw();
      expect(() => renderDOMToImage('<div></div>', 100, 100, 0)).to.throw();
      expect(() => renderDOMToImage('<div></div>', NaN, 100)).to.throw();
      expect(() => renderDOMToImage('<div></div>', 100, Infinity)).to.throw();
    });
  });

  describe('DomContentComponent', () => {
    it('should have default property values', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      expect(domContent.htmlContent).to.equal('');
      expect(domContent.contentWidth).to.equal(300);
      expect(domContent.contentHeight).to.equal(200);
      expect(domContent.contentScale).to.equal(1);
    });

    it('should update properties via setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 400, 300, 2);
      expect(domContent.htmlContent).to.equal('<div>Test</div>');
      expect(domContent.contentWidth).to.equal(400);
      expect(domContent.contentHeight).to.equal(300);
      expect(domContent.contentScale).to.equal(2);
    });

    it('should clamp negative contentScale to 0', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 100, 100, -2);
      expect(domContent.contentScale).to.equal(0);
    });

    it('should render texture after setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div style="background:red;">Test</div>', 100, 100);
      player.gotoAndPlay(0.01);

      await waitFor(() => !!domContent.material.getTexture('_MainTex'));
      expect(domContent.material.getTexture('_MainTex')).to.not.be.undefined;
    });

    it('should not render with empty content or invalid dimensions', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('', 100, 100);
      player.gotoAndPlay(0.01);
      await new Promise(_resolve => { setTimeout(_resolve, 100); });
      expect(domContent.material.getTexture('_MainTex')).to.be.undefined;

      domContent.setContent('<div>Test</div>', 0, 0);
      player.gotoAndPlay(0.01);
      await new Promise(_resolve => { setTimeout(_resolve, 100); });
      expect(domContent.material.getTexture('_MainTex')).to.be.undefined;
    });

    it('should handle rapid consecutive setContent calls', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>First</div>', 100, 100);
      domContent.setContent('<div>Second</div>', 200, 200);
      domContent.setContent('<div>Third</div>', 300, 300);

      expect(domContent.htmlContent).to.include('Third');
      expect(domContent.contentWidth).to.equal(300);
    });

    it('should dispose safely during async rendering', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div style="background:red;">Test</div>', 100, 100);
      player.gotoAndPlay(0.01);
      composition.dispose();

      await new Promise(_resolve => { setTimeout(_resolve, 100); });
    });
  });

  describe('replaceSpriteTexture', () => {
    it('should replace sprite texture', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const sprite = item.getComponent(SpriteComponent);

      await replaceSpriteTexture(sprite, '<div style="background:red;">Test</div>', 100, 100);
      expect(sprite.material.getTexture('_MainTex')).to.not.be.undefined;
    });

    it('should throw on invalid parameters', async () => {
      const composition = await player.loadScene(json);
      const sprite = composition.getItemByName('place_holder')!.getComponent(SpriteComponent);

      // width = 0
      try {
        await replaceSpriteTexture(sprite, '<div></div>', 0, 100);
        expect.fail('should throw');
      } catch { /* expected */ }
      // height < 0
      try {
        await replaceSpriteTexture(sprite, '<div></div>', 100, -1);
        expect.fail('should throw');
      } catch { /* expected */ }
      // scale = 0
      try {
        await replaceSpriteTexture(sprite, '<div></div>', 100, 100, 0);
        expect.fail('should throw');
      } catch { /* expected */ }
      // width = NaN
      try {
        await replaceSpriteTexture(sprite, '<div></div>', NaN, 100);
        expect.fail('should throw');
      } catch { /* expected */ }
    });
  });

  describe('inlineImageSources', () => {
    it('should return unchanged HTML without img tags', async () => {
      const html = '<div>Hello</div>';

      expect(await inlineImageSources(html)).to.equal(html);
    });

    it('should skip data: and blob: URLs', async () => {
      const html1 = '<img src="data:image/png;base64,abc" />';
      const html2 = '<img src="blob:http://localhost/id" />';

      expect(await inlineImageSources(html1)).to.equal(html1);
      expect(await inlineImageSources(html2)).to.equal(html2);
    });

    it('should keep original URL when fetch fails', async () => {
      const html = '<img src="https://invalid.test/404.png" />';
      const result = await inlineImageSources(html);

      expect(result).to.include('https://invalid.test/404.png');
    });

    it('should handle empty HTML', async () => {
      expect(await inlineImageSources('')).to.equal('');
    });
  });
});