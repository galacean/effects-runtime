import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ktx2';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-ffd';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*1zOzT6g_Mw8AAAAAQgAAAAgAelB4AQ';
const json_ktx2_spine = 'https://mdn.alipayobjects.com/mars/afts/file/A*lnmBT7dsNNgAAAAAQFAAAAgAelB4AQ';
const json_ktx2 = `{
  "playerVersion": {
    "web": "2.7.0",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "981c5f4c34134005854cf0cb768d45be",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*Q0JLTZaekosAAAAAQpAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*Jo17ToPrHF8AAAAAQWAAAAgAelB4AQ/original"
    },
    {
      "id": "ae4e2e56505a4a4181f1911307d74cff",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*Qz8_R7XR_lQAAAAAQmAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*WoL5TqCEmukAAAAAQYAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.5",
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "1e96d2ae76eb4f81b3c5e589b1192419",
      "name": "新建合成1",
      "duration": 5,
      "startTime": 0,
      "endBehavior": 4,
      "previewSize": [750, 1624],
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
          "id": "3971de4f490a42eda24357ee4e29807e"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "3971de4f490a42eda24357ee4e29807e",
      "item": {
        "id": "1e96d2ae76eb4f81b3c5e589b1192419"
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "d0680050c92d48e4af6271ce0a7cf3ea"
        },
        {
          "id": "3b0050cfb14c4f5299e9275e5f7fde6c"
        }
      ],
      "timelineAsset": {
        "id": "7bbd2bf6757449e2999287e2ae1e5e4f"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "356e2c53d8b04614a32ced079db61d66"
          },
          "value": {
            "id": "d0680050c92d48e4af6271ce0a7cf3ea"
          }
        },
        {
          "key": {
            "id": "3848626cb16f4d13b4d57e9c754c34f1"
          },
          "value": {
            "id": "3b0050cfb14c4f5299e9275e5f7fde6c"
          }
        }
      ]
    },
    {
      "id": "291fc61dd0cc4ca4bbd132910db571b8",
      "item": {
        "id": "d0680050c92d48e4af6271ce0a7cf3ea"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "1c89a5f5c796475f8dd3fea2cc0c7847"
        }
      }
    },
    {
      "id": "b6cfdf624dde4638be85987129a38a20",
      "item": {
        "id": "3b0050cfb14c4f5299e9275e5f7fde6c"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "659aea660ef44becb625b9b868eab687"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "d0680050c92d48e4af6271ce0a7cf3ea",
      "name": "SuperAnt",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 2,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "291fc61dd0cc4ca4bbd132910db571b8"
        }
      ],
      "transform": {
        "position": {
          "x": 0.148,
          "y": -1.825,
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
          "x": 3.6914,
          "y": 4.7742
        },
        "scale": {
          "x": 1,
          "y": 1,
          "z": 1
        }
      },
      "dataType": "VFXItemData"
    },
    {
      "id": "3b0050cfb14c4f5299e9275e5f7fde6c",
      "name": "BCC61CB2-80C2-42b8-98C2-B1F27188C65B",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 2,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "b6cfdf624dde4638be85987129a38a20"
        }
      ],
      "transform": {
        "position": {
          "x": 0.148,
          "y": 2.2322,
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
          "x": 2.7937,
          "y": 3.861
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
      "id": "1c89a5f5c796475f8dd3fea2cc0c7847",
      "source": {
        "id": "981c5f4c34134005854cf0cb768d45be"
      },
      "flipY": true
    },
    {
      "id": "659aea660ef44becb625b9b868eab687",
      "source": {
        "id": "ae4e2e56505a4a4181f1911307d74cff"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "7bbd2bf6757449e2999287e2ae1e5e4f",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "356e2c53d8b04614a32ced079db61d66"
        },
        {
          "id": "3848626cb16f4d13b4d57e9c754c34f1"
        }
      ]
    },
    {
      "id": "ed8b2fbab2d54d17bec03191e27b01c1",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "801ee6c0e5d546f1b39ef5eaa4c2c5f4",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "1aacab2406b24540929e5c3160eddf45",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "202c44f8f0064c39bc359a914211cd94",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "ed8b2fbab2d54d17bec03191e27b01c1"
          }
        }
      ]
    },
    {
      "id": "a5955e85e37a49738d4eeaf118640c1b",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "801ee6c0e5d546f1b39ef5eaa4c2c5f4"
          }
        }
      ]
    },
    {
      "id": "9942fbe490264fd29f62c4332912bf62",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "1aacab2406b24540929e5c3160eddf45"
          }
        }
      ]
    },
    {
      "id": "356e2c53d8b04614a32ced079db61d66",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "202c44f8f0064c39bc359a914211cd94"
        },
        {
          "id": "a5955e85e37a49738d4eeaf118640c1b"
        },
        {
          "id": "9942fbe490264fd29f62c4332912bf62"
        }
      ],
      "clips": []
    },
    {
      "id": "4da1f85119c64feba5b52f015f0b62c9",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "1d3ec98141dd44b09353ee7ec84c40e9",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "53ede6ae987849d6b8aca06cd3968a96",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1],
      "colorOverLifetime": {
        "opacity": [21, [
            [4, [0.128, 1]
            ],
            [4, [0.274, 0]
            ]
          ]
        ]
      }
    },
    {
      "id": "d218c1babebe4d519842728dc51ec1a5",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "4da1f85119c64feba5b52f015f0b62c9"
          }
        }
      ]
    },
    {
      "id": "2ed85474222f4df584a830e15fd03b32",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "1d3ec98141dd44b09353ee7ec84c40e9"
          }
        }
      ]
    },
    {
      "id": "cfba32cec3f14db197d80fcb5d759f02",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 2,
          "asset": {
            "id": "53ede6ae987849d6b8aca06cd3968a96"
          }
        }
      ]
    },
    {
      "id": "3848626cb16f4d13b4d57e9c754c34f1",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "d218c1babebe4d519842728dc51ec1a5"
        },
        {
          "id": "2ed85474222f4df584a830e15fd03b32"
        },
        {
          "id": "cfba32cec3f14db197d80fcb5d759f02"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "1e96d2ae76eb4f81b3c5e589b1192419"
}`;
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(json_ktx2_spine, {
    useCompressedTexture: true,
  });
})();
