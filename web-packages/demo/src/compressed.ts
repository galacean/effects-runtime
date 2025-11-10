import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

//uastc
//https://mdn.alipayobjects.com/oasis_be/afts/img/A*jgEpQL3iLTwAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2
//etc1s
//https://mdn.alipayobjects.com/oasis_be/afts/img/A*AjHmTaAxmKAAAAAAQXAAAAgAekp5AQ/original/SuperAnt.ktx2
const json = inspireList.compressed.url;
const json_ktx2 = `{
  "playerVersion": {
    "web": "2.6.6",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "80b823c7fc5b453ba72efc773c6516ba",
      "ktx2": "https://mdn.alipayobjects.com/oasis_be/afts/img/A*jgEpQL3iLTwAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2",
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*Zs_yTqFmcMQAAAAAQXAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.4",
  "shapes": [],
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "1b327b98b72a41cfa0aab2f0a2df997b",
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
          "id": "94963ccccefc41f1b741a9dcab6f4bbe"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "94963ccccefc41f1b741a9dcab6f4bbe",
      "item": {
        "id": ""
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "504abd081e174c24aa63cd22e07fa74b"
        }
      ],
      "timelineAsset": {
        "id": "d7d907cc58204a66966ea0a43ffe9f61"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "ee53f73f7aaf47b19f28b1d501e68c4d"
          },
          "value": {
            "id": "504abd081e174c24aa63cd22e07fa74b"
          }
        }
      ]
    },
    {
      "id": "90722c73daed4a1caf39f89fa1f28561",
      "item": {
        "id": "504abd081e174c24aa63cd22e07fa74b"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "4d5e642519e940b7b211ca6dde9e38ca"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "504abd081e174c24aa63cd22e07fa74b",
      "name": "SuperAnt",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "90722c73daed4a1caf39f89fa1f28561"
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
          "x": 3.6907,
          "y": 4.7733
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
      "id": "4d5e642519e940b7b211ca6dde9e38ca",
      "source": {
        "id": "80b823c7fc5b453ba72efc773c6516ba"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "d7d907cc58204a66966ea0a43ffe9f61",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "ee53f73f7aaf47b19f28b1d501e68c4d"
        }
      ]
    },
    {
      "id": "a259182ad2bc4ed7a89e39dd9733a7a1",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "ad803aacc9e642c7933ef82988631237",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "06c43a4540fe4267b0a82f3eabb5c664",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "a42741c1435c42cb9535a51b6117e593",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "a259182ad2bc4ed7a89e39dd9733a7a1"
          }
        }
      ]
    },
    {
      "id": "ef706715e9d84b36962fe5f563f9e715",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "ad803aacc9e642c7933ef82988631237"
          }
        }
      ]
    },
    {
      "id": "812e5b7d74bb4993a161a29d6afd03bf",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "06c43a4540fe4267b0a82f3eabb5c664"
          }
        }
      ]
    },
    {
      "id": "ee53f73f7aaf47b19f28b1d501e68c4d",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "a42741c1435c42cb9535a51b6117e593"
        },
        {
          "id": "ef706715e9d84b36962fe5f563f9e715"
        },
        {
          "id": "812e5b7d74bb4993a161a29d6afd03bf"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "1b327b98b72a41cfa0aab2f0a2df997b"
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
