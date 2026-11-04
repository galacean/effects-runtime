import { Engine } from '@galacean/effects-core';
import { TextCache } from '@galacean/effects';
import { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('core/text-cache', () => {
  it('uses engine pixel ratio as atlas resolution and premultiplies alpha on upload', () => {
    const engine = new Engine(document.createElement('canvas'), { pixelRatio: 1 });
    const cache = new TextCache(engine);
    const atlas1x = cache.getAtlas(20, 'Arial', 'normal', 'normal');

    atlas1x.ensureCharacters('A');
    const page1x = atlas1x.pages[0];

    expect(atlas1x.resolution).to.equal(1);
    expect(page1x.canvasAndContext.canvas.width).to.equal(512);
    expect(page1x.canvasAndContext.canvas.height).to.equal(512);
    expect(page1x.texture.source.premultiplyAlpha).to.be.true;

    engine.displayServer.pixelRatio = 2;
    const atlas2x = cache.getAtlas(20, 'Arial', 'normal', 'normal');

    atlas2x.ensureCharacters('A');
    const page2x = atlas2x.pages[0];

    expect(atlas2x).not.to.equal(atlas1x);
    expect(page1x.texture.isDestroyed).to.be.true;
    expect(atlas2x.resolution).to.equal(2);
    expect(page2x.canvasAndContext.canvas.width).to.equal(1024);
    expect(page2x.canvasAndContext.canvas.height).to.equal(1024);
    expect(page2x.texture.source.premultiplyAlpha).to.be.true;

    cache.dispose();
    engine.dispose();
  });
});
