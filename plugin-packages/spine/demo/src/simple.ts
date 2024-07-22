// @ts-nocheck
import type { spec } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import type { SpineVFXItem } from '@galacean/effects-plugin-spine';
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
  willCaptureImage: true,
  pixelRatio: 2,
  interactive: true,
  reusable: true,
  onItemClicked: () => console.info('包围盒内被点击'),
  onEnd: () => console.info('合成播放结束'),
  env: 'editor',
};
const files = direct;

if (files === premultiply) {
  filetype.innerText = '纹理打包选择预乘alpha: true';
} else if (files === direct) {
  filetype.innerText = '纹理打包选择预乘alpha: false';
}

const file = files.spineboy;
const mix = files.mix;
const activeAnimation = ['run', 'jump'], skin = 'default', dur = 10, mixDuration = 0.3, speed = 1;

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
    })),
    ...mix.png.map((url, index) => ({
      source: index + file.png.length,
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
        'endBehavior': 2,
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
            'duration': dur,
            'content': {
              'options': {
                'activeSkin': skin,
                speed,
                mixDuration,
                activeAnimation,
                'spine': 0,
                'startSize': 2,
                'resizeRule': 1,
              },
            },
            'transform': {
              'position': [
                0,
                4,
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
                'activeSkin': 'skin-base',
                speed,
                mixDuration,
                'activeAnimation': ['dance'],
                'spine': 1,
                'startSize': 2,
                'resizeRule': 0,
              },
            },
            'transform': {
              'position': [
                0,
                -6,
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
      ...mix.png.map(i => ({
        url: i,
        renderLevel: 'B+',
      })),
    ],
    'version': '1.5',
    'shapes': [],
    'plugins': [
      'spine',
    ],
    'type': 'mars',
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
    const comp = await player.loadScene(animation, {});

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
      const spineItem = comp.getItemByName('spine_item');

      if (spineItem) {
        const skinList = spineItem.skinList;
        const newSkin = skinList[Math.floor(Math.random() * skinList.length)];

        (spineItem as SpineVFXItem).setSkin(newSkin);
      }
    };

    animationEle.onclick = () => {
      const spineItem = comp.getItemByName('spine_item');

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
