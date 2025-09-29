import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

//ktx2 file 'https://mdn.alipayobjects.com/oasis_be/afts/img/A*vYbvQLTyemoAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2'
const json = inspireList.compressed.url;
const json_ktx2 = `{
  "playerVersion": {
    "web": "2.6.6",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "id": "cbb3fa8a242f41c2a0d2cc8d4d2cbe0f",
      "compressed": {
        "astc": "https://mdn.alipayobjects.com/oasis_be/afts/img/A*vYbvQLTyemoAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2"
      },
      "url": "https://mdn.alipayobjects.com/oasis_be/afts/img/A*vYbvQLTyemoAAAAAQqAAAAgAekp5AQ/original/SuperAnt.ktx2"
    }
  ],
  "fonts": [],
  "version": "3.4",
  "shapes": [],
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "c3dfadd84b01460496706be3e5cfc612",
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
          "id": "e14b6b3636414d69a9fddff7521d6f14"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "e14b6b3636414d69a9fddff7521d6f14",
      "item": {
        "id": ""
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "204e246c5f8e46a591a843e717689e58"
        }
      ],
      "timelineAsset": {
        "id": "69be1871105442afa77ea0c67bce3dec"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "63643a56fd694df58b878168e58e0aa4"
          },
          "value": {
            "id": "204e246c5f8e46a591a843e717689e58"
          }
        }
      ]
    },
    {
      "id": "222eaf8dbc114a5fb32e56194270b832",
      "item": {
        "id": "204e246c5f8e46a591a843e717689e58"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [1, 1, 1, 1]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "6ac16b0c4b6e4134968d30f694178839"
        }
      }
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "204e246c5f8e46a591a843e717689e58",
      "name": "SuperAnt",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 4,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "222eaf8dbc114a5fb32e56194270b832"
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
          "x": 1,
          "y": 1.2892
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
      "id": "6ac16b0c4b6e4134968d30f694178839",
      "source": {
        "id": "cbb3fa8a242f41c2a0d2cc8d4d2cbe0f"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "69be1871105442afa77ea0c67bce3dec",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "63643a56fd694df58b878168e58e0aa4"
        }
      ]
    },
    {
      "id": "17c64db1326a47a98754ae7521e132c3",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "d53f73d621534653b48d0247322fe435",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {

      }
    },
    {
      "id": "60573fadbaed4caf9693ae321f43afb6",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [1, 1, 1, 1]
    },
    {
      "id": "f9f0c2510bae4a68b188aad8b362c515",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "17c64db1326a47a98754ae7521e132c3"
          }
        }
      ]
    },
    {
      "id": "b95329944d3849f692f9833e041d4a81",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "d53f73d621534653b48d0247322fe435"
          }
        }
      ]
    },
    {
      "id": "3583e20f36ee42aaaa521e8044153e51",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 4,
          "asset": {
            "id": "60573fadbaed4caf9693ae321f43afb6"
          }
        }
      ]
    },
    {
      "id": "63643a56fd694df58b878168e58e0aa4",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "f9f0c2510bae4a68b188aad8b362c515"
        },
        {
          "id": "b95329944d3849f692f9833e041d4a81"
        },
        {
          "id": "3583e20f36ee42aaaa521e8044153e51"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "c3dfadd84b01460496706be3e5cfc612"
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
