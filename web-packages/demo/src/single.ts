import { AssetManager, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/YDITHDADWXXM/1601633123-e644d.json';
// 蒙版
// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/HCQBCOWGHRQC/273965510-c5c29.json';
// 蒙版新数据
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*36ybTZJI4JEAAAAAAAAAAAAADlB4AQ';
// 普通拖尾
// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/RYYAXEAYMIYJ/1314733612-96c0b.json';
// 图贴拖尾
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*VRedS5UU8DAAAAAAAAAAAAAADlB4AQ';
// 3D
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*sA-6TJ695dYAAAAAAAAAAAAADlB4AQ';
// 特效元素
/*const json = {
  'playerVersion': {
    'web': '2.2.5',
    'native': '0.0.1.202311221223',
  },
  'images': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*IJIyR70UU3cAAAAAAAAAAAAAelB4AQ/original',
      'id': '9e0c04f933354a98b473d25a7f26fcf5',
      'renderLevel': 'B+',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*mks8SrLGKo0AAAAAAAAAAAAAelB4AQ/original',
    },
  ],
  'fonts': [],
  'version': '3.1',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [
    {
      'id': '2',
      'name': '新建合成1 (1)',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 4,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': 'e858da630d55426c86629ad50640ff5c',
        },
        {
          'id': '38d99ac1571947d688c80956a569e44a',
        },
      ],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [
          0,
          0,
          8,
        ],
        'rotation': [
          0,
          0,
          0,
        ],
      },
      'sceneBindings': [
        {
          'key': {
            'id': '44f15eaa915044309c0f760522f06373',
          },
          'value': {
            'id': 'e858da630d55426c86629ad50640ff5c',
          },
        },
        {
          'key': {
            'id': '65804fd5dabb4261a1458837cfa966ff',
          },
          'value': {
            'id': '38d99ac1571947d688c80956a569e44a',
          },
        },
      ],
      'timelineAsset': {
        'id': 'e5699539910d4f1f8d9783f7059a5fc9',
      },
    },
  ],
  'components': [
    {
      'id': '942129cf150f4d6fa6d8c47621e23226',
      'item': {
        'id': 'e858da630d55426c86629ad50640ff5c',
      },
      'dataType': 'SpriteComponent',
      'options': {
        'startColor': [
          1,
          1,
          1,
          1,
        ],
      },
      'renderer': {
        'renderMode': 1,
        'texture': {
          'id': '926704d2aa9d4758aa2d8546030c5073',
        },
        'maskMode': 1,
      },
      'splits': [
        [
          0,
          0,
          0.65625,
          0.58984375,
          0,
        ],
      ],
      'mask': {
        'mask': true,
        'mode': 1,
        'ref': 2,
      },
    },
    {
      'id': '1b12b88203ef46dd8526ca1d775c56f1',
      'item': {
        'id': '38d99ac1571947d688c80956a569e44a',
      },
      'dataType': 'SpriteComponent',
      'options': {
        'startColor': [
          1,
          1,
          1,
          1,
        ],
      },
      'renderer': {
        'renderMode': 1,
        'maskMode': 2,
      },
      'mask': {
        'mode': 2,
        'ref': 2,
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': 'e858da630d55426c86629ad50640ff5c',
      'name': '星形',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '942129cf150f4d6fa6d8c47621e23226',
        },
      ],
      'transform': {
        'position': {
          'x': -0.2329,
          'y': 5.5336,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 4.1352,
          'y': 3.7178,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
    {
      'id': '38d99ac1571947d688c80956a569e44a',
      'name': 'sprite_5',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '1b12b88203ef46dd8526ca1d775c56f1',
        },
      ],
      'transform': {
        'position': {
          'x': -0.2329,
          'y': 5.5336,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 5.5674,
          'y': 4.8114,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
  ],
  'shaders': [],
  'bins': [],
  'textures': [
    {
      'id': '926704d2aa9d4758aa2d8546030c5073',
      'source': {
        'id': '9e0c04f933354a98b473d25a7f26fcf5',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': 'e5699539910d4f1f8d9783f7059a5fc9',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': '44f15eaa915044309c0f760522f06373',
        },
        {
          'id': '65804fd5dabb4261a1458837cfa966ff',
        },
      ],
    },
    {
      'id': '76ddffd12a2443259611fa570398e9bf',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '7038e6ecd6f74ce39bef3790667644da',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '78945f7f1b2d4e478fbef7495dfde2e2',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': '9643cf6a887f45268996f5f742a1bd9c',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '76ddffd12a2443259611fa570398e9bf',
          },
        },
      ],
    },
    {
      'id': '398c4d6feee14bcf8e33b6d0078d89ce',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '7038e6ecd6f74ce39bef3790667644da',
          },
        },
      ],
    },
    {
      'id': 'db8e3551c0a148339e77c25aa40d5bd6',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '78945f7f1b2d4e478fbef7495dfde2e2',
          },
        },
      ],
    },
    {
      'id': '44f15eaa915044309c0f760522f06373',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '9643cf6a887f45268996f5f742a1bd9c',
        },
        {
          'id': '398c4d6feee14bcf8e33b6d0078d89ce',
        },
        {
          'id': 'db8e3551c0a148339e77c25aa40d5bd6',
        },
      ],
      'clips': [],
    },
    {
      'id': '1dfe909120224af1906466ce47ef14dc',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '14f09f65baef415b943991f5ac1fb904',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': 'd211a6c552124e1abd817ef4c285be83',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': 'fb5b6bd942194a60bdc832af33a1d1a2',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '1dfe909120224af1906466ce47ef14dc',
          },
        },
      ],
    },
    {
      'id': 'cb37b7b1f8554477914a33751fec8446',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '14f09f65baef415b943991f5ac1fb904',
          },
        },
      ],
    },
    {
      'id': 'ea7bcea628f1412183114363d281b2a0',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'd211a6c552124e1abd817ef4c285be83',
          },
        },
      ],
    },
    {
      'id': '65804fd5dabb4261a1458837cfa966ff',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'fb5b6bd942194a60bdc832af33a1d1a2',
        },
        {
          'id': 'cb37b7b1f8554477914a33751fec8446',
        },
        {
          'id': 'ea7bcea628f1412183114363d281b2a0',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': '2',
};*/

const json = {
  'playerVersion': {
    'web': '2.2.5',
    'native': '0.0.1.202311221223',
  },
  'images': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*RKMPRqapNVkAAAAAAAAAAAAAelB4AQ/original',
      'id': 'e459ac0a43d84cd2936d403cde406403',
      'renderLevel': 'B+',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*UL0HSJxfWJoAAAAAAAAAAAAAelB4AQ/original',
    },
  ],
  'fonts': [],
  'version': '3.1',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [
    {
      'id': '2',
      'name': '新建合成1 (1)',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 4,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': 'e858da630d55426c86629ad50640ff5c',
        },
        {
          'id': '38d99ac1571947d688c80956a569e44a',
        },
        {
          'id': 'f0590ca013eb485bbd1840399abe3f1c',
        },
        {
          'id': '367a125187e14279acb536148ff249b4',
        },
      ],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [
          0,
          0,
          8,
        ],
        'rotation': [
          0,
          0,
          0,
        ],
      },
      'sceneBindings': [
        {
          'key': {
            'id': 'ccc448e09e4c42f0862ce153a78ac10d',
          },
          'value': {
            'id': 'e858da630d55426c86629ad50640ff5c',
          },
        },
        {
          'key': {
            'id': '5ffdde48f89c4408944713e215cd1adf',
          },
          'value': {
            'id': '38d99ac1571947d688c80956a569e44a',
          },
        },
        {
          'key': {
            'id': 'c47db4ad9f624f71a21f498d8080d64a',
          },
          'value': {
            'id': 'f0590ca013eb485bbd1840399abe3f1c',
          },
        },
        {
          'key': {
            'id': '1c6343a0ee8941529981d509b63d1a97',
          },
          'value': {
            'id': '367a125187e14279acb536148ff249b4',
          },
        },
      ],
      'timelineAsset': {
        'id': '0b0be85570464f8cb3efd4b5e0068eeb',
      },
    },
  ],
  'components': [
    {
      'id': '14c26388f32d4e92ba0e23b9e2c019ae',
      'item': {
        'id': 'e858da630d55426c86629ad50640ff5c',
      },
      'dataType': 'SpriteComponent',
      'options': {
        'startColor': [
          1,
          1,
          1,
          1,
        ],
      },
      'renderer': {
        'renderMode': 1,
        'texture': {
          'id': 'dfdbf89b242c467db07d7a319b0c48d0',
        },
        'maskMode': 1,
      },
      'mask': {
        'mask': true,
        'ref': 1,
      },
      'splits': [
        [
          0,
          0,
          0.65625,
          0.58984375,
          0,
        ],
      ],
    },
    {
      'id': '40ea201546b54ec190903ed865778e3b',
      'item': {
        'id': '38d99ac1571947d688c80956a569e44a',
      },
      'dataType': 'SpriteComponent',
      'options': {
        'startColor': [
          1,
          1,
          1,
          1,
        ],
      },
      'renderer': {
        'renderMode': 1,
        'maskMode': 2,
      },
      'mask': {
        'mode': 2,
        'ref': 1,
      },
    },
    {
      'id': 'f53b775cc19f46ce8a17b599d1d9faf2',
      'item': {
        'id': 'f0590ca013eb485bbd1840399abe3f1c',
      },
      'type': 0,
      'dataType': 'ShapeComponent',
      'points': [
        {
          'x': -1.2811,
          'y': 1.529,
        },
        {
          'x': -2.8533,
          'y': 0.0437,
        },
        {
          'x': -1.2811,
          'y': -1.529,
        },
        {
          'x': -0.1747,
          'y': -1.1213,
        },
        {
          'x': 2.8533,
          'y': -0.5679,
        },
      ],
      'easingIns': [
        {
          'x': -1.2811,
          'y': 1.529,
        },
        {
          'x': -2.8533,
          'y': 0.0437,
        },
        {
          'x': -1.2811,
          'y': -1.529,
        },
        {
          'x': -0.1747,
          'y': -1.1213,
        },
        {
          'x': 2.8533,
          'y': -0.5679,
        },
      ],
      'easingOuts': [
        {
          'x': -1.2811,
          'y': 1.529,
        },
        {
          'x': -2.8533,
          'y': 0.0437,
        },
        {
          'x': -1.2811,
          'y': -1.529,
        },
        {
          'x': -0.1747,
          'y': -1.1213,
        },
        {
          'x': 2.8533,
          'y': -0.5679,
        },
      ],
      'shapes': [
        {
          'indexes': [
            {
              'point': 0,
              'easingIn': 0,
              'easingOut': 0,
            },
            {
              'point': 1,
              'easingIn': 1,
              'easingOut': 1,
            },
            {
              'point': 2,
              'easingIn': 2,
              'easingOut': 2,
            },
            {
              'point': 3,
              'easingIn': 3,
              'easingOut': 3,
            },
            {
              'point': 4,
              'easingIn': 4,
              'easingOut': 4,
            },
          ],
          'close': false,
          'fill': {
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        },
      ],
      'renderer': {
        'renderMode': 1,
        'maskMode': 1,
      },
      'mask': {
        'mask': true,
        'ref': 3,
      },
    },
    {
      'id': '4847443fbd574b1c80495488fcdd6524',
      'item': {
        'id': '367a125187e14279acb536148ff249b4',
      },
      'dataType': 'SpriteComponent',
      'options': {
        'startColor': [
          0.9608,
          0.9098,
          0.3176,
          1,
        ],
      },
      'renderer': {
        'renderMode': 1,
        'maskMode': 2,
      },
      'mask': {
        mode: 2,
        ref: 3,
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': 'e858da630d55426c86629ad50640ff5c',
      'name': '星形',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '14c26388f32d4e92ba0e23b9e2c019ae',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 5.8831,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 4.1352,
          'y': 3.7178,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },

    {
      'id': '367a125187e14279acb536148ff249b4',
      'name': '被矢量遮挡',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '4847443fbd574b1c80495488fcdd6524',
        },
      ],
      'transform': {
        'position': {
          'x': 0.0755,
          'y': -3.6988,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 4.2863,
          'y': 3.9959,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
    {
      'id': 'f0590ca013eb485bbd1840399abe3f1c',
      'name': '矢量',
      'duration': 5,
      'type': 'shape',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': 'f53b775cc19f46ce8a17b599d1d9faf2',
        },
      ],
      'transform': {
        'position': {
          'x': 0.7857,
          'y': -3.6988,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
    {
      'id': '38d99ac1571947d688c80956a569e44a',
      'name': '被星星遮挡',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '40ea201546b54ec190903ed865778e3b',
        },
      ],
      'transform': {
        'position': {
          'x': -0.2329,
          'y': 5.5336,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 5.5674,
          'y': 4.8114,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
  ],
  'shaders': [],
  'bins': [],
  'textures': [
    {
      'id': 'dfdbf89b242c467db07d7a319b0c48d0',
      'source': {
        'id': 'e459ac0a43d84cd2936d403cde406403',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': '0b0be85570464f8cb3efd4b5e0068eeb',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': 'ccc448e09e4c42f0862ce153a78ac10d',
        },
        {
          'id': '5ffdde48f89c4408944713e215cd1adf',
        },
        {
          'id': 'c47db4ad9f624f71a21f498d8080d64a',
        },
        {
          'id': '1c6343a0ee8941529981d509b63d1a97',
        },
      ],
    },
    {
      'id': '0b8d490279744e6ca0317cba35f36316',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '0e6bb999152a452faa47c5f21aac7409',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '930e190d6ae94918bf7f878eb49da5f2',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': '78ea7e63979443c0881b21b572016ed7',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '0b8d490279744e6ca0317cba35f36316',
          },
        },
      ],
    },
    {
      'id': '95662355519e4765bdd56ea4be30d0fb',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '0e6bb999152a452faa47c5f21aac7409',
          },
        },
      ],
    },
    {
      'id': 'bfaf5a3152144f218b52f8f88e3d38e4',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '930e190d6ae94918bf7f878eb49da5f2',
          },
        },
      ],
    },
    {
      'id': 'ccc448e09e4c42f0862ce153a78ac10d',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '78ea7e63979443c0881b21b572016ed7',
        },
        {
          'id': '95662355519e4765bdd56ea4be30d0fb',
        },
        {
          'id': 'bfaf5a3152144f218b52f8f88e3d38e4',
        },
      ],
      'clips': [],
    },
    {
      'id': 'e84907d0391f44c395df9dce2b903219',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '66a2ede785fb430da8e9e0623a236776',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '7369b9c9cebe455a800a3039b9e497c9',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': '08269e03d73543b497c934e73a5a7a51',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'e84907d0391f44c395df9dce2b903219',
          },
        },
      ],
    },
    {
      'id': 'ac67fcc91cec474fb781823e548d63e1',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '66a2ede785fb430da8e9e0623a236776',
          },
        },
      ],
    },
    {
      'id': 'be1f5477444d45d7a93d6cdcd4907745',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '7369b9c9cebe455a800a3039b9e497c9',
          },
        },
      ],
    },
    {
      'id': '5ffdde48f89c4408944713e215cd1adf',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '08269e03d73543b497c934e73a5a7a51',
        },
        {
          'id': 'ac67fcc91cec474fb781823e548d63e1',
        },
        {
          'id': 'be1f5477444d45d7a93d6cdcd4907745',
        },
      ],
      'clips': [],
    },
    {
      'id': '2d5243e81127497cbea949d1a1d0714f',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '55239ee4521e49cabab3241f176b8933',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '75d3c7aaf51642a5ae484685b0d84033',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '2d5243e81127497cbea949d1a1d0714f',
          },
        },
      ],
    },
    {
      'id': '0e876cd6d30149f2a034b99b7b2e3039',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '55239ee4521e49cabab3241f176b8933',
          },
        },
      ],
    },
    {
      'id': 'c47db4ad9f624f71a21f498d8080d64a',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '75d3c7aaf51642a5ae484685b0d84033',
        },
        {
          'id': '0e876cd6d30149f2a034b99b7b2e3039',
        },
      ],
      'clips': [],
    },
    {
      'id': 'f2ecc212a0d94dcc8ab31d9b27479d3e',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '105d4856a4f843909187d2aa00699811',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '3f77b4e87a8a46bba66559074f5ef50f',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        0.9608,
        0.9098,
        0.3176,
        1,
      ],
    },
    {
      'id': 'e3a2a43f5d3b42888972e5dfa4f18a4b',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'f2ecc212a0d94dcc8ab31d9b27479d3e',
          },
        },
      ],
    },
    {
      'id': 'edee5b7f94d747ddb611d785e2db0a14',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '105d4856a4f843909187d2aa00699811',
          },
        },
      ],
    },
    {
      'id': 'a82848da578d4d7693a93bbf9103a5f1',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '3f77b4e87a8a46bba66559074f5ef50f',
          },
        },
      ],
    },
    {
      'id': '1c6343a0ee8941529981d509b63d1a97',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'e3a2a43f5d3b42888972e5dfa4f18a4b',
        },
        {
          'id': 'edee5b7f94d747ddb611d785e2db0a14',
        },
        {
          'id': 'a82848da578d4d7693a93bbf9103a5f1',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': '2',
};
const container = document.getElementById('J-container');

(async () => {
  try {
    const assetManager = new AssetManager();
    const player = new Player({
      container,
      interactive: true,
    });
    // const converter = new JSONConverter(player.renderer, true);
    // const data = await converter.processScene(json);
    // const scene = await assetManager.loadScene(json);

    await player.loadScene(json);

    player.gotoAndStop(1);

  } catch (e) {
    console.error('biz', e);
  }
})();
