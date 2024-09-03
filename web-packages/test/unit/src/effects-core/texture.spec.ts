import { Texture, Player, glContext } from '@galacean/effects';

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

  it('texture from image with options', async () => {
    const testTexture = await Texture.fromImage('https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ', player.renderer.engine,
      {
        minFilter: glContext.LINEAR_MIPMAP_LINEAR,
        magFilter: glContext.LINEAR,
        wrapS: glContext.REPEAT,
        wrapT: glContext.MIRRORED_REPEAT,
      }
    );
    const textureSource = testTexture.source;

    expect(textureSource.minFilter).to.equal(glContext.LINEAR_MIPMAP_LINEAR);
    expect(textureSource.magFilter).to.equal(glContext.LINEAR);
    expect(textureSource.wrapS).to.equal(glContext.REPEAT);
    expect(textureSource.wrapT).to.equal(glContext.MIRRORED_REPEAT);
    expect(textureSource.flipY).to.be.true;
    expect(testTexture).to.be.an.instanceOf(Texture);
    expect(testTexture.width).to.be.a('number');
    expect(testTexture.height).to.be.a('number');
    expect(testTexture.id).to.be.a('string');
  });
});
