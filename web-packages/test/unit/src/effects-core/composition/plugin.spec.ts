// @ts-nocheck
import { Player, AbstractPlugin, VFXItem, registerPlugin, unregisterPlugin } from '@galacean/effects';

const { expect } = chai;

describe('plugin', () => {
  let player: Player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas') });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('lifetime check', async () => {
    const resetSpy = chai.spy('reset');
    const constructSpy = chai.spy('constructed');
    const updateSpy = chai.spy('update');
    let i = 0;

    class TestPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        scene.storage.xx = 1;
        expect(options.player).not.exist;

        return Promise.resolve(1);
      }

      onCompositionUpdate (composition, dt) {
        updateSpy(ipp());
      }

      onCompositionReset (composition, renderFrame) {
        expect(composition.items).to.be.an('array').with.lengthOf(1);
        resetSpy(ipp());
      }

      onCompositionConstructed (composition, scene) {
        expect(scene.storage.xx).to.eql(1);
        expect(composition.items.length).to.eql(0);
        constructSpy(ipp());
      }
    }

    function ipp () {
      return i++;
    }

    registerPlugin('test-plugin', TestPlugin, VFXItem, true);
    const comp = await player.loadScene(generateScene({}));

    player.gotoAndStop(0.1);

    expect(resetSpy).to.have.been.called.with(1);
    expect(constructSpy).to.have.been.called.with(0);
    expect(updateSpy).to.have.been.called.with(2);
  });

  it('loaded scene will be used twice', async () => {
    const spy = chai.spy();

    registerPlugin('test-plugin-res-rewrite', class T2 extends AbstractPlugin {
      static prepareResource (json, options) {
        expect(json.jsonScene.compositions[0].items[0].content.renderer.renderMode).to.eql(1);
        expect(json.jsonScene.compositions[0].items[0].content.renderer.texture).to.eql(tex);
        json.jsonScene.compositions[0].items[0].content.renderer.renderMode = 2;
        spy();

        return Promise.resolve();
      }
    }, VFXItem, true);

    const scn = generateScene();
    const tex = scn.compositions[0].items[0].sprite.renderer.texture = { abc: 1 };

    // TODO 与老版JsonScene加载逻辑判断不同，没有考虑重复加载的情况。
    // await player.loadScene(scn);
    // await player.loadScene(scn);
    // expect(spy).to.has.been.called.twice;

  });
  afterEach(() => {
    unregisterPlugin('test-plugin');
    unregisterPlugin('test-plugin-1');
    unregisterPlugin('test-plugin-2');
    unregisterPlugin('test-plugin-3');
    unregisterPlugin('test-plugin-4');
    unregisterPlugin('test-plugin-multiple');
    unregisterPlugin('test-plugin-6');
    unregisterPlugin('test-plugin-res-rewrite');
  });
});

function generateScene (opt) {
  opt = opt || {};

  return {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': opt.name || 'composition_1',
      'id': 1,
      'duration': 5,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': opt.items || [
        {
          'name': 'item_1',
          'delay': 0,
          'id': 1,
          'ro': 0.1,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.2,
              'sizeAspect': 1,
              'startColor': [8, [255, 255, 255]],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
            }, 'renderer': { 'renderMode': 1 },
          },
        },
      ],
      'meta': { 'previewSize': [750, 1624] },
    }],
    'gltf': [],
    'images': [],
    'version': '0.8.10-beta.4',
    'shapes': [],
    'plugins': opt.plugins || [],
    'type': 'mars',
    '_imgs': { '1': [] },
  };
}

