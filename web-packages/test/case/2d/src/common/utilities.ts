// @ts-nocheck
import type { PlayerConfig, Composition } from '@galacean/effects';
import {
  Player,
  registerPlugin,
  AbstractPlugin,
  VFXItem,
  vec3MulMat4,
  spec,
  getDefaultTemplateCanvasPool, AssetManager,
} from '@galacean/effects';

const sleepTime = 50;
const params = new URLSearchParams(location.search);
const playerVersion = params.get('version') || '1.3.4';  // 旧 Player 版本
const oldSpineVersion = params.get('version') || '2.0.1'; // 旧 spine 插件版本
const playerOptions: PlayerConfig = {
  //env: 'editor',
  //pixelRatio: 2,
  renderOptions: {
    willCaptureImage: true,
  },
  manualRender: true,
  willCaptureImage: true,
};

export class TestPlayer {
  constructor (width, height, playerClass, playerOptions, renderFramework, registerFunc, MarsPlugin, VFXItem, prefetchFunc) {
    this.width = width;
    this.height = height;
    //
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderFramework = renderFramework;
    //
    this.player = new playerClass({
      canvas: this.canvas,
      ...playerOptions,
      renderFramework,
    });
    this.prefetchFunc = prefetchFunc;
    this.scene = undefined;
    this.composition = undefined;
    this.lastTime = 0;

    registerFunc('orientation-transformer', MarsPlugin, VFXItem, true);
  }

  async initialize (url, loadOptions = undefined, playerOptions = undefined) {
    if (this.prefetchFunc) {
      // await this.prefetchFunc(url, { pendingCompile: true });
    }

    Math.seedrandom('mars-runtime');
    if (this.player.loadScene) {
      getDefaultTemplateCanvasPool().dispose();
      const assetManager = new AssetManager();
      const json = await assetManager.loadScene(url);

      compatibleCalculateItem(json.jsonScene.compositions[0]);
      this.player.destroyCurrentCompositions();
      Math.seedrandom('mars-runtime');
      this.composition = this.scene = await this.player.loadScene(json, { ...loadOptions, timeout: 100, autoplay: false });
      this.player.gotoAndStop(0);
    } else {
      // 旧版Mars调用
      this.scene = await this.player.loadSceneAsync(url, { ...loadOptions, timeout: 100 });
      Math.seedrandom('mars-runtime');
      this.composition = await this.player.play(this.scene, playerOptions ?? { pauseOnFirstFrame: true });
    }

  }

  gotoTime (time) {
    const deltaTime = time - this.lastTime;

    this.lastTime = time;
    //
    Math.seedrandom(`mars-runtime${time}`);
    if (this.player.gotoAndStop) {
      this.player.gotoAndStop(time);
      const comp = this.player.getCompositions()[0];

      if (comp.time === comp.duration && comp.content.endBehavior === 5) {
        this.player.gotoAndStop(0);
      }
    } else {
      this.composition.forwardTime(deltaTime);
      this.player.tick(0);
    }
  }

