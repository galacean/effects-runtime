import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';

const json = {
  'playerVersion': {
    'web': '1.2.1',
    'native': '0.0.1.202311221223',
  },
  'images': [],
  'fonts': [],
  'spines': [],
  'version': '2.2',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [
    {
      'id': '1',
      'name': '新建合成1',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 1,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': '6',
          'name': 'sprite_6',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
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
              'path': [
                22,
                [
                  [
                    [
                      3,
                      [
                        0,
                        0,
                        0.068,
                        0,
                      ],
                      1,
                    ],
                    [
                      2,
                      [
                        0.136,
                        1,
                        0.204,
                        1,
                      ],
                      1,
                    ],
                  ],
                  [
                    [
                      0,
                      0,
                      0,
                    ],
                    [
                      4.1659,
                      0,
                      0,
                    ],
                  ],
                  [
                    [
                      0.9143,
                      -1.6536,
                      0,
                    ],
                    [
                      3.8558,
                      1.9716,
                      0,
                    ],
                  ],
                ],
              ],
              'direction': [
                0,
                0,
                0,
              ],
              'startSpeed': 0,
              'gravity': [
                0,
                0,
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
              -3.4981,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1.2,
              1.2,
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
  'compositionId': '1',
  'bins': [],
  'textures': [],
};
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240305030946984/mars-preview.json'; // 1条路径
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304060128455/mars-preview.json'; // 定格
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304052625290/mars-preview.json'; // 首尾复制
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304051328538/mars-preview.json'; // 中间线性
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304043452170/mars-preview.json'; // 4个控制点 不带直线
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
      autoplay: false,
    });

    setTimeout(() => {
      comp.play();
    }, 1000);

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
    env: 'editor',
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
