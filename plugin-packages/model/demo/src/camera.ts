//@ts-nocheck
import { math, spec } from '@galacean/effects';
import { CameraGestureType, CameraGestureHandlerImp } from '@galacean/effects-plugin-model';
import { LoaderImplEx } from '../../src/helper';

const { Sphere, Vector3, Box3 } = math;

let player: Player;
let pending = false;

let sceneAABB;
let sceneCenter;
let sceneRadius = 1;
let mouseDown = false;

const pauseOnFirstFrame = false;

let gestureType = CameraGestureType.rotate_focus;
let gestureHandler;
let moveBegin = false;
let scaleBegin = false;
let rotationBegin = false;
let rotationFocusBegin = false;

let playScene;

const url = 'https://gw.alipayobjects.com/os/bmw-prod/2b867bc4-0e13-44b8-8d92-eb2db3dfeb03.glb';

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

  sceneAABB = new Box3(sceneMin, sceneMax);
  sceneRadius = sceneAABB.getBoundingSphere(new Sphere()).radius;
  sceneCenter = sceneAABB.getCenter(new Vector3());
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

  if (!pending) {
    const loadOptions = {
      pluginData: {
        enableDynamicSort: true,
      },
    };

    pending = true;

    return player.loadScene(playScene, loadOptions).then(async comp => {
      gestureHandler = new CameraGestureHandlerImp(comp);

      pending = false;

      return true;
    });
  }
}

