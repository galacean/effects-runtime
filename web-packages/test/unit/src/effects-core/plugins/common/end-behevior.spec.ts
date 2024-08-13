import { Player, AbstractPlugin, registerPlugin, VFXItem, spec } from '@galacean/effects';

const { expect } = chai;
let onUpdateTriggerTimes = 0;

describe('item onEnd', () => {
  let player: Player;
  let canvas: HTMLCanvasElement;

  before(() => {
    canvas = document.createElement('canvas');
    registerPlugin('test', TestLoader, TestVFXItem, true);
  });

  beforeEach(() => {
    player = new Player({
      canvas,
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('item destroy', async () => {
    const composition = await generateComposition(spec.END_BEHAVIOR_DESTROY, player, 2);

    onUpdateTriggerTimes = 0;
    composition.gotoAndPlay(1);
    expect(onUpdateTriggerTimes).to.equal(0);
  });

  it('item freeze', async () => {
    const composition = await generateComposition(spec.END_BEHAVIOR_DESTROY, player, 2);

    onUpdateTriggerTimes = 0;
    composition.gotoAndPlay(1);
    expect(onUpdateTriggerTimes).to.equal(0);
  });

  it('item loop', async () => {
    const composition = await generateComposition(spec.END_BEHAVIOR_RESTART, player, 2);

    onUpdateTriggerTimes = 0;
    composition.gotoAndPlay(1);
    expect(onUpdateTriggerTimes).to.not.equal(0);
  });
});

class TestVFXItem extends VFXItem {
  onItemUpdate (dt: number) {
    onUpdateTriggerTimes++;
  }
}

class TestLoader extends AbstractPlugin {

}

async function generateComposition (
  endBehavior: spec.EndBehavior,
  player: Player,
  currentTime = 0,
) {
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
        'endBehavior': endBehavior,
        'content': {},
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
  const scene = await player.loadScene(json);

  player.gotoAndPlay(0.01 + currentTime);

  return scene;
}
