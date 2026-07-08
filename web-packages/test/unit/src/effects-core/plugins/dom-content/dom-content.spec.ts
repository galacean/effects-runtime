import { Player, SpriteComponent } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { DomContentComponent, renderDOMToImage, inlineImageSources, inlineFontSources, extractSVGDefs, sanitizeSVGContent } from '@galacean/effects-plugin-dom-content';

const { expect } = chai;

// 本地内联的最小场景 JSON，包含 place_holder sprite item，避免依赖远程 URL
const json = JSON.parse('{"compositionId":1,"requires":[],"compositions":[{"name":"dom_content_test","id":1,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"items":[{"name":"place_holder","delay":0,"id":1,"type":"1","ro":0.1,"sprite":{"options":{"startLifetime":2,"startSize":1.2,"sizeAspect":1,"startColor":["color",[255,255,255]],"duration":2,"gravityModifier":1,"renderLevel":"B+"},"renderer":{"renderMode":1}}}],"meta":{"previewSize":[750,1334]}}],"gltf":[],"images":[],"version":"0.9.0","shapes":[],"plugins":[],"type":"mars","_imgs":{"1":[]}}');

/** 轮询等待条件满足 */
async function waitFor (predicate: () => boolean, timeout = 2000, interval = 50): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (predicate()) { return; }
    await new Promise(resolve => { setTimeout(resolve, interval); });
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * 拦截 XMLHttpRequest，捕获 open 时传入的 URL；mode 决定 send 后触发的事件。
 * - 'error' 模式：模拟网络失败，inlineImageSources 走 catch，HTML 原文保留
 * - 'success' 模式：返回一段最小 PNG Blob，让 base64 替换路径完整跑一遍
 */
function stubXHRCapture (mode: 'error' | 'success'): { urls: string[], restore: () => void } {
  const urls: string[] = [];
  const OriginalXHR = globalThis.XMLHttpRequest;
  // 最小 PNG 头字节，让 FileReader 能产出 data:image/png;base64,...
  const tinyPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  class MockXHR {
    onloadHandler: ((e: Event) => void) | null = null;
    onerrorHandler: ((e: Event) => void) | null = null;
    status = 0;
    response: Blob | null = null;
    responseType: XMLHttpRequestResponseType = '';
    addEventListener (event: string, handler: (e: Event) => void) {
      if (event === 'load') { this.onloadHandler = handler; }
      if (event === 'error') { this.onerrorHandler = handler; }
    }
    open (_method: string, url: string) { urls.push(url); }
    send () {
      setTimeout(() => {
        if (mode === 'success') {
          this.status = 200;
          this.response = new Blob([tinyPng], { type: 'image/png' });
          this.onloadHandler?.(new Event('load'));
        } else {
          this.onerrorHandler?.(new Event('error'));
        }
      }, 0);
    }
  }

  globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

  return { urls, restore: () => { globalThis.XMLHttpRequest = OriginalXHR; } };
}

describe('plugin/dom-content', () => {
  let player: Player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), pixelRatio: 1, manualRender: true });
  });

  after(() => { player?.dispose(); });

  describe('sanitizeSVGContent', () => {
    it('should preserve safe tags (div, span, svg, img)', () => {
      const html = '<div><span>hi</span><svg><circle/></svg><img src="data:image/png;base64,abc"/></div>';

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
      // place_holder 自带 SpriteComponent，DomContentComponent 会绑定到 sprite 并写入其纹理
      const sprite = item.getComponent(SpriteComponent);
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div style="background:red;">Test</div>', 100, 100);
      player.gotoAndPlay(0.01);

      await waitFor(() => !!sprite.material.getTexture('_MainTex'));
      expect(sprite.material.getTexture('_MainTex')).to.not.be.undefined;
    });

    it('should not render with empty content or invalid dimensions', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const sprite = item.getComponent(SpriteComponent);
      const initialTexture = sprite.material.getTexture('_MainTex');
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('', 100, 100);
      player.gotoAndPlay(0.01);
      await new Promise(_resolve => { setTimeout(_resolve, 100); });
      // 空内容不应触发纹理替换，sprite 纹理应保持不变
      expect(sprite.material.getTexture('_MainTex')).to.equal(initialTexture);

      domContent.setContent('<div>Test</div>', 0, 0);
      player.gotoAndPlay(0.01);
      await new Promise(_resolve => { setTimeout(_resolve, 100); });
      expect(sprite.material.getTexture('_MainTex')).to.equal(initialTexture);
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
      // 使用 fetch stub 模拟网络失败，避免依赖 DNS 解析
      const originalFetch = globalThis.fetch;

      globalThis.fetch = () => Promise.reject(new Error('Network error'));
      try {
        const html = '<img src="https://example.com/404.png" />';
        const result = await inlineImageSources(html);

        expect(result).to.include('https://example.com/404.png');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle empty HTML', async () => {
      expect(await inlineImageSources('')).to.equal('');
    });

    it('should HTML-decode entity-encoded URLs before fetching', async () => {
      // Bug fix: <img src="...?a=1&amp;b=2"> 的 src 提取出字面 "&amp;"，
      // 若直接拿去 fetch，CDN 收到 "amp;b=2" 视为非法参数名，普遍返回 404。
      const captured = stubXHRCapture('error');

      try {
        const html = '<img src="https://example.com/img.png?a=1&amp;b=2" />';
        const result = await inlineImageSources(html);

        expect(captured.urls).to.have.lengthOf(1);
        expect(captured.urls[0]).to.equal('https://example.com/img.png?a=1&b=2');
        // 替换路径以原始字符串为 key，fetch 失败时 HTML 原文保留
        expect(result).to.include('&amp;');
      } finally {
        captured.restore();
      }
    });

    it('should keep src wrapped in quotes after base64 replacement for unquoted attributes', async () => {
      // Bug fix: <img src=https://...> 无引号时，base64 含 ;,/= 等字符
      // 若不补引号会被 HTML parser 在首个分号处截断，导致 src 失效。
      const captured = stubXHRCapture('success');

      try {
        const html = '<img src=https://example.com/x.png />';
        const result = await inlineImageSources(html);

        expect(result).to.match(/src="data:image\/png;base64,[^"]+"/);
        expect(result).to.not.match(/src=data:/);
      } finally {
        captured.restore();
      }
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
      // 使用 fetch stub 模拟网络失败，避免依赖 DNS 解析
      const originalFetch = globalThis.fetch;

      globalThis.fetch = () => Promise.reject(new Error('Network error'));
      try {
        const html = '@font-face { font-family: "Test"; src: url("https://example.com/font.woff2"); }';
        const result = await inlineFontSources(html);

        expect(result).to.include('@font-face');
        expect(result).to.include('https://example.com/font.woff2');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