function registerMouseEvent () {
  window.addEventListener('keydown', function (e) {
    switch (e.key) {
      case '1':
        gestureType = CameraGestureType.translate;

        break;
      case '2':
        gestureType = CameraGestureType.scale;

        break;
      case '3':
        gestureType = CameraGestureType.rotate_self;

        break;
      case '4':
        gestureType = CameraGestureType.rotate_focus;

        break;
      case 'w':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          zAxis: -1, speed: 0.2,
        });

        break;
      case 's':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          zAxis: 1, speed: 0.2,
        });

        break;
      case 'a':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          xAxis: -1, speed: 0.2,
        });

        break;
      case 'd':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          xAxis: 1, speed: 0.2,
        });

        break;
      case 'q':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          yAxis: 1, speed: 0.2,
        });

        break;
      case 'e':
        gestureHandler.onKeyEvent({
          cameraID: 'extra-camera',
          yAxis: -1, speed: 0.2,
        });

        break;
      case 'f':
        gestureHandler.onFocusPoint('extra-camera', sceneCenter.toArray(), sceneRadius * 3);

        break;
    }

    refreshCamera();
    if (pauseOnFirstFrame) {
      player.compositions.forEach(comp => {
        comp.gotoAndStop(comp.time);
      });
    }
  });

  player.canvas.addEventListener('mousedown', function (e) {
    mouseDown = true;
    if (gestureHandler) {
      switch (gestureType) {
        case CameraGestureType.translate:
          moveBegin = true;

          break;
        case CameraGestureType.scale:
          scaleBegin = true;

          break;
        case CameraGestureType.rotate_self:
          rotationBegin = true;

          break;
        case CameraGestureType.rotate_focus:
          rotationFocusBegin = true;

          break;
      }
    }
  });

  player.canvas.addEventListener('mousemove', async function (e) {
    if (gestureHandler && mouseDown) {
      switch (gestureType) {
        case CameraGestureType.translate:
          if (moveBegin) {
            gestureHandler.onXYMoveBegin(
              e.clientX,
              e.clientY,
              player.canvas.width / 2,
              player.canvas.height / 2,
              'extra-camera'
            );
            moveBegin = false;
          }
          gestureHandler.onXYMoving(e.clientX, e.clientY);
          refreshCamera();
          if (pauseOnFirstFrame) {
            player.compositions.forEach(comp => {
              comp.gotoAndStop(comp.time);
            });
          }

          break;
        case CameraGestureType.scale:
          if (scaleBegin) {
            gestureHandler.onZMoveBegin(
              e.clientX,
              e.clientY,
              player.canvas.width / 2,
              player.canvas.height / 2,
              'extra-camera'
            );
            scaleBegin = false;
          }
          gestureHandler.onZMoving(e.clientX, e.clientY);
          refreshCamera();
          if (pauseOnFirstFrame) {
            player.compositions.forEach(comp => {
              comp.gotoAndStop(comp.time);
            });
          }

          break;
        case CameraGestureType.rotate_self:
          if (rotationBegin) {
            gestureHandler.onRotateBegin(
              e.clientX,
              e.clientY,
              player.canvas.width / 2,
              player.canvas.height / 2,
              'extra-camera'
            );
            rotationBegin = false;
          }

          gestureHandler.onRotating(e.clientX, e.clientY);
          refreshCamera();
          if (pauseOnFirstFrame) {
            player.compositions.forEach(comp => {
              comp.gotoAndStop(comp.time);
            });
          }

          break;
        case CameraGestureType.rotate_focus:
          if (rotationFocusBegin) {
            gestureHandler.onRotatePointBegin(
              e.clientX,
              e.clientY,
              player.canvas.width / 2,
              player.canvas.height / 2,
              [0, 0, 0],
              'extra-camera'
            );
            rotationFocusBegin = false;
          }

          gestureHandler.onRotatingPoint(e.clientX, e.clientY);
          refreshCamera();
          if (pauseOnFirstFrame) {
            player.compositions.forEach(comp => {
              comp.gotoAndStop(comp.time);
            });
          }

          break;
      }
    }
  });

  player.canvas.addEventListener('mouseup', async function (e) {
    mouseDown = false;
    if (gestureHandler) {
      switch (gestureType) {
        case CameraGestureType.translate:
          gestureHandler.onXYMoveEnd();

          break;
        case CameraGestureType.scale:
          gestureHandler.onZMoveEnd();

          break;
        case CameraGestureType.rotate_self:
          gestureHandler.onRotateEnd();

          break;
        case CameraGestureType.rotate_focus:
          gestureHandler.onRotatePointEnd();

          break;
      }
    }
  });

  player.canvas.addEventListener('mouseleave', async function (e) {
    mouseDown = false;
    if (gestureHandler) {
      switch (gestureType) {
        case CameraGestureType.translate:
          gestureHandler.onXYMoveEnd();

          break;
        case CameraGestureType.scale:
          gestureHandler.onZMoveEnd();

          break;
        case CameraGestureType.rotate_self:
          gestureHandler.onRotateEnd();

          break;
        case CameraGestureType.rotate_focus:
          gestureHandler.onRotatePointEnd();

          break;
      }
    }
  });

  player.canvas.addEventListener('wheel', function (e) {
    if (gestureHandler) {
      gestureHandler.onKeyEvent({
        cameraID: 'extra-camera',
        zAxis: e.deltaY > 0 ? 1 : -1,
        speed: sceneRadius * 0.1,
      });
    }
  });
}

function refreshCamera () {
  const freeCamera = playScene.items.find(item => item.name === 'extra-camera');
  const position = player.compositions[0].camera.position;
  const rotation = player.compositions[0].camera.rotation;

  if (rotation[0] === null) {
    return;
  }

  freeCamera.transform.position = position;
  freeCamera.transform.rotation = rotation;
}

const demo_infoDom = document.getElementsByClassName('demo-info')[0];

export function createUI () {
  const uiDom = document.createElement('div');

  uiDom.className = 'my_ui';

  const select = document.createElement('select');

  select.innerHTML = `
  <option value="${CameraGestureType.translate}">translate</option>
  <option value="${CameraGestureType.rotate_self}">rotate</option>
  <option value="${CameraGestureType.rotate_focus}">rotatePoint</option>
  <option value="${CameraGestureType.scale}">scale</option>
  `;
  select.onchange = e => {
    gestureType = +e.target.value;
  };
  select.value = gestureType;
  // add ui to parent dom
  demo_infoDom.appendChild(uiDom);
  demo_infoDom.appendChild(select);
}

