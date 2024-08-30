import { Player, TextComponent } from '@galacean/effects';

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
    expect(player.assetManagers.find(d => d.baseUrl === json).options.variables).to.eql(variables);
  });

  it('加载单个合成 JSONValue 并设置可选参数', async () => {
    const json = JSON.parse('{"playerVersion":{"web":"1.3.0","native":"0.0.1.202311221223"},"images":[{"template":{"v":2,"variables":{"image1":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original"},"width":300,"height":388,"background":{"name":"image2","url":"https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*7JCcSpJ3lVsAAAAAAAAAAAAADsF2AQ/original","type":"image"}},"url":"https://mdn.alipayobjects.com/mars/afts/img/A*_aDmQ6X7laUAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*lrr9Tb2hIYcAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.2","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"2","name":"新建合成2","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[3.6924,4.7756,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"2","bins":[],"textures":[{"source":0,"flipY":true}]}');
    const variables = {
      'image2': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*oelLS68rL4kAAAAAAAAAAAAADt_KAQ/original',
    };

    await player.loadScene(json, { variables });

    // @ts-expect-error
    expect(player.assetManagers[1].options.variables).to.eql(variables);
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

    // @ts-expect-error
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
    expect(player.assetManagers.find(d => d.baseUrl === json1).options.variables).to.eql(variables1);
    // @ts-expect-error
    expect(player.assetManagers.find(d => d.baseUrl === json2).options.variables).to.eql(variables2);
    expect(composition1.getSpeed()).to.eql(2);
    expect(composition2.getSpeed()).to.eql(1);
  });

  it('加载多个合成链接并统一设置可选参数', async () => {
    const json1 = 'https://mdn.alipayobjects.com/mars/afts/file/A*T1U4SqWhvioAAAAAAAAAAAAADlB4AQ';
    const json2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*de0NTrRAyzoAAAAAAAAAAAAADlB4AQ';

    // @ts-expect-error
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
      await player.loadScene('https://galacean.antgroup.com/effects/', { timeout: 5 });
    } catch (e: any) {
      expect(e.message).to.include('Load error in processJSON');
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

  // TODO 未通过 先注释
  // it('load cube texture demo2', async () => {
  //   const json = {
  //     'compositionId': 1,
  //     'requires': [],
  //     'compositions': [{
  //       'name': 'composition_1',
  //       'id': 1,
  //       'duration': 5,
  //       'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
  //       'items': [{
  //         'name': '11111',
  //         'delay': 0,
  //         'id': 2,
  //         'type': '1',
  //         'ro': 0.1,
  //         'sprite': {
  //           'options': {
  //             'startLifetime': 2,
  //             'startSize': 0.8355836885408324,
  //             'sizeAspect': 1.1403508771929824,
  //             'startColor': [8, [255, 255, 255]],
  //             'duration': 2,
  //             'gravityModifier': 1,
  //             'renderLevel': 'B+',
  //           }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
  //         },
  //       }],
  //       'meta': { 'previewSize': [0, 0] },
  //     }],
  //     'gltf': [],
  //     'images': [],
  //     'version': '0.9.0',
  //     'shapes': [],
  //     'plugins': [],
  //     'bins': [
  //       { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data0.bin' },
  //       { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data1.bin' },
  //       { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data2.bin' },
  //       { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data3.bin' },
  //     ],
  //     'textures': [
  //       {
  //         'mipmaps': [
  //           [
  //             [20, [3, 0, 113649]],
  //             [20, [3, 113652, 103308]],
  //             [20, [3, 216960, 73885]],
  //             [20, [3, 290848, 115292]],
  //             [20, [3, 406140, 109199]],
  //             [20, [3, 515340, 102131]],
  //           ],
  //           [
  //             [20, [3, 617472, 26164]],
  //             [20, [3, 643636, 23931]],
  //             [20, [3, 667568, 19089]],
  //             [20, [3, 686660, 24184]],
  //             [20, [3, 710844, 25232]],
  //             [20, [3, 736076, 23683]],
  //           ],
  //           [
  //             [20, [3, 759760, 5543]],
  //             [20, [3, 765304, 4313]],
  //             [20, [3, 769620, 4236]],
  //             [20, [3, 773856, 3895]],
  //             [20, [3, 777752, 4664]],
  //             [20, [3, 782416, 4697]],
  //           ],
  //           [
  //             [20, [3, 787116, 1550]],
  //             [20, [3, 788668, 1240]],
  //             [20, [3, 789908, 1230]],
  //             [20, [3, 791140, 1176]],
  //             [20, [3, 792316, 1322]],
  //             [20, [3, 793640, 1286]],
  //           ],
  //           [
  //             [20, [3, 794928, 453]],
  //             [20, [3, 795384, 444]],
  //             [20, [3, 795828, 458]],
  //             [20, [3, 796288, 512]],
  //             [20, [3, 796800, 474]],
  //             [20, [3, 797276, 499]],
  //           ],
  //         ],
  //         'sourceType': 7,
  //         'target': 34067,
  //       },
  //     ],
  //     'type': 'mars',
  //     '_imgs': { '1': [] },
  //   };
  //   const scn = await player.loadScene(json);
  //
  //   expect(scn.textures[0].mipmaps.length).to.eql(json.textures[0].mipmaps.length);
  //   expect(scn.textures[0].mipmaps.every(m => m.every(img => img instanceof HTMLImageElement || img instanceof ImageBitmap))).to.be.true;
  // });
  //
  // it('load cube textures fail', async () => {
  //   const a = {
  //     'compositionId': 1,
  //     'requires': [],
  //     'compositions': [{
  //       'name': 'composition_1',
  //       'id': 1,
  //       'duration': 5,
  //       'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
  //       'items': [{
  //         'name': 'item_1',
  //         'delay': 0,
  //         'id': 1,
  //         'type': '1',
  //         'ro': 0.1,
  //         'sprite': {
  //           'options': {
  //             'startLifetime': 2,
  //             'startSize': 1.2,
  //             'sizeAspect': 1.320754716981132,
  //             'startColor': [8, [255, 255, 255]],
  //             'duration': 2,
  //             'gravityModifier': 1,
  //             'renderLevel': 'B+',
  //           }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
  //         },
  //       }],
  //       'meta': { 'previewSize': [750, 1624] },
  //     }],
  //     'gltf': [],
  //     images: [],
  //     'textures': [{
  //       'minFilter': 9987,
  //       'magFilter': 9729,
  //       'wrapS': 33071,
  //       'wrapT': 33071,
  //       'target': 34067,
  //       'format': 6408,
  //       'internalFormat': 6408,
  //       'type': 5121,
  //       'mipmaps': [[
  //         [20, [5, 0, 24661]],
  //         [20, [5, 24664, 26074]],
  //         [20, [5, 50740, 26845]],
  //         [20, [5, 77588, 24422]],
  //         [20, [5, 102012, 24461]],
  //         [20, [5, 126476, 27099]]],
  //       [[20, [5, 153576, 7699]], [20, [5, 161276, 7819]], [20, [5, 169096, 8919]], [20, [5, 178016, 7004]], [20, [5, 185020, 7657]], [20, [5, 192680, 8515]]], [[20, [5, 201196, 2305]], [20, [5, 203504, 2388]], [20, [5, 205892, 2789]], [20, [5, 208684, 2147]], [20, [5, 210832, 2351]], [20, [5, 213184, 2541]]], [[20, [5, 215728, 755]], [20, [5, 216484, 810]], [20, [5, 217296, 902]], [20, [5, 218200, 727]], [20, [5, 218928, 775]], [20, [5, 219704, 835]]], [[20, [5, 220540, 292]], [20, [5, 220832, 301]], [20, [5, 221136, 317]], [20, [5, 221456, 285]], [20, [5, 221744, 301]], [20, [5, 222048, 307]]], [[20, [5, 222356, 147]], [20, [5, 222504, 147]], [20, [5, 222652, 149]], [20, [5, 222804, 149]], [20, [5, 222956, 149]], [20, [5, 223108, 149]]], [[20, [5, 223260, 96]], [20, [5, 223356, 96]], [20, [5, 223452, 96]], [20, [5, 223548, 97]], [20, [5, 223648, 97]], [20, [5, 223748, 97]]], [[20, [5, 223848, 83]], [20, [5, 223932, 83]], [20, [5, 224016, 83]], [20, [5, 224100, 83]], [20, [5, 224184, 83]], [20, [5, 224268, 83]]]],
  //       'sourceType': 7,
  //     }],
  //     'bins': [
  //       new ArrayBuffer(1),
  //       new ArrayBuffer(1),
  //       new ArrayBuffer(1),
  //       new ArrayBuffer(1),
  //       new ArrayBuffer(1),
  //       new ArrayBuffer(1)],
  //     'version': '0.9.0',
  //     'shapes': [],
  //     'plugins': [],
  //     'type': 'mars',
  //   };
  //   const spy = chai.spy();
  //
  //   await player.loadScene(a).catch(ex => {
  //     expect(ex.message).to.eql('Error: load texture 0 fails');
  //     spy();
  //   });
  //   expect(spy).to.has.been.called.once;
  // });

  it('load scene with different text variables', async () => {
    // @ts-expect-error
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
    const t1 = composition1.getItemByName('text_908').getComponent(TextComponent);
    const t2 = composition2.getItemByName('text_908').getComponent(TextComponent);

    expect(t1.text).to.eql('ttt');
    expect(t2.text).to.eql('xxx');
  });
});

function getJSONWithImageURL (url: string, webp?: string) {
  return JSON.parse(`{"playerVersion":{"web":"1.3.0","native":"0.0.1.202311221223"},"images":[{"url":"${url}","webp":"${webp ?? url}","renderLevel":"B+"}],"fonts":[],"spines":[],"version":"2.2","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"2","name":"新建合成2","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0,0,0.5859375,0.7578125,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[3.6924,4.7756,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"2","bins":[],"textures":[{"source":0,"flipY":true}]}`);
}
