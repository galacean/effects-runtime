// @ts-nocheck
import { Player, AbstractPlugin, VFXItem, registerPlugin, spec, unregisterPlugin } from '@galacean/effects';

const { expect } = chai;

describe('plugin', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas') });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('plugin name', async () => {
    registerPlugin('test-plugin-1', TPlugin1, TItem1, true);
    registerPlugin('test-plugin-2', TPlugin2, TItem2, true);

    const comp = await player.loadScene(generateScene({
      items: [{
        name: 't3',
        delay: 0,
        id: '23',
        pluginName: 'test-plugin-1',
        content: {
          options: {
            duration: 1.3,
          },
        },
      }, {
        name: 't4',
        delay: 0,
        id: '24',
        content: {
          options: {
            duration: 1.3,
            type: 'test-plugin-2',
          },
        },
      }],
      plugins: ['test-plugin-1', 'test-plugin-2'],
    }));

    player.gotoAndStop(0);
    const item3 = comp.getItemByName('t3');
    const item4 = comp.getItemByName('t4');

    expect(item3).to.be.an.instanceof(TItem1);
    expect(item4).to.be.an.instanceof(TItem2);
  });

  it('lifetime check', async () => {
    const resetSpy = chai.spy('reset');
    const constructSpy = chai.spy('constructed');
    const updateSpy = chai.spy('update');
    let i = 0;

    class TesPlugin extends AbstractPlugin {
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

    registerPlugin('test-plugin', TesPlugin, VFXItem, true);
    const comp = await player.loadScene(generateScene({}));

    player.gotoAndStop(0.1);

    expect(resetSpy).to.have.been.called.with(1);
    expect(constructSpy).to.have.been.called.with(0);
    expect(updateSpy).to.have.been.called.with(2);
  });

  it('call destroy before reset', async () => {
    const resetSpy = chai.spy('reset');
    const constructSpy = chai.spy('constructed');
    const destroySpy = chai.spy('destory');
    let j = 0;

    class TesPlugin extends AbstractPlugin {

      onCompositionDestroyed (composition, data) {
        destroySpy(ipp());
      }

      onCompositionReset (composition, renderFrame) {
        expect(composition.items).to.be.an('array').with.lengthOf(1);
        resetSpy(ipp());
      }

      onCompositionConstructed (composition, scene, data) {
        expect(composition.items.length).to.eq(0);
        constructSpy(ipp());
      }

    }

    function ipp () {
      return j++;
    }

    registerPlugin('test-plugin-multiple', TesPlugin, VFXItem, true);
    const scene = await player.loadScene(generateScene({}));

    player.gotoAndStop(0.1);
    expect(resetSpy).to.have.been.called;
    expect(constructSpy).to.not.have.been.called;
    expect(destroySpy).to.not.have.been.called;
    player.play(scene);
    expect(destroySpy).to.have.been.called;
  });

  it('lifetime with item check', async () => {
    const resetSpy = chai.spy('reset');
    const constructSpy = chai.spy('constructed');
    const updateSpy = chai.spy('update');
    const processSpy = chai.spy('process');
    let i = 0;

    class TesPlugin extends AbstractPlugin {
      static processRawJSONAsync (json, options) {
        processSpy();
        expect(options.pluginData).to.deep.equals({});

        return Promise.resolve();
      }

      static prepareResource (scene, options) {
        scene.storage.xx = 1;
        expect(options.pluginData).to.deep.equals({});

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

    const itemConstructedSpy = chai.spy('item-constructed');
    const itemUpdateSpy = chai.spy('item-update');
    const itemCreateContentSpy = chai.spy('item-create-content');

    class TestItem extends VFXItem {
      get type () {
        return 'test-item';
      }

      set type (v) {

      }

      onConstructed (options) {
        this.duration = options.duration;
        expect(this.duration).to.eql(1.3);
        itemConstructedSpy(ipp());
      }

      precompile (shaderLibrary) {
        itemPrecompileSpy(ipp());
      }

      doCreateContent (renderer) {
        itemCreateContentSpy(ipp());

        return 1;
      }

      onItemUpdate (dt, lifetime) {
        itemUpdateSpy(ipp());
      }
    }

    function ipp () {
      return i++;
    }

    registerPlugin('test-plugin-1', TesPlugin, TestItem, true);
    registerPlugin('test-plugin-2', TesPlugin, VFXItem, true);
    const comp = await player.loadScene(generateScene({
      items: [{
        pn: 0,
        name: 't2',
        delay: 0,
        id: '23',
        type: 'test-item',
        content: {
          options: {
            duration: 1.3,
          },
        },
      }],
      plugins: ['test-plugin-1'],
    }));

    player.gotoAndStop(0.1);

    expect(comp.pluginSystem.plugins.filter(p => p instanceof TesPlugin).length).to.eql(1);
    expect(constructSpy).to.have.been.called.with(0);
    expect(itemConstructedSpy).to.has.been.called.with(1);
    expect(resetSpy).to.have.been.called.with(2);
    // expect(itemCreateContentSpy).to.has.been.called.with(1);
    expect(updateSpy).to.have.been.called.with(4);
    expect(itemUpdateSpy).to.have.been.called.with(5);

  });
  it('call hide change for reusable item', async () => {
    const hide = chai.spy('hide');
    const remove = chai.spy('remove');

    class TestItem extends VFXItem {
      get type () {
        return 'test-item';
      }

      set type (v) {

      }

      handleVisibleChanged (h) {
        hide(h);
      }

      onItemRemoved (renderer, content) {
        remove();
      }
    }

    registerPlugin('test-plugin-3', AbstractPlugin, TestItem, true);
    const comp = await player.loadScene(generateScene({
      name: 'comp3',
      items: [{
        pn: 0,
        name: 't2',
        delay: 0,
        id: '23',
        type: 'test-item',
        content: {
          options: {
            duration: 1.3,
          },
        },
      }],
      plugins: ['test-plugin-3'],
    }), {
      reusable: true,
    });

    const item = comp.getItemByName('t2');

    comp.gotoAndStop(0.3);
    expect(item.contentVisible).to.be.true;

    item.setVisible(false);
    expect(hide).to.has.been.called.with(false);
    expect(hide).to.has.been.called.once;

    comp.gotoAndStop(1.4);
    expect(item).to.exist;
    expect(item.reusable).to.be.true;
    expect(item.contentVisible).to.be.false;
    expect(remove).not.to.has.been.called;
    comp.dispose();
  });

  it('not call hide change for reusable item,[endBehavior != destroy ]', async () => {
    const hide = chai.spy('hide');
    const remove = chai.spy('remove');

    class TesPlugin extends AbstractPlugin {

    }

    class TestItem extends VFXItem {
      get type () {
        return 'test-item';
      }

      set type (v) {

      }

      _onHideChanged (h) {
        hide(h);
      }

      onItemRemoved (renderer, content) {
        remove();
      }
    }

    registerPlugin('test-plugin-4', TesPlugin, TestItem, true);
    const comp = await player.loadScene(generateScene({
      name: 'comp1',
      items: [{
        pn: 0,
        name: 't2',
        delay: 0,
        id: '23',
        type: 'test-item',
        content: {
          options: {
            duration: 1.3,
            //  endBehavior: END_BEHAVIOR_FORWARD,
            looping: true,
          },
        },
      },
      {
        pn: 0,
        name: 't3',
        delay: 0,
        id: '33',
        type: 'test-item',
        content: {
          options: {
            duration: 1.3,
            endBehavior: spec.END_BEHAVIOR_FORWARD,
          },
        },
      }],
      plugins: ['test-plugin-4'],
    }), {
      reusable: true,
    });

    player.gotoAndStop(1.4);

    const item = comp.getItemByName('t2');
    const forward = comp.getItemByName('t3');

    expect(item).to.exist;
    expect(forward.endBehavior).to.eql(spec.END_BEHAVIOR_FORWARD);
    expect(item.endBehavior).to.eql(spec.END_BEHAVIOR_RESTART);
    expect(item.reusable).to.be.true;
    expect(item.visible).to.be.true;
    expect(forward.visible).to.be.true;
    expect(remove).not.to.has.been.called;
    expect(hide).not.to.has.been.called;
    comp.gotoAndStop(0.3);
    expect(item.visible).to.be.true;
    expect(forward.visible).to.be.true;
    expect(hide).not.to.has.been.called;
    comp.dispose();
  });

  it('plugin hide test', async () => {
    const hide = chai.spy('hide');

    class TesPlugin extends AbstractPlugin {
      static prepareResource (scene, options) {
        expect(options.pluginData.hideNames).to.deep.equals(['t2xxxx']);

        expect(scene.jsonScene.compositions[0].items.length).to.eql(1);
        expect(scene.jsonScene.compositions[0].items[0].name).to.eql('t2xxxx');
        scene.jsonScene.compositions[0].items[0].visible = false;
        hide();

        return Promise.resolve(undefined);
      }
    }

    registerPlugin('test-plugin-6', TesPlugin, VFXItem, true);
    const comp = await player.loadScene(generateScene({
      items: [{
        pn: 0,
        name: 't2xxxx',
        delay: 0,
        id: '23',
        type: 'test-item',
        content: {
          options: {
            duration: 1.3,
            //  endBehavior: END_BEHAVIOR_FORWARD,
            looping: true,
          },
        },
      },
      ],
      plugins: ['test-plugin-6'],
    }), { pluginData: { hideNames: ['t2xxxx'] } });

    player.gotoAndStop(0.1);
    const items = comp.compositionSourceManager.jsonScene.compositions[0].items.slice();

    expect(items.length).to.eql(1);
    await player.play();

    expect(comp.items.length).to.eql(0);
    expect(hide).to.has.been.called.once;

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

class TPlugin1 extends AbstractPlugin {
}

class TItem1 extends VFXItem {
}

class TPlugin2 extends AbstractPlugin {
}

class TItem2 extends VFXItem {
}

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

