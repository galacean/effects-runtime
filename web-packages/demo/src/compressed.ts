import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ktx2';
import { registerKTX2Loader, unregisterKTX2Loader } from '@galacean/effects-plugin-ktx2';

const json = `
{
  "playerVersion": {
    "web": "2.8.9",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "c1f6ee3cb65d4eb499580362fcddf50a",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*SKPgSZDpJKoAAAAAgCAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*TUMcSrXq6hsAAAAAgGAAAAgAelB4AQ/original",
      "renderLevel": "B+",
      "webp": "https://mdn.alipayobjects.com/mars/afts/file/A*t6ZdSJH1Q6kAAAAAgCAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.6",
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "fe2b7fc662cf46369ab5e6ac44854548",
      "name": "KTX2",
      "duration": 5,
      "startTime": 0,
      "endBehavior": 2,
      "previewSize": [1024, 1024],
      "camera": {
        "fov": 60,
        "far": 40,
        "near": 0.1,
        "clipMode": 1,
        "position": [0, 0, 8],
        "rotation": [0, 0, 0]
      },
      "components": [
        {
          "id": "cb954cc0023d420a9d0e278381238f0e"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "cb954cc0023d420a9d0e278381238f0e",
      "item": {
        "id": "fe2b7fc662cf46369ab5e6ac44854548"
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "64e32243fe0a4e49b15e1fc6614abe1e"
        }
      ],
      "timelineAsset": {
        "id": "ee5080015b884b2a98c7cd5e1aea422e"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "e77af121dbe44abc94eb1331d5fc686c"
          },
          "value": {
            "id": "64e32243fe0a4e49b15e1fc6614abe1e"
          }
        }
      ]
    },
    {
      "id": "219804e271e9421d9e24240b7bcec50a",
      "item": {
        "id": "64e32243fe0a4e49b15e1fc6614abe1e"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "0a979208b247473eac2151c2f158b20e"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "64e32243fe0a4e49b15e1fc6614abe1e",
      "name": "KTX2",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 4,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "219804e271e9421d9e24240b7bcec50a"
        }
      ],
      "transform": {
        "position": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "eulerHint": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "anchor": {
          "x": 0,
          "y": 0
        },
        "size": {
          "x": 10,
          "y": 10
        },
        "scale": {
          "x": 1,
          "y": 1,
          "z": 1
        }
      },
      "dataType": "VFXItemData"
    }
  ],
  "shaders": [],
  "bins": [],
  "textures": [
    {
      "id": "0a979208b247473eac2151c2f158b20e",
      "source": {
        "id": "c1f6ee3cb65d4eb499580362fcddf50a"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "ee5080015b884b2a98c7cd5e1aea422e",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "e77af121dbe44abc94eb1331d5fc686c"
        }
      ]
    },
    {
      "id": "0c1e52f68ecd4545acd57b4d785a6d60",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "9bb30f59b8c24b409dc98bf870761495",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "771b8d499f054ad2a875bdd23e8f5a69",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "e52a877147dc4e1c8ab3ea41dc8b8ed2",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "0c1e52f68ecd4545acd57b4d785a6d60"
          }
        }
      ]
    },
    {
      "id": "156d56f9b9c141b2a7b5bbf33c09a200",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "9bb30f59b8c24b409dc98bf870761495"
          }
        }
      ]
    },
    {
      "id": "6011d376e301496988bf3b9063eba154",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "771b8d499f054ad2a875bdd23e8f5a69"
          }
        }
      ]
    },
    {
      "id": "e77af121dbe44abc94eb1331d5fc686c",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "e52a877147dc4e1c8ab3ea41dc8b8ed2"
        },
        {
          "id": "156d56f9b9c141b2a7b5bbf33c09a200"
        },
        {
          "id": "6011d376e301496988bf3b9063eba154"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "fe2b7fc662cf46369ab5e6ac44854548"
}
`;

const container = document.getElementById('J-container');
const mockBtn = document.getElementById('J-mock-btn') as HTMLButtonElement;

// 保存原始的 getExtension 方法
const originalWebGLGetExtension = WebGLRenderingContext.prototype.getExtension;
const originalWebGL2GetExtension = WebGL2RenderingContext.prototype.getExtension;

function mockNoKTX2Support () {
  WebGLRenderingContext.prototype.getExtension = function (this: WebGLRenderingContext, name: string) {
    if (name === 'WEBGL_compressed_texture_astc' || name === 'WEBKIT_WEBGL_compressed_texture_astc') {
      return null;
    }

    return originalWebGLGetExtension.call(this, name as Parameters<typeof originalWebGLGetExtension>[0]);
  } as typeof WebGLRenderingContext.prototype.getExtension;

  WebGL2RenderingContext.prototype.getExtension = function (this: WebGL2RenderingContext, name: string) {
    if (name === 'WEBGL_compressed_texture_astc' || name === 'WEBKIT_WEBGL_compressed_texture_astc') {
      return null;
    }

    return originalWebGL2GetExtension.call(this, name as Parameters<typeof originalWebGL2GetExtension>[0]);
  } as typeof WebGL2RenderingContext.prototype.getExtension;
}

// 恢复原始的 getExtension 方法
function restoreKTX2Support () {
  WebGLRenderingContext.prototype.getExtension = originalWebGLGetExtension;
  WebGL2RenderingContext.prototype.getExtension = originalWebGL2GetExtension;
}

let player: Player | null = null;
let isMocked = false;

async function loadScene () {
  // 销毁旧的 player 实例
  if (player) {
    player.dispose();
    player = null;
  }

  player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: err => {
      console.error('biz', err.message);
    },
  });

  // 使用 WebWorker，需要先卸载默认的主线程加载器，再注册使用 WebWorker 的加载器
  // unregisterKTX2Loader();
  // registerKTX2Loader(2);

  await player.loadScene(JSON.parse(json), {
    useCompressedTexture: true,
  });
}

// 按钮点击：切换 mock 状态并重新加载场景
mockBtn.addEventListener('click', async () => {
  mockBtn.disabled = true;
  mockBtn.textContent = '加载中...';

  if (isMocked) {
    restoreKTX2Support();
    isMocked = false;
  } else {
    mockNoKTX2Support();
    isMocked = true;
  }

  await loadScene();

  mockBtn.textContent = isMocked ? '恢复原始状态' : '模拟不支持KTX2';
  mockBtn.disabled = false;
});

// 初始加载
void loadScene();
