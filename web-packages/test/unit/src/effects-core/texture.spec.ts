import { Texture, Player } from '@galacean/effects';

const { expect } = chai;

describe('core/texture', () => {
  let player: Player;

  before(() => {
    const canvas = document.createElement('canvas');
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player && player.dispose();
  });

  // 图片纹理
  it('texture from image', async () => {
    const testTexture = await Texture.fromImage('https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ', player.renderer.engine);

    expect(testTexture).to.be.an.instanceOf(Texture);
    expect(testTexture.width).to.be.a('number');
    expect(testTexture.height).to.be.a('number');
    expect(testTexture.id).to.be.a('string');
  });
});
