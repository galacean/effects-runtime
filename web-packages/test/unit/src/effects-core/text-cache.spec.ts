import { TextCache } from '@galacean/effects';
import { GLEngine } from '@galacean/effects-webgl';

const { expect } = chai;

describe('core/text-cache', () => {
  it('uses engine pixel ratio as atlas resolution and premultiplies alpha on upload', () => {
    const engine = new GLEngine(document.createElement('canvas'), { pixelRatio: 1 });
    const cache = new TextCache(engine);
    const atlas1x = cache.getAtlas(20, 'Arial', 'normal', 'normal');

    expect(atlas1x.resolution).to.equal(1);
    expect(atlas1x.canvas.width).to.equal(512);
    expect(atlas1x.canvas.height).to.equal(512);
    expect(atlas1x.texture.source.premultiplyAlpha).to.be.true;

    engine.pixelRatio = 2;
    const atlas2x = cache.getAtlas(20, 'Arial', 'normal', 'normal');

    expect(atlas2x).not.to.equal(atlas1x);
    expect(atlas1x.texture.isDestroyed).to.be.true;
    expect(atlas2x.resolution).to.equal(2);
    expect(atlas2x.canvas.width).to.equal(1024);
    expect(atlas2x.canvas.height).to.equal(1024);
    expect(atlas2x.texture.source.premultiplyAlpha).to.be.true;

    cache.dispose();
    engine.dispose();
  });
});
