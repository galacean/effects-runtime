// @ts-nocheck
import type { Camera, JSONValue } from '@galacean/effects';
import { Player } from '@galacean/effects';
import type { FileFormat } from './files';
import { direct, premultiply } from './files';
import type { SkeletonData } from '@galacean/effects-plugin-spine';
import {
  createSkeletonData,
  getAnimationDuration,
  getAnimationList,
  getSkinList,
  TextureAtlas,
} from '@galacean/effects-plugin-spine';
import 'fpsmeter';

const playerOptions = {
  pixelRatio: 2,
  interactive: true,
  onEnd: () => console.info('合成播放结束'),
  env: 'editor',
};

const filetype = document.getElementById('J-premultiply')!;
const startEle = document.getElementById('J-start')!;
const pauseEle = document.getElementById('J-pause')!;
const fileList = document.getElementById('J-fileList') as HTMLSelectElement;
const op = document.getElementById('J-op')!;
const x = op.querySelector('input[name="rotationX"]') as HTMLInputElement;
const y = op.querySelector('input[name="rotationY"]') as HTMLInputElement;
const z = op.querySelector('input[name="rotationZ"]') as HTMLInputElement;
const dz = op.querySelector('input[name="distanceZ"]') as HTMLInputElement;
const dx = op.querySelector('input[name="distanceX"]') as HTMLInputElement;
const dy = op.querySelector('input[name="distanceY"]') as HTMLInputElement;
const speed = op.querySelector('input[name="speed"]') as HTMLInputElement;
const mixDuration = op.querySelector('input[name="mixDuration"]') as HTMLInputElement;
const delay = op.querySelector('input[name="delay"]') as HTMLInputElement;
const dzValue = document.getElementById('J-DZ')!;
const dxValue = document.getElementById('J-DX')!;
const dyValue = document.getElementById('J-DY')!;
const rx = document.getElementById('J-RX')!;
const ry = document.getElementById('J-RY')!;
const rz = document.getElementById('J-RZ')!;
const skin = document.getElementById('J-skinList') as HTMLSelectElement;
const animation = document.getElementById('J-animationList') as HTMLSelectElement;
const format = document.getElementById('J-formatList') as HTMLSelectElement;

// format.onchange = handleChange;
// delay.onchange = handleChange;

const files: Record<string, FileFormat> = direct;

if (files === premultiply) {
  filetype.innerText = '纹理打包选择预乘alpha: true';
} else if (files === direct) {
  filetype.innerText = '纹理打包选择预乘alpha: false';
}

let selectedFile = 'mix';
let skeletonData: SkeletonData, activeSkin: string, activeAnimation: string, duration = 5;
let file: FileFormat, comp, camera: Camera, scene: JSONValue, animationList: string[] = [];
const cameraPos = [0, 0, 8];

const player = new Player({
  container: document.getElementById('J-container'),
  ...playerOptions,
});

// @ts-expect-error
if (window.FPSMeter) {
  // @ts-expect-error
  const meter = new window.FPSMeter();

  player.ticker.add(meter.tick);
}

initialFileList();

fileList.onchange = () => {
  if (player && player.hasPlayable) {
    player.pause();
  }
  animationList = [];
  skin.options.length = 0;
  animation.innerHTML = '';
  activeSkin = '';
  activeAnimation = '';
  const sf = fileList.value;

  selectedFile = sf;
  loadFile(sf);
};
pauseEle.onclick = () => {
  player.pause();
};
startEle.onclick = async () => {
  if (player.hasPlayable) {
    player.pause();
  }
  player.destroyCurrentCompositions();
  handleChange();
  const comp = await player.loadScene(scene);

  void player.play();

  camera = comp.camera;

  console.info(`player play file ${selectedFile}, format:${format.value}, skin: ${activeSkin}, animation: ${activeAnimation}`);
};

function initialFileList () {
  const options = [];

  for (const key of Object.keys(files)) {
    options.push(`<option value="${key}">${key}</option>`);
  }
  options.push('<option value="" selected={}>请选择文件</option>');
  fileList.innerHTML = options.join('');
}

function loadFile (fileName: string) {
  file = files[fileName];
  loadSelectionData(file).then(res => {
    const [data, skinList, animationList] = res;

    setSkinList(skinList);
    addAnimationList(animationList);
    skeletonData = data;
    addCameraEvent();
  }).catch(e => {
    console.error(`loadFile error: ${e}`);
  });
}

async function loadSelectionData (file: FileFormat): Promise<[SkeletonData, string[], string[]]> {
  const atlasText = await loadText(file.atlas);
  const atlas = new TextureAtlas(atlasText);

  const skeleton = await loadText(file.json);
  const skeletonData = createSkeletonData(atlas, skeleton, 'json');

  return [skeletonData, getSkinList(skeletonData), getAnimationList(skeletonData)];
}

