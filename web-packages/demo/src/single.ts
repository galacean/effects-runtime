import { AssetManager, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

/*let json = {
  'playerVersion': {
    'web': '2.2.5',
    'native': '0.0.1.202311221223',
  },
  'images': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*9QqYTpyl6-oAAAAAAAAAAAAAelB4AQ/original',
      'id': '032f8e585a6f47ffa4ad0bf6eb746de5',
      'renderLevel': 'B+',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*WK81QL2S27EAAAAAAAAAAAAAelB4AQ/original',
    },
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*Jzi6Q5Dw-cAAAAAAAAAAAAAAelB4AQ/original',
      'id': '58bbac32a799438db4354b5e9f79fb55',
      'renderLevel': 'B+',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*XHtcT5ptGiQAAAAAAAAAAAAAelB4AQ/original',
    },
  ],
  'fonts': [],
  'version': '3.2',
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
          'id': 'ef5492b7919a45e5921455bc12904697',
        },
        {
          'id': '8c366b769d7342ebbf3593f353dbddc7',
        },
        {
          'id': '38d99ac1571947d688c80956a569e44a',
        },
        {
          'id': 'e2773001f806484ab4f51282c9bdf068',
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
            'id': '9d2b00ed92474cd6b90c8b192fb10873',
          },
          'value': {
            'id': '8c366b769d7342ebbf3593f353dbddc7',
          },
        },
        {
          'key': {
            'id': '5cdde70f957048088d84dbfa660bf0f4',
          },
          'value': {
            'id': 'e2773001f806484ab4f51282c9bdf068',
          },
        },
        {
          'key': {
            'id': 'f58535a1ed364c009eb0d7791ceb2b5e',
          },
          'value': {
            'id': 'e858da630d55426c86629ad50640ff5c',
          },
        },
        {
          'key': {
            'id': 'b53272d0aec44cad954532da6fda9efb',
          },
          'value': {
            'id': '38d99ac1571947d688c80956a569e44a',
          },
        },
        {
          'key': {
            'id': '844e1a4a59bb417abfa9f31199f55ca7',
          },
          'value': {
            'id': 'ef5492b7919a45e5921455bc12904697',
          },
        },
        {
          'key': {
            'id': '9e65050e175347a499f2dd0ad8982e7c',
          },
          'value': {
            'id': '367a125187e14279acb536148ff249b4',
          },
        },
      ],
      'timelineAsset': {
        'id': '8a03cedea3eb4f62a1fa8d59867e05bf',
      },
    },
  ],
  'components': [
    {
      'id': '989b6e9b32bf49b0b9191000d8370e16',
      'item': {
        'id': '8c366b769d7342ebbf3593f353dbddc7',
      },
      'dataType': 'TextComponent',
      'options': {
        'text': '我是文本',
        'fontFamily': 'sans-serif',
        'fontSize': 80,
        'textColor': [
          1,
          1,
          1,
          1,
        ],
        'fontWeight': 'bold',
        'letterSpace': 0,
        'textAlign': 1,
        'fontStyle': 'normal',
        'autoWidth': false,
        'textWidth': 398.8918,
        'textHeight': 126,
        'lineHeight': 125.72,
        'size': [
          4.9092,
          1.5512,
        ],
      },
      'renderer': {
        'renderMode': 1,
        // 'maskMode': 1,
      },
      'mask': {
        'mask': true,
      },
    },
    {
      'id': '0608f99b2b484280bb874a044ba7c77f',
      'item': {
        'id': 'e2773001f806484ab4f51282c9bdf068',
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
          'id': 'fd93606579684f67a1818452c0db274b',
        },
        // 'maskMode': 2,
      },
      'mask': {
        'mode': 2,
        'ref': {
          'id': '989b6e9b32bf49b0b9191000d8370e16',
        },
      },
      'splits': [
        [
          0.6416015625,
          0.45703125,
          0.3359375,
          0.5234375,
          0,
        ],
      ],
    },
    {
      'id': 'eaf3ffdea0414572a644d6b2c9fa9df9',
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
          'id': 'f61952fd42ae47e791d1c69d3b097f97',
        },
        // 'maskMode': 1,
      },
      'mask': {
        'mask': true,
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
      'id': '7994320e30c14b2c85e279480e21489f',
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
        'texture': {
          'id': 'fd93606579684f67a1818452c0db274b',
        },
      },
      'mask': {
        'mode': 2,
        'ref': {
          'id': 'eaf3ffdea0414572a644d6b2c9fa9df9',
        },
      },
      'splits': [
        [
          0,
          0,
          0.732421875,
          0.455078125,
          0,
        ],
      ],
    },
    {
      'id': 'cca53dcc674b496b9d2b53d82d193b27',
      'item': {
        'id': 'ef5492b7919a45e5921455bc12904697',
      },
      'type': 0,
      'dataType': 'ShapeComponent',
      'points': [
        {
          'x': -0.3202,
          'y': 1.2961,
        },
        {
          'x': 1.1938,
          'y': 0.9175,
        },
        {
          'x': 1.1938,
          'y': 0.1311,
        },
        {
          'x': 1.1938,
          'y': -0.8009,
        },
        {
          'x': 0.4659,
          'y': -1.2961,
        },
        {
          'x': -0.3202,
          'y': -1.296,
        },
        {
          'x': -1.1937,
          'y': -0.8009,
        },
        {
          'x': -1.1937,
          'y': 0.1311,
        },
        {
          'x': -1.019,
          'y': 0.9174,
        },
      ],
      'easingIns': [
        {
          'x': -0.3202,
          'y': 1.296,
        },
        {
          'x': 1.1938,
          'y': 0.9174,
        },
        {
          'x': 1.1938,
          'y': 0.131,
        },
        {
          'x': 1.1938,
          'y': -0.7718,
        },
        {
          'x': 0.4659,
          'y': -1.2961,
        },
        {
          'x': -0.3202,
          'y': -1.296,
        },
        {
          'x': -1.1937,
          'y': -0.8009,
        },
        {
          'x': -1.1937,
          'y': 0.1311,
        },
        {
          'x': -1.019,
          'y': 0.9174,
        },
      ],
      'easingOuts': [
        {
          'x': -0.3202,
          'y': 1.2961,
        },
        {
          'x': 1.1938,
          'y': 0.9175,
        },
        {
          'x': 1.1937,
          'y': 0.1311,
        },
        {
          'x': 1.1937,
          'y': -0.8301,
        },
        {
          'x': 0.4658,
          'y': -1.296,
        },
        {
          'x': -0.3202,
          'y': -1.296,
        },
        {
          'x': -1.1937,
          'y': -0.8009,
        },
        {
          'x': -1.1937,
          'y': 0.1311,
        },
        {
          'x': -1.019,
          'y': 0.9174,
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
            {
              'point': 5,
              'easingIn': 5,
              'easingOut': 5,
            },
            {
              'point': 6,
              'easingIn': 6,
              'easingOut': 6,
            },
            {
              'point': 7,
              'easingIn': 7,
              'easingOut': 7,
            },
            {
              'point': 8,
              'easingIn': 8,
              'easingOut': 8,
            },
          ],
          'close': true,
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
        // 'maskMode': 1,
      },
      'mask': {
        'mask': true,
      },
    },
    {
      'id': 'a365c15929ea45849750d90026b187f5',
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
        // 'maskMode': 2,
        'texture': {
          'id': 'fd93606579684f67a1818452c0db274b',
        },
      },
      'mask': {
        'mode': 2,
        'ref': {
          'id': 'cca53dcc674b496b9d2b53d82d193b27',
        },
      },
      'splits': [
        [
          0,
          0.45703125,
          0.4658203125,
          0.6396484375,
          1,
        ],
      ],
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': '8c366b769d7342ebbf3593f353dbddc7',
      'name': 'text_6',
      'duration': 5,
      'type': 'text',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0.0962,
          'y': 0,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'scale': {
          'x': 4.9092,
          'y': 1.5512,
          'z': 1,
        },
      },
      'components': [
        {
          'id': '989b6e9b32bf49b0b9191000d8370e16',
        },
      ],
      'dataType': 'VFXItemData',
    },
    {
      'id': 'e2773001f806484ab4f51282c9bdf068',
      'name': 'sprite_5',
      'duration': 1,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '0608f99b2b484280bb874a044ba7c77f',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
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
          'x': 8.0769,
          'y': 17.8988,
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
          'id': 'eaf3ffdea0414572a644d6b2c9fa9df9',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 1,
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
      'name': '被星星遮挡',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '7994320e30c14b2c85e279480e21489f',
        },
      ],
      'transform': {
        'position': {
          'x': -0.2329,
          'y': 1,
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
          'x': 9.2281,
          'y': 5.7349,
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
      'id': 'ef5492b7919a45e5921455bc12904697',
      'name': '矢量',
      'duration': 5,
      'type': 'shape',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': 'cca53dcc674b496b9d2b53d82d193b27',
        },
      ],
      'transform': {
        'position': {
          'x': 0.0141,
          'y': -0.6,
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
          'id': 'a365c15929ea45849750d90026b187f5',
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
          'x': 5.8691,
          'y': 8.0609,
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
      'id': 'fd93606579684f67a1818452c0db274b',
      'source': {
        'id': '032f8e585a6f47ffa4ad0bf6eb746de5',
      },
      'flipY': true,
    },
    {
      'id': 'f61952fd42ae47e791d1c69d3b097f97',
      'source': {
        'id': '58bbac32a799438db4354b5e9f79fb55',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': '8a03cedea3eb4f62a1fa8d59867e05bf',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': '9d2b00ed92474cd6b90c8b192fb10873',
        },
        {
          'id': '5cdde70f957048088d84dbfa660bf0f4',
        },
        {
          'id': 'f58535a1ed364c009eb0d7791ceb2b5e',
        },
        {
          'id': 'b53272d0aec44cad954532da6fda9efb',
        },
        {
          'id': '844e1a4a59bb417abfa9f31199f55ca7',
        },
        {
          'id': '9e65050e175347a499f2dd0ad8982e7c',
        },
      ],
    },
    {
      'id': 'cdda0203be0b400299e7d68808c51645',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '669ecc07cb42439d8fc85705dc662fea',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '400a69865f754a82a76d50510130a849',
      'dataType': 'SpriteColorPlayableAsset',
    },
    {
      'id': '75ede6426e5c40b5b4311443d453bfa8',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'cdda0203be0b400299e7d68808c51645',
          },
        },
      ],
    },
    {
      'id': '57e45da1c53e4f05bba6ca980cd491a4',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '669ecc07cb42439d8fc85705dc662fea',
          },
        },
      ],
    },
    {
      'id': '233ed132922c49ff9606273f9aceda9d',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '400a69865f754a82a76d50510130a849',
          },
        },
      ],
    },
    {
      'id': '9d2b00ed92474cd6b90c8b192fb10873',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '75ede6426e5c40b5b4311443d453bfa8',
        },
        {
          'id': '57e45da1c53e4f05bba6ca980cd491a4',
        },
        {
          'id': '233ed132922c49ff9606273f9aceda9d',
        },
      ],
      'clips': [],
    },
    {
      'id': '7ac403203a7e4237a744af3ac7fcb369',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '48eedd4843ec48488128a4e2a6a690b5',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '8602a109eb984ee6bef1719f8476badf',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': 'e9e0082ded7e4ee59a847a426fa31626',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '7ac403203a7e4237a744af3ac7fcb369',
          },
        },
      ],
    },
    {
      'id': 'dfb7bbd86001427c93aafdd7ae6ed854',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '48eedd4843ec48488128a4e2a6a690b5',
          },
        },
      ],
    },
    {
      'id': 'badbe7fc444441a58787d6dcb5804667',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '8602a109eb984ee6bef1719f8476badf',
          },
        },
      ],
    },
    {
      'id': '5cdde70f957048088d84dbfa660bf0f4',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'e9e0082ded7e4ee59a847a426fa31626',
        },
        {
          'id': 'dfb7bbd86001427c93aafdd7ae6ed854',
        },
        {
          'id': 'badbe7fc444441a58787d6dcb5804667',
        },
      ],
      'clips': [],
    },
    {
      'id': '5e1c404a74ea4b1192abaa1bfd279ff5',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '3bc61d3e7bcd413cb7c177081b09246d',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '4003002390024a2ba0fc6fa88bf42b3d',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': 'd5a4a6ca94fa48eda00d51029dc52505',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '5e1c404a74ea4b1192abaa1bfd279ff5',
          },
        },
      ],
    },
    {
      'id': 'a3e9b53ada4d4abba66f385bcfab9f13',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '3bc61d3e7bcd413cb7c177081b09246d',
          },
        },
      ],
    },
    {
      'id': '39989ba774804afcb3c6d1f9b4c2531c',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '4003002390024a2ba0fc6fa88bf42b3d',
          },
        },
      ],
    },
    {
      'id': 'f58535a1ed364c009eb0d7791ceb2b5e',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'd5a4a6ca94fa48eda00d51029dc52505',
        },
        {
          'id': 'a3e9b53ada4d4abba66f385bcfab9f13',
        },
        {
          'id': '39989ba774804afcb3c6d1f9b4c2531c',
        },
      ],
      'clips': [],
    },
    {
      'id': 'dbf02abdc86344f9b8d1362a11f2f3f3',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '24ef0aa0cc7e4b7bbd71f2aeeddbb423',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '0cdca251cdb54dad8f38aef19518ff23',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        1,
        1,
        1,
        1,
      ],
    },
    {
      'id': '5a6530ec197044d7b06bd08dc5665ac4',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'dbf02abdc86344f9b8d1362a11f2f3f3',
          },
        },
      ],
    },
    {
      'id': '3ca11e5277c8465283eb672dc11defcc',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '24ef0aa0cc7e4b7bbd71f2aeeddbb423',
          },
        },
      ],
    },
    {
      'id': 'ae9adbe7bc094c918a8536d8a7995f33',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '0cdca251cdb54dad8f38aef19518ff23',
          },
        },
      ],
    },
    {
      'id': 'b53272d0aec44cad954532da6fda9efb',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '5a6530ec197044d7b06bd08dc5665ac4',
        },
        {
          'id': '3ca11e5277c8465283eb672dc11defcc',
        },
        {
          'id': 'ae9adbe7bc094c918a8536d8a7995f33',
        },
      ],
      'clips': [],
    },
    {
      'id': 'd350bdd335674d00b767529abcebfbc3',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': 'af61d16b4b5544bc822e0f4477ff984c',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '26faedfa811a4ca4a791c0375fdc876c',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'd350bdd335674d00b767529abcebfbc3',
          },
        },
      ],
    },
    {
      'id': 'fa910a1a87de44ecb17516fc3eb2f85b',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'af61d16b4b5544bc822e0f4477ff984c',
          },
        },
      ],
    },
    {
      'id': '844e1a4a59bb417abfa9f31199f55ca7',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '26faedfa811a4ca4a791c0375fdc876c',
        },
        {
          'id': 'fa910a1a87de44ecb17516fc3eb2f85b',
        },
      ],
      'clips': [],
    },
    {
      'id': 'ef88fbb1d9bf44ef82098e355d8df1f9',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '780a658963614fa89a01c594c49eb19c',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {},
    },
    {
      'id': '7fef84da54b2402893ea895645ed3569',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [
        0.9608,
        0.9098,
        0.3176,
        1,
      ],
    },
    {
      'id': 'baa0c68a030946ea838c22e240997303',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': 'ef88fbb1d9bf44ef82098e355d8df1f9',
          },
        },
      ],
    },
    {
      'id': '2ccd0699ec5a4f6f936d5f0e86d91066',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '780a658963614fa89a01c594c49eb19c',
          },
        },
      ],
    },
    {
      'id': 'b43fe847b1bf496fa9a529664a5603a9',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 0,
          'asset': {
            'id': '7fef84da54b2402893ea895645ed3569',
          },
        },
      ],
    },
    {
      'id': '9e65050e175347a499f2dd0ad8982e7c',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'baa0c68a030946ea838c22e240997303',
        },
        {
          'id': '2ccd0699ec5a4f6f936d5f0e86d91066',
        },
        {
          'id': 'b43fe847b1bf496fa9a529664a5603a9',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': '2',
};*/

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*N6fqSaIfq4gAAAAAAAAAAAAAelB4AQ';
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

    player.gotoAndStop(3);

  } catch (e) {
    console.error('biz', e);
  }
})();