  async readImageBuffer () {
    await sleep(sleepTime);
    const ctx = this.canvas.getContext(this.renderFramework);
    const pixels = new Uint8Array(this.width * this.height * 4);

    ctx.flush();
    ctx.readPixels(0, 0, this.width, this.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

    return pixels;
  }

  loadSceneTime () {
    return this.scene.totalTime;
  }

  firstFrameTime () {
    return this.composition.statistic.firstFrameTime;
  }

  hitTest (x, y) {
    const ret = this.composition.hitTest(x, y);

    this.player.tick(0);

    return ret;
  }

  duration () {
    return this.composition.duration;
  }

  isLoop () {
    return this.composition.endBehavior === spec.END_BEHAVIOR_RESTART;
  }

  getRandomPointInParticle () {
    const itemList = [];
    let viewProjection;
    const inPosition = [0, 0, 0];

    if (this.composition._camera) {
      viewProjection = this.composition._camera.viewProjection;
    } else {
      viewProjection = this.composition.camera.getViewProjectionMatrix();
    }

    this.composition.items.forEach(item => {
      if (item._content?.interaction) {
        if (item._content && item._content.particleMesh) {
          itemList.push(item._content);
        }
      }
    });
    if (itemList.length > 0) {
      const index = Math.floor(Math.random() * 0.9999999 * itemList.length);
      const item = itemList[index];
      let particleLink;

      if (item._particleLink) {
        particleLink = item._particleLink;
      } else {
        particleLink = item.particleLink;
      }
      const particleCount = particleLink.length;

      if (particleCount > 0) {
        const subIndex = Math.floor(Math.random() * 0.9999999 * particleCount);
        const mesh = item.particleMesh;

        if (typeof itemList[index].getParticleBoxes === 'function') {
          const pos = item.getParticleBoxes().reverse()[subIndex].center;

          vec3MulMat4(inPosition, pos, viewProjection);
        } else {
          const pos = mesh.getPointPosition(subIndex);

          vec3MulMat4(inPosition, pos, viewProjection);
        }

        return [inPosition[0], inPosition[1]];
      }
    }

    return [Math.random() * 2 - 1, Math.random() * 2 - 1];
  }

  async saveCanvasToFile (filename) {
    await sleep(sleepTime);
    console.info('saveCanvasToFile', filename);
    const url = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');

    a.setAttribute('download', filename);
    a.target = '_blank';
    a.href = url;
    a.click();
  }

  disposeScene () {
    if (this.composition && this.composition.dispose) {
      this.composition.dispose();
      this.player.compositions.length = 0;
    }
  }

  dispose () {
    this.player.pause();
    if (this.player.dispose) {
      this.player.dispose();
    } else {
      this.player.destroy();
    }
    this.player = null;
    this.canvas.remove();
    this.canvas = null;
  }
}

export class TestController {
  constructor () {
    this.renderFramework = 'webgl';
    this.marsPlayer = undefined;
    this.runtimePlayer = undefined;
  }

  async createPlayers (width, height, renderFramework, isEditor = true) {
    const playerScript = await this.loadOldPlayer();
    const filterScript = await this.loadOldFilters();
    const modelPlugin = await this.loadOldModelPlugin();
    const spinePlugin = await this.loadOldSpinePlugin();

    playerOptions.env = isEditor ? 'editor' : '';

    this.renderFramework = renderFramework;
    if (window.Mars.MarsPlayer) {
      window.Mars.registerFilters(window.MarsFilters.filters);
      this.marsPlayer = new TestPlayer(
        width, height, window.Mars.MarsPlayer, playerOptions, renderFramework,
        window.Mars.registerPlugin, window.Mars.MarsPlugin, window.Mars.VFXItem,
        window.Mars.loadSceneAsync
      );
      this.runtimePlayer = new TestPlayer(
        width, height, Player, playerOptions, renderFramework,
        registerPlugin, AbstractPlugin, VFXItem, null
      );
      console.info('Create all players');
    } else {
      console.info(`Create player error: ${e}`);
    }
  }

  disposePlayers () {
    this.marsPlayer.dispose();
    this.runtimePlayer.dispose();
    //
    this.marsPlayer = undefined;
    this.runtimePlayer = undefined;
  }

  async loadOldPlayer () {
    const playerAddress = `https://gw.alipayobjects.com/os/lib/alipay/mars-player/${playerVersion}/dist/index.js`;

    return this.loadScript(playerAddress);
  }

  async loadOldFilters () {
    const filterAddress = `https://gw.alipayobjects.com/os/lib/alipay/mars-player/${playerVersion}/dist/filters.js`;

    return this.loadScript(filterAddress);
  }

  async loadOldModelPlugin () {
    const pluginAddress = 'https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_mars-plugin-model/1.1.0/dist/index.min.js';

    return this.loadScript(pluginAddress);
  }

  async loadOldSpinePlugin () {
    const spineAddress = `https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_mars-plugin-spine/${oldSpineVersion}/dist/index.min.js`;

    return this.loadScript(spineAddress);
  }

  async loadScript (src) {
    const script = document.createElement('script');

    script.src = src;
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => {
        console.debug(`load success ${src}`);
        resolve(script);
      };
      script.onerror = () => {
        console.debug(`load ${src} fail`);
        reject();
      };
    });
  }
}

export class ImageComparator {
  constructor (pixelThreshold) {
    this.pixelThreshold = pixelThreshold;
  }

