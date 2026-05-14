import type { PlayerConfig, Composition, SceneLoadOptions, GLType, Player, AssetManager, spec } from '@galacean/effects';
import { ParticleSystem, ParticleSystemRenderer } from '@galacean/effects';
import { math } from '@galacean/effects';
import { JSONConverter } from '@galacean/effects-plugin-model';
import { CaseImagePreview } from '../preview/image-preview';
import { createPlayerLayout } from './player-layout';

export class TestPlayer {
  player: Player;
  div: HTMLDivElement;
  canvas: HTMLCanvasElement;
  composition!: Composition;
  lastTime = 0;
  private readonly imagePreview = new CaseImagePreview();

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

    const layout = createPlayerLayout({
      width,
      height,
      isOldVersion: oldVersion,
    });

    this.canvas = layout.canvas;
    this.div = layout.mount;

    this.player = new playerClass({
      canvas: this.canvas,
      ...playerOptions,
      renderFramework,
    });

    this.assetManager = assetManager;
  }

  async initialize (url: string | spec.JSONScene, loadOptions: SceneLoadOptions = {}) {
    // @ts-expect-error
    Math.seedrandom('runtime');
    this.clearResource();

    const assetManager = new this.assetManager({ ...loadOptions, timeout: 100 });
    let json: spec.JSONScene | string = url;

    if (this.is3DCase) {
      const converter = new JSONConverter(this.player.renderer);

      json = await converter.processScene(url as string);
    }

    const scene = await assetManager.loadScene(json, this.player.renderer);

    this.composition = await this.player.loadScene(scene, {
      ...loadOptions,
      timeout: 100,
      autoplay: false,
    });
    // @ts-expect-error
    Math.seedrandom('runtime');
    this.player.gotoAndStop(0);
  }

  gotoTime (newtime: number) {
    const time = newtime;

    this.lastTime = newtime;
    // @ts-expect-error
    Math.seedrandom(`runtime${time}`);
    this.player.gotoAndStop(time);
  }

  async readImageBuffer () {
    const ctx = this.canvas.getContext(this.renderFramework) as WebGL2RenderingContext;

    // 强制等待 GPU 完成所有渲染命令
    ctx.finish();

    //使用实际的drawingBuffer读取，而不是使用画布尺寸
    const originalWidth = ctx.drawingBufferWidth;
    const originalHeight = ctx.drawingBufferHeight;
    const pixels = new Uint8Array(originalWidth * originalHeight * 4);

    ctx.readPixels(0, 0, originalWidth, originalHeight, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

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
    return this.composition.getDuration();
  }

  getRandomPointInParticle () {
    const itemList: ParticleSystem[] = [];
    const inPosition = new math.Vector3(0, 0, 0);
    let viewProjection = this.composition.camera.getViewProjectionMatrix();

    if (ArrayBuffer.isView(viewProjection)) {
      // @ts-expect-error
      viewProjection = math.Matrix4.fromArray(viewProjection);
    }

    this.composition.items.forEach(item => {
      const { interaction } = item.getComponent(ParticleSystem) ?? {};
      const content = item.getComponent(ParticleSystemRenderer);
      const { particleMesh } = content ?? {};

      if (interaction) {
        if (particleMesh) {
          // @ts-expect-error
          itemList.push(content);
        }
      }
    });

    if (itemList.length > 0) {
      const index = Math.floor(Math.random() * 0.9999999 * itemList.length);
      const item = itemList[index];
      const particleCount = item.particleCount;

      if (particleCount > 0) {
        const subIndex = Math.floor(Math.random() * 0.9999999 * particleCount);

        if (typeof itemList[index].getParticleBoxes === 'function' && subIndex < item.getParticleBoxes().length) {
          const pos = item.getParticleBoxes().reverse()[subIndex].center;

          viewProjection.projectPoint(pos, inPosition);
        } else {
          const pos = item.getPointPositionByIndex(subIndex);

          pos && viewProjection.projectPoint(pos, inPosition);
        }

        return [inPosition.x, inPosition.y];
      }
    }

    return [Math.random() * 2 - 1, Math.random() * 2 - 1];
  }

  async saveCanvasToImage (
    filename: string,
    idx: [number, number],
    isNew?: boolean,
    dataUrl?: string,
    imageClassName?: string,
    note?: string,
  ) {
    const ctx = this.canvas.getContext(this.renderFramework) as WebGL2RenderingContext;

    // 强制等待 GPU 完成所有渲染命令
    ctx.finish();

    const url = dataUrl || this.canvas.toDataURL('image/png');

    await this.imagePreview.saveImage({
      filename,
      idx,
      url,
      isNew,
      imageClassName,
      note,
    });
  }

  clearResource () {
    this.player.destroyCurrentCompositions();
  }

  disposeScene () {
    if (this.composition && this.composition.dispose) {
      this.composition.dispose();
      this.player.getCompositions().length = 0;
    }
  }

  dispose () {
    this.player.dispose();
    // @ts-expect-error
    this.player = null;
    this.canvas.remove();
    // @ts-expect-error
    this.canvas = null;
    this.div.remove();
    // @ts-expect-error
    this.div = null;
  }
}
