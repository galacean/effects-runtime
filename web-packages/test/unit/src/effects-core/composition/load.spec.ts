// @ts-nocheck
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('load error', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('load json fail with msg', async () => {
    const spy = chai.spy();

    // TODO 待补充。
    // await player.loadScene('https://abc.com/').catch(function (e) {
    //   expect(e.message).to.eql('Error: load scene fail:https://abc.com/');
    //   spy();
    // });
    //expect(spy).to.has.been.called.once;
  });

  it('load image fail with msg', async () => {
    const json = {
      'compositionId': 611209599,
      'requires': [],
      'compositions': [{
        'name': 'test',
        'id': 611209599,
        'duration': 5,
        'endBehavior': 1,
        'camera': { 'fov': 60, 'far': 40, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1, 'rotation': [0, 0, 0] },
        'items': [{
          'name': '9月 (1)',
          'delay': 0,
          'id': 4,
          'type': '2',
          'ro': 0.01,
          'particle': {
            'renderer': { 'renderMode': 1, 'texture': 0 },
            'shape': { 'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0 },
            'options': {
              'startDelay': 0,
              'duration': 5,
              'maxCount': 10,
              'sizeAspect': 1,
              'startSpeed': 1,
              'startSize': 4.4851,
              'startRotation': 0,
              'startLifetime': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'startColor': [8, [255, 255, 255, 1]],
              'gravity': [0, 0, 0],
            },
            'emission': { 'rateOverTime': 5 },
            'transform': { 'position': [1.1827, 0.4963, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1] },
          },
        }],
        'meta': { 'previewSize': [0, 0] },
      }],
      'gltf': [],
      'images': [{
        'template': {
          'content': '$image$',
          'variables': { 'image': 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*XfL-Qo-nsXAAAAAAAAAAAAAAARQnAQ' },
          'asImage': true,
          'width': null,
          'height': null,
          'backgroundWidth': 64,
          'backgroundHeight': 64,
        },
        'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*NqZcRIy2ougAAAAAAAAAAAAADlB4AQ/original',
      }],
      'version': '0.1.47',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '611209599': [0] },
      'imageTags': ['B+'],
    };
    const spy = chai.spy();

    // TODO 待补充。
    // await player.loadScene(json, { variables: { image: 'http://mars.com/abc' } }).catch(function (e) {
    //   spy();
    //   expect(e.message).to.eql('Error: image template fail:https://mdn.alipayobjects.com/mars/afts/img/A*NqZcRIy2ougAAAAAAAAAAAAADlB4AQ/original');
    // });
    // expect(spy).to.has.been.called.once;
  });

  it('load image fail with msg', async () => {
    const json = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': '11111',
          'delay': 0,
          'id': 2,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 0.8355836885408324,
              'sizeAspect': 1.1403508771929824,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
          },
        }],
        'meta': { 'previewSize': [0, 0] },
      }],
      'gltf': [],
      'images': ['http://mars.com/abc'],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [0] },
    };
    const spy = chai.spy();

    // TODO 待补充。
    // await player.loadScene(json).catch(function (e) {
    //   expect(e.message).to.eql('Error: load image fail:http://mars.com/abc');
    //   spy(1);
    // });
    // expect(spy).to.has.been.called.once;
  });

  it('load bin fail with url', async () => {
    const a = {
      'bins': [{ 'url': 'http://mars.com/abc' }],
      'images': [],
      'compositions': [
        {
          'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
          'duration': 5,
          'id': '1',
          'items': [
            {
              'type': '3',
              'name': 'parent',
              'id': '1',
              'duration': 2,
              'endBehavior': 5,
              'content': { 'options': {}, 'rotationOverLifetime': { 'separateAxes': true, 'y': [0, 180] } },
              'transform': { 'rotation': [0, 45, 0] },
            },
          ],
        },
      ],
      'version': '1.3',
      'compositionId': '1',
    };
    const spy = chai.spy();

    // TODO 待补充，错误信息输出。
    // await player.loadScene(a).catch(ex => {
    //   expect(ex.message).to.eql('Error: load http://mars.com/abc fail');
    //   spy(1);
    // });
    // expect(spy).to.has.been.called.once;
  });

  it('toggle png when webp fails', async () => {
    const json = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': '11111',
          'delay': 0,
          'id': 2,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 0.8355836885408324,
              'sizeAspect': 1.1403508771929824,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
          },
        }],
        'meta': { 'previewSize': [0, 0] },
      }],
      'gltf': [],
      'images': [{
        webp: 'http://mars.com/abc',
        url: 'https://mdn.alipayobjects.com/mars/afts/img/A*NqZcRIy2ougAAAAAAAAAAAAADlB4AQ/original',
      }],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [0] },
    };
    const scn = await player.loadScene(json);

    expect(scn.textures[0].sourceFrom).to.contains({ url: 'https://mdn.alipayobjects.com/mars/afts/img/A*NqZcRIy2ougAAAAAAAAAAAAADlB4AQ/original' });
  });

  it('load cube texture demo2', async () => {
    const json = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': '11111',
          'delay': 0,
          'id': 2,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 0.8355836885408324,
              'sizeAspect': 1.1403508771929824,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
          },
        }],
        'meta': { 'previewSize': [0, 0] },
      }],
      'gltf': [],
      'images': [],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'bins': [
        { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data0.bin' },
        { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data1.bin' },
        { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data2.bin' },
        { 'url': 'https://gw.alipayobjects.com/os/gltf-asset/67210123752698/data3.bin' },
      ],
      'textures': [
        {
          'mipmaps': [
            [
              [20, [3, 0, 113649]],
              [20, [3, 113652, 103308]],
              [20, [3, 216960, 73885]],
              [20, [3, 290848, 115292]],
              [20, [3, 406140, 109199]],
              [20, [3, 515340, 102131]],
            ],
            [
              [20, [3, 617472, 26164]],
              [20, [3, 643636, 23931]],
              [20, [3, 667568, 19089]],
              [20, [3, 686660, 24184]],
              [20, [3, 710844, 25232]],
              [20, [3, 736076, 23683]],
            ],
            [
              [20, [3, 759760, 5543]],
              [20, [3, 765304, 4313]],
              [20, [3, 769620, 4236]],
              [20, [3, 773856, 3895]],
              [20, [3, 777752, 4664]],
              [20, [3, 782416, 4697]],
            ],
            [
              [20, [3, 787116, 1550]],
              [20, [3, 788668, 1240]],
              [20, [3, 789908, 1230]],
              [20, [3, 791140, 1176]],
              [20, [3, 792316, 1322]],
              [20, [3, 793640, 1286]],
            ],
            [
              [20, [3, 794928, 453]],
              [20, [3, 795384, 444]],
              [20, [3, 795828, 458]],
              [20, [3, 796288, 512]],
              [20, [3, 796800, 474]],
              [20, [3, 797276, 499]],
            ],
          ],
          'sourceType': 7,
          'target': 34067,
        },
      ],
      'type': 'mars',
      '_imgs': { '1': [] },
    };
    const scn = await player.loadScene(json);

    expect(scn.textures[0].mipmaps.length).to.eql(json.textures[0].mipmaps.length);
    expect(scn.textures[0].mipmaps.every(m => m.every(img => img instanceof HTMLImageElement || img instanceof ImageBitmap))).to.be.true;
  });

  it('load cube textures fail', async () => {
    const a = {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': 5,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': [{
          'name': 'item_1',
          'delay': 0,
          'id': 1,
          'type': '1',
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1.320754716981132,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1, 'anchor': [0.5, 0.5], 'texture': 0 },
          },
        }],
        'meta': { 'previewSize': [750, 1624] },
      }],
      'gltf': [],
      images: [],
      'textures': [{
        'minFilter': 9987,
        'magFilter': 9729,
        'wrapS': 33071,
        'wrapT': 33071,
        'target': 34067,
        'format': 6408,
        'internalFormat': 6408,
        'type': 5121,
        'mipmaps': [[
          [20, [5, 0, 24661]],
          [20, [5, 24664, 26074]],
          [20, [5, 50740, 26845]],
          [20, [5, 77588, 24422]],
          [20, [5, 102012, 24461]],
          [20, [5, 126476, 27099]]],
        [[20, [5, 153576, 7699]], [20, [5, 161276, 7819]], [20, [5, 169096, 8919]], [20, [5, 178016, 7004]], [20, [5, 185020, 7657]], [20, [5, 192680, 8515]]], [[20, [5, 201196, 2305]], [20, [5, 203504, 2388]], [20, [5, 205892, 2789]], [20, [5, 208684, 2147]], [20, [5, 210832, 2351]], [20, [5, 213184, 2541]]], [[20, [5, 215728, 755]], [20, [5, 216484, 810]], [20, [5, 217296, 902]], [20, [5, 218200, 727]], [20, [5, 218928, 775]], [20, [5, 219704, 835]]], [[20, [5, 220540, 292]], [20, [5, 220832, 301]], [20, [5, 221136, 317]], [20, [5, 221456, 285]], [20, [5, 221744, 301]], [20, [5, 222048, 307]]], [[20, [5, 222356, 147]], [20, [5, 222504, 147]], [20, [5, 222652, 149]], [20, [5, 222804, 149]], [20, [5, 222956, 149]], [20, [5, 223108, 149]]], [[20, [5, 223260, 96]], [20, [5, 223356, 96]], [20, [5, 223452, 96]], [20, [5, 223548, 97]], [20, [5, 223648, 97]], [20, [5, 223748, 97]]], [[20, [5, 223848, 83]], [20, [5, 223932, 83]], [20, [5, 224016, 83]], [20, [5, 224100, 83]], [20, [5, 224184, 83]], [20, [5, 224268, 83]]]],
        'sourceType': 7,
      }],
      'bins': [
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1)],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
    };
    const spy = chai.spy();

    await player.loadScene(a).catch(ex => {
      expect(ex.message).to.eql('Error: load texture 0 fails');
      spy();
    });
    expect(spy).to.has.been.called.once;
  });

  it('load timeout', async () => {
    const cacheSpy = chai.spy();

    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*GXqISoCVTuEAAAAAAAAAAAAADlB4AQ', { timeout: 0.001 }).catch(ex => {
      cacheSpy(1);
    });
    expect(cacheSpy).to.has.been.called.with(1);
  });

  it('运行时不加载template外的url和webp', async () => {
    const json = {
      'compositionId': 37,
      'requires': [],
      'compositions': [
        {
          'name': '超级红包',
          'id': 37,
          'duration': 4,
          'endBehavior': 2,
          'camera': {
            'fov': 60,
            'far': 20,
            'near': 0.1,
            'aspect': null,
            'clipMode': 0,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
          'items': [],
          'startTime': 0,
          'meta': {
            'previewSize': [
              750,
              856,
            ],
          },
        },
      ],
      'gltf': [],
      'images': [
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*NNUKRaaQ0M8AAAAAAAAAAAAADlB4AQ/original',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*Dm4nSrj1HwMAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
        },
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*ympoT6SNxk0AAAAAAAAAAAAADlB4AQ/original',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*qB7eR7z0ORQAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
        },
        {
          'template': {
            'v': 2,
            'content': {
              'fonts': [],
              'texts': [],
              'colors': [],
            },
            'variables': {
              'text': '这是         文案',
              'img': 'https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*L6tQQbF6oMMAAAAAAAAAAAAADsF2AQ/original',
            },
            'width': 346,
            'height': 150,
            'background': {
              'name': 'img',
              'url': 'https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*L6tQQbF6oMMAAAAAAAAAAAAADsF2AQ/original',
            },
          },
          'url': 'https://mars.com',
          'webp': 'https://mars.com',
          'renderLevel': 'B+',
        },
      ],
      'spines': [],
      'version': '0.1.47',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'bins': [],
      'textures': [
        {
          'source': 0,
          'flipY': true,
        },
        {
          'source': 1,
          'flipY': true,
        },
        {
          'source': 2,
          'flipY': true,
        },
      ],
    };
    const spy = chai.spy();

    await player.loadScene(json).catch(e => {
      spy();
    });
    expect(spy).to.not.have.been.called();
  });
});
