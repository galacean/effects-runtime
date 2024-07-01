//@ts-nocheck
import { Transform } from '@galacean/effects';
import { ToggleItemBounding, CompositionHitTest } from '@galacean/effects-plugin-model';
import { LoaderImplEx, InputController } from '../../src/helper';
import { createSlider } from './utility';

let player;

let inputController;

let currentTime = 0.1;

let composition;

let playScene;

let url = 'https://gw.alipayobjects.com/os/bmw-prod/2b867bc4-0e13-44b8-8d92-eb2db3dfeb03.glb';

const compatibleMode = 'tiny3d';
const autoAdjustScene = true;

async function getCurrentScene () {
  const duration = 9999;
  const endBehavior = 5;
  const loader = new LoaderImplEx();
  const loadResult = await loader.loadScene({
    gltf: {
      resource: url,
      compatibleMode: compatibleMode,
      skyboxType: 'FARM',
    },
    effects: {
      renderer: player.renderer,
      duration: duration,
      endBehavior: endBehavior,
      playAnimation: -1,
    },
  });

  const items = loadResult.items;

  items.push({
    id: 'extra-camera',
    duration: duration,
    name: 'extra-camera',
    pn: 0,
    type: 'camera',
    transform: {
      position: [0, 0, 8],
      rotation: [0, 0, 0],
    },
    endBehavior: 5,
    content: {
      options: {
        duration: duration,
        near: 0.1,
        far: 2000,
        fov: 60,
        clipMode: 0,
      },
    },
  });

  return {
    'compositionId': 1,
    'requires': [],
    'compositions': [{
      'name': 'composition_1',
      'id': 1,
      'duration': duration,
      'endBehavior': 5,
      'camera': { 'fov': 30, 'far': 1000, 'near': 0.1, 'position': [0, 0, 0], 'clipMode': 1 },
      'items': items,
      'meta': { 'previewSize': [750, 1334] },
    }],
    'gltf': [],
    'images': [],
    'version': '0.8.9-beta.9',
    'shapes': [],
    'plugins': ['model'],
    'type': 'mars',
    '_imgs': { '1': [] },
  };
}

export async function loadScene (inPlayer) {
  if (!player) {
    player = inPlayer;
  }

  if (!playScene) {
    playScene = await getCurrentScene();
    registerMouseEvent();
  }

  const opt = {
    env: 'editor',
    autoplay: false,
    pluginData: {
      visBoundingBox: true,
      compatibleMode: compatibleMode,
      autoAdjustScene: autoAdjustScene,
    },
  };

  composition = await player.loadScene(playScene, opt);
  player.gotoAndStop(currentTime);

  if (inputController !== undefined) {
    inputController.dispose();
  }
  inputController = new InputController();
  inputController.initial({
    cameraID: 'extra-camera',
    sceneRadius: 5.0,
    //
    comp: composition,
    canvas: player.canvas,
  });

  inputController.setMoveEventCallback(eventName => {
    refreshCamera();
    player.gotoAndStop(0);
  });
}

function registerMouseEvent () {
  player.canvas.addEventListener('mousedown', function (e) {
    if (e.button === 1) {
      const [x, y] = getHitTestCoord(e);
      const hitRes = CompositionHitTest(composition, x, y);

      if (hitRes.length > 0) {
        ToggleItemBounding(composition, hitRes[0].id);
      } else {
        ToggleItemBounding(composition, '');
      }
      const hitInfo = hitRes.map(val => { return val.name; });

      console.info(x, y, hitInfo, (hitInfo.length ? 'hit item' : 'miss'));
      player.gotoAndStop(0);
    }
  });
}

function refreshCamera () {
  const freeCamera = playScene.compositions[0].items.find(item => item.id === 'extra-camera');
  const position = player.compositions[0].camera.position;
  const quat = player.compositions[0].camera.getQuat();

  if (quat[0] === null) {
    return;
  }
  const transfrom = new Transform({
    position: position,
    quat: quat,
  });

  freeCamera.transform.position = transfrom.position;
  freeCamera.transform.rotation = transfrom.rotation;
}

function getHitTestCoord (e) {
  const bounding = e.target.getBoundingClientRect();
  const x = ((e.clientX - bounding.left) / bounding.width) * 2 - 1;
  const y = 1 - ((e.clientY - bounding.top) / bounding.height) * 2;

  return [x, y];
}

export function createUI () {
  document.getElementsByClassName('container')[0].style.background = 'rgba(30,32,32)';
  //
  const uiDom = document.createElement('div');

  uiDom.className = 'my_ui';

  const Label = document.createElement('label');

  Label.innerHTML = '<h1>通过鼠标中键进行点击测试</h1>';
  uiDom.appendChild(Label);

  uiDom.appendChild(createSlider('播放时间', 0, 2, 0.01, 0, value => {
    currentTime = value;
    player.gotoAndStop(currentTime);
  }, 'width:420px'));

  const demoInfo = document.getElementsByClassName('demo-info')[0];

  demoInfo.appendChild(uiDom);
}

function createSlider (name, minV, maxV, stepV, defaultV, callback, style) {
  const InputDom = document.createElement('input');

  InputDom.type = 'range';
  InputDom.min = minV.toString();
  InputDom.max = maxV.toString();
  InputDom.value = defaultV.toString();
  InputDom.step = stepV.toString();
  InputDom.style = style;
  InputDom.addEventListener('input', function (event) {
    const dom = event.target;

    Label.innerHTML = dom.value;
    callback(Number(dom.value));
  });
  const divDom = document.createElement('div');

  divDom.innerHTML = name;
  divDom.appendChild(InputDom);
  const Label = document.createElement('label');

  Label.innerHTML = defaultV.toString();
  divDom.appendChild(Label);

  return divDom;
}

