import * as THREE from 'three';
import { ThreeDisplayObject } from '@galacean/effects-threejs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { createThreePlayer } from './common/three-display-object';
import inspireList from './assets/inspire-list';

const jsons: [url: string, pos: number[], scale?: number][] = [
  ['https://mdn.alipayobjects.com/mars/afts/file/A*e2PBQa_gAwcAAAAAAAAAAAAADlB4AQ', [0, 10, 7]],
  [inspireList.multiPeople.url, [0, 10, -7]],
  [inspireList.book.url, [0, 75, 0], 10],
  [inspireList.heart.url, [9, 10, 3]],
  ['https://mdn.alipayobjects.com/mars/afts/file/A*ger1RL7iTAoAAAAAAAAAAAAADlB4AQ', [-10, 4, 3]],
];

(async () => {
  // THREE 资源加载
  const rgbeLoader = new RGBELoader();
  const gltfLoader = new GLTFLoader();
  const [texture, gltf, gltf2, gltf3] = await Promise.all([
    rgbeLoader.loadAsync('https://gw.alipayobjects.com/os/public-service/owl/hdr/venice_sunset_1k.hdr'),
    gltfLoader.loadAsync('https://mdn.alipayobjects.com/huamei_s9rwo4/afts/file/A*YgNkS4JVkboAAAAAAAAAAAAADiqKAQ/spacestation_scene_ld.glb'),
    // model
    gltfLoader.loadAsync('https://mdn.alipayobjects.com/huamei_s9rwo4/afts/file/A*W48ZT6LBF8YAAAAAAAAAAAAADiqKAQ/a.glb'),
    gltfLoader.loadAsync('https://gw.alipayobjects.com/os/H5App-BJ/1643985956418-gltf/scene.gltf'),
  ]);

  // THREE 插件初始化
  const threePlayer = createThreePlayer({
    container: document.getElementById('J-container'),
    pixelRatio: window.devicePixelRatio,
  });
  // THREE 场景创建
  const renderer = threePlayer.renderer;
  const width = renderer.domElement.getBoundingClientRect().width;
  const height = renderer.domElement.getBoundingClientRect().height;
  const scene = new THREE.Scene();
  const clock = new THREE.Clock();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

  // 设置主相机
  camera.position.set(5, 15, 30);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  // 实例化 ThreeDisplayObject，并添加到主场景中
  const groups = await Promise.all(jsons.map(async ([url, pos, scale = 1]) => {
    const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height, camera });

    await displayObject.loadScene(url);
    // 修改 Galacean Effects 位置
    displayObject.position.set(pos[0], pos[1], pos[2]);
    displayObject.scale.set(scale, scale, scale);

    scene.add(displayObject);

    return displayObject;
  }));

  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
  gltf2.scene.position.set(10, 4.5, 3);
  gltf2.scene.scale.set(10, 10, 10);

  gltf3.scene.position.set(-10, 4.5, 3);
  gltf3.scene.scale.set(10, 10, 10);
  gltf.scene.scale.set(3, 3, 3);

  const mixer = new THREE.AnimationMixer(gltf.scene);

  mixer.clipAction(gltf.animations[0]).play();
  scene.add(gltf.scene);
  scene.add(gltf2.scene);
  scene.add(gltf3.scene);
  // 添加控制
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.minDistance = 0.1;
  controls.maxDistance = 1000;
  controls.target.set(0, 0, 0);
  // controls.update();
  controls.addEventListener('change', renderThree); // use if there is no animation loop

  let lastTime = performance.now();

  function render () {
    for (const group of groups) {
      const { currentComposition } = group;

      if (!currentComposition.isDestroyed) {
        currentComposition.update(performance.now() - lastTime);
      }
    }
    lastTime = performance.now();
    // 标志板设置
    groups[2].lookAt(camera.position.x, camera.position.y, camera.position.z);
    renderThree();
    requestAnimationFrame(render);
  }

  function renderThree () {
    mixer.update(clock.getDelta());
    renderer.render(scene, camera);
  }

  render();
})();
