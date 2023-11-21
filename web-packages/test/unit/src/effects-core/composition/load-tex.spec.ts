// @ts-nocheck
import { Player, AbstractPlugin, Texture, TextureSourceType, VFXItem, getDefaultTextureFactory, glContext, registerPlugin, unregisterPlugin } from '@galacean/effects';

const { expect } = chai;

describe('load textures', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('load images without textures config', async () => {
    const a = {
      'images': [{ 'url': 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png' }],
      'compositions': [
        {
          'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
          'duration': 5,
          'id': '1',
          'items': [
            {
              'type': '3',
              'name': 'parent',
              'pn': 0,
              'id': '1',
              'duration': 2,
              'endBehavior': 5,
              'content': { 'options': {}, 'rotationOverLifetime': { 'separateAxes': true, 'y': [0, 180] } },
              'transform': { 'rotation': [0, 45, 0] },
            },
          ],
        },
      ],
      'plugins': ['test-load-tex-0'],
      'version': '1.3',
      'compositionId': '1',
    };

    const spy = chai.spy('loadPlugin');
    let texOpt;

    registerPlugin('test-load-tex-0', class TestPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        expect(scene.images).to.exist;
        expect(scene.images[0]).to.exist;

        // TODO 老player这里是scene.texture，现在数据都放在了textureOptions里，原有的Scene中textures属性是否还有意义？
        expect(scene.textureOptions).to.exist;
        expect(scene.textureOptions[0]).to.exist;
        texOpt = scene.textureOptions[0];
        spy();

        return Promise.resolve(undefined);
      }
    }, VFXItem, false);
    const scn = await player.loadScene(a);

    expect(scn.textureOptions.length).to.eql(1);
    expect(scn.textureOptions[0]).not.to.be.instanceof(Texture);
    expect(texOpt).to.eql(scn.textureOptions[0]);
    const comp = await player.play(scn);

    expect(comp.textures.length).to.eql(1);
    expect(comp.textures[0]).to.be.instanceof(Texture);
    expect(spy).to.has.been.called.once;
  });
  it('load images textures config', async () => {
    const a = {
      'images': [{ 'url': 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png' }],
      'textures': [{ source: 0, flipY: true, minFilter: glContext.NEAREST_MIPMAP_NEAREST }, {
        source: 0,
        flipY: true,
        minFilter: glContext.NEAREST_MIPMAP_LINEAR,
      }],
      'compositions': [
        {
          'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
          'duration': 5,
          'id': '1',
          'items': [
            {
              'type': '3',
              'name': 'parent',
              'pn': 0,
              'id': '1',
              'duration': 2,
              'endBehavior': 5,
              'content': { 'options': {}, 'rotationOverLifetime': { 'separateAxes': true, 'y': [0, 180] } },
              'transform': { 'rotation': [0, 45, 0] },
            },
          ],
        },
      ],
      'plugins': ['test-load-tex-2'],
      'version': '1.3',
      'compositionId': '1',
    };

    const spy = chai.spy('loadPlugin');
    let texOpt;

    registerPlugin('test-load-tex-2', class TestPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        expect(scene.images).to.exist;
        expect(scene.images[0]).to.exist;
        expect(scene.textureOptions).to.exist;
        expect(scene.textureOptions[0]).to.exist;
        texOpt = scene.textureOptions[0];
        expect(texOpt.sourceFrom.url).to.eql(a.images[0].url);
        expect(texOpt.flipY).to.be.true;
        expect(texOpt.minFilter).to.eql(glContext.NEAREST_MIPMAP_NEAREST, 'tex filter');
        expect(scene.textureOptions.length).to.eql(2);
        spy();

        return Promise.resolve(undefined);
      }
    }, VFXItem, false);
    const scn = await player.loadScene(a);

    expect(scn.textureOptions.length).to.eql(2);
    expect(scn.textureOptions[0]).not.to.be.instanceof(Texture);
    expect(texOpt).to.eql(scn.textureOptions[0]);
    const comp = await player.play(scn);

    expect(comp.textures.length).to.eql(2);
    expect(comp.textures[0]).to.be.instanceof(Texture);
    delete texOpt.image;
    expect(comp.textures[0].source).to.contains(texOpt);
    expect(comp.textures[1].source.minFilter).to.eql(glContext.NEAREST_MIPMAP_LINEAR);
    expect(spy).to.has.been.called.once;
  });

  it('keep resource reuse textures', async () => {
    // TODO 需要确定一下现在的texture加载逻辑，是否还支持加载Texture。
    const a = {
      'images': [{ 'url': 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png' }],
      'textures': [{ source: 0, flipY: true, minFilter: glContext.NEAREST_MIPMAP_NEAREST }, {
        source: 0,
        flipY: true,
        minFilter: glContext.NEAREST_MIPMAP_LINEAR,
      }],
      'compositions': [
        {
          'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
          'duration': 5,
          'id': '1',
          'items': [
            {
              'type': '3',
              'name': 'parent',
              'pn': 0,
              'id': '1',
              'duration': 2,
              'endBehavior': 5,
              'content': { 'options': {}, 'rotationOverLifetime': { 'separateAxes': true, 'y': [0, 180] } },
              'transform': { 'rotation': [0, 45, 0] },
            },
          ],
        },
      ],
      'plugins': ['test-load-tex-3'],
      'version': '1.3',
      'compositionId': '1',
    };

    const spy = chai.spy('loadPlugin');
    let texOpt;

    registerPlugin('test-load-tex-3', class TestPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        expect(scene.images).to.exist;
        expect(scene.images[0]).to.exist;
        expect(scene.textureOptions.length).to.eql(2);
        expect(scene.textureOptions).to.exist;
        expect(scene.textureOptions[0]).to.exist;
        expect(scene.textureOptions[0].image).to.exist;
        expect(scene.textureOptions[1].image).to.exist;
        texOpt = scene.textureOptions[0];
        expect(texOpt.sourceFrom.url).to.eql(a.images[0].url);
        expect(texOpt.flipY).to.be.true;
        expect(texOpt.minFilter).to.eql(glContext.NEAREST_MIPMAP_NEAREST, 'tex filter');
        spy();

        return Promise.resolve(undefined);
      }
    }, VFXItem, false);
    const scn = await player.loadScene(a);

    expect(scn.textureOptions.length).to.eql(2);
    expect(scn.textureOptions[0]).not.to.be.instanceof(Texture);
    expect(texOpt).to.eql(scn.textureOptions[0]);
    let comp = await player.play(scn, { keepResource: true });

    expect(comp.textures.length).to.eql(2);
    expect(comp.textures[0]).to.be.instanceof(Texture);

    expect(comp.textures[1]).to.be.instanceof(Texture);
    const texOpt2 = scn.textureOptions[1];

    delete texOpt2.image;
    expect(comp.textures[0].source).to.contains(texOpt);
    expect(comp.textures[1].source.minFilter).to.eql(glContext.NEAREST_MIPMAP_LINEAR);
    expect(spy).to.has.been.called;
    comp.dispose();
    const texs = scn.textureOptions;

    comp = await player.play(scn);
    expect(comp.textures.length).to.eql(2);
    expect(comp.textures[0]).to.be.instanceof(Texture);
    expect(comp.textures[1]).to.be.instanceof(Texture);
    expect(comp.textures[0]).to.eql(texs[0]);
    expect(comp.textures[1]).to.eql(texs[1]);
    expect(comp.textures[0].isDestroyed).to.be.false;
    expect(comp.textures[1].isDestroyed).to.be.false;
    expect(spy).to.has.been.called.once;
    comp.destroy();
    expect(texs[0].isDestroyed).to.be.true;
    expect(texs[1].isDestroyed).to.be.true;
  });

  it('plugin modify textureOptions', async () => {
    const a = {
      'images': [{ 'url': 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png' }],
      'textures': [{ source: 0, flipY: true, minFilter: glContext.NEAREST_MIPMAP_NEAREST }, {
        source: 0,
        flipY: true,
        minFilter: glContext.NEAREST_MIPMAP_LINEAR,
        name: 'abc',
      }],
      'compositions': [
        {
          'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
          'duration': 5,
          'id': '1',
          'items': [
            {
              'type': '3',
              'name': 'parent',
              'pn': 0,
              'id': '1',
              'duration': 2,
              'endBehavior': 5,
              'content': { 'options': {}, 'rotationOverLifetime': { 'separateAxes': true, 'y': [0, 180] } },
              'transform': { 'rotation': [0, 45, 0] },
            },
          ],
        },
      ],
      'plugins': ['test-load-tex-4'],
      'version': '1.3',
      'compositionId': '1',
    };

    const spy = chai.spy(() => {
    });

    registerPlugin('test-load-tex-4', class TestPlugin extends AbstractPlugin {
      static prepareResource (scene, options, data) {
        scene.textures[1].magFilter = glContext.LINEAR;
        expect(scene.textures[1].name).to.eql('abc');
        spy(1);

        return Promise.resolve(undefined);
      }

      onCompositionConstructed (composition, scene) {
        expect(composition.textures[1].name).to.eql('abc');
      }

    }, VFXItem, false);
    const scn = await player.loadScene(a);

    expect(scn.textures[1]).to.contains({
      magFilter: glContext.LINEAR,
      minFilter: glContext.NEAREST_MIPMAP_LINEAR,
      name: 'abc',
    });
    const comp = player.play(scn);

    expect(comp.textures[1].options.name).to.eql('abc');
    expect(spy).to.has.been.called.with(1);
  });

  it('load bins', async () => {
    const data = new ArrayBuffer(12);
    const a = {
      'bins': [{ 'url': 'https://gw.alipayobjects.com/os/gltf-asset/65735550218203/geometry01.bin' }, data],
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
    const spy = chai.spy('bins');

    registerPlugin('bins-test-plugin', class BinsPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        spy();
        expect(scene.bins.length).to.eql(2);
        expect(scene.bins[0]).to.be.an.instanceof(ArrayBuffer);
        expect(scene.bins[1]).to.eql(data);
        scene.storage.key = 1;

        return Promise.resolve(undefined);
      }

      onCompositionConstructed (composition, scene) {
        expect(scene.storage.key).to.eql(1);
        spy();
      }
    }, VFXItem, true);
    const scn = await player.loadScene(a);

    await player.play(scn);
    expect(scn.bins).to.exist;
    expect(scn.bins[0]).to.be.an.instanceof(ArrayBuffer);
    expect(spy).to.has.been.called.twice;
    unregisterPlugin('bins-test-plugin');
  });

  it('load 2d ri textures', async () => {
    const textureOpt = await getDefaultTextureFactory().loadSource({
      url: 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png',
      type: TextureSourceType.image,
    });
    const texture = Texture.create(player.renderer.engine, textureOpt);

    texture.initialize();
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
      'images': [texture],
      '_textures': [texture],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [0] },
    };
    const scn = await player.loadScene(a);

    expect(scn.textureOptions[0]).to.be.an.instanceof(Texture);
    expect(scn.images[0]).not.to.be.an.instanceof(Texture);
    await player.play(scn);
  });
  it('load 2d tex without flipY', async () => {
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
      'images': [{ url: 'https://gw.alipayobjects.com/zos/gltf-asset/65735550218203/image01.png' }],
      'textures': [{ source: 0 }],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': { '1': [0] },
    };
    const scn = await player.loadScene(a);

    expect(!!scn.textureOptions[0].flipY).to.be.false;
  });
  it('load cube textures', async () => {
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
      'images': [],
      'textures': [{
        'minFilter': 9987,
        'magFilter': 9729,
        'wrapS': 33071,
        'wrapT': 33071,
        'target': 34067,
        'format': 6408,
        'internalFormat': 6408,
        'type': 5121,
        'mipmaps': [
          [
            [20, [5, 0, 24661]],
            [20, [5, 24664, 26074]],
            [20, [5, 50740, 26845]],
            [20, [5, 77588, 24422]],
            [20, [5, 102012, 24461]],
            [20, [5, 126476, 27099]],
          ],
          [
            [20, [5, 153576, 7699]],
            [20, [5, 161276, 7819]],
            [20, [5, 169096, 8919]],
            [20, [5, 178016, 7004]],
            [20, [5, 185020, 7657]],
            [20, [5, 192680, 8515]],
          ], [[20, [5, 201196, 2305]], [20, [5, 203504, 2388]], [20, [5, 205892, 2789]], [20, [5, 208684, 2147]], [20, [5, 210832, 2351]], [20, [5, 213184, 2541]]], [[20, [5, 215728, 755]], [20, [5, 216484, 810]], [20, [5, 217296, 902]], [20, [5, 218200, 727]], [20, [5, 218928, 775]], [20, [5, 219704, 835]]], [[20, [5, 220540, 292]], [20, [5, 220832, 301]], [20, [5, 221136, 317]], [20, [5, 221456, 285]], [20, [5, 221744, 301]], [20, [5, 222048, 307]]], [[20, [5, 222356, 147]], [20, [5, 222504, 147]], [20, [5, 222652, 149]], [20, [5, 222804, 149]], [20, [5, 222956, 149]], [20, [5, 223108, 149]]], [[20, [5, 223260, 96]], [20, [5, 223356, 96]], [20, [5, 223452, 96]], [20, [5, 223548, 97]], [20, [5, 223648, 97]], [20, [5, 223748, 97]]], [[20, [5, 223848, 83]], [20, [5, 223932, 83]], [20, [5, 224016, 83]], [20, [5, 224100, 83]], [20, [5, 224184, 83]], [20, [5, 224268, 83]]]],
        'sourceType': 7,
      }],
      'bins': [
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        new ArrayBuffer(1),
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*pGF4QJqDT3wAAAAAAAAAAAAADlB4AQ' }],
      'version': '0.9.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
    };
    const scn = await player.loadScene(a);
    const texture = scn.textureOptions[0];

    expect(texture.sourceType).to.eql(TextureSourceType.mipmaps);
    expect(texture.target).to.eql(glContext.TEXTURE_CUBE_MAP);
    expect(texture.sourceFrom).to.deep.equals({
      type: TextureSourceType.mipmaps,
      target: glContext.TEXTURE_CUBE_MAP,
      bin: 'https://mdn.alipayobjects.com/mars/afts/file/A*pGF4QJqDT3wAAAAAAAAAAAAADlB4AQ',
      mipmaps: [[[0, 24661], [24664, 26074], [50740, 26845], [77588, 24422], [102012, 24461], [126476, 27099]], [[153576, 7699], [161276, 7819], [169096, 8919], [178016, 7004], [185020, 7657], [192680, 8515]], [[201196, 2305], [203504, 2388], [205892, 2789], [208684, 2147], [210832, 2351], [213184, 2541]], [[215728, 755], [216484, 810], [217296, 902], [218200, 727], [218928, 775], [219704, 835]], [[220540, 292], [220832, 301], [221136, 317], [221456, 285], [221744, 301], [222048, 307]], [[222356, 147], [222504, 147], [222652, 149], [222804, 149], [222956, 149], [223108, 149]], [[223260, 96], [223356, 96], [223452, 96], [223548, 97], [223648, 97], [223748, 97]], [[223848, 83], [223932, 83], [224016, 83], [224100, 83], [224184, 83], [224268, 83]]],
    });
  });
});
