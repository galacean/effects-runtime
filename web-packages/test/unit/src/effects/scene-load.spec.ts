import type { Texture2DSourceOptionsVideo } from '@galacean/effects';
import { AssetManager, Player, SpriteComponent, TextComponent, spec } from '@galacean/effects';
import { cubeTexture1, cubeTexture2 } from '../../../assets/cube-texture';

const { expect } = chai;

describe('player/scene-load', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('加载单个合成链接并设置可选参数', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*de0NTrRAyzoAAAAAAAAAAAAADlB4AQ';
    const variables = {
      'image1': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*st1QSIvJEBcAAAAAAAAAAAAADt_KAQ/original',
    };

    await player.loadScene(json, { variables });

    // @ts-expect-error
    expect(player.getAssetManager().find(d => d.baseUrl === json)?.options.variables).to.eql(variables);
  });

  it('加载单个合成 JSONValue 并设置可选参数', async () => {
    const json = JSON.parse('{"playerVersion":{"web":"1.3.0","native":"0.0.1.202311221223"},"images":[{"template":{"v":2,"variables":{"image1":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original"},"width":300,"height":388,"background":{"name":"image2","url":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original","type":"image"}},"url":"https://mdn.alipayobjects.com/mars/afts/img/A*_aDmQ6X7laUAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*lrr9Tb2hIYcAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.2","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"2","name":"新建合成2","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[3.6924,4.7756,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"2","bins":[],"textures":[{"source":0,"flipY":true}]}');
    const variables = {
      'image2': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*oelLS68rL4kAAAAAAAAAAAAADt_KAQ/original',
    };

    await player.loadScene(json, { variables });

    // @ts-expect-error
    expect(player.getAssetManager().at(-1).options.variables).to.eql(variables);
  });

  it('加载多个合成链接并各自设置可选参数', async () => {
    const json1 = 'https://mdn.alipayobjects.com/mars/afts/file/A*T1U4SqWhvioAAAAAAAAAAAAADlB4AQ';
    const json2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*de0NTrRAyzoAAAAAAAAAAAAADlB4AQ';
    const variables1 = {
      'avatar1': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*st1QSIvJEBcAAAAAAAAAAAAADt_KAQ/original',
      'avatar2': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*oelLS68rL4kAAAAAAAAAAAAADt_KAQ/original',
    };
    const variables2 = {
      'image1': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*st1QSIvJEBcAAAAAAAAAAAAADt_KAQ/original',
    };

    const [composition1, composition2] = await player.loadScene([{
      url: json1,
      options: {
        variables: variables1,
        speed: 2,
      },
    }, {
      url: json2,
      options: {
        variables: variables2,
      },
    }]);

    // @ts-expect-error
    expect(player.getAssetManager().find(d => d.baseUrl === json1)?.options.variables).to.eql(variables1);
    // @ts-expect-error
    expect(player.getAssetManager().find(d => d.baseUrl === json2)?.options.variables).to.eql(variables2);
    expect(composition1.getSpeed()).to.eql(2);
    expect(composition2.getSpeed()).to.eql(1);
  });

  it('加载多个合成链接并统一设置可选参数', async () => {
    const json1 = 'https://mdn.alipayobjects.com/mars/afts/file/A*T1U4SqWhvioAAAAAAAAAAAAADlB4AQ';
    const json2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*de0NTrRAyzoAAAAAAAAAAAAADlB4AQ';

    const [composition1, composition2] = await player.loadScene([{
      url: json1,
    }, {
      url: json2,
    }], {
      speed: 2,
    });

    expect(composition1.getSpeed()).to.eql(2);
    expect(composition2.getSpeed()).to.eql(2);
  });

  it('load json fail with msg', async () => {
    const spy = chai.spy();

    try {
      await player.loadScene('https://www.galacean.com/effects/', { timeout: 5 });
    } catch (e: any) {
      expect(e.message).to.include('Load error in loadJSON');
      spy();
    }
    expect(spy).to.has.been.called.once;
  });

  it('load timeout', async () => {
    const spy = chai.spy() as ChaiSpies.SpyFunc1Proxy<number, void>;

    try {
      await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*GXqISoCVTuEAAAAAAAAAAAAADlB4AQ', { timeout: 0.001 });
    } catch (e: any) {
      expect(e.message).to.include('Load time out');
      spy(1);
    }
    expect(spy).to.has.been.called.with(1);
  });

  it('toggle png when webp fails', async () => {
    const png = 'https://mdn.alipayobjects.com/mars/afts/img/A*_aDmQ6X7laUAAAAAAAAAAAAADlB4AQ/original';
    const json = getJSONWithImageURL(png, 'https://mdn.alipayobjects.com/error');
    const scene = await player.loadScene(json);

    expect(scene.textures[0].sourceFrom).to.contains({ url: png });
  });

  it('load image fail with msg', async () => {
    const json = getJSONWithImageURL('https://mdn.alipayobjects.com/error');
    const spy = chai.spy();

    try {
      await player.loadScene(json);
    } catch (e: any) {
      expect(e.message).to.include('Load error in processImages');
      spy();
    }
    expect(spy).to.has.been.called.once;
  });

  it('load template image fail with msg', async () => {
    const json = JSON.parse('{"playerVersion":{"web":"1.3.0","native":"0.0.1.202311221223"},"images":[{"template":{"v":2,"variables":{"image1":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original"},"width":300,"height":388,"background":{"name":"image1","url":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original","type":"image"}},"url":"https://mdn.alipayobjects.com/mars/afts/img/A*_aDmQ6X7laUAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*lrr9Tb2hIYcAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.2","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"2","name":"新建合成2","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[3.6924,4.7756,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"2","bins":[],"textures":[{"source":0,"flipY":true}]}');
    const spy = chai.spy();

    try {
      await player.loadScene(json, {
        variables: {
          'image1': 'https://mdn.alipayobjects.com/error',
        },
      });
    } catch (e: any) {
      expect(e.message).to.include('Failed to load. Check the template or if the URL is image type');
      spy();
    }
    expect(spy).to.has.been.called.once;
  });

  it('load bin fail with url', async () => {
    const json = JSON.parse('{"bins":[{"url":"https://mdn.alipayobjects.com/error"}],"images":[],"compositions":[{"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1},"duration":5,"id":"1","items":[{"type":"3","name":"parent","id":"1","duration":2,"endBehavior":5,"content":{"options":{},"rotationOverLifetime":{"separateAxes":true,"y":[0,180]}},"transform":{"rotation":[0,45,0]}}]}],"version":"1.3","compositionId":"1"}');
    const spy = chai.spy();

    try {
      await player.loadScene(json);
    } catch (e: any) {
      expect(e.message).to.include('Load error in processBins');
      spy();
    }
    expect(spy).to.has.been.called.once;
  });

  it('load scene with varible text', async () => {
    const compostion = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*_QkURKxu0TEAAAAAAAAAAAAADlB4AQ', {
      variables: {
        text_908: 'ttt',
      },
    });
    const textComponent = compostion.getItemByName('text_908')?.getComponent(TextComponent);

    expect(textComponent?.text).to.eql('ttt');
  });

  it('load scene with different text variables', async () => {
    const [composition1, composition2] = await player.loadScene([{
      url: 'https://mdn.alipayobjects.com/mars/afts/file/A*_QkURKxu0TEAAAAAAAAAAAAADlB4AQ',
      options: {
        variables: {
          text_908: 'ttt',
        },
      },
    }, {
      url: 'https://mdn.alipayobjects.com/mars/afts/file/A*_QkURKxu0TEAAAAAAAAAAAAADlB4AQ',
      options: {
        variables: {
          text_908: 'xxx',
        },
      },
    }]);
    const t1 = composition1.getItemByName('text_908')?.getComponent(TextComponent);
    const t2 = composition2.getItemByName('text_908')?.getComponent(TextComponent);

    expect(t1?.text).to.eql('ttt');
    expect(t2?.text).to.eql('xxx');
  });

  it('success load json object by assetManager', async () => {
    const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
    const [json] = await Promise.all([
      fetch(url).then(res => res.text()),
    ]);
    const data = JSON.parse(json);
    const assetManager = new AssetManager();
    const scene = await assetManager.loadScene(data);
    const spy = chai.spy();

    try {
      await player.loadScene(scene);
    } catch (e: any) {
      spy();
    }
    expect(spy).not.to.have.been.called();
  });

  it('success load multi-data type by assetManager', async () => {
    const url1 = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/SDNRPIJFENBK/-1998534768-39820.json';
    const url2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
    const image = 'https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*ySrfRJvfvfQAAAAAAAAAAAAADvV6AQ/original';
    const [json] = await Promise.all([
      fetch(url1).then(res => res.text()),
    ]);
    const data = JSON.parse(json);
    const assetManager = new AssetManager({
      renderLevel: spec.RenderLevel.S,
      variables: {
        image,
      },
    });
    const scene1 = await assetManager.loadScene(data);
    const scene2 = await assetManager.loadScene(url2);
    const spy = chai.spy();

    expect(scene1.renderLevel).to.eql(spec.RenderLevel.S);
    expect(scene2.renderLevel).to.eql(spec.RenderLevel.S);

    try {
      const [composition1, composition2] = await player.loadScene([scene1, { url: scene2 }], {
        speed: 2,
      });
      const item = composition2.getItemByName('sprite_1');
      const spriteComponent = item?.getComponent(SpriteComponent);

      expect(spriteComponent?.renderer.texture.sourceFrom).to.contains({ url: image });
      expect(composition1.getSpeed()).to.eql(2);
      expect(composition2.getSpeed()).to.eql(2);
    } catch (e: any) {
      spy();
    }
    expect(spy).not.to.have.been.called();
  });

  it('load scene with template video', async () => {
    const videoUrl = 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ';
    const images = [{
      'id': 'test',
      'template': {
        'width': 126,
        'height': 130,
        'background': {
          'type': spec.BackgroundType.video,
          'name': 'test',
          'url': videoUrl,
        },
      },
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*oKwARKdkWhEAAAAAAAAAAAAADlB4AQ/original',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*eOLVQpT57FcAAAAAAAAAAAAADlB4AQ/original',
      'renderLevel': spec.RenderLevel.BPlus,
    }];

    const composition = await player.loadScene(getJSONWithImages(images));
    const textures = composition.textures;
    const videoElement = (textures[0].source as Texture2DSourceOptionsVideo).video;

    expect(textures.length).to.deep.equals(1);
    expect(textures[0].source).to.not.be.empty;
    expect(videoElement).to.be.an.instanceOf(HTMLVideoElement);
    expect(videoElement.src).to.be.equals(videoUrl);
  });

  it('load scene with template video on variables', async () => {
    const videoUrl = 'https://gw.alipayobjects.com/v/huamei_p0cigc/afts/video/A*dftzSq2szUsAAAAAAAAAAAAADtN3AQ';
    const images = [{
      'id': 'test',
      'template': {
        'width': 126,
        'height': 130,
        'background': {
          'type': spec.BackgroundType.video,
          'name': 'test',
          'url': 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
        },
      },
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*oKwARKdkWhEAAAAAAAAAAAAADlB4AQ/original',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*eOLVQpT57FcAAAAAAAAAAAAADlB4AQ/original',
      'renderLevel': spec.RenderLevel.BPlus,
    }];

    const composition = await player.loadScene(getJSONWithImages(images), {
      variables: {
        // 视频地址
        test: videoUrl,
      },
    });
    const textures = composition.textures;
    const videoElement = (textures[0].source as Texture2DSourceOptionsVideo).video;

    expect(videoElement).to.be.an.instanceOf(HTMLVideoElement);
    expect(videoElement.src).to.be.equals(videoUrl);
  });

  it('load cube texture', async () => {
    const scene = await player.loadScene(cubeTexture1);
    const mipmaps = scene.textures[0].taggedProperties.mipmaps as (HTMLImageElement | ImageBitmap)[][];

    expect(mipmaps.length).to.eql(cubeTexture1.textures[0].mipmaps.length);
    expect(mipmaps.every(mipmap => mipmap.every(img => img instanceof HTMLImageElement || img instanceof ImageBitmap))).to.be.true;
  });

  it('load cube textures fail', async () => {
    const spy = chai.spy();

    await player.loadScene(cubeTexture2).catch(e => {
      expect(e.message).to.include('Error: Load texture 0 fails');
      spy();
    });
    expect(spy).to.has.been.called.once;
  });
});

