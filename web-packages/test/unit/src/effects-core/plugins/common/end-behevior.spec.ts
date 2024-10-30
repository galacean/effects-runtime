import { Player, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/common/item-end', () => {
  let player: Player;
  let canvas: HTMLCanvasElement;

  before(() => {
    canvas = document.createElement('canvas');
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
    const composition = await generateComposition(spec.END_BEHAVIOR_DESTROY, player);
    const item = composition.getItemByName('sprite_1');

    composition.gotoAndStop(0.01 + 1);
    expect(item?.transform.getValid()).to.equal(true);
    composition.gotoAndStop(0.01 + 2);
    expect(item?.transform.getValid()).to.equal(false);
  });

  it('item freeze', async () => {
    const composition = await generateComposition(spec.END_BEHAVIOR_FREEZE, player);
    const item = composition.getItemByName('sprite_1');

    composition.gotoAndStop(0.01 + 2);
    expect(item?.transform.getValid()).to.equal(true);
  });

  it('item loop', async () => {
    const composition = await generateComposition(spec.END_BEHAVIOR_RESTART, player);
    const item = composition.getItemByName('sprite_1');

    composition.gotoAndStop(1);
    expect(item?.transform.getValid()).to.equal(true);
  });
});

async function generateComposition (
  endBehavior: spec.EndBehavior,
  player: Player,
) {
  const json = `{"playerVersion":{"web":"1.6.5","native":"0.0.1.202311221223"},"images":[],"fonts":[],"spines":[],"version":"2.4","shapes":[],"plugins":[],"type":"ge","compositions":[{"id":"7","name":"composition1","duration":2,"startTime":0,"endBehavior":${spec.END_BEHAVIOR_FORWARD},"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":${endBehavior},"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1},"positionOverLifetime":{}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"7","bins":[],"textures":[]}`;
  const scene = await player.loadScene(JSON.parse(json));

  return scene;
}
