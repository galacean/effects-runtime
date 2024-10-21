import type { Player } from '@galacean/effects';
import { math, spec, generateGUID } from '@galacean/effects';
import { CameraGestureHandlerImp } from '@galacean/effects-plugin-model';
import { LoaderImplEx } from '../../src/helper';
import { GizmoSubType } from '@galacean/effects-plugin-editor-gizmo';

const { Sphere, Vector3, Box3 } = math;

let player: Player;
let sceneAABB;
let sceneCenter;
let sceneRadius = 1;

let gestureHandler: CameraGestureHandlerImp;
let mouseDown = false;
let scaleBegin = false;
let rotationBegin = false;

let playScene: spec.JSONScene;

let url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/fish_test.glb';

url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/DamagedHelmet.glb';

//url = './Ignore/fashi2.glb'

//url = './Ignore/1729503665851.glb'
//url = './Ignore/1729503649957.glb'
//url = './Ignore/1729503615854.glb'

enum EditorMode {
  standard,
  diffuse,
  wireframe,
  wireframe2,
}

let editorMode = EditorMode.standard;

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
    fov: 18,
    clipMode: 0,
    //
    name: 'extra-camera',
    duration: duration,
    endBehavior: spec.EndBehavior.restart,
    position: position.toArray(),
    rotation: [0, 0, 0],
  });

  loader.addLight({
    lightType: spec.LightType.directional,
    color: { r: 1, g: 1, b: 1, a: 1 },
    intensity: 1,
    //
    name: 'main-light',
    position: [0, 0, 0],
    rotation: [45, 45, 0],
    scale: [1, 1, 1],
    duration: duration,
    endBehavior: spec.EndBehavior.restart,
  });

  const specularImageList = getSpecularImageList();
  const diffuseImageList = specularImageList[specularImageList.length - 1];

  loader.addSkybox({
    type: 'url',
    renderable: false,
    intensity: 1,
    reflectionsIntensity: 1,
    diffuseImage: diffuseImageList,
    specularImage: specularImageList,
    specularImageSize: Math.pow(2, specularImageList.length - 1),
    specularMipCount: specularImageList.length,
  });

  const { jsonScene } = loader.getLoadResult();

  loader.dispose();

  jsonScene.plugins.push('editor-gizmo');

  return jsonScene;
}

export async function loadScene (inPlayer: Player) {
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
        const camera = player.getCompositions()[0].camera;

        item.transform = {
          position: camera.position.clone(),
          eulerHint: camera.rotation.clone(),
          scale: { x: 1, y: 1, z: 1 },
        };
      }
    });
  }

  let currentScene = playScene;
  let renderMode3D = spec.RenderMode3D.none;

  if (editorMode === EditorMode.wireframe) {
    currentScene = addWireframeItems(playScene);
  } else if (editorMode === EditorMode.wireframe2) {
    currentScene = addWireframeItems(playScene, false);
  } else if (editorMode === EditorMode.diffuse) {
    renderMode3D = spec.RenderMode3D.diffuse;
  }

  player.destroyCurrentCompositions();
  const loadOptions = {
    pluginData: {
      renderMode3D: renderMode3D,
      renderMode3DUVGridSize: 1 / 12,
    },
  };

  return player.loadScene(currentScene, loadOptions).then(async comp => {
    gestureHandler = new CameraGestureHandlerImp(comp);

    return true;
  });
}

function addWireframeItems (scene: spec.JSONScene, hide3DModel = true) {
  const newComponents: any = [];

  scene.components.forEach(comp => {
    const newComponent: any = { ...comp };

    if (newComponent.dataType === spec.DataType.MeshComponent) {
      newComponent.hide = hide3DModel;
    }
    newComponents.push(newComponent);
  });
  const newItems: any = [
    ...scene.items,
  ];

  scene.items.forEach(item => {
    if (item.type === 'mesh') {
      const { name, duration, endBehavior } = item;
      const newItem: any = {
        name: name + '_shadedWireframe',
        id: generateGUID(),
        pn: 1,
        type: 'editor-gizmo',
        visible: true,
        duration: duration ?? 999,
        dataType: spec.DataType.VFXItemData,
        endBehavior,
        transform: {
          scale: { x: 1, y: 1, z: 1 },
          position: { x: 0, y: 0, z: 0 },
          eulerHint: { x: 0, y: 0, z: 0 },
        },
      };
      const newComponent = {
        dataType: 'GizmoComponent',
        id: generateGUID(),
        item: { id: newItem.id },
        options: {
          target: item.id,
          subType: GizmoSubType.modelWireframe,
          color: [0, 255, 255],
        },
      };

      newItem.components = [
        { id: newComponent.id },
      ];
      newComponents.push(newComponent);
      newItems.push(newItem);
    }
  });
  const newComposition = {
    ...scene.compositions[0],
  };
  const items = [];

  for (const item of newItems) {
    items.push({
      id: item.id,
    });
  }
  newComposition.items = items;
  const newScene: spec.JSONScene = {
    ...scene,
    components: newComponents,
    items: newItems,
    compositions: [newComposition],
  };

  return newScene;
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
  const freeCamera = playScene.items.find(item => item.name === 'extra-camera') as spec.VFXItemData;
  const position = player.getCompositions()[0].camera.position;
  const rotation = player.getCompositions()[0].camera.rotation;

  if (rotation.x === null) {
    return;
  }

  freeCamera.transform!.position = position;
  // @ts-expect-error
  freeCamera.transform!.rotation = rotation;
}

