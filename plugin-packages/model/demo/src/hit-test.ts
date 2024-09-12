import type { Composition, Player } from '@galacean/effects';
import { Transform, spec, math } from '@galacean/effects';
import { ToggleItemBounding, CompositionHitTest } from '@galacean/effects-plugin-model';
import { LoaderImplEx, InputController } from '../../src/helper';
import { createSlider } from './utility';

const { Sphere, Vector3, Box3 } = math;

let player: Player;
let inputController: InputController;
let currentTime = 0.1;
let composition: Composition;
let playScene: spec.JSONScene;
let url: string;

url = 'https://gw.alipayobjects.com/os/bmw-prod/2b867bc4-0e13-44b8-8d92-eb2db3dfeb03.glb';
url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/DamagedHelmet.glb';

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
    endBehavior: spec.EndBehavior.restart,
    position: position.toArray(),
    rotation: [0, 0, 0],
  });

  return loader.getLoadResult().jsonScene;
}

export async function loadScene (inPlayer: Player) {
  if (!player) {
    player = inPlayer;
    registerMouseEvent();
  }

  if (!playScene) {
    playScene = await getCurrentScene();
  } else {
    playScene.items.forEach(item => {
      if (item.id === 'extra-camera') {
        // @ts-expect-error
        item.transform = player.getCompositions()[0].camera;
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
  const freeCamera = playScene.items.find(item => item.name === 'extra-camera') as spec.VFXItemData;
  const position = player.getCompositions()[0].camera.position;
  const quat = player.getCompositions()[0].camera.getQuat();

  if (quat.x === null) {
    return;
  }
  const transfrom = new Transform({
    position: position,
    quat: quat,
  });

  freeCamera.transform!.position = transfrom.position;
  // @ts-expect-error
  freeCamera.transform!.rotation = transfrom.rotation;
}

function getHitTestCoord (e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  const bounding = canvas.getBoundingClientRect();
  const x = ((e.clientX - bounding.left) / bounding.width) * 2 - 1;
  const y = 1 - ((e.clientY - bounding.top) / bounding.height) * 2;

  return [x, y];
}

export function createUI () {
  const container = document.getElementsByClassName('container')[0] as HTMLElement;
  const uiDom = document.createElement('div');
  const Label = document.createElement('label');

  container.style.background = 'rgba(30,32,32)';
  uiDom.className = 'my_ui';
  Label.innerHTML = '<h1>通过鼠标中键进行点击测试</h1>';
  uiDom.appendChild(Label);

  uiDom.appendChild(createSlider('播放时间', 0, 2, 0.01, 0, value => {
    currentTime = value;
    player.gotoAndStop(currentTime);
  }, 'width:420px'));

  const demoInfo = document.getElementsByClassName('demo-info')[0];

  demoInfo.appendChild(uiDom);
}

