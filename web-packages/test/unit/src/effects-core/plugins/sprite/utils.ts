import type { Player, spec } from '@galacean/effects';

// 使用 1.5 版本的 json 进行测试
export const generateSceneJSON = (items: spec.Item[]) => {
  const json = '{"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*RwX8SqbAZZoAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UBY5SIBoRVgAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"spines":[],"version":"2.4","shapes":[],"plugins":[],"type":"mars","compositions":[{"id":"13","name":"测试合成","duration":5,"startTime":0,"endBehavior":5,"previewSize":[750,713],"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"rotation":[0,0,0],"clipMode":1}}],"requires":[],"compositionId":"13","bins":[],"textures":[{"source":0,"flipY":true}]}';
  const result = JSON.parse(json);

  result.compositions[0].items = items;

  return result;
};

export async function loadSceneAndPlay (
  player: Player,
  items: spec.Item[],
  currentTime = 0.01,
) {
  const json = generateSceneJSON(items);
  const composition = await player.loadScene(json);

  player.gotoAndPlay(currentTime);

  return composition;
}

export function sanitizeNumbers (vec: number[], zeroValue = Number.EPSILON) {
  return vec.map(num => {
    if (Math.abs(num) <= zeroValue || 1 / num === -Infinity) {
      return 0;
    }

    return num;
  });
}
