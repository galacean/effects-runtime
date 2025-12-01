import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const json = `{
  "playerVersion": {
    "web": "2.6.0",
    "native": "0.0.1.202311221223"
  },
  "images": [],
  "fonts": [],
  "version": "3.3",
  "shapes": [],
  "plugins": [
    "video"
  ],
  "type": "ge",
  "compositions": [
    {
      "id": "90d8fafaf2db4bb09d85d0805da15632",
      "name": "刷剧",
      "duration": 3.67,
      "endBehavior": 0,
      "previewSize": [750, 1624],
      "camera": {
        "fov": 60,
        "far": 40,
        "near": 0.1,
        "clipMode": 1,
        "position": [0, 0, 8],
        "rotation": [0, 0, 0]
      },
      "sceneBindings": [
        {
          "key": {
            "id": "fdc939b293b241da86f87ed949dd301c"
          },
          "value": {
            "id": "61995ad967654622a2d0b38444540cc3"
          }
        }
      ],
      "timelineAsset": {
        "id": "a37092b85e4f4309a5138ae755437159"
      },
      "items": [
        {
          "id": "61995ad967654622a2d0b38444540cc3"
        }
      ],
      "startTime": 0
    }
  ],
  "components": [
    {
      "id": "fe4c8335fd564e96b167ef1475d7a230",
      "item": {
        "id": "61995ad967654622a2d0b38444540cc3"
      },
      "dataType": "VideoComponent",
      "options": {
        "startColor": [1, 1, 1, 1],
        "muted": true,
        "video": {
          "id": "e38870f6cc7c4a689b07ea6adb33d3a0"
        },
        "volume": 1,
        "playbackRate": 1,
        "transparent": true
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "e688285a65e446679b21dce4d07cef18"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "61995ad967654622a2d0b38444540cc3",
      "name": "video_2",
      "duration": 3.6667,
      "type": "video",
      "visible": true,
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "fe4c8335fd564e96b167ef1475d7a230"
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
          "x": 9.2272,
          "y": 15.8638
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
      "id": "e688285a65e446679b21dce4d07cef18",
      "source": {
        "id": "e38870f6cc7c4a689b07ea6adb33d3a0"
      },
      "flipY": true
    }
  ],
  "miscs": [
    {
      "id": "a37092b85e4f4309a5138ae755437159",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "fdc939b293b241da86f87ed949dd301c"
        }
      ]
    },
    {
      "id": "0733d8fd69364be9aa870371eab47396",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "5a80b4db21ba4cddb32af23c1c063eb3",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "a43e46972361480da6d9ba8b3d28f3bf",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "bd2c1b14a4fe42fe8a3a5780200ce262",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 3.6667,
          "endBehavior": 0,
          "asset": {
            "id": "0733d8fd69364be9aa870371eab47396"
          }
        }
      ]
    },
    {
      "id": "cae6956db3ad41669835dfa08120eebc",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 3.6667,
          "endBehavior": 0,
          "asset": {
            "id": "5a80b4db21ba4cddb32af23c1c063eb3"
          }
        }
      ]
    },
    {
      "id": "27775d50e1f944718d67662982c62fcf",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 3.6667,
          "endBehavior": 0,
          "asset": {
            "id": "a43e46972361480da6d9ba8b3d28f3bf"
          }
        }
      ]
    },
    {
      "id": "fdc939b293b241da86f87ed949dd301c",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "bd2c1b14a4fe42fe8a3a5780200ce262"
        },
        {
          "id": "cae6956db3ad41669835dfa08120eebc"
        },
        {
          "id": "27775d50e1f944718d67662982c62fcf"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "90d8fafaf2db4bb09d85d0805da15632",
  "videos": [
    {
      "id": "e38870f6cc7c4a689b07ea6adb33d3a0",
      "hevc": {
          "url": "https://gw.alipayobjects.com/v/huamei_sudmkl/afts/video/B9nsTZyXsJUAAAAASfAAAAgAfoeUAQBr",
          "codec": "hev1.1.6.L93.B0"
        },
      "url": "https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*45DbSrlgav8AAAAAXkAAAAgAesF2AQ"
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
