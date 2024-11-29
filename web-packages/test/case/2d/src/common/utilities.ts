// @ts-nocheck
import type { PlayerConfig, Composition, SceneLoadOptions, GLType } from '@galacean/effects';
import { Player, spec, math, AssetManager } from '@galacean/effects';
import { JSONConverter } from '@galacean/effects-plugin-model';

const { Vector3, Matrix4 } = math;

const sleepTime = 20;
const params = new URLSearchParams(location.search);
const oldVersion = params.get('version') || '2.1.1';  // 旧版Player版本
const playerOptions: PlayerConfig = {
  //env: 'editor',
  //pixelRatio: 2,
  renderOptions: {
    willCaptureImage: true,
  },
  manualRender: true,
};

export class TestPlayer {
  player: Player;
  div: HTMLDivElement;
  canvas: HTMLCanvasElement;
  scene: Composition;
  composition: Composition;
  lastTime = 0;

  constructor (
    public width: number,
    public height: number,
    playerClass: typeof Player,
    playerOptions: PlayerConfig,
    public renderFramework: GLType,
    public assetManager: typeof AssetManager,
    public oldVersion: boolean,
    public is3DCase: boolean,
  ) {
    width /= 2;
    height /= 2;

    this.width = width;
    this.height = height;

    this.div = document.createElement('div');
    this.div.style.position = 'absolute';
    this.div.style.width = width + 'px';
    this.div.style.height = height + 'px';
    this.div.style.backgroundColor = 'black';

    const left = 1800;
    const top = 800;

    if (oldVersion) {
      this.div.style.left = left + 'px';
      this.div.style.top = top + 'px';
    } else {
      this.div.style.left = (left + width) + 'px';
      this.div.style.top = top + 'px';
    }

    this.canvas = document.createElement('canvas');

    document.body.appendChild(this.div);
    this.div.appendChild(this.canvas);

    this.player = new playerClass({
      canvas: this.canvas,
      ...playerOptions,
      renderFramework,
    });
    this.assetManager = assetManager;
  }

  async initialize (url: string, loadOptions: SceneLoadOptions = {}) {
    // @ts-expect-error
    Math.seedrandom('mars-runtime');
    this.clearResource();
    const assetManager = new this.assetManager({ ...loadOptions, timeout: 100 });
    let inData: spec.JSONScene | string = url;

    if (this.is3DCase) {
      const converter = new JSONConverter(this.player.renderer);

      inData = await converter.processScene(url);
    }

    const json = await assetManager.loadScene(inData, this.player.renderer);

    this.composition = this.scene = await this.player.loadScene(json, { ...loadOptions, timeout: 100, autoplay: false });
    // @ts-expect-error
    Math.seedrandom('mars-runtime');
    this.player.gotoAndStop(0);
  }

  gotoTime (newtime: number) {
    const time = newtime;
    const deltaTime = time - this.lastTime;

    this.lastTime = newtime;
    // @ts-expect-error
    Math.seedrandom(`mars-runtime${time}`);
    if (this.player.gotoAndStop) {
      this.player.gotoAndStop(time);
    } else {
      this.composition.forwardTime(deltaTime);
      this.player.doTick(0, true);
    }
  }