  async compareImages (image0, image1) {
    let pixelDiffValue = 0;

    for (let i = 0; i < image0.length; i += 4) {
      if (image0[i] == image1[i]
        && image0[i + 1] == image1[i + 1]
        && image0[i + 2] == image1[i + 2]
        && image0[i + 3] == image1[i + 3]) {
        continue;
      }
      const diff = Math.max(
        Math.abs(image0[i] - image1[i]),
        Math.abs(image0[i + 1] - image1[i + 1]),
        Math.abs(image0[i + 2] - image1[i + 2]),
        Math.abs(image0[i + 3] - image1[i + 3]),
      );

      if (diff > this.pixelThreshold) {
        ++pixelDiffValue;
      }
    }

    return pixelDiffValue;
  }
}

export class SceneInfo {
  constructor () {
    this.name = '';
    this.loadCost = 0;
    this.createCost = 0;
    this.totalCost = 0;
    this.totalDiffCost = 0;
    this.pixelDiffCount = 0;
  }

  setInfo (name, loadCost, createCost, baseLoadCost, baseCreateCost, pixelDiffCount) {
    this.name = name;
    this.loadCost = loadCost;
    this.createCost = createCost;
    this.totalCost = loadCost + createCost;
    this.totalDiffCost = this.totalCost - baseLoadCost - baseCreateCost;
    this.pixelDiffCount = pixelDiffCount;
  }

  add (scene) {
    this.loadCost += scene.loadCost;
    this.createCost += scene.createCost;
    this.totalCost += scene.totalCost;
    this.totalDiffCost += scene.totalDiffCost;
    this.pixelDiffCount += scene.pixelDiffCount;
  }
}

export class PlayerCost {
  constructor () {
    this.sceneList = [];
    this.accumScene = new SceneInfo();
    this.maxPixelDiffCount = 0;
  }

  add (name, loadCost, createCost, baseLoadCost, baseCreateCost, pixelDiffCount) {
    const scene = new SceneInfo();

    scene.setInfo(
      name, loadCost, createCost,
      baseLoadCost, baseCreateCost, pixelDiffCount
    );
    this.sceneList.push(scene);
    this.accumScene.add(scene);
    if (this.maxPixelDiffCount < pixelDiffCount) {
      this.maxPixelDiffCount = pixelDiffCount;
    }
  }

  getTotalSceneCount () {
    return this.sceneList.length;
  }

  getDiffSceneCount () {
    let count = 0;

    this.sceneList.forEach(scene => {
      if (scene.pixelDiffCount > 0) {
        ++count;
      }
    });

    return count;
  }

  getEqualSceneCount () {
    let count = 0;

    this.sceneList.forEach(scene => {
      if (scene.pixelDiffCount == 0) {
        ++count;
      }
    });

    return count;
  }

  getAverLoadCost () {
    return this.accumScene.loadCost / this.getTotalSceneCount();
  }

  getAverCreateCost () {
    return this.accumScene.createCost / this.getTotalSceneCount();
  }

  getAverTotalCost () {
    return this.accumScene.totalCost / this.getTotalSceneCount();
  }

  getTotalPixelDiffCount () {
    return this.accumScene.pixelDiffCount;
  }

  getAverPixelDiffCount () {
    return this.accumScene.pixelDiffCount / this.getTotalSceneCount();
  }

  getMaxDiffCostScenes (count) {
    this.sceneList.sort((a, b) => b.totalDiffCost - a.totalDiffCost);
    const sceneList = [];

    for (let i = 0; i < count && i < this.sceneList.length; i++) {
      sceneList.push(this.sceneList[i]);
    }

    return sceneList;
  }
}

export class ComparatorStats {
  constructor (renderFramework) {
    this.renderFramework = renderFramework;
    this.marsCost = new PlayerCost();
    this.runtimeCost = new PlayerCost();
  }

  addSceneInfo (name, marsLoadCost, marsCreateCost, runtimeLoadCost, runtimeCreateCost, pixelDiffCount) {
    this.marsCost.add(
      name, marsLoadCost, marsCreateCost,
      marsLoadCost, marsCreateCost, pixelDiffCount
    );
    this.runtimeCost.add(
      name, runtimeLoadCost, runtimeCreateCost,
      marsLoadCost, marsCreateCost, pixelDiffCount
    );
  }

