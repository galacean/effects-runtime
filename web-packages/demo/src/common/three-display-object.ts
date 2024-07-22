// @ts-nocheck
import { EventSystem, EVENT_TYPE_CLICK, ThreeDisplayObject, spec } from '@galacean/effects-threejs';

export function createThreePlayer (options) {
  const { container, renderFramework = 'webgl' } = options;
  const renderOptions = {
    alpha: true,
    stencil: true,
    antialias: true,
    depth: true,
    premultipliedAlpha: true,
  };
  const renderer = renderFramework === 'webgl' ? new THREE.WebGL1Renderer(renderOptions) : new THREE.WebGLRenderer(renderOptions);
  const { width, height } = container.getBoundingClientRect();

  renderer.setPixelRatio(options.pixelRatio);
  renderer.setSize(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  return {
    renderer,
    hasPlayable: false,
    pause: () => { },
    resume: () => { },
    onItemClicked: ({ name }) => {
      console.debug(`item ${name} has been clicked`);
    },
  };
}

let sceneName = '';

export async function renderbyThreeDisplayObject (player, json) {
  const renderer = player.renderer;
  const { width, height } = renderer.domElement.getBoundingClientRect();
  const camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);
  const scene = new THREE.Scene();

  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  let event;

  const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });

  await displayObject.loadScene(json);
  // 兼容父节点的结束行为销毁时表现为冻结
  displayObject.currentComposition.items.forEach(item => {
    if (item.type === spec.ItemType.null && item.endBehavior === spec.EndBehavior.destroy) {
      item.endBehavior = spec.EndBehavior.freeze;
    }
  });
  scene.add(displayObject);

  const { currentComposition } = displayObject;

  renderer.render(scene, camera);

  // 防止 event 重复创建
  if (currentComposition.name !== sceneName) {
    // 注册事件系统 不需要响应点击时可以不进行注册
    event = new EventSystem(renderer.domElement);

    event.bindListeners();
    event.addEventListener(EVENT_TYPE_CLICK, handleClick);
    currentComposition.event = event;
  }
  sceneName = currentComposition.name;

  function handleClick (e) {
    const { x, y } = e;
    const regions = currentComposition.hitTest(x, y);

    if (regions.length) {
      for (let i = 0; i < regions.length; i++) {
        const { name, id, hitPositions, behavior = spec.InteractBehavior.NOTIFY } = regions[i];

        if (behavior === spec.InteractBehavior.NOTIFY) {
          // 或者自定义notify的回调参数
          console.info(`item ${name} has been clicked`);

        } else if (behavior === spec.InteractBehavior.RESUME_PLAYER) {
          player.resume();
        }
      }
    }
  }

  let lastTime = performance.now();
  let paused = false;

  player.hasPlayable = true;
  player.pause = () => {
    paused = true;
  };
  player.resume = () => {
    paused = false;
    lastTime = performance.now();
    render();
  };

  function render () {
    if (!currentComposition.isDestroyed) {
      displayObject.update(performance.now() - lastTime);
    }
    lastTime = performance.now();
    renderer.render(scene, camera);

    if (!paused) {
      requestAnimationFrame(render);
    }
  }
  render();
}
