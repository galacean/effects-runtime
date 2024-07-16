import { getStandardJSON, spec } from '@galacean/effects';

const { expect } = chai;

describe('Null item endBehavior', () => {
  it('destroy to forward', () => {
    const json = '{"images":[],"spines":[],"version":"1.5","shapes":[],"plugins":[],"type":"mars","compositions":[{"id":"6","name":"新建合成1","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"1","name":"sprite_1","duration":5,"type":"1","parentId":"2","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}},{"id":"2","name":"null_2","duration":5,"type":"3","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"positionOverLifetime":{}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}],"camera":{"fov":60,"far":40,"near":0.1,"clipMode":1,"position":[0,0,8],"rotation":[0,0,0]}}],"requires":[],"compositionId":"6","bins":[],"textures":[]}';
    const { version, compositions, items } = getStandardJSON(JSON.parse(json));

    expect(version).to.eq('3.0');
    items.forEach(item => {
      if (item.type === spec.ItemType.null) {
        expect(item.endBehavior).to.eq(spec.EndBehavior.freeze);
      }
    });
  });
});
