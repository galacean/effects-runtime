//@ts-nocheck
import { Transform, spec, math } from '@galacean/effects';
import { ToggleItemBounding, CompositionHitTest } from '@galacean/effects-plugin-model';
import { LoaderImplEx, InputController } from '../../src/helper';
import { createSlider } from './utility';

const { Sphere, Vector3, Box3 } = math;

let player;

let inputController;

let currentTime = 0.1;

let composition;

let playScene;

const url = 'https://gw.alipayobjects.com/os/bmw-prod/2b867bc4-0e13-44b8-8d92-eb2db3dfeb03.glb';

const compatibleMode = 'tiny3d';
const autoAdjustScene = true;

async function getCurrentScene () {
  const duration = 9999;
  const endBehavior = 5;
  const loader = new LoaderImplEx();
  const loadResult = await loader.loadScene({
    gltf: {
      resource: url,
      compatibleMode: 'tiny3d',
      skyboxType: 'NFT',
      skyboxVis: true,
    },
    effects: {
      duration: duration,
      endBehavior: endBehavior,
      playAnimation: 0,
    },
  });

  const sceneMin = Vector3.fromArray(loadResult.sceneAABB.min);
  const sceneMax = Vector3.fromArray(loadResult.sceneAABB.max);

  const sceneAABB = new Box3(sceneMin, sceneMax);
  const sceneRadius = sceneAABB.getBoundingSphere(new Sphere()).radius;
  const sceneCenter = sceneAABB.getCenter(new Vector3());
  const position = sceneCenter.add(new Vector3(0, 0, sceneRadius * 3));

  loader.addCamera({
    near: 0.1,
    far: 5000,
    fov: 60,
    clipMode: 0,
    //
    name: 'extra-camera',
    duration: duration,
    endBehavior: spec.ItemEndBehavior.loop,
    position: position.toArray(),
    rotation: [0, 0, 0],
  });

  return loader.getLoadResult().jsonScene;
}

export async function loadScene (inPlayer) {
  if (!player) {
    player = inPlayer;
    registerMouseEvent();
  }

  if (!playScene) {
    playScene = await getCurrentScene();
  } else {
    playScene.compositions[0].items.forEach(item => {
      if (item.id === 'extra-camera') {
        item.transform = player.compositions[0].camera;
      }
    });
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
  const freeCamera = playScene.items.find(item => item.name === 'extra-camera');
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

