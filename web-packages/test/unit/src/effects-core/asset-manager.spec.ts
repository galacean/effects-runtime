import { AssetManager, TextureSourceType, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/asset-manager', () => {
  let assetManager: AssetManager;

  before(() => {
  });

  after(() => {
    assetManager?.dispose();
  });

  it('scene renderLevel is right when pass options', async () => {
    assetManager = new AssetManager({
      renderLevel: spec.RenderLevel.B,
    });
    const scene = await assetManager.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*GC99RbcyZiMAAAAAAAAAAAAADlB4AQ');

    expect(scene.renderLevel).to.eql(spec.RenderLevel.B);
  });

  it('scene renderLevel is right when not pass options', async () => {
    assetManager = new AssetManager();
    const scene = await assetManager.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*GC99RbcyZiMAAAAAAAAAAAAADlB4AQ');

    expect(scene.renderLevel).to.eql(undefined);
  });

  it('image replace right when pass variables', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
    const url = 'https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*ySrfRJvfvfQAAAAAAAAAAAAADvV6AQ/original';

    assetManager = new AssetManager({
      variables: {
        image: url,
      },
    });
    const scene = await assetManager.loadScene(json);

    expect((scene.images[0] as HTMLImageElement).src).to.eql(url);
    expect(scene.textureOptions[0].image.src).to.eql(url);
  });

  it('video replace right when pass variables', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*kENFRbxlKcUAAAAAAAAAAAAADlB4AQ';
    const url = 'https://gw.alipayobjects.com/v/huamei_p0cigc/afts/video/A*7gPzSo3RxlQAAAAAAAAAAAAADtN3AQ';
    const text = 'Dynamic Video';

    assetManager = new AssetManager({
      variables: {
        video: url,
        text_3: text,
      },
    });
    const scene = await assetManager.loadScene(json);

    expect((scene.images[1] as HTMLVideoElement).src).to.eql(url);
    expect(scene.textureOptions[1].sourceType).to.eql(TextureSourceType.video);
    expect(scene.textureOptions[1].video.src).to.eql(url);
    expect(scene.jsonScene.items[0].content.options.text).to.not.eql(text);
  });
});
