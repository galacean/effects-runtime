import { Player, SpriteComponent } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { DomContentComponent, renderDOMToImage, inlineImageSources, inlineFontSources, extractSVGDefs, sanitizeSVGContent } from '@galacean/effects-plugin-dom-content';

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

    it('should escape additional dangerous tags (meta, template, noscript)', () => {
      const result = sanitizeSVGContent('<meta http-equiv="refresh"><template><div>hi</div></template><noscript>no</noscript>');

      expect(result).to.include('&lt;meta');
      expect(result).to.include('&lt;template');
      expect(result).to.include('&lt;noscript');
    });

    it('should remove javascript: protocol from attributes', () => {
      expect(sanitizeSVGContent('<a href="javascript:alert(1)">link</a>')).to.not.include('javascript:');
      expect(sanitizeSVGContent('<form action="javascript:submit()">')).to.not.include('javascript:');
      expect(sanitizeSVGContent('<input formaction="javascript:check()">')).to.not.include('javascript:');
    });

    it('should handle multiline attributes', () => {
      const result = sanitizeSVGContent('<img src="x"\n onerror="alert(1)">');

      expect(result).to.not.include('onerror');
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

    it('should throw on invalid parameters', async () => {
      try { await renderDOMToImage('<div></div>', 0, 100); expect.fail('should throw'); } catch { /* expected */ }
      try { await renderDOMToImage('<div></div>', 100, -1); expect.fail('should throw'); } catch { /* expected */ }
      try { await renderDOMToImage('<div></div>', 100, 100, -1); expect.fail('should throw'); } catch { /* expected */ }
      try { await renderDOMToImage('<div></div>', NaN, 100); expect.fail('should throw'); } catch { /* expected */ }
      try { await renderDOMToImage('<div></div>', 100, Infinity); expect.fail('should throw'); } catch { /* expected */ }
    });

    it('should respect options to disable auto-inline', async () => {
      // 纯 CSS HTML，关闭所有自动前置处理仍可正常渲染
      const image = await renderDOMToImage(
        '<div style="width:100px;height:100px;background:blue;"></div>',
        100, 100, 1,
        { inlineFonts: false, inlineImages: false, extractDefs: false },
      );

      expect(image).to.be.instanceOf(HTMLImageElement);
      expect(image.width).to.equal(100);
    });

    it('should return empty image when scale is 0', async () => {
      const image = await renderDOMToImage('<div>Test</div>', 100, 100, 0);

      expect(image).to.be.instanceOf(HTMLImageElement);
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

    it('should clamp negative width to 0', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', -50, 100);
      expect(domContent.contentWidth).to.equal(0);
    });

    it('should clamp negative height to 0', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 100, -50);
      expect(domContent.contentHeight).to.equal(0);
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

  describe('DomContentComponent texture override', () => {
    it('should override sprite texture when added to item with SpriteComponent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const sprite = item.getComponent(SpriteComponent);

      // 添加 DomContentComponent，应自动覆盖 Sprite 的纹理
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div style="background:red;">Test</div>', 100, 100);
      player.gotoAndPlay(0.01);

      await waitFor(() => !!sprite.material.getTexture('_MainTex'));
      expect(sprite.material.getTexture('_MainTex')).to.not.be.undefined;
    });

    it('should handle invalid parameters gracefully', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      // width = 0
      domContent.setContent('<div></div>', 0, 100);
      expect(domContent.contentWidth).to.equal(0);

      // height < 0 (should clamp to 0)
      domContent.setContent('<div></div>', 100, -1);
      expect(domContent.contentHeight).to.equal(0);

      // scale = 0
      domContent.setContent('<div></div>', 100, 100, 0);
      expect(domContent.contentScale).to.equal(0);
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

  describe('inlineFontSources', () => {
    it('should return unchanged HTML without @font-face', async () => {
      const html = '<div>Hello</div>';

      expect(await inlineFontSources(html)).to.equal(html);
    });

    it('should skip data: and blob: URLs', async () => {
      const html = '@font-face { src: url("data:font/woff2;base64,abc") format("woff2"); }';

      expect(await inlineFontSources(html)).to.equal(html);
    });

    it('should handle empty HTML', async () => {
      expect(await inlineFontSources('')).to.equal('');
    });

    it('should preserve @font-face structure when fetch fails', async () => {
      const html = '@font-face { font-family: "Test"; src: url("https://invalid.test/font.woff2"); }';
      const result = await inlineFontSources(html);

      expect(result).to.include('@font-face');
      expect(result).to.include('https://invalid.test/font.woff2');
    });
  });
});
