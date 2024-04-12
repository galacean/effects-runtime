import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412015840448/mars-preview.json';
/*  {
  'playerVersion': {
    'web': '1.2.1',
    'native': '0.0.1.202311221223',
  },
  'images': [
    {
      'url': 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412113756372/200%2B39.png',
      'webp': 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412113755698/200%2B39.webp',
      'renderLevel': 'B+',
    },
  ],
  'fonts': [],
  'spines': [],
  'version': '2.2',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [
    {
      'id': '200',
      'name': 'dsds',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 2,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': '39',
          'name': 'face (1)',
          'duration': 2,
          'type': '2',
          'visible': true,
          'endBehavior': 5,
          'delay': 0,
          'renderLevel': 'B+',
          'content': {
            'shape': {
              'shape': 'Cone',
              'radius': 0.6,
              'arc': 360,
              'arcMode': 0,
              'angle': 33,
              'type': 2,
              'alignSpeedDirection': false,
              'turbulenceX': [
                0,
                0,
              ],
              'turbulenceY': [
                0,
                0,
              ],
              'turbulenceZ': [
                0,
                0,
              ],
            },
            'options': {
              'startColor': [
                8,
                [
                  1,
                  1,
                  1,
                  1,
                ],
              ],
              'maxCount': 100,
              'startLifetime': [
                0,
                2,
              ],
              'startDelay': [
                0,
                0,
              ],
              'startSize': [
                4,
                [
                  0.2,
                  0.4,
                ],
              ],
              'sizeAspect': [
                0,
                1,
              ],
              'start3DSize': false,
              'startRotationZ': [
                4,
                [
                  0,
                  360,
                ],
              ],
            },
            'renderer': {
              'renderMode': 1,
              'texture': 0,
            },
            'emission': {
              'rateOverTime': [
                0,
                0,
              ],
              'burstOffsets': [
                {
                  'index': 0,
                  'x': 0,
                  'y': 0,
                  'z': 0,
                },
                {
                  'index': 1,
                  'x': 0,
                  'y': 0,
                  'z': 0,
                },
                {
                  'index': 2,
                  'x': 0,
                  'y': 0,
                  'z': 0,
                },
              ],
              'bursts': [
                {
                  'time': 0,
                  'count': 22,
                  'cycles': 1,
                  'interval': 0,
                },
                {
                  'time': 0.5,
                  'count': 22,
                  'cycles': 1,
                  'interval': 0,
                },
                {
                  'time': 1,
                  'count': 22,
                  'cycles': 1,
                  'interval': 0,
                },
              ],
            },
            'positionOverLifetime': {
              'asMovement': false,
              'speedOverLifetime': [
                21,
                [
                  [
                    3,
                    [
                      0,
                      1,
                      0.0733,
                      1,
                    ],
                  ],
                  [
                    1,
                    [
                      0.1467,
                      0.9345,
                      0.22,
                      0.8392,
                      0.2911,
                      0.7524,
                    ],
                  ],
                  [
                    1,
                    [
                      0.3622,
                      0.1614,
                      0.4333,
                      0.1282,
                      0.6222,
                      0.0315,
                    ],
                  ],
                  [
                    2,
                    [
                      0.8111,
                      0,
                      1,
                      0,
                    ],
                  ],
                ],
              ],
              'linearY': [
                0,
                0,
              ],
              'linearX': [
                0,
                0,
              ],
              'linearZ': [
                0,
                0,
              ],
              'startSpeed': [
                0,
                3,
              ],
              'gravity': [
                0,
                -1,
                0,
              ],
              'gravityOverLifetime': [
                0,
                0,
              ],
            },
            'sizeOverLifetime': {
              'size': [
                21,
                [
                  [
                    4,
                    [
                      0,
                      0.8,
                    ],
                  ],
                  [
                    4,
                    [
                      0.2547,
                      1.4018,
                    ],
                  ],
                  [
                    4,
                    [
                      1,
                      1.6,
                    ],
                  ],
                ],
              ],
            },
            'rotationOverLifetime': {
              'asRotation': false,
              'z': [
                4,
                [
                  260,
                  400,
                ],
              ],
            },
            'colorOverLifetime': {
              'opacity': [
                21,
                [
                  [
                    4,
                    [
                      0,
                      0,
                    ],
                  ],
                  [
                    4,
                    [
                      0.1769,
                      1,
                    ],
                  ],
                  [
                    4,
                    [
                      0.8198,
                      1,
                    ],
                  ],
                  [
                    4,
                    [
                      1,
                      0,
                    ],
                  ],
                ],
              ],
            },
            'textureSheetAnimation': {
              'col': 4,
              'animate': false,
              'total': 0,
              'row': 1,
            },
          },
          'transform': {
            'position': [
              0,
              -5.49,
              0,
            ],
            'rotation': [
              90,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
        },
        {
          'id': '40',
          'name': 'sprite_6',
          'duration': 3,
          'type': '1',
          'visible': true,
          'endBehavior': 4,
          'delay': 0,
          'renderLevel': 'B+',
          'content': {
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
            },
            'positionOverLifetime': {
              'direction': [
                0,
                0,
                0,
              ],
              'startSpeed': 0,
              'gravity': [
                0,
                -7,
                0,
              ],
              'gravityOverLifetime': [
                0,
                1,
              ],
            },
          },
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
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
    },
  ],
  'requires': [],
  'compositionId': '200',
  'bins': [],
  'textures': [
    {
      'source': 0,
      'flipY': true,
    },
  ],
};*/
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412110717169/mars-preview.json';
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240410104505760/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240410104505760/mars-preview.json';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    await player.loadScene(json, {});
  } catch (e) {
    console.error('biz', e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    interactive: true,
    onPlayableUpdate: ({ player, playing }) => {
    },
    // renderFramework: 'webgl',
    // env: 'editor',
    notifyTouch: true,
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    onItemClicked: data => {
      console.info(`item ${data.name} has been clicked`);
    },
    // reportGPUTime: console.debug,
  });

  return player;
}

// dat gui 参数及修改
function setDatGUI () {
  // const gui = new dat.GUI();
}