export function createUI () {
  const container = document.getElementsByClassName('container')[0] as HTMLElement;
  const uiDom = document.createElement('div');
  const select = document.createElement('select');

  container.style.background = 'rgba(0,0,0)';
  uiDom.className = 'my_ui';
  select.innerHTML = `
    <option value="standard">正常</option>
    <option value="diffuse">白膜</option>
    <option value="wireframe">线框</option>
    <option value="wireframe2">线框2</option>
  `;
  for (let i = 0; i < select.options.length; i++) {
    const option = select.options[i];

    if (option.value === editorMode.toString()) {
      select.selectedIndex = i;

      break;
    }
  }

  select.onchange = async function (e) {
    const element = e.target as HTMLSelectElement;

    if (element.value === 'standard') {
      editorMode = EditorMode.standard;
    } else if (element.value === 'diffuse') {
      editorMode = EditorMode.diffuse;
    } else if (element.value === 'wireframe') {
      editorMode = EditorMode.wireframe;
    } else if (element.value === 'wireframe2') {
      editorMode = EditorMode.wireframe2;
    }

    await loadScene(player);
  };
  uiDom.appendChild(select);

  const demoInfo = document.getElementsByClassName('demo-info')[0];

  demoInfo.appendChild(uiDom);
}

function getSpecularImageList () {
  return [
    [
      './Ignore/20241021_150133/Cubemap_256_px.png',
      './Ignore/20241021_150133/Cubemap_256_nx.png',
      './Ignore/20241021_150133/Cubemap_256_py.png',
      './Ignore/20241021_150133/Cubemap_256_ny.png',
      './Ignore/20241021_150133/Cubemap_256_pz.png',
      './Ignore/20241021_150133/Cubemap_256_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_128_px.png',
      './Ignore/20241021_150133/Cubemap_128_nx.png',
      './Ignore/20241021_150133/Cubemap_128_py.png',
      './Ignore/20241021_150133/Cubemap_128_ny.png',
      './Ignore/20241021_150133/Cubemap_128_pz.png',
      './Ignore/20241021_150133/Cubemap_128_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_64_px.png',
      './Ignore/20241021_150133/Cubemap_64_nx.png',
      './Ignore/20241021_150133/Cubemap_64_py.png',
      './Ignore/20241021_150133/Cubemap_64_ny.png',
      './Ignore/20241021_150133/Cubemap_64_pz.png',
      './Ignore/20241021_150133/Cubemap_64_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_32_px.png',
      './Ignore/20241021_150133/Cubemap_32_nx.png',
      './Ignore/20241021_150133/Cubemap_32_py.png',
      './Ignore/20241021_150133/Cubemap_32_ny.png',
      './Ignore/20241021_150133/Cubemap_32_pz.png',
      './Ignore/20241021_150133/Cubemap_32_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_16_px.png',
      './Ignore/20241021_150133/Cubemap_16_nx.png',
      './Ignore/20241021_150133/Cubemap_16_py.png',
      './Ignore/20241021_150133/Cubemap_16_ny.png',
      './Ignore/20241021_150133/Cubemap_16_pz.png',
      './Ignore/20241021_150133/Cubemap_16_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_8_px.png',
      './Ignore/20241021_150133/Cubemap_8_nx.png',
      './Ignore/20241021_150133/Cubemap_8_py.png',
      './Ignore/20241021_150133/Cubemap_8_ny.png',
      './Ignore/20241021_150133/Cubemap_8_pz.png',
      './Ignore/20241021_150133/Cubemap_8_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_4_px.png',
      './Ignore/20241021_150133/Cubemap_4_nx.png',
      './Ignore/20241021_150133/Cubemap_4_py.png',
      './Ignore/20241021_150133/Cubemap_4_ny.png',
      './Ignore/20241021_150133/Cubemap_4_pz.png',
      './Ignore/20241021_150133/Cubemap_4_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_2_px.png',
      './Ignore/20241021_150133/Cubemap_2_nx.png',
      './Ignore/20241021_150133/Cubemap_2_py.png',
      './Ignore/20241021_150133/Cubemap_2_ny.png',
      './Ignore/20241021_150133/Cubemap_2_pz.png',
      './Ignore/20241021_150133/Cubemap_2_nz.png',
    ],
    [
      './Ignore/20241021_150133/Cubemap_1_px.png',
      './Ignore/20241021_150133/Cubemap_1_nx.png',
      './Ignore/20241021_150133/Cubemap_1_py.png',
      './Ignore/20241021_150133/Cubemap_1_ny.png',
      './Ignore/20241021_150133/Cubemap_1_pz.png',
      './Ignore/20241021_150133/Cubemap_1_nz.png',
    ],
  ];
}
