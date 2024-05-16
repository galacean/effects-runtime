//@ts-nocheck
import { isObject } from '@galacean/effects';
import { getPMeshList, getRendererGPUInfo } from '@galacean/effects-plugin-model';
import { createButton, createPlayer, disposePlayer, createSlider, loadJsonFromURL } from './utility';
import { JSONConverter } from '@galacean/effects-plugin-model';

let player;
let pending = false;
let currentTime = 0;
let pauseOnFirstFrame = false;

let infoElement;
let url = 'https://mdn.alipayobjects.com/mars/afts/file/A*SERYRaes5S0AAAAAAAAAAAAADlB4AQ';

// 兔子
url = 'https://mdn.alipayobjects.com/mars/afts/file/A*sA-6TJ695dYAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*9iL-RaFeQ80AAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*NPMMTbrZrJAAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*ZQq_SKRrEKsAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*16M9QrFglbUAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*Lqa0SL35KhcAAAAAAAAAAAAADlB4AQ';
//url = 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/restart.json';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*MBmNSbmPOIIAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*cnCMTo1seD0AAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*Lqa0SL35KhcAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*16M9QrFglbUAAAAAAAAAAAAADlB4AQ';
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*9iL-RaFeQ80AAAAAAAAAAAAADlB4AQ';
// 虚拟人
//url = 'https://mdn.alipayobjects.com/mars/afts/file/A*ZQq_SKRrEKsAAAAAAAAAAAAADlB4AQ';

const compatibleMode = 'tiny3d';

async function getCurrentScene () {
  if (isObject(url)) {
    return url;
  }

  return loadJsonFromURL(url).then(scene => {
    if (scene.imgUsage && Object.getOwnPropertyNames(scene.imgUsage).length === 0) { scene.imgUsage = undefined; }

    return scene;
  });
}

export async function loadScene (inPlayer) {
  if (!player) {
    player = inPlayer;
    addRealTimeTicker();
  }
  //
  let scene = await getCurrentScene();
  const converter = new JSONConverter(player);

  scene = await converter.processScene(scene);
  //
  if (!pending) {
    pending = true;
    const opt = {
      pluginData: {
        compatibleMode: compatibleMode,
      },
    };

    return player.loadScene(scene, opt).then(res => {
      if (pauseOnFirstFrame) {
        player.gotoAndStop(currentTime);
      } else {
        player.gotoAndPlay(currentTime);
      }

      pending = false;

      return true;
    });
  }
}

export function createUI () {
  document.getElementsByClassName('container')[0].style.background = 'rgba(30,32,32)';

  const parentElement = document.createElement('div');

  parentElement.className = 'my_ui';

  createButton(parentElement, '重播', async function (ev) {
    currentTime = 0;
    pauseOnFirstFrame = false;
    if (player === undefined) {
      await loadScene(createPlayer(getEnv()));
    } else {
      await loadScene(player);
    }
  });

  createButton(parentElement, '销毁', function (ev) {
    if (player !== undefined) {
      disposePlayer(player);
    }
    player = undefined;
  });

  const slider = createSlider('时间轴', 0, 25, 0.01, 0, async function (value) {
    currentTime = value;
    pauseOnFirstFrame = true;
    await loadScene(player);
  }, 'width:470px');

  parentElement.appendChild(slider);

  const head = document.createElement('label');

  head.innerHTML = '<h1>渲染信息：</h1>';
  parentElement.appendChild(head);

  infoElement = document.createElement('label');
  infoElement.innerHTML = '<h4>加载中...</h4>';
  parentElement.appendChild(infoElement);

  const demoInfo = document.getElementsByClassName('demo-info')[0];

  demoInfo.appendChild(parentElement);
}

export function getEnv () {
  return '';
}

function addRealTimeTicker () {
  let elapsedTime = 3000;

  player.ticker.add(
    function (dt) {
      elapsedTime += dt;
      if (elapsedTime >= 3000) {
        elapsedTime = 0;
        const infoList = [];

        infoList.push(`<p>DeltaTime: ${dt}</p>`);
        //
        let skinHalfFloat = false;
        let skinTextureMode = false;
        const meshList = getPMeshList(player);

        meshList.forEach(mesh => {
          if (mesh.skin?.textureDataMode) {
            skinTextureMode = true;
          }
          mesh.subMeshes.forEach(subMesh => {
            if (subMesh.jointMatrixTexture?.isHalfFloat) { skinHalfFloat = true; }
          });
        });
        infoList.push(`<p>蒙皮信息: HalfFloat ${skinHalfFloat}, 纹理模式 ${skinTextureMode}</p>`);
        //
        const gpuInfo = getRendererGPUInfo(player);

        infoList.push(`<pre>GPU信息: ${gpuInfo}</pre>`);
        infoElement.innerHTML = infoList.join('');
      }
    }
  );
}
