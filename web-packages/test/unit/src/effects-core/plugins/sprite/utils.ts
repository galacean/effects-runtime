// @ts-nocheck

// 使用1.5版本的json进行测试
export const generateSceneJSON = items => {
  const json = '{"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*RwX8SqbAZZoAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UBY5SIBoRVgAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"spines":[],"version":"1.5","shapes":[],"plugins":[],"type":"mars","compositions":[{"id":"13","name":"测试合成","duration":5,"startTime":0,"endBehavior":5,"previewSize":[750,713],"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"rotation":[0,0,0],"clipMode":1}}],"requires":[],"compositionId":"13","bins":[],"textures":[{"source":0,"flipY":true}]}';
  const result = JSON.parse(json);

  result.compositions[0].items = items;

  return result;
};

export const loadSceneAndPlay = async (player, items, options = {}) => {
  const json = generateSceneJSON(items);

  const comp = await player.loadScene(json);

  if (!options.currentTime) {
    options.currentTime = 0.01;
  }

  player.gotoAndPlay(options.currentTime);

  return comp;
};

export function sanitizeNumbers (vec, zeroValue = Number.EPSILON) {
  return vec.map(function (num) {
    if (Math.abs(num) <= zeroValue || 1 / num === -Infinity) {
      return 0;
    }

    return num;
  });
}

export function mapSplitItemNames (split) {
  return split.items.map(i => i.name);
}

export function mapSpriteGroupItemIndices (spriteGroup) {
  return spriteGroup.items.map(item => item.listIndex);
}
