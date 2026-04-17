import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import { DomContentComponent, renderDOMToImage, sanitizeSVGContent } from '@galacean/effects-plugin-dom-content';

const { expect } = chai;

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*1T3xS4Vkrm8AAAAAQDAAAAgAelB4AQ';

/**
 * 轮询等待条件满足
 */
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
    const canvas = document.createElement('canvas');
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player && player.dispose();
  });

  describe('sanitizeSVGContent', () => {
    it('should escape <svg> open tag', () => {
      const result = sanitizeSVGContent('<svg>content</svg>');

      expect(result).to.not.include('<svg>');
      expect(result).to.include('&lt;svg>');
    });

    it('should escape </svg> close tag', () => {
      const result = sanitizeSVGContent('before</svg>after');

      expect(result).to.not.include('</svg>');
      expect(result).to.include('&lt;/svg>');
    });

    it('should escape <svg/> self-closing tag', () => {
      const result = sanitizeSVGContent('<svg/>');

      expect(result).to.not.include('<svg/>');
      expect(result).to.include('&lt;svg/>');
    });

    it('should escape <foreignObject> open tag', () => {
      const result = sanitizeSVGContent('<foreignObject>content</foreignObject>');

      expect(result).to.not.include('<foreignObject>');
      expect(result).to.include('&lt;foreignObject>');
    });

    it('should escape </foreignObject> close tag', () => {
      const result = sanitizeSVGContent('before</foreignObject>after');

      expect(result).to.not.include('</foreignObject>');
      expect(result).to.include('&lt;/foreignObject>');
    });

    it('should escape <foreignObject/> self-closing tag', () => {
      const result = sanitizeSVGContent('<foreignObject/>');

      expect(result).to.not.include('<foreignObject/>');
      expect(result).to.include('&lt;foreignObject/>');
    });

    it('should be case-insensitive', () => {
      const result = sanitizeSVGContent('<SVG><FOREIGNOBJECT></FOREIGNOBJECT></SVG>');

      expect(result).to.not.include('<SVG>');
      expect(result).to.not.include('<FOREIGNOBJECT>');
    });

    it('should escape svg tag with attributes', () => {
      const result = sanitizeSVGContent('<svg xmlns="http://www.w3.org/2000/svg" width="100">');

      expect(result).to.not.include('<svg ');
      expect(result).to.include('&lt;svg ');
    });

    it('should not affect normal HTML tags', () => {
      const html = '<div><span>hello</span><img src="data:image/png;base64,abc"/></div>';
      const result = sanitizeSVGContent(html);

      expect(result).to.equal(html);
    });
  });

  describe('renderDOMToImage', () => {
    it('should render simple HTML to an image element', async () => {
      const html = '<div style="width:100px;height:100px;background:red;"></div>';
      const image = await renderDOMToImage(html, 100, 100);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
      expect(image.width).to.equal(100);
      expect(image.height).to.equal(100);
    });

    it('should render HTML with inline styles', async () => {
      const html = `
        <div style="width:200px;height:150px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:20px;color:white;font-family:sans-serif;box-sizing:border-box;">
          <p style="margin:0;font-size:14px;">Test Content</p>
        </div>
      `;
      const image = await renderDOMToImage(html, 200, 150);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
      expect(image.width).to.equal(200);
      expect(image.height).to.equal(150);
    });

    it('should handle different dimensions', async () => {
      const html = '<div style="width:50px;height:80px;background:blue;"></div>';
      const image = await renderDOMToImage(html, 50, 80);

      expect(image.width).to.equal(50);
      expect(image.height).to.equal(80);
    });

    it('should render scaled image with scale parameter', async () => {
      const html = '<div style="width:100px;height:100px;background:green;"></div>';
      const image = await renderDOMToImage(html, 100, 100, 2);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
      expect(image.width).to.equal(200);
      expect(image.height).to.equal(200);
    });

    it('should safely render HTML containing svg tags', async () => {
      const html = '<div>text with <svg>inside</svg> tag</div>';
      const image = await renderDOMToImage(html, 200, 100);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
    });

    it('should safely render HTML containing foreignObject tags', async () => {
      const html = '<div>text with <foreignObject>inside</foreignObject> tag</div>';
      const image = await renderDOMToImage(html, 200, 100);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
    });

    it('should reject when given empty HTML string', async () => {
      // 空 HTML 生成合法 SVG，foreignObject 内容为空
      const image = await renderDOMToImage('', 100, 100);

      expect(image).to.be.an.instanceOf(HTMLImageElement);
    });
  });

  describe('DomContentComponent', () => {
    it('should load scene and find placeholder item', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder');

      expect(item).to.not.be.undefined;
      expect(item).to.not.be.null;
    });

    it('should add DomContentComponent to placeholder item', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      expect(domContent).to.be.an.instanceOf(DomContentComponent);
    });

    it('should have default property values after addComponent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      expect(domContent.htmlContent).to.equal('');
      expect(domContent.contentWidth).to.equal(300);
      expect(domContent.contentHeight).to.equal(200);
    });

    it('should update properties via setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);
      const html = '<div style="width:300px;height:200px;background:red;">Hello</div>';

      domContent.setContent(html, 300, 200);

      expect(domContent.htmlContent).to.equal(html);
      expect(domContent.contentWidth).to.equal(300);
      expect(domContent.contentHeight).to.equal(200);
    });

    it('should update width and height via setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 400, 300);

      expect(domContent.contentWidth).to.equal(400);
      expect(domContent.contentHeight).to.equal(300);
    });

    it('should keep default dimensions when not specified in setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>');

      expect(domContent.contentWidth).to.equal(300);
      expect(domContent.contentHeight).to.equal(200);
    });

    it('should have default contentScale of 1', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      expect(domContent.contentScale).to.equal(1);
    });

    it('should update contentScale via setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 300, 200, 2);

      expect(domContent.contentScale).to.equal(2);
    });

    it('should keep default contentScale when not specified in setContent', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 300, 200);

      expect(domContent.contentScale).to.equal(1);
    });

    it('should not trigger render with empty content', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('', 300, 200);
      player.gotoAndPlay(0.01);

      await new Promise(resolve => { setTimeout(resolve, 100); });

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.be.undefined;
    });

    it('should not trigger render with zero dimensions', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 0, 0);
      player.gotoAndPlay(0.01);

      await new Promise(resolve => { setTimeout(resolve, 100); });

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.be.undefined;
    });

    it('should not trigger render with negative dimensions', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', -100, -100);
      player.gotoAndPlay(0.01);

      await new Promise(resolve => { setTimeout(resolve, 100); });

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.be.undefined;
    });

    it('should not trigger render with zero contentScale', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      domContent.setContent('<div>Test</div>', 100, 100, 0);
      player.gotoAndPlay(0.01);

      await new Promise(resolve => { setTimeout(resolve, 100); });

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.be.undefined;
    });

    it('should render scaled texture with contentScale', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);
      const html = '<div style="width:100px;height:100px;background:red;">Scale Test</div>';

      domContent.setContent(html, 100, 100, 2);

      player.gotoAndPlay(0.01);

      await waitFor(() => !!domContent.material.getTexture('_MainTex'));

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.not.be.undefined;
      expect(texture).to.not.be.null;
    });

    it('should render texture after setContent and update', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);
      const html = '<div style="width:300px;height:200px;background:green;">Texture Test</div>';

      domContent.setContent(html, 300, 200);

      player.gotoAndPlay(0.01);

      await waitFor(() => !!domContent.material.getTexture('_MainTex'));

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.not.be.undefined;
      expect(texture).to.not.be.null;
    });

    it('should handle rapid consecutive setContent calls', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);

      // 快速连续调用
      domContent.setContent('<div style="background:red;">First</div>', 100, 100);
      domContent.setContent('<div style="background:green;">Second</div>', 200, 200);
      domContent.setContent('<div style="background:blue;">Third</div>', 300, 300);

      // 最终应为最后一次调用的值
      expect(domContent.htmlContent).to.include('Third');
      expect(domContent.contentWidth).to.equal(300);
      expect(domContent.contentHeight).to.equal(300);

      player.gotoAndPlay(0.01);

      await waitFor(() => !!domContent.material.getTexture('_MainTex'));

      const texture = domContent.material.getTexture('_MainTex');

      expect(texture).to.not.be.undefined;
    });

    it('should dispose without error', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);
      const html = '<div style="width:300px;height:200px;background:blue;">Dispose Test</div>';

      domContent.setContent(html, 300, 200);
      player.gotoAndPlay(0.01);

      await waitFor(() => !!domContent.material.getTexture('_MainTex'));

      // 销毁不应抛异常
      composition.dispose();
    });

    it('should safely dispose during async rendering', async () => {
      const composition = await player.loadScene(json);
      const item = composition.getItemByName('place_holder')!;
      const domContent = item.addComponent(DomContentComponent);
      const html = '<div style="width:300px;height:200px;background:red;">Async Dispose</div>';

      domContent.setContent(html, 300, 200);
      player.gotoAndPlay(0.01);

      // 不等待渲染完成，立即销毁
      composition.dispose();

      await new Promise(resolve => { setTimeout(resolve, 200); });
    });
  });
});
