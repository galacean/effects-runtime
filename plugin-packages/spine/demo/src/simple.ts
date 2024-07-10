// @ts-nocheck
import type { spec } from '@galacean/effects';
import { generateGUID, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import type { SpineVFXItem } from '@galacean/effects-plugin-spine';
import { SpineComponent } from '@galacean/effects-plugin-spine';
import { direct, premultiply } from './files';

const startEle = document.getElementById('J-start');
const pauseEle = document.getElementById('J-pause');
const skinEle = document.getElementById('J-skin');
const animationEle = document.getElementById('J-animation');
const op = document.getElementById('J-op');
const x = op.querySelector('input[name="rotationX"]');
const y = op.querySelector('input[name="rotationY"]');
const z = op.querySelector('input[name="rotationZ"]');
const dz = op.querySelector('input[name="distanceZ"]');
const dx = op.querySelector('input[name="distanceX"]');
const dy = op.querySelector('input[name="distanceY"]');
const dzValue = document.getElementById('J-DZ');
const dxValue = document.getElementById('J-DX');
const dyValue = document.getElementById('J-DY');
const rx = document.getElementById('J-RX');
const ry = document.getElementById('J-RY');
const rz = document.getElementById('J-RZ');
const filetype = document.getElementById('J-premultiply');

const cameraPos = [0, 0, 8];
const playerOptions = {
  interactive: true,
  onItemClicked: () => console.info('包围盒内被点击'),
  onEnd: () => console.info('合成播放结束'),
};
const files = premultiply;

if (files === premultiply) {
  filetype.innerText = '纹理打包选择预乘alpha: true';
} else if (files === direct) {
  filetype.innerText = '纹理打包选择预乘alpha: false';
}

const file = files.spineboy;
const mix = files.mix;
const activeAnimation = ['run', 'jump'], skin = 'default', dur = 4, mixDuration = 0, speed = 1;

(async () => {
  const animation = {
    'compositionId': '2',
    'requires': [],
    'textures': [...file.png.map((url, index) => ({
      source: index,
      images: [
        url.slice(url.lastIndexOf('/') + 1) + '.png',
      ],
      sourceType: 2,
      pma: true,
      name: url.slice(url.lastIndexOf('/') + 1),
      flipY: false,
      'minFilter': 9729,
      'magFilter': 9729,
      'wrapS': 33071,
      'wrapT': 10497,
      'target': 3553,
      'format': 6408,
      'internalFormat': 6408,
      'type': 5121,
    }))],
    'bins': [{ url: file.atlas }, { url: file.json }, { url: mix.atlas }, { url: mix.json }],
    'spines': [
      {
        'atlas': [20, [0, 0]],
        'skeleton': [20, [1, 0]],
        'skeletonType': 'json',
        'images': file.png.map((item, index) => index),
      },
      {
        'atlas': [20, [2, 0]],
        'skeleton': [20, [3, 0]],
        'skeletonType': 'json',
        'images': mix.png.map((item, index) => index + file.png.length),
      },
    ],
    'compositions': [
      {
        'id': '2',
        'name': '新建合成2',
        'duration': 10,
        'startTime': 0,
        'endBehavior': 5,
        'previewSize': [
          750,
          1624,
        ],
        'camera': {
          'fov': 60,
          'far': 40,
          'near': 0.1,
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
          'clipMode': 1,
        },
        'items': [
          {
            'name': 'spine_item',
            'delay': 0,
            'id': 4,
            'type': 'spine',
            'pluginName': 'spine',
            'visible': true,
            'endBehavior': 5,
            'renderLevel': 'B+',
            'duration': 3,
            'content': {
              'options': {
                'activeSkin': skin,
                speed,
                mixDuration,
                activeAnimation,
                'spine': 0,
                'startSize': 3,
              },
            },
            'transform': {
              'position': [
                0,
                2,
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
          {
            'name': 'spine_item2',
            'delay': 0,
            'id': 5,
            'type': 'spine',
            'pluginName': 'spine',
            'visible': true,
            'endBehavior': 5,
            'renderLevel': 'B+',
            'duration': dur,
            'content': {
              'options': {
                'activeSkin': 'full-skins/girl',
                speed,
                mixDuration,
                'activeAnimation': ['dance'],
                'spine': 1,
                'startSize': 3,
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
        'meta': {
          'previewSize': [
            0,
            0,
          ],
        },
      },
    ],
    'gltf': [],
    'images': [
      ...file.png.map(i => ({
        url: i,
        renderLevel: 'B+',
      })),
      // ...mix.png.map(i => ({
      //   url: i,
      //   renderLevel: 'B+',
      // })),
    ],
    'version': '1.5',
    'shapes': [],
    'plugins': [
      'spine',
    ],
    'type': 'mars',
  };

  const spineResourceID = generateGUID();

  const json = {
    'playerVersion': {
      'web': '1.4.3',
      'native': '0.0.1.202311221223',
    },
    'images': [
      {
        'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*F1djTaBIjWkAAAAAAAAAAAAADlB4AQ/original',
        'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*MjfmTIhfUf0AAAAAAAAAAAAADlB4AQ/original',
        'renderLevel': 'B+',
        'oriY': 1,
        'id': '974c3bc4e8204fad97a2a5feaf72530d',
      },
    ],
    'fonts': [],
    'version': '3.0',
    'shapes': [],
    'plugins': [
      'spine',
    ],
    'type': 'ge',
    'compositions': [
      {
        'id': '345',
        'name': '新建合成20',
        'duration': 5,
        'startTime': 0,
        'endBehavior': 2,
        'previewSize': [
          750,
          1624,
        ],
        'items': [
          {
            'id': '57df188efcd54593ac0a7e33405ed599',
          },
          {
            'id': '7947b92111fe4bd09f5565fbd4d79f53',
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
        'timelineAsset': {
          'id': 'd3e03b3b295942278d834dd2a77475d0',
        },
        'sceneBindings': [
          {
            'key': {
              'id': 'dbd64fb2193d4519a4fc0cf00ce90bb3',
            },
            'value': {
              'id': '57df188efcd54593ac0a7e33405ed599',
            },
          },
          {
            'key': {
              'id': '2e0f120bbf794205b88c6be5811c4df3',
            },
            'value': {
              'id': '7947b92111fe4bd09f5565fbd4d79f53',
            },
          },
        ],
      },
    ],
    'requires': [],
    'compositionId': '345',
    'bins': [
      {
        'id': spineResourceID,
        'dataType': 'BinaryAsset',
        'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*z92_T7Ugb80AAAAAAAAAAAAADlB4AQ',
      },
    ],
    'textures': [
      {
        'minFilter': 9729,
        'magFilter': 9729,
        'wrapS': 33071,
        'wrapT': 33071,
        'target': 3553,
        'format': 6408,
        'internalFormat': 6408,
        'type': 5121,
        'flipY': false,
        'images': [
          '表情动画.png',
        ],
        'pma': false,
        'name': '表情动画.png',
        'sourceType': 2,
        'source': {
          'id': '974c3bc4e8204fad97a2a5feaf72530d',
        },
        'id': 'f5fee32102114a0fa2226b26a6584671',
        'dataType': 'Texture',
      },
    ],
    'items': [
      {
        'id': '57df188efcd54593ac0a7e33405ed599',
        'name': '表情动画',
        'duration': 4.0833,
        'type': 'spine',
        'pluginName': 'spine',
        'visible': true,
        'endBehavior': 5,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'tracks': [
            {
              'clips': [
                {
                  'id': '58734d2ab44f4835b1323639abe47812',
                  'dataType': 'TransformPlayableAsset',
                },
              ],
            },
          ],
          'id': '03bf982cdeca40e08823a56cdc4c9b11',
          'item': {
            'id': '57df188efcd54593ac0a7e33405ed599',
          },
          'dataType': 'SpineComponent',
        },
        'transform': {
          'position': {
            'x': -6.3746,
            'y': 3.7864,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 5,
            'y': 5,
            'z': 5,
          },
        },
        'oldId': '2',
        'components': [
          {
            'id': '03bf982cdeca40e08823a56cdc4c9b11',
          },
        ],
        'dataType': 'VFXItemData',
        'listIndex': 0,
      },
      {
        'id': '7947b92111fe4bd09f5565fbd4d79f53',
        'name': 'sprite_3',
        'duration': 5,
        'type': '1',
        'visible': true,
        'endBehavior': 5,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.3765,
              0.5569,
              0.8667,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
          },
          'positionOverLifetime': {},
          'tracks': [
            {
              'clips': [
                {
                  'id': 'fe5d27269a344aa4b5c6dc04d3e311b0',
                  'dataType': 'TransformPlayableAsset',
                  'positionOverLifetime': {},
                },
              ],
            },
            {
              'clips': [
                {
                  'id': 'bb4ccf40575541f592cb6c86aa528c3a',
                  'dataType': 'SpriteColorPlayableAsset',
                  'startColor': [
                    0.3765,
                    0.5569,
                    0.8667,
                    1,
                  ],
                },
              ],
            },
          ],
          'id': '0729b5d9af8f4ebe8763b39ca24c7747',
          'item': {
            'id': '7947b92111fe4bd09f5565fbd4d79f53',
          },
          'dataType': 'SpriteComponent',
        },
        'transform': {
          'position': {
            'x': 0,
            'y': 3.8894,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 1,
            'y': 1,
            'z': 1,
          },
          'size': {
            'x': 3,
            'y': 3,
          },
          'anchor': {
            'x': 0,
            'y': 0,
          },
        },
        'oldId': '3',
        'components': [
          {
            'id': '0729b5d9af8f4ebe8763b39ca24c7747',
          },
        ],
        'dataType': 'VFXItemData',
        'listIndex': 1,
      },
    ],
    'components': [
      {
        'resource': {
          'atlas': {
            'bins': {
              'id': spineResourceID,
            },
            'source': [
              // startIndex，length
              0, 2297,
            ],
          },
          'skeleton': {
            'bins': {
              'id': spineResourceID,
            },
            'source': [
              2300, 325858,
            ],
          },
          'images': [
            {
              'id': 'f5fee32102114a0fa2226b26a6584671',
            },
          ],
          'skeletonType': 'json',
        },
        'options': {
          'activeSkin': '',
          'spine': 0,
          'startSize': 5,
          'activeAnimation': [
            '生气',
          ],
          'mixDuration': 0,
          'speed': 1,
        },
        'tracks': [
          {
            'clips': [
              {
                'id': '58734d2ab44f4835b1323639abe47812',
                'dataType': 'TransformPlayableAsset',
              },
            ],
          },
        ],
        'id': '03bf982cdeca40e08823a56cdc4c9b11',
        'item': {
          'id': '57df188efcd54593ac0a7e33405ed599',
        },
        'dataType': 'SpineComponent',
      },
      {
        'options': {
          'startColor': [
            0.3765,
            0.5569,
            0.8667,
            1,
          ],
        },
        'renderer': {
          'renderMode': 1,
        },
        'positionOverLifetime': {},
        'tracks': [
          {
            'clips': [
              {
                'id': 'fe5d27269a344aa4b5c6dc04d3e311b0',
                'dataType': 'TransformPlayableAsset',
                'positionOverLifetime': {},
              },
            ],
          },
          {
            'clips': [
              {
                'id': 'bb4ccf40575541f592cb6c86aa528c3a',
                'dataType': 'SpriteColorPlayableAsset',
                'startColor': [
                  0.3765,
                  0.5569,
                  0.8667,
                  1,
                ],
              },
            ],
          },
        ],
        'id': '0729b5d9af8f4ebe8763b39ca24c7747',
        'item': {
          'id': '7947b92111fe4bd09f5565fbd4d79f53',
        },
        'dataType': 'SpriteComponent',
      },
    ],
    'materials': [],
    'shaders': [],
    'geometries': [],
    'animations': [
      {
        'tracks': [
          {
            'id': 'dbd64fb2193d4519a4fc0cf00ce90bb3',
          },
          {
            'id': '2e0f120bbf794205b88c6be5811c4df3',
          },
        ],
        'id': 'd3e03b3b295942278d834dd2a77475d0',
        'dataType': 'TimelineAsset',
      },
      {
        'id': '9cd006ba57c6488b9ac23c5063c1c4ce',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'asset': {
              'id': '5728e82910be4e8798a7b8c0ec538222',
            },
          },
        ],
      },
      {
        'id': 'dbd64fb2193d4519a4fc0cf00ce90bb3',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '9cd006ba57c6488b9ac23c5063c1c4ce',
          },
        ],
        'clips': [],
      },
      {
        'id': '27b0145b361c4575bccb7a690899ca66',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'asset': {
              'id': 'e9fb1febc78445a88e63854c9d661d3c',
            },
          },
        ],
      },
      {
        'id': 'df1dd8d01af04e80b5fb99a16a981d2b',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'asset': {
              'id': 'd20de2ecb50b4a1dab56f0c1a235e799',
            },
          },
        ],
      },
      {
        'id': '2e0f120bbf794205b88c6be5811c4df3',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '27b0145b361c4575bccb7a690899ca66',
          },
          {
            'id': 'df1dd8d01af04e80b5fb99a16a981d2b',
          },
        ],
        'clips': [],
      },
      {
        'id': '5728e82910be4e8798a7b8c0ec538222',
        'dataType': 'TransformPlayableAsset',
      },
      {
        'id': 'e9fb1febc78445a88e63854c9d661d3c',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {},
      },
      {
        'id': 'd20de2ecb50b4a1dab56f0c1a235e799',
        'dataType': 'SpriteColorPlayableAsset',
        'startColor': [
          0.3765,
          0.5569,
          0.8667,
          1,
        ],
      },
    ],
  };

  try {
    await start();
  } catch (e) {
    console.error(e);
  }

  async function start () {
    const player = new Player({
      container: document.getElementById('J-container'),
      ...playerOptions,
    });
    const comp = await player.loadScene(json);

    setCamera(comp);
    pauseEle.onclick = () => {
      player.pause();
    };

    startEle.onclick = () => {
      void player.resume().then(_ => {
        const spineItems = comp.items.filter(item => item.type === 'plugin-spine' as spec.ItemType);

        console.info('player resume success');
      });
    };

    skinEle.onclick = () => {
      const spineItem = comp.getItemByName('spine_item2');

      if (spineItem) {
        const skinList = spineItem.skinList;
        const newSkin = skinList[Math.floor(Math.random() * skinList.length)];

        (spineItem as SpineVFXItem).setSkin(newSkin);
      }
    };

    animationEle.onclick = () => {
      const spineItem = comp.getItemByName('spine_item2');

      if (spineItem) {
        const animationList = spineItem.animationList;
        const newAni = animationList[Math.floor(Math.random() * animationList.length)];

        (spineItem as SpineVFXItem).setAnimation(newAni);
      }
    };

    window.addEventListener('unload', () => {
      player.dispose();
    });

  }

  function setCamera (comp) {
    const camera = comp.camera;

    dx.addEventListener('input', e => {
      dxValue.innerText = `X: ${dx.value}`;
      camera.position = [dx.value, dy.value, dz.value];
    });

    dy.addEventListener('input', e => {
      dyValue.innerText = `Y: ${dy.value}`;
      camera.position = [dx.value, dy.value, dz.value];
    });

    dz.addEventListener('input', e => {
      dzValue.innerText = `Z: ${dz.value}`;
      camera.position = [dx.value, dy.value, dz.value];
    });

    const [px, py, pz] = cameraPos;

    dx.value = px;
    dy.value = py;
    dz.value = pz;
    dxValue.innerText = `X: ${px}`;
    dyValue.innerText = `Y: ${py}`;
    dzValue.innerText = `Z: ${pz}`;

    x.addEventListener('input', e => {
      rx.innerText = `RotationX: ${x.value}`;
      camera.rotation = [x.value, y.value, z.value];
    });
    y.addEventListener('input', e => {
      ry.innerText = `RotationY: ${y.value}`;
      camera.rotation = [x.value, y.value, z.value];
    });
    z.addEventListener('input', e => {
      rz.innerText = `RotationZ: ${z.value}`;
      camera.rotation = [x.value, y.value, z.value];
    });
  }
})();
