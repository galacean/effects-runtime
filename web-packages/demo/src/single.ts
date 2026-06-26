import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const json = `{
  "playerVersion": {
    "web": "2.8.11",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "8bfab36a62674e12b8f8cc95b985ab9a",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*p0YpQ4WXpwEAAAAAgCAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*e92yR4jH0bgAAAAAgCAAAAgAelB4AQ/original",
      "renderLevel": "B+",
      "webp": "https://mdn.alipayobjects.com/mars/afts/file/A*t6ZdSJH1Q6kAAAAAgCAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.6",
  "plugins": [
    "video"
  ],
  "type": "ge",
  "compositions": [
    {
      "id": "78efce1a1ebf4f558bec31267906dd70",
      "name": "新建合成1 (10)",
      "duration": 9,
      "startTime": 0,
      "endBehavior": 2,
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
          "id": "b260bad0652d4a66941b02e8e39f02e0"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "b260bad0652d4a66941b02e8e39f02e0",
      "item": {
        "id": "78efce1a1ebf4f558bec31267906dd70"
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "8a5ddb1e0c604a12b1ed7f1570549e64"
        },
        {
          "id": "0b6b424423c944a188a334eb5b5b4c44"
        }
      ],
      "timelineAsset": {
        "id": "3029e959591644cba72e13c677c9fd52"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "6adab07c7ffe4ccda73e45f4a7fd51a8"
          },
          "value": {
            "id": "8a5ddb1e0c604a12b1ed7f1570549e64"
          }
        },
        {
          "key": {
            "id": "23f3a18d60df46b9b8d9ec1a289bdeb7"
          },
          "value": {
            "id": "0b6b424423c944a188a334eb5b5b4c44"
          }
        }
      ]
    },
    {
      "id": "1c92a2986cff4a868b1cfe6874aaf784",
      "item": {
        "id": "8a5ddb1e0c604a12b1ed7f1570549e64"
      },
      "dataType": "VideoComponent",
      "options": {
        "startColor": [1, 1, 1, 1],
        "muted": true,
        "video": {
          "id": "017d5e0b1e3c44a3a07f39152a1b33b3"
        },
        "volume": 1,
        "playbackRate": 1,
        "transparent": true
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "96b1d1de56e44da79f7fc319f2dfd979"
        }
      }
    },
    {
      "id": "3fdc3d2a703c4ca5a4ac5dd7dccd8396",
      "item": {
        "id": "0b6b424423c944a188a334eb5b5b4c44"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "fdcfbcc360d34d5caa3181b732601d4f"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "8a5ddb1e0c604a12b1ed7f1570549e64",
      "name": "video_2",
      "duration": 8,
      "type": "video",
      "visible": true,
      "endBehavior": 4,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "1c92a2986cff4a868b1cfe6874aaf784"
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
          "x": 8.8589,
          "y": 17.2255
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
      "id": "0b6b424423c944a188a334eb5b5b4c44",
      "name": "KTX2",
      "duration": 9,
      "type": "1",
      "visible": true,
      "endBehavior": 0,
      "delay": 7.5,
      "renderLevel": "B+",
      "components": [
        {
          "id": "3fdc3d2a703c4ca5a4ac5dd7dccd8396"
        }
      ],
      "transform": {
        "position": {
          "x": -0.08448,
          "y": -5.1823,
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
          "x": 9.8594,
          "y": 10.2448
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
      "id": "fdcfbcc360d34d5caa3181b732601d4f",
      "source": {
        "id": "8bfab36a62674e12b8f8cc95b985ab9a"
      },
      "flipY": true
    },
    {
      "id": "96b1d1de56e44da79f7fc319f2dfd979",
      "source": {
        "id": "017d5e0b1e3c44a3a07f39152a1b33b3"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "3029e959591644cba72e13c677c9fd52",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "6adab07c7ffe4ccda73e45f4a7fd51a8"
        },
        {
          "id": "23f3a18d60df46b9b8d9ec1a289bdeb7"
        }
      ]
    },
    {
      "id": "a0b69032f60a4346a1a9b6499f2a2fd1",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "21c585d0aca545e3ba13f7b08c64a4ac",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "16a37a8747c842e0ac92ede7ae3fa8a8",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "19c20d69876b4da99d1613bcf66e295e",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 8,
          "endBehavior": 4,
          "asset": {
            "id": "a0b69032f60a4346a1a9b6499f2a2fd1"
          }
        }
      ]
    },
    {
      "id": "f16e32eea16d4e31840c6282455df69c",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 8,
          "endBehavior": 4,
          "asset": {
            "id": "21c585d0aca545e3ba13f7b08c64a4ac"
          }
        }
      ]
    },
    {
      "id": "6b8b53dd6d6f45439373d17be2afc10a",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 8,
          "endBehavior": 4,
          "asset": {
            "id": "16a37a8747c842e0ac92ede7ae3fa8a8"
          }
        }
      ]
    },
    {
      "id": "6adab07c7ffe4ccda73e45f4a7fd51a8",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "19c20d69876b4da99d1613bcf66e295e"
        },
        {
          "id": "f16e32eea16d4e31840c6282455df69c"
        },
        {
          "id": "6b8b53dd6d6f45439373d17be2afc10a"
        }
      ],
      "clips": []
    },
    {
      "id": "38b72ff096084b7f8c571a3610f0eb85",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "f737145f18f84069a44017d4ca9cf8d9",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "f7523b49adfe4354896dc333e326d9ba",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1],
      "colorOverLifetime": {
        "opacity": [21, [
            [4, [-0.003333, 0]
            ],
            [4, [0.1667, 1.01]
            ]
          ]
        ]
      }
    },
    {
      "id": "1dcd90ce75ff46fd82ef12028d9e90ff",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 7.5,
          "duration": 9,
          "endBehavior": 0,
          "asset": {
            "id": "38b72ff096084b7f8c571a3610f0eb85"
          }
        }
      ]
    },
    {
      "id": "584d2de073054bc391db4226be8550fb",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 7.5,
          "duration": 9,
          "endBehavior": 0,
          "asset": {
            "id": "f737145f18f84069a44017d4ca9cf8d9"
          }
        }
      ]
    },
    {
      "id": "d41e5b2c076b4cc897e25fdc7b348e88",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 7.5,
          "duration": 9,
          "endBehavior": 0,
          "asset": {
            "id": "f7523b49adfe4354896dc333e326d9ba"
          }
        }
      ]
    },
    {
      "id": "23f3a18d60df46b9b8d9ec1a289bdeb7",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "1dcd90ce75ff46fd82ef12028d9e90ff"
        },
        {
          "id": "584d2de073054bc391db4226be8550fb"
        },
        {
          "id": "d41e5b2c076b4cc897e25fdc7b348e88"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "78efce1a1ebf4f558bec31267906dd70",
  "videos": [
    {
      "id": "017d5e0b1e3c44a3a07f39152a1b33b3",
      "url": "https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*j8OtQY4vpr0AAAAAgBAAAAgAesF2AQ",
      "hevc": {
        "codec": "hev1.1.0.L93.B0",
        "url": "https://mdn.alipayobjects.com/mars/afts/video/A*-gO7Q5A8aOMAAAAAgLAAAAgAesF2AQ/540P_h265"
      }
    }
  ]
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

  await player.loadScene(JSON.parse(json));
})();
