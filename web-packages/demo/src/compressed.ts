import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

//uastc
//https://mdn.alipayobjects.com/oasis_be/afts/img/A*jgEpQL3iLTwAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2
//etc1s
//https://mdn.alipayobjects.com/oasis_be/afts/img/A*AjHmTaAxmKAAAAAAQXAAAAgAekp5AQ/original/SuperAnt.ktx2
const json = inspireList.compressed.url;
const json_ktx2 = `{
  "playerVersion": {
    "web": "2.7.0",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "c04e3c0983e843e5adec11ada3a0a2b9",
      "compressed": {
        "astc": "https://mdn.alipayobjects.com/oasis_be/afts/img/A*AjHmTaAxmKAAAAAAQXAAAAgAekp5AQ/original/SuperAnt.ktx2"
      },
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*NpZ-T6ix53kAAAAAQYAAAAgAelB4AQ/original"
    },
    {
      "id": "a1411be576f24bf5bc3ee565458a5d2d",
      "compressed": {
        "astc": "https://mdn.alipayobjects.com/oasis_be/afts/img/A*jgEpQL3iLTwAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2"
      },
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*NpZ-T6ix53kAAAAAQYAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.5",
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "62c04a5ef1554eab8d455e319a332073",
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
          "id": "0d1c0349d8b649dea12540bf1acbb3b5"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "0d1c0349d8b649dea12540bf1acbb3b5",
      "item": {
        "id": "62c04a5ef1554eab8d455e319a332073"
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
        "id": "d749350b6bac47328acdb5e6e068dc66"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "2362e1f50d5b491aa6ba89bf32655a4c"
          },
          "value": {
            "id": "d0680050c92d48e4af6271ce0a7cf3ea"
          }
        },
        {
          "key": {
            "id": "5c76d1796ab94b60a2ee10ea237d596b"
          },
          "value": {
            "id": "3b0050cfb14c4f5299e9275e5f7fde6c"
          }
        }
      ]
    },
    {
      "id": "274304693adc410a8ea60c625586a4d1",
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
          "id": "005bca74358845f4a09ff032261da9d9"
        }
      }
    },
    {
      "id": "91b8d1776e9442cdb0d88e5413a996c3",
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
          "id": "2f88ef60b9c345fdb4b555dd4ca46571"
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
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "274304693adc410a8ea60c625586a4d1"
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
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "91b8d1776e9442cdb0d88e5413a996c3"
        }
      ],
      "transform": {
        "position": {
          "x": 0.4721,
          "y": 3.2121,
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
          "x": 4.3396,
          "y": 4.2421
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
      "id": "005bca74358845f4a09ff032261da9d9",
      "source": {
        "id": "c04e3c0983e843e5adec11ada3a0a2b9"
      },
      "flipY": true
    },
    {
      "id": "2f88ef60b9c345fdb4b555dd4ca46571",
      "source": {
        "id": "a1411be576f24bf5bc3ee565458a5d2d"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "d749350b6bac47328acdb5e6e068dc66",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "2362e1f50d5b491aa6ba89bf32655a4c"
        },
        {
          "id": "5c76d1796ab94b60a2ee10ea237d596b"
        }
      ]
    },
    {
      "id": "98a6c13066db447d83f09e0b3a92b43e",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "a0ec4bdb50374befa35862677f64fb9f",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "aaacb167793548e69cd1be14ac13ec45",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "7972e21daf954a40a905b70ad63e2cc5",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "98a6c13066db447d83f09e0b3a92b43e"
          }
        }
      ]
    },
    {
      "id": "c584097da0094c48a9a67341e98c4956",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "a0ec4bdb50374befa35862677f64fb9f"
          }
        }
      ]
    },
    {
      "id": "95d7d0ba997641e2933c4eb467042623",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "aaacb167793548e69cd1be14ac13ec45"
          }
        }
      ]
    },
    {
      "id": "2362e1f50d5b491aa6ba89bf32655a4c",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "7972e21daf954a40a905b70ad63e2cc5"
        },
        {
          "id": "c584097da0094c48a9a67341e98c4956"
        },
        {
          "id": "95d7d0ba997641e2933c4eb467042623"
        }
      ],
      "clips": []
    },
    {
      "id": "133db6e80fae4fdbb685013c2768dec7",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "907469eeb1a8455a8446cd6282b1a3da",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "0520f1fb121d4461906bf7207445caf4",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "49a1d797e7814e4faea43af01576390e",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "133db6e80fae4fdbb685013c2768dec7"
          }
        }
      ]
    },
    {
      "id": "eab59a57e8d84f33840bf5ba4789bdf6",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "907469eeb1a8455a8446cd6282b1a3da"
          }
        }
      ]
    },
    {
      "id": "97899f04448a4670bf60fa2a1aa40cfb",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "0520f1fb121d4461906bf7207445caf4"
          }
        }
      ]
    },
    {
      "id": "5c76d1796ab94b60a2ee10ea237d596b",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "49a1d797e7814e4faea43af01576390e"
        },
        {
          "id": "eab59a57e8d84f33840bf5ba4789bdf6"
        },
        {
          "id": "97899f04448a4670bf60fa2a1aa40cfb"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "62c04a5ef1554eab8d455e319a332073"
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

  await player.loadScene(JSON.parse(json_ktx2), {
    useCompressedTexture: true,
  });
})();
