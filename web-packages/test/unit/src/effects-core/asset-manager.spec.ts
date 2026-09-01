import { AssetManager, TextureSourceType, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/asset-manager', () => {
  let assetManager: AssetManager;

  before(() => {
  });

  after(() => {
    assetManager?.dispose();
  });

  it('default use compressed texture and hevc video', () => {
    assetManager = new AssetManager();

    expect(assetManager.options.useCompressedTexture).to.eql(true);
    expect(assetManager.options.useHevcVideo).to.eql(true);

    assetManager.updateOptions({
      useCompressedTexture: undefined,
      useHevcVideo: undefined,
    });

    expect(assetManager.options.useCompressedTexture).to.eql(true);
    expect(assetManager.options.useHevcVideo).to.eql(true);
  });

  it('can disable compressed texture and hevc video', () => {
    assetManager = new AssetManager({
      useCompressedTexture: false,
      useHevcVideo: false,
    });

    expect(assetManager.options.useCompressedTexture).to.eql(false);
    expect(assetManager.options.useHevcVideo).to.eql(false);
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
    const url = 'data:video/mp4;base64,AAAA';
    const text = 'Dynamic Video';
    const restoreMediaPlayback = stubMediaPlayback();
    const json = {
      playerVersion: { web: '1.4.3' },
      images: [{
        template: {
          width: 1,
          height: 1,
          variables: { video: url },
          background: { name: 'video', url, type: spec.BackgroundType.video },
        },
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZAAAAABJRU5ErkJggg==',
        renderLevel: spec.RenderLevel.BPlus,
      }],
      fonts: [],
      spines: [],
      version: '2.4',
      shapes: [],
      plugins: [],
      type: 'ge',
      compositions: [{
        id: '1',
        name: 'video variable',
        duration: 1,
        startTime: 0,
        endBehavior: 1,
        previewSize: [1, 1],
        items: [{
          id: 'text',
          name: 'text_3',
          duration: 1,
          type: 'text',
          visible: true,
          endBehavior: 1,
          delay: 0,
          content: {
            options: { text: 'Original Text' },
            renderer: { renderMode: 1 },
          },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        }],
        camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
      }],
      compositionId: '1',
      bins: [],
      textures: [{ source: 0, flipY: true }],
    };

    try {
      assetManager = new AssetManager({
        variables: {
          video: url,
          text_3: text,
        },
      });
      const scene = await assetManager.loadScene(json);

      expect((scene.images[0] as HTMLVideoElement).src).to.eql(url);
      expect(scene.textureOptions[0].sourceType).to.eql(TextureSourceType.video);
      expect(scene.textureOptions[0].video.src).to.eql(url);
      expect(scene.jsonScene.items[0].content.options.text).to.not.eql(text);
    } finally {
      restoreMediaPlayback();
    }
  });
});

function stubMediaPlayback (): () => void {
  const originalPlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function () {
    queueMicrotask(() => { this.dispatchEvent(new Event('canplay')); });

    return Promise.resolve();
  };

  return () => { HTMLMediaElement.prototype.play = originalPlay; };
}
