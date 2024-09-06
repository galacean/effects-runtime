//@ts-nocheck
import { math, spec } from '@galacean/effects';
import { CameraGestureHandlerImp } from '@galacean/effects-plugin-model';
import { LoaderImplEx } from '../../src/helper';

const { Sphere, Vector3, Box3 } = math;

let player;

let sceneAABB;
let sceneCenter;
let sceneRadius = 1;
let lastCameraPosition;
let lastCameraRotation;

let gestureHandler;
let mouseDown = false;
let scaleBegin = false;
let rotationBegin = false;

let playScene;

let url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/fish_test.glb';

//url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/DamagedHelmet.glb';

url = './cute_bunny_doll_draft.glb';

let renderMode3D = spec.RenderMode3D.diffuse;

async function getCurrentScene () {
  const duration = 99999;
  const loader = new LoaderImplEx();
  const loadResult = await loader.loadScene({
    gltf: {
      resource: url,
    },
    effects: {
      duration: duration,
      endBehavior: spec.EndBehavior.restart,
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
    endBehavior: spec.EndBehavior.restart,
    position: position.toArray(),
    rotation: [0, 0, 0],
  });

  loader.addLight({
    lightType: spec.LightType.ambient,
    color: { r: 1, g: 1, b: 1, a: 1 },
    intensity: 0.4,
    //
    name: 'ambient-light',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    duration: duration,
    endBehavior: spec.EndBehavior.restart,
  });

  loader.addLight({
    lightType: spec.LightType.directional,
    color: { r: 1, g: 1, b: 1, a: 1 },
    intensity: 1.0,
    followCamera: true,
    //
    name: 'main-light',
    position: [0, 0, 0],
    rotation: [30, 325, 0],
    scale: [1, 1, 1],
    duration: duration,
    endBehavior: spec.EndBehavior.restart,
  });

  const { jsonScene } = loader.getLoadResult();

  loader.dispose();

  return jsonScene;
}

export async function loadScene (inPlayer) {
  if (!player) {
    player = inPlayer;
    registerMouseEvent();
  }
  //
  if (!playScene) {
    playScene = await getCurrentScene();
  } else {
    playScene.items.forEach(item => {
      if (item.name === 'extra-camera') {
        const camera = player.compositions[0].camera;

        item.transform = {
          position: camera.position.clone(),
          eulerHint: camera.rotation.clone(),
          scale: { x: 1, y: 1, z: 1 },
        };
      }
    });
  }

  player.destroyCurrentCompositions();
  const loadOptions = {
    pluginData: {
      renderMode3D: renderMode3D,
      renderMode3DUVGridSize: 1 / 12,
    },
  };

  return player.loadScene(playScene, loadOptions).then(async comp => {
    gestureHandler = new CameraGestureHandlerImp(comp);

    return true;
  });
}

function registerMouseEvent () {
  player.canvas.addEventListener('mousedown', function (e) {
    if (!gestureHandler) {
      return;
    }

    mouseDown = true;
    if (e.buttons === 1) {
      rotationBegin = true;
    } else if (e.buttons === 4) {
      scaleBegin = true;
    }
  });

  player.canvas.addEventListener('mousemove', async function (e) {
    if (gestureHandler && mouseDown) {
      if (e.buttons === 1) {
        if (rotationBegin) {
          gestureHandler.onRotatePointBegin(
            e.clientX,
            e.clientY,
            player.canvas.width / 2,
            player.canvas.height / 2,
            [0, 0, 0],
            'extra-camera'
          );
          rotationBegin = false;
        }

        gestureHandler.onRotatingPoint(e.clientX, e.clientY);
        refreshCamera();
      } else if (e.buttons === 4) {
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
      }
    }
  });

  player.canvas.addEventListener('mouseup', async function (e) {
    mouseDown = false;
    if (gestureHandler) {
      if (e.buttons === 1) {
        gestureHandler.onRotatePointEnd();
      } else if (e.buttons === 4) {
        gestureHandler.onZMoveEnd();
      }
    }
  });

  player.canvas.addEventListener('mouseleave', async function (e) {
    mouseDown = false;
    if (gestureHandler) {
      if (e.buttons === 1) {
        gestureHandler.onRotatePointEnd();
      } else if (e.buttons === 4) {
        gestureHandler.onZMoveEnd();
      }
    }
  });

  player.canvas.addEventListener('wheel', function (e) {
    if (gestureHandler) {
      gestureHandler.onKeyEvent({
        cameraID: 'extra-camera',
        zAxis: e.deltaY > 0 ? 1 : -1,
        speed: sceneRadius * 0.15,
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

export function createUI () {
  document.getElementsByClassName('container')[0].style.background = 'rgba(182,217,241)';

  const uiDom = document.createElement('div');

  uiDom.className = 'my_ui';

  const select = document.createElement('select');

  select.innerHTML = `
    <option value="none">none</option>
    <option value="diffuse">diffuse</option>
    <option value="uv">uv</option>
    <option value="normal">normal</option>
    <option value="basecolor">basecolor</option>
    <option value="alpha">alpha</option>
    <option value="metallic">metallic</option>
    <option value="roughness">roughness</option>
    <option value="ao">ao</option>
    <option value="emissive">emissive</option>
  `;
  for (let i = 0; i < select.options.length; i++) {
    const option = select.options[i];

    if (option.value === renderMode3D) {
      select.selectedIndex = i;

      break;
    }
  }

  select.onchange = async function (e) {
    if (e.target.value === 'none') {
      renderMode3D = spec.RenderMode3D.none;
    } else if (e.target.value === 'diffuse') {
      renderMode3D = spec.RenderMode3D.diffuse;
    } else if (e.target.value === 'uv') {
      renderMode3D = spec.RenderMode3D.uv;
    } else if (e.target.value === 'normal') {
      renderMode3D = spec.RenderMode3D.normal;
    } else if (e.target.value === 'basecolor') {
      renderMode3D = spec.RenderMode3D.basecolor;
    } else if (e.target.value === 'alpha') {
      renderMode3D = spec.RenderMode3D.alpha;
    } else if (e.target.value === 'metallic') {
      renderMode3D = spec.RenderMode3D.metallic;
    } else if (e.target.value === 'roughness') {
      renderMode3D = spec.RenderMode3D.roughness;
    } else if (e.target.value === 'ao') {
      renderMode3D = spec.RenderMode3D.ao;
    } else if (e.target.value === 'emissive') {
      renderMode3D = spec.RenderMode3D.emissive;
    }

    const composition = player.getCompositions()[0];

    composition.items.forEach(item => {
      if (item.name === 'extra-camera') {
        lastCameraPosition = item.transform.position.toArray();
        lastCameraRotation = item.transform.rotation.toArray();
      }
    });

    await loadScene(player);
  };
  uiDom.appendChild(select);

  const demoInfo = document.getElementsByClassName('demo-info')[0];

  demoInfo.appendChild(uiDom);
}
