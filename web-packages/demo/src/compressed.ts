import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ktx2';

const json_ktx2 = `{
  "playerVersion": {
    "web": "2.7.3",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "6a7f84aea6c044a4b055fcdeeef8d49e",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*mTDtSbgkNUoAAAAAQIAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*Jo17ToPrHF8AAAAAQWAAAAgAelB4AQ/original"
    },
    {
      "id": "329790a354254d6fb9ebb8004abf9a00",
      "ktx2": "https://mdn.alipayobjects.com/mars/afts/file/A*_ocyQKtPvR8AAAAAQKAAAAgAelB4AQ/original",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*WoL5TqCEmukAAAAAQYAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.5",
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "4a18d8d3c87a43e7975608f28d481760",
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
          "id": "677c3ae1a28c4a05980abf510208475f"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "677c3ae1a28c4a05980abf510208475f",
      "item": {
        "id": "4a18d8d3c87a43e7975608f28d481760"
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
        "id": "ea328671aa284b5da74fefc67f28a378"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "5d14464a734a47b2888a8edbd5146ba2"
          },
          "value": {
            "id": "d0680050c92d48e4af6271ce0a7cf3ea"
          }
        },
        {
          "key": {
            "id": "53c6b3a6790145108808883dd9f67434"
          },
          "value": {
            "id": "3b0050cfb14c4f5299e9275e5f7fde6c"
          }
        }
      ]
    },
    {
      "id": "83bf293fb5d444878274ce7ed22658f4",
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
          "id": "362bdc0d384d499c82e198bc916241c8"
        }
      }
    },
    {
      "id": "97053e05ed194bafb5bd0eaeb35d11e3",
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
          "id": "813bca9a61e94edf97b14465ab03f046"
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
          "id": "83bf293fb5d444878274ce7ed22658f4"
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
          "id": "97053e05ed194bafb5bd0eaeb35d11e3"
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
      "id": "362bdc0d384d499c82e198bc916241c8",
      "source": {
        "id": "6a7f84aea6c044a4b055fcdeeef8d49e"
      },
      "flipY": true
    },
    {
      "id": "813bca9a61e94edf97b14465ab03f046",
      "source": {
        "id": "329790a354254d6fb9ebb8004abf9a00"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "ea328671aa284b5da74fefc67f28a378",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "5d14464a734a47b2888a8edbd5146ba2"
        },
        {
          "id": "53c6b3a6790145108808883dd9f67434"
        }
      ]
    },
    {
      "id": "a0015638f99140128af2916ac7e6fddc",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "7e69de4e7c5b48e4867ebee3fa15cada",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "99da978afa734db38e260a4286483fc8",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "7802e10ee5a1448ca3948a14437091dd",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "a0015638f99140128af2916ac7e6fddc"
          }
        }
      ]
    },
    {
      "id": "b530d2f083294eb2b7b2ad66667078c1",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "7e69de4e7c5b48e4867ebee3fa15cada"
          }
        }
      ]
    },
    {
      "id": "bb7da4436d664b52b7b76f0679e93737",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "99da978afa734db38e260a4286483fc8"
          }
        }
      ]
    },
    {
      "id": "5d14464a734a47b2888a8edbd5146ba2",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "7802e10ee5a1448ca3948a14437091dd"
        },
        {
          "id": "b530d2f083294eb2b7b2ad66667078c1"
        },
        {
          "id": "bb7da4436d664b52b7b76f0679e93737"
        }
      ],
      "clips": []
    },
    {
      "id": "e8fec4f74ce64407907e4c71cd22b2bf",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "e7b1916a928d478784212419b7b2d576",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "cecacce5574f4557888bd8c46635aff7",
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
      "id": "f68c7d7d50c54954ab0bca70c7e76a99",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "e8fec4f74ce64407907e4c71cd22b2bf"
          }
        }
      ]
    },
    {
      "id": "8ec7ebbf8ebe42c2a332f1747422d709",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "e7b1916a928d478784212419b7b2d576"
          }
        }
      ]
    },
    {
      "id": "a1e4fabf9d8c4018b34b346fb4b3dbc2",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "cecacce5574f4557888bd8c46635aff7"
          }
        }
      ]
    },
    {
      "id": "53c6b3a6790145108808883dd9f67434",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "f68c7d7d50c54954ab0bca70c7e76a99"
        },
        {
          "id": "8ec7ebbf8ebe42c2a332f1747422d709"
        },
        {
          "id": "a1e4fabf9d8c4018b34b346fb4b3dbc2"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "4a18d8d3c87a43e7975608f28d481760"
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