function addCameraEvent () {
  window.addEventListener('unload', () => {
    player.dispose();
  });

  dx.addEventListener('input', e => {
    dxValue.innerText = `X: ${dx.value}`;
    camera.position = [Number(dx.value), Number(dy.value), Number(dz.value)];
  });

  dy.addEventListener('input', e => {
    dyValue.innerText = `Y: ${dy.value}`;
    camera.position = [Number(dx.value), Number(dy.value), Number(dz.value)];
  });

  dz.addEventListener('input', e => {
    dzValue.innerText = `Z: ${dz.value}`;
    camera.position = [Number(dx.value), Number(dy.value), Number(dz.value)];
  });

  const [px, py, pz] = cameraPos;

  dx.value = '' + px;
  dy.value = '' + py;
  dz.value = '' + pz;
  dxValue.innerText = `X: ${px}`;
  dyValue.innerText = `Y: ${py}`;
  dzValue.innerText = `Z: ${pz}`;

  x.addEventListener('input', e => {
    rx.innerText = `RotationX: ${x.value}`;
    camera.rotation = [Number(x.value), Number(y.value), Number(z.value)];
  });
  y.addEventListener('input', e => {
    ry.innerText = `RotationY: ${y.value}`;
    camera.rotation = [Number(x.value), Number(y.value), Number(z.value)];
  });
  z.addEventListener('input', e => {
    rz.innerText = `RotationZ: ${z.value}`;
    camera.rotation = [Number(x.value), Number(y.value), Number(z.value)];
  });
}

function handleChange () {
  const as = skin.value;

  activeSkin = as;
  duration = 0.1;
  for (const a of animationList) {
    duration += getAnimationDuration(skeletonData, a);
  }

  scene = generateScene(as, animationList, duration, Number(delay.value), Number(speed.value), Number(mixDuration.value)) as JSONValue;
}

function generateScene (activeSkin: string, activeAnimation: string[], duration: number, delay = 0, speed = 1, mixDuration = 0) {
  return {
    'playerVersion': {
      'web': '1.0.0',
      'native': '1.0.0.231013104006',
    },
    'images': file.png.map(img => {
      return {
        'url': img,
        'renderLevel': 'B+',
        'oriY': 1,
      };
    }),
    'fonts': [],
    'spines': [
      {
        'atlas': [20, [0, 0]],
        'skeleton': [20, [1, 0]],
        'skeletonType': format.value === 'json' ? 'json' : 'skel',
        'images': file.png.map((item, index) => index),
      },
    ],
    'version': '2.2',
    'shapes': [],
    'plugins': [
      'spine',
    ],
    'type': 'ge',
    'compositions': [
      {
        'id': '10',
        'name': '新建合成',
        'duration': 10,
        'startTime': 0,
        'endBehavior': 5,
        'previewSize': [
          750,
          1624,
        ],
        'items': [
          {
            'id': '104',
            'name': 'spine_item',
            duration,
            'type': 'spine',
            'pluginName': 'spine',
            'visible': true,
            'endBehavior': 5,
            delay,
            'renderLevel': 'B+',
            'content': {
              'options': {
                activeSkin,
                'spine': 0,
                'size': [
                  3,
                  3,
                ],
                'startSize': 3,
                activeAnimation,
                mixDuration,
                speed,
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
    'compositionId': '10',
    'bins': [{ url: file.atlas }, { url: format.value === 'json' ? file.json : file.skeleton }],
    'textures': file.png.map((url, index) => ({
      source: index,
      name: url.slice(url.lastIndexOf('/') + 1),
      flipY: false,
    })),
  };
}
function setSkinList (list: string[]) {
  const options = [];

  for (let i = 0; i < list.length; i++) {
    const name = list[i];

    options.push(`<option value="${name}">${name}</option>`);
  }
  options.push('<option value="" selected>请选择皮肤</option>');
  skin.innerHTML = options.join('');
  // skin.onchange = handleChange;
  skin.value = skin.value || list[0];
}

function setAnimationList (e: Event) {
  if (e.target) {
    animationList.push((e.target as HTMLInputElement).name);
  }
}

function addAnimationList (list: string[]) {
  for (let i = 0; i < list.length; i++) {
    const name = list[i];

    const label = document.createElement('label');

    label.className = 'am-list-item checkbox';
    const title = document.createElement('div');

    title.className = 'am-list-label';
    title.innerText = name;
    const box = document.createElement('div');

    box.className = 'am-checkbox';
    const input = document.createElement('input');

    input.type = 'checkbox';
    input.name = name;
    input.onchange = setAnimationList;
    input.id = name;
    const span = document.createElement('span');

    span.className = 'icon-check';
    span.ariaHidden = 'true';

    box.appendChild(input);
    box.appendChild(span);
    title.appendChild(box);
    label.appendChild(title);
    animation.appendChild(label);
  }
}

function loadText (url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.overrideMimeType('text/html');
    request.open('GET', url, true);
    request.onload = () => {
      if (request.status == 200 || request.status == 0) {
        resolve(request.responseText);
      }
    };
    request.onerror = reject;
    request.send();
  });
}