  async readImageBuffer () {
    await sleep(sleepTime);
    const ctx = this.canvas.getContext(this.renderFramework) as WebGL2RenderingContext;
    const pixels = new Uint8Array(this.width * this.height * 4);

    ctx.flush();
    ctx.readPixels(0, 0, this.width, this.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

    return pixels;
  }

  loadSceneTime () {
    return this.composition.statistic.loadTime;
  }

  firstFrameTime () {
    return this.composition.statistic.firstFrameTime;
  }

  hitTest (x: number, y: number) {
    const ret = this.composition.hitTest(x, y);

    this.player.tick(0);

    return ret;
  }

  duration () {
    // @ts-expect-error
    if (this.composition.content) {
      // @ts-expect-error
      return this.composition.content.duration;
    } else {
      return this.composition.getDuration();
    }
  }

  isLoop () {
    return this.composition.endBehavior === spec.END_BEHAVIOR_RESTART;
  }

  getRandomPointInParticle () {
    const itemList = [];
    let viewProjection;
    const inPosition = new Vector3(0, 0, 0);

    if (this.composition._camera) {
      viewProjection = Matrix4.fromArray(this.composition._camera.viewProjection);
    } else {
      viewProjection = this.composition.camera.getViewProjectionMatrix();
      if (ArrayBuffer.isView(viewProjection)) {
        viewProjection = Matrix4.fromArray(viewProjection);
      }
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

        if (typeof itemList[index].getParticleBoxes === 'function' && subIndex < item.getParticleBoxes().length) {
          const pos = item.getParticleBoxes().reverse()[subIndex].center;

          viewProjection.projectPoint(pos, inPosition);
        } else {
          let pos;

          if (typeof item.getPointPositionByIndex === 'function') {
            pos = item.getPointPositionByIndex(subIndex);
          } else {
            pos = item.particleMesh.getPointPosition(subIndex);
          }

          viewProjection.projectPoint(pos, inPosition);
        }

        return [inPosition.x, inPosition.y];
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

  clearResource () {
    this.player.destroyCurrentCompositions();
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
    this.div.remove();
    this.div = null;
  }
}

export class TestController {
  renderFramework = 'webgl';
  oldPlayer: TestPlayer;
  newPlayer: TestPlayer;

  constructor (
    public is3DCase = false,
  ) { }

  async createPlayers (
    width: number,
    height: number,
    renderFramework: GLType,
    isEditor = true,
  ) {
    await this.loadOldPlayer();
    await this.loadOldModelPlugin();
    await this.loadOldSpinePlugin();
    await this.loadOldOrientationTransformerPlugin();

    playerOptions.env = isEditor ? 'editor' : '';

    this.renderFramework = renderFramework;
    if (window.ge.Player) {
      this.oldPlayer = new TestPlayer(
        width, height, window.ge.Player, playerOptions, renderFramework,
        window.ge.AssetManager, true, this.is3DCase
      );
      this.newPlayer = new TestPlayer(
        width, height, Player, playerOptions, renderFramework,
        AssetManager, false, this.is3DCase
      );
      console.info('Create all players');
    } else {
      console.info('Create player error: window.ge.EffectsPlayer is undefined');
    }
  }

  disposePlayers () {
    this.oldPlayer.dispose();
    this.newPlayer.dispose();
    //
    this.oldPlayer = undefined;
    this.newPlayer = undefined;
  }

  async loadOldPlayer () {
    const playerAddress = `https://unpkg.com/@galacean/effects@${oldVersion}/dist/index.min.js`;

    return this.loadScript(playerAddress);
  }

  async loadOldModelPlugin () {
    const pluginAddress = `https://unpkg.com/@galacean/effects-plugin-model@${oldVersion}/dist/index.min.js`;

    return this.loadScript(pluginAddress);
  }

  async loadOldSpinePlugin () {
    const spineAddress = `https://unpkg.com/@galacean/effects-plugin-spine@${oldVersion}/dist/index.min.js`;

    return this.loadScript(spineAddress);
  }

  async loadOldOrientationTransformerPlugin () {
    const spineAddress = `https://unpkg.com/@galacean/effects-plugin-orientation-transformer@${oldVersion}/dist/index.min.js`;

    return this.loadScript(spineAddress);
  }

  async loadScript (src) {
    const element = document.getElementById(src);

    if (element !== null) {
      return;
    }

    const script = document.createElement('script');

    script.id = src;
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
    this.oldCost = new PlayerCost();
    this.newCost = new PlayerCost();
  }

  addSceneInfo (name, oldLoadCost, oldCreateCost, newLoadCost, newCreateCost, pixelDiffCount) {
    this.oldCost.add(
      name, oldLoadCost, oldCreateCost,
      oldLoadCost, oldCreateCost, pixelDiffCount
    );
    this.newCost.add(
      name, newLoadCost, newCreateCost,
      oldLoadCost, oldCreateCost, pixelDiffCount
    );
  }

  getStatsInfo () {
    const diffSceneCount = this.newCost.getDiffSceneCount();
    const equalSceneCount = this.newCost.getEqualSceneCount();
    const totalCount = equalSceneCount + diffSceneCount;
    const diffSceneRatio = equalSceneCount / totalCount;
    const maxPixelDiffCount = this.newCost.maxPixelDiffCount;
    const totalPixelDiffCount = this.newCost.getTotalPixelDiffCount();
    const averPixelDiffCount = totalPixelDiffCount / diffSceneCount;
    const msgList = [];

    msgList.push(
      `DiffStats: ${this.renderFramework}, total ${totalCount}, equal ${equalSceneCount}, ratio ${diffSceneRatio.toFixed(2)}, ` +
      `diff ${diffSceneCount}, max ${maxPixelDiffCount}, aver ${averPixelDiffCount.toFixed(2)}`
    );
    const oldAverLoadCost = this.oldCost.getAverLoadCost();
    const oldAverCreateCost = this.oldCost.getAverCreateCost();
    const oldAverTotalCost = oldAverLoadCost + oldAverCreateCost;
    const newAverLoadCost = this.newCost.getAverLoadCost();
    const newAverCreateCost = this.newCost.getAverCreateCost();
    const newAverTotalCost = newAverLoadCost + newAverCreateCost;
    const maxSceneList = this.newCost.getMaxDiffCostScenes(5);
    const oldCostInfo = `Old(${oldAverLoadCost.toFixed(2)}, ${oldAverCreateCost.toFixed(2)}, ${oldAverTotalCost.toFixed(2)})`;
    const newCostInfo = `New(${newAverLoadCost.toFixed(2)}, ${newAverCreateCost.toFixed(2)}, ${newAverTotalCost.toFixed(2)})`;

    msgList.push(`CostStats: ${this.renderFramework}, ${oldCostInfo}, ${newCostInfo}`);
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