function getJSONWithImageURL (url: string, webp?: string) {
  return JSON.parse(`{"playerVersion":{"web":"1.3.0","native":"0.0.1.202311221223"},"images":[{"url":"${url}","webp":"${webp ?? url}","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.2","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"2","name":"新建合成2","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0,0,0.5859375,0.7578125,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[3.6924,4.7756,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"2","bins":[],"textures":[{"source":0,"flipY":true}]}`);
}

function getJSONWithImages (images: spec.TemplateImage[]) {
  return JSON.parse(`{"playerVersion":{"web":"1.2.1","native":"0.0.1.202311221223"},"images":${JSON.stringify(images)},"version":"2.2","type":"ge","compositions":[{"id":"1","name":"新建合成1","duration":5,"startTime":0,"endBehavior":0,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[0.9529,1,0.0431,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"path":[12,[[[0,0,0,2.3256],[0.43,1,2.3256,3.4483],[0.72,2,3.4483,0]],[[0,0,0],[0,7.79,0],[3.3269,7.79,0]],[[0,1.9475,0],[0,5.8425,0],[0.8317,7.79,0],[2.4952,7.79,0]]]],"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[6,[[0.126,1.2055,0,1.6835],[0.72,2.5395,1.6835,0]]]},"colorOverLifetime":{"opacity":[6,[[0,0,0,1.3889],[0.72,1,1.3889,0]]]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.5492,1.5984,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"1","bins":[],"textures":[{"source":0,"flipY":true}]}`);
}