  getStatsInfo () {
    const diffSceneCount = this.runtimeCost.getDiffSceneCount();
    const equalSceneCount = this.runtimeCost.getEqualSceneCount();
    const totalCount = equalSceneCount + diffSceneCount;
    const diffSceneRatio = equalSceneCount / totalCount;
    const maxPixelDiffCount = this.runtimeCost.maxPixelDiffCount;
    const totalPixelDiffCount = this.runtimeCost.getTotalPixelDiffCount();
    const averPixelDiffCount = totalPixelDiffCount / diffSceneCount;
    const msgList = [];

    msgList.push(
      `DiffStats: ${this.renderFramework}, total ${totalCount}, equal ${equalSceneCount}, ratio ${diffSceneRatio.toFixed(2)}, ` +
      `diff ${diffSceneCount}, max ${maxPixelDiffCount}, aver ${averPixelDiffCount.toFixed(2)}`
    );
    const marsAverLoadCost = this.marsCost.getAverLoadCost();
    const marsAverCreateCost = this.marsCost.getAverCreateCost();
    const marsAverTotalCost = marsAverLoadCost + marsAverCreateCost;
    const runtimeAverLoadCost = this.runtimeCost.getAverLoadCost();
    const runtimeAverCreateCost = this.runtimeCost.getAverCreateCost();
    const runtimeAverTotalCost = runtimeAverLoadCost + runtimeAverCreateCost;
    const maxSceneList = this.runtimeCost.getMaxDiffCostScenes(5);
    const marsCostInfo = `mars(${marsAverLoadCost.toFixed(2)}, ${marsAverCreateCost.toFixed(2)}, ${marsAverTotalCost.toFixed(2)})`;
    const runtimeCostInfo = `runtime(${runtimeAverLoadCost.toFixed(2)}, ${runtimeAverCreateCost.toFixed(2)}, ${runtimeAverTotalCost.toFixed(2)})`;

    msgList.push(`CostStats: ${this.renderFramework}, ${marsCostInfo}, ${runtimeCostInfo}`);
    msgList.push('Top5Scene: ' + maxSceneList.map(scene => scene.name + `(${scene.totalDiffCost.toFixed(1)})`).join(', '));
    console.info(msgList.join('\n'));

    return msgList.join('<br>');
  }

}

function sleep (ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function getCurrnetTimeStr () {
  const date = new Date(Date.now());
  const timeStr = date.toLocaleString('zh-CN');
  const ms = `${date.getMilliseconds()}`;

  return timeStr.split(/[ /:]+/).join('') + ms.padStart(3, '0');
}

export function filterInteractScene (sceneDataSet) {
  const interactScenes = [];

  Object.keys(sceneDataSet).forEach(async key => {
    const { name, url } = sceneDataSet[key];
    const sceneData = await loadTextFromURL(url);

    if (sceneData.indexOf('interact') >= 0) {
      interactScenes.push(url);
      console.info(`InteractScene: ${key}, ${name}, ${url}`);
    }
  });

  return interactScenes;
}

function loadTextFromURL (url) {
  return new Promise(function (resolve, reject) {
    const href = new URL(url, location.href).href;
    const xhr = new XMLHttpRequest();

    xhr.responseType = 'text';
    xhr.addEventListener('load', () => resolve(xhr.response));
    xhr.addEventListener('error', reject);
    xhr.open('get', href);
    xhr.send();
  });
}

export function getWebGLVersionFromURL (): string | null {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  return urlParams.get('webgl');
}

/**
 * 兼容旧 player 中空节点结束行为是销毁和冻结表现一样的动画
 * TODO 不需要和 player 做效果对比时可以移除
 */
function compatibleCalculateItem (composition: Composition) {
  // 测试用的兼容
  composition.items.forEach(item => {
    // 兼容空节点结束行为，保持和player一致，在runtime上空节点结束为销毁改为冻结的效果
    if (item.type === spec.ItemType.null && item.endBehavior === spec.ItemEndBehavior.destroy) {
      item.endBehavior = spec.ItemEndBehavior.forward;
    }
    // 兼容旧版 Player 粒子发射器为直线时形状错误
    if (item.type === spec.ItemType.particle && item.content.shape && item.content.shape.type === spec.ShapeType.EDGE) {
      item.content.shape.width /= 2;
    }
  });

}
