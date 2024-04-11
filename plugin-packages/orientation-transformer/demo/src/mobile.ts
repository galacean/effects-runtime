import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';

const json = {
  'compositionId': 10,
  'requires': [],
  'compositions': [
    {
      'name': '1. 扫福',
      'id': 10,
      'duration': 5,
      'endBehavior': 2,
      'camera': {
        'fov': 60,
        'far': 20,
        'near': 0.1,
        'position': [
          0,
          0,
          8,
        ],
        'clipMode': 0,
      },
      'items': [
        {
          'name': 'front1',
          'delay': 0,
          'id': 173,
          'parentId': 198,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'relative': true,
              'endBehavior': 4,
              'looping': true,
              'sizeAspect': 1,
              'renderLevel': 'B+',
            },
          },
        },
        {
          'name': 'middle1',
          'delay': 0,
          'id': 174,
          'parentId': 198,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'relative': true,
              'endBehavior': 4,
              'looping': true,
              'sizeAspect': 1,
              'renderLevel': 'B+',
            },
          },
        },
        {
          'name': 'back1',
          'delay': 0,
          'id': 175,
          'parentId': 198,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'relative': true,
              'endBehavior': 4,
              'looping': true,
              'sizeAspect': 1,
              'renderLevel': 'B+',
            },
          },
        },
        {
          'name': '卡片光',
          'delay': 0,
          'id': 176,
          'parentId': 198,
          'ro': 0.001,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 3.2000000000000024,
              'sizeAspect': 0.7001194743130227,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'endBehavior': 4,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
            },
            'transform': {
              'position': [
                0,
                -0.4,
                -0.000006954744002030111,
              ],
            },
            'colorOverLifetime': {
              'opacity': 0.5,
            },
            'splits': [
              [
                0.0009765625,
                0.0009765625,
                0.572265625,
                0.5859375,
                0,
              ],
            ],
          },
        },
        {
          'name': '框',
          'delay': 0,
          'id': 177,
          'parentId': 198,
          'ro': 0.002,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 2.34,
              'sizeAspect': 0.61,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'looping': true,
              'renderLevel': 'B+',
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
              'maskMode': 1,
              'occlusion': false,
              'shape': 0,
            },
            'transform': {
              'position': [
                0.02,
                -0.42,
                -0.0000023182466755145015,
              ],
            },
            'splits': [
              [
                0.0009765625,
                0.9599609375,
                0.0390625,
                0.0693359375,
                1,
              ],
            ],
          },
        },
        {
          'name': '背景',
          'delay': 0,
          'id': 178,
          'parentId': 198,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 2.385700251178918,
              'sizeAspect': 0.6281859070464768,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                0.016989584351474223,
                -0.3279272876317747,
                -0.000006954744002030111,
              ],
            },
            'splits': [
              [
                0.0009765625,
                0.5888671875,
                0.310546875,
                0.4921875,
                1,
              ],
            ],
          },
        },
        {
          'name': '地面',
          'delay': 0,
          'id': 179,
          'parentId': 174,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 7.2878036911715,
              'sizeAspect': 1.6285714285714286,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'endBehavior': 4,
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 1,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                -0.0690553060602746,
                -1.8981404049398103,
                -0.000011591246645181741,
              ],
            },
            'splits': [
              [
                0.0009765625,
                0.142578125,
                0.5,
                0.30859375,
                1,
              ],
              [
                0.0009765625,
                0.64453125,
                0.5,
                0.30859375,
                0,
              ],
              [
                0.3115234375,
                0.142578125,
                0.5,
                0.30859375,
                1,
              ],
              [
                0.6220703125,
                0.142578125,
                0.5,
                0.30859375,
                1,
              ],
            ],
          },
        },
        {
          'name': '右云',
          'delay': 0,
          'id': 180,
          'parentId': 175,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.1770330957295596,
              'sizeAspect': 2.1809523809523808,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
              'gravity': [
                0,
                0,
                0,
              ],
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                0.4920084788224827,
                1.0732347379996794,
                -0.000016227755514464093,
              ],
            },
            'velocityOverLifetime': {
              'asMovement': true,
              'linearY': [
                'curve',
                [
                  [
                    0,
                    0,
                    -0.034,
                    -0.034,
                  ],
                  [
                    0.5,
                    -0.15,
                    0,
                    0,
                  ],
                  [
                    1,
                    0,
                    0.152,
                    0.152,
                  ],
                ],
              ],
            },
            'splits': [
              [
                0.5751953125,
                0.4306640625,
                0.2236328125,
                0.1025390625,
                0,
              ],
            ],
          },
        },
        {
          'name': '鞋子阴影',
          'delay': 0,
          'id': 181,
          'parentId': 186,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.319657758147716,
              'sizeAspect': 1.9173553719008265,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 2,
              'maskMode': 2,
              'blending': 0,
            },
            'transform': {
              'position': [
                0.19565679042169445,
                -1.0844367010065872,
                -0.000016227754491282553,
              ],
            },
            'splits': [
              [
                0.693359375,
                0.0009765625,
                0.2265625,
                0.1181640625,
                0,
              ],
            ],
          },
        },
        {
          'name': '右腿',
          'delay': 0,
          'id': 182,
          'parentId': 174,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.1468636357189699,
              'sizeAspect': 1.4428571428571428,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 2,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                0.1926692835363213,
                -1.131647589070069,
                -0.000025500785682197602,
              ],
            },
            'splits': [
              [
                0.693359375,
                0.12109375,
                0.201171875,
                0.140625,
                0,
              ],
            ],
          },
        },
        {
          'name': '头',
          'delay': 0,
          'id': 183,
          'parentId': 186,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 0.9123121269003371,
              'sizeAspect': 0.935672514619883,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 1,
              'maskMode': 2,
              'particleOrigin': 8,
            },
            'transform': {
              'position': [
                -0.23434633759197296,
                0.6411946961897125,
                -0.000032455571918887927,
              ],
            },
            'rotationOverLifetime': {
              'asRotation': true,
              'angularVelocity': [
                'curve',
                [
                  [
                    0,
                    -1,
                    -0.03,
                    -0.03,
                  ],
                  [
                    0.507,
                    0,
                    0,
                    0,
                  ],
                  [
                    1,
                    -1,
                    0,
                    0,
                  ],
                ],
              ],
            },
            'splits': [
              [
                0.5029296875,
                0.64453125,
                0.16015625,
                0.1708984375,
                0,
              ],
            ],
          },
        },
        {
          'name': '左腿',
          'delay': 0,
          'id': 184,
          'parentId': 186,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 0.6272488084412766,
              'sizeAspect': 1.054945054945055,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 1,
              'maskMode': 2,
              'particleOrigin': 6,
            },
            'transform': {
              'position': [
                -0.4931977315674142,
                -0.1999648655639277,
                -0.000027819045602228698,
              ],
              'rotation': [
                0,
                0,
                7,
              ],
            },
            'rotationOverLifetime': {
              'asRotation': true,
              'angularVelocity': [
                'curve',
                [
                  [
                    0,
                    -10,
                    -0.03,
                    -0.03,
                  ],
                  [
                    0.507,
                    0,
                    0,
                    0,
                  ],
                  [
                    1,
                    -10,
                    0.043,
                    0.043,
                  ],
                ],
              ],
            },
            'splits': [
              [
                0.5029296875,
                0.8173828125,
                0.09765625,
                0.0927734375,
                1,
              ],
            ],
          },
        },
        {
          'name': '身体',
          'delay': 0,
          'id': 185,
          'parentId': 186,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.562003197759934,
              'sizeAspect': 0.9660377358490566,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 2,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                -0.27512618656289195,
                0.28347729530506455,
                -0.00003013731186918278,
              ],
              'rotation': [
                0,
                0,
                -2,
              ],
            },
            'splits': [
              [
                0.4287109375,
                0.0009765625,
                0.25390625,
                0.2626953125,
                1,
              ],
            ],
          },
        },
        {
          'name': '身体节点',
          'delay': 0,
          'id': 186,
          'parentId': 174,
          'cal': {
            'options': {
              'duration': 4,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
              'looping': true,
            },
            'transform': {
              'position': [
                0.044125481435272756,
                -0.3758296099453035,
                -0.0000023182504237543156,
              ],
            },
            'rotationOverLifetime': {
              'asRotation': true,
              'angularVelocity': [
                'curve',
                [
                  [
                    0,
                    0,
                    0.052,
                    0.052,
                  ],
                  [
                    0.5,
                    2,
                    0,
                    0,
                  ],
                  [
                    1,
                    0,
                    0.001,
                    0.001,
                  ],
                ],
              ],
            },
          },
        },
        {
          'name': '手',
          'delay': 0,
          'id': 187,
          'parentId': 190,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 2.0009129867451096,
              'sizeAspect': 0.8410138248847926,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                -0.492086670993339,
                0.709525599910207,
                -0.000037092095537261116,
              ],
            },
            'splits': [
              [
                0.5751953125,
                0.0009765625,
                0.3603515625,
                0.427734375,
                0,
              ],
            ],
          },
        },
        {
          'name': '模糊',
          'delay': 0,
          'id': 188,
          'parentId': 190,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.1,
              'sizeAspect': 0.7568493150684932,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                -0.8786955541903939,
                1.11,
                -0.000018546013301090625,
              ],
            },
            'colorOverLifetime': {
              'opacity': [
                'curve',
                [
                  [
                    0,
                    0.07,
                    -0.025,
                    -0.025,
                  ],
                  [
                    0.316,
                    0.073,
                    -0.002,
                    -0.002,
                  ],
                  [
                    0.472,
                    1,
                    0,
                    0,
                  ],
                  [
                    0.624,
                    0.002,
                    0.014,
                    0.014,
                  ],
                  [
                    1,
                    0.002,
                    0,
                    0,
                  ],
                ],
              ],
            },
            'splits': [
              [
                0.4951171875,
                0.5888671875,
                0.369140625,
                0.48828125,
                1,
              ],
            ],
          },
        },
        {
          'name': '扫描',
          'delay': 0,
          'id': 189,
          'parentId': 190,
          'ro': 0.003,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 1.7041571120225523,
              'sizeAspect': 2.8597285067873304,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 4,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 2,
              'shape': 1,
              'maskMode': 2,
            },
            'transform': {
              'rotation': [
                0,
                0,
                -20,
              ],
              'position': [
                -1.0956954896480482,
                1.7206080269065847,
                -0.00001622775608289828,
              ],
            },
            'velocityOverLifetime': {
              'asMovement': true,
              'linearX': [
                'lines',
                [
                  [
                    0.15,
                    0,
                  ],
                  [
                    0.683,
                    0.347,
                  ],
                ],
              ],
              'linearY': [
                'lines',
                [
                  [
                    0.15,
                    0,
                  ],
                  [
                    0.685,
                    -0.96,
                  ],
                ],
              ],
            },
            'colorOverLifetime': {
              'opacity': [
                'curve',
                [
                  [
                    0,
                    0,
                    0,
                    0,
                  ],
                  [
                    0.083,
                    0,
                    -0.06,
                    -0.06,
                  ],
                  [
                    0.419,
                    1,
                    0,
                    0,
                  ],
                  [
                    0.724,
                    0,
                    -0.01,
                    -0.01,
                  ],
                  [
                    1,
                    0,
                    0,
                    0,
                  ],
                ],
              ],
            },
            'splits': [
              [
                0.0009765625,
                0.6640625,
                0.42578125,
                0.2197265625,
                0,
              ],
            ],
          },
        },
        {
          'name': '手节点',
          'delay': 0,
          'id': 190,
          'parentId': 173,
          'cal': {
            'options': {
              'duration': 4,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
              'looping': true,
            },
            'transform': {
              'rotation': [
                0,
                0,
                0,
              ],
              'position': [
                1.2,
                -1.4251122748784997,
                -0.000006954746446297122,
              ],
            },
            'rotationOverLifetime': {
              'asRotation': true,
              'angularVelocity': [
                'curve',
                [
                  [
                    0,
                    0,
                    2.12,
                    2.12,
                  ],
                  [
                    0.33,
                    4,
                    0,
                    0,
                  ],
                  [
                    0.66,
                    -4,
                    0.01,
                    0.01,
                  ],
                  [
                    0.999,
                    0,
                    2.434,
                    2.434,
                  ],
                ],
              ],
            },
            'sizeOverLifetime': {
              'size': 1.05,
            },
          },
        },
        {
          'name': '雪',
          'delay': 0,
          'id': 191,
          'parentId': 198,
          'ro': 0.004,
          'particle': {
            'options': {
              'startLifetime': [
                'random',
                [
                  4,
                  10,
                ],
              ],
              'startSize': [
                'random',
                [
                  0.01,
                  0.12,
                ],
              ],
              'sizeAspect': 0.9746192893401016,
              'startSpeed': [
                'random',
                [
                  0.3,
                  0.75,
                ],
              ],
              'startColor': [
                'colors',
                [
                  'rgb(255,255,255)',
                ],
              ],
              'duration': 5,
              'maxCount': 10,
              'gravityModifier': 0.3,
              'looping': true,
              'gravity': [
                -0.4,
                0,
                0,
              ],
              'renderLevel': 'A+',
            },
            'emission': {
              'rateOverTime': 1,
            },
            'shape': {
              'shape': 'Edge',
              'radius': 1,
              'arc': 360,
              'arcMode': 0,
              'width': 3,
            },
            'renderer': {
              'texture': 3,
              'maskMode': 2,
            },
            'transform': {
              'rotation': [
                180,
                0,
                0,
              ],
              'position': [
                0.044125481435272756,
                1.5241703900546963,
                -0.000004636497099268817,
              ],
            },
            'colorOverLifetime': {
              'opacity': [
                'random',
                [
                  0.75,
                  1.1,
                ],
              ],
            },
            'splits': [
              [
                0.00390625,
                0.00390625,
                0.75,
                0.76953125,
                0,
              ],
            ],
          },
        },
        {
          'name': '矩形',
          'delay': 0,
          'id': 192,
          'parentId': 198,
          'ro': 0.005,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 2.303530156710596,
              'sizeAspect': 3.2019943666974098,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'renderLevel': 'B+',
              'looping': true,
            },
            'renderer': {
              'renderMode': 1,
              'texture': 1,
              'maskMode': 2,
            },
            'transform': {
              'position': [
                0,
                -1.95,
                -0.00000463649469573113,
              ],
            },
            'splits': [
              [
                0.0009765625,
                0.0009765625,
                0.9765625,
                0.1396484375,
                0,
              ],
            ],
          },
        },
        {
          'name': '边框（选中）',
          'delay': 0,
          'id': 196,
          'parentId': 198,
          'ro': 0.006,
          'sprite': {
            'options': {
              'startLifetime': 2,
              'startSize': 2.371528742868344,
              'sizeAspect': 0.6159814916541153,
              'startColor': [
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration': 2,
              'gravityModifier': 1,
              'looping': true,
              'renderLevel': 'B+',
            },
            'renderer': {
              'renderMode': 1,
              'texture': 2,
            },
            'transform': {
              'position': [
                0.020000152084447716,
                -0.41165025047465015,
                -0.00005795656212370659,
              ],
            },
            'colorOverLifetime': {
              'opacity': 1,
            },
            'splits': [
              [
                0.0009765625,
                0.0009765625,
                0.4169921875,
                0.6611328125,
                0,
              ],
            ],
          },
        },
        {
          'name': '陀螺仪',
          'delay': 0,
          'id': 197,
          'content': {
            'options': {
              'duration': 5,
              'type': 'orientation-transformer',
              'targets': [
                {
                  'name': 'back1',
                  'xMin': '-0.2',
                  'xMax': '0.2',
                  'yMin': '',
                  'yMax': '',
                },
                {
                  'name': 'front1',
                  'xMin': '0.35',
                  'xMax': '-0.35',
                  'yMin': '',
                  'yMax': '',
                },
                {
                  'name': 'middle1',
                  'xMin': '0.15',
                  'xMax': '-0.15',
                  'yMin': '',
                  'yMax': '',
                },
                {
                  'name': '框',
                  'vMin': '-30',
                  'vMax': '30',
                  'hMin': '-30',
                  'hMax': '30',
                },
              ],
              'looping': true,
              'renderLevel': 'B+',
            },
            'transform': {
              'position': [
                0,
                0,
                0,
              ],
            },
          },
        },
        {
          'name': 'scan',
          'delay': 0,
          'id': 198,
          'cal': {
            'options': {
              'duration': 2,
              'startSize': 1,
              'sizeAspect': 1,
              'relative': true,
              'renderLevel': 'B+',
              'looping': true,
            },
          },
        },
      ],
      'meta': {
        'previewSize': [
          750,
          1624,
        ],
      },
    },
  ],
  'gltf': [],
  'images': [
    'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/TCFWNOIAYQRL/1104759407-3db0c.png',
    'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/TCFWNOIAYQRL/-1300736739-1491c.png',
    'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/TCFWNOIAYQRL/-1979178489-505a9.png',
    'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/TCFWNOIAYQRL/-1203398720-5a3ae.png',
  ],
  'version': '0.1.47',
  'shapes': [
    {
      'g': {
        'p': [
          [
            -0.8033573031425476,
            1,
            -0.2613912170660426,
            1.0000000000000007,
            -0.8572469819990614,
            0.99368720572677,
          ],
          [
            -0.9664268493652344,
            0.9370315074920654,
            -0.9200857747265841,
            0.9779402043549111,
            -1.0200245973789817,
            0.8770614544237676,
          ],
          [
            -0.9956774376417233,
            0.7626133786848073,
            -0.989459138855388,
            0.822583385046239,
            -0.9807465278661889,
            0.21888520114786092,
          ],
          [
            -0.9730017006802721,
            -0.8609693877551021,
            -0.9867848512958801,
            -0.3172411397831244,
            -0.9718897326403424,
            -0.9147351253474271,
          ],
          [
            -0.7825255102040816,
            -0.9834183673469388,
            -0.8685249497040267,
            -0.982723037932991,
            -0.2661385736674033,
            -0.9834183673469391,
          ],
          [
            0.7579215605513039,
            -0.9866669323979591,
            0.24153457352622276,
            -0.986666932397958,
            0.8141023176315599,
            -0.9820758279782088,
          ],
          [
            0.9441344246031746,
            -0.9149549142573696,
            0.9047026688279478,
            -0.9744961623972506,
            0.9835661803784015,
            -0.8554136661174887,
          ],
          [
            0.9952038526535034,
            0.8650674819946289,
            0.9626911874895279,
            0.26736629990699806,
            1.001587419955468,
            0.9230649201521615,
          ],
          [
            0.7937649488449097,
            1,
            0.8920177127486326,
            1.000112404896961,
            0.2597924442521778,
            0.9999999999999999,
          ],
        ],
        's': [
          [
            0,
            0.5,
            1,
          ],
          [
            0,
            0.5,
            1,
          ],
          [
            0,
            1,
          ],
          [
            0,
            0.25,
            0.5,
            0.75,
            1,
          ],
          [
            0,
            1,
          ],
          [
            0,
            0.25,
            0.5,
            0.75,
            1,
          ],
          [
            0,
            0.125,
            0.25,
            0.5,
            1,
          ],
          [
            0,
            0.25,
            0.5,
            0.75,
            1,
          ],
          [
            0,
            1,
          ],
        ],
      },
    },
    {
      'g': {
        'p': [
          [
            -0.4391146146334135,
            -0.9906144362229568,
            0.1445021831047989,
            -0.9906144362229568,
            -0.4391146146334135,
            0.11464118328698758,
          ],
          [
            -0.4446523813100961,
            0.5628382756159855,
            -0.4446523813100961,
            0.11209336072021964,
            0.3713876399775021,
            0.5628382756159855,
          ],
          [
            0.43864464393028846,
            0.5653603186974159,
            0.05813628190277226,
            0.5653603186974159,
            0.43864464393028846,
            -0.34110849039859825,
          ],
          [
            0.44520920973557687,
            -1.0060607910156252,
            0.44520920973557687,
            -0.5294657576961401,
            -0.3880915897787178,
            -1.0060607910156252,
          ],
        ],
        's': [
          [
            0,
            1,
          ],
          [
            0,
            1,
          ],
          [
            0,
            1,
          ],
          [
            0,
            1,
          ],
        ],
      },
    },
  ],
  'plugins': [
    'orientation-transformer',
  ],
  'type': 'mars',
  '_imgs': {
    '10': [
      0,
      1,
      2,
      3,
    ],
  },
  'imageTags': [
    'B+',
    'B+',
    'B+',
    'A+',
  ],
};
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
  });

  await player.loadScene(json);
})();
