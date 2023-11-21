// @ts-nocheck
import { Player, AbstractPlugin, registerPlugin, VFXItem, spec } from '@galacean/effects';

const { expect } = chai;
let onUpdateTriggerTimes = 0;

describe('item onEnd', () => {
  let player, canvas;

  before(()=>{
    canvas = document.createElement('canvas');
    registerPlugin('test', TestLoader, TestVFXItem, true);
  });

  beforeEach(() => {
    player = new Player({
      canvas,
      manualRender: true,
    });
  });

  afterEach(() => {
    player.resume();
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('item destroy', async () => {
    const comp = await generateComposition(spec.END_BEHAVIOR_DESTROY, player, { currentTime: 2 });

    onUpdateTriggerTimes = 0;
    comp.forwardTime(1);
    expect(onUpdateTriggerTimes).to.equal(0);
  });

  it('item freeze', async () => {
    const comp = await generateComposition(spec.END_BEHAVIOR_DESTROY, player, { currentTime: 2 });

    onUpdateTriggerTimes = 0;
    comp.forwardTime(1);
    expect(onUpdateTriggerTimes).to.equal(0);
  });

  it('item loop', async () => {
    const comp = await generateComposition(spec.END_BEHAVIOR_RESTART, player, { currentTime: 2 });

    onUpdateTriggerTimes = 0;
    comp.forwardTime(1);
    expect(onUpdateTriggerTimes).to.not.equal(0);
  });
});

class TestVFXItem extends VFXItem {
  onConstructed (options) {
    super.onConstructed(options);
    console.debug(options);
  }

  onItemUpdate (dt, lifetime) {
    onUpdateTriggerTimes++;
  }
}

class TestLoader extends AbstractPlugin {

}

async function generateComposition (endBehavior, player, playerOptions) {
  const json = {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': 'composition_1',
      'id': 1,
      'duration': 2,
      'endBehavior': spec.END_BEHAVIOR_FORWARD,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': [{
        'name': 'item_1',
        'delay': 0,
        'id': 1,
        'pluginName': 'test',
        'ro': 0.1,
        'duration': 2,
        endBehavior,
      }],
      'meta': { 'previewSize': [750, 1334] },
    }],
    'gltf': [],
    'images': [],
    'version': '1.0',
    'shapes': [],
    'plugins': ['test'],
    'type': 'mars',
    '_imgs': { '1': [] },
  };
  const scene = await player.createComposition(json);

  await player.gotoAndPlay(0.01 + (playerOptions.currentTime ?? 0));

  return scene;
}
