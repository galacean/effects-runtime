type GLTFLoadMode = 'playAnimation0' | 'playAllAnimation';

type SceneRule = {
  case3DFullTime?: boolean,
  gltfAllTime?: boolean,
  gltfLoadMode?: GLTFLoadMode,
};

const SCENE_RULES: Record<string, SceneRule> = {
  '简单 Morph': {
    case3DFullTime: true,
  },
  'Restart 测试': {
    case3DFullTime: true,
  },
  '818 圆环': {
    case3DFullTime: true,
  },
  ebec344a9fa02bec3b9987d475e04191: {
    gltfAllTime: false,
    gltfLoadMode: 'playAnimation0',
  },
  '5eb610471972b998b9d570987d72d784': {
    gltfAllTime: false,
    gltfLoadMode: 'playAnimation0',
  },
  'CesiumMan.glb': {
    gltfAllTime: false,
  },
};

function getSceneRule (sceneName: string): SceneRule {
  return SCENE_RULES[sceneName] ?? {};
}

export function is3DCaseFullTimeScene (sceneName: string) {
  return getSceneRule(sceneName).case3DFullTime === true;
}

export function getGLTFLoadOptionsBySceneName (sceneName: string) {
  const { gltfLoadMode } = getSceneRule(sceneName);

  if (gltfLoadMode === 'playAnimation0') {
    return { playAnimation: 0 } as const;
  }

  return { playAllAnimation: true } as const;
}

export function isGLTFAllTimeScene (sceneName: string) {
  return getSceneRule(sceneName).gltfAllTime !== false;
}
