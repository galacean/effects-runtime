import type { PlayerConfig, Composition, SceneLoadOptions, GLType, Player, AssetManager, spec } from '@galacean/effects';
import { ParticleSystem, ParticleSystemRenderer } from '@galacean/effects';
import { math } from '@galacean/effects';
import { JSONConverter } from '@galacean/effects-plugin-model';
import { buildMergedPreviewDataURL } from './image-preview';

type ViewerToolbarOptions = {
  zoomIn?: number | boolean,
  zoomOut?: number | boolean,
  oneToOne?: number | boolean,
  reset?: number | boolean,
  prev?: number | boolean,
  play?: number | boolean,
  next?: number | boolean,
  rotateLeft?: number | boolean,
  rotateRight?: number | boolean,
  flipHorizontal?: number | boolean,
  flipVertical?: number | boolean,
};

type ViewerOptions = {
  inline?: boolean,
  navbar?: boolean,
  title?: boolean,
  toolbar?: boolean | ViewerToolbarOptions,
  backdrop?: boolean | 'static',
  transition?: boolean,
  movable?: boolean,
  zoomable?: boolean,
  zoomRatio?: number,
  maxZoomRatio?: number,
  keyboard?: boolean,
};

type ViewerInstance = {
  show?: () => void,
  destroy?: () => void,
};

type ViewerConstructor = new (element: HTMLElement, options?: ViewerOptions) => ViewerInstance;

type ZoomableImage = HTMLImageElement & {
  __previewBound?: boolean,
  __viewerInstance?: ViewerInstance,
};

export class TestPlayer {
  player: Player;
  div: HTMLDivElement;
  canvas: HTMLCanvasElement;
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

    const div = document.createElement('div');
    const canvas = document.createElement('canvas');

    div.style.position = 'fixed';
    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.backgroundColor = 'black';

    if (oldVersion) {
      div.style.right = '0px';
      div.style.bottom = '0px';
    } else {
      div.style.right = `${width + 1}px`;
      div.style.bottom = '0px';
    }

    this.canvas = canvas;
    this.div = div;
    document.body.appendChild(div);
    div.appendChild(canvas);

    this.player = new playerClass({
      canvas,
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

  private getImageGroupType (filename: string, isNew?: boolean, imageClassName?: string): 'old' | 'new' | 'heatmap' {
    if (imageClassName?.includes('diff-heatmap') || /_diff\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return 'heatmap';
    }
    if (isNew || /_new\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return 'new';
    }

    return 'old';
  }

  private getSampleKey (filename: string) {
    return filename
      .replace(/\.(png|jpg|jpeg|webp)$/i, '')
      .replace(/_(old|new|diff|compare)$/i, '');
  }

  private createImageGroupTemplate (group: 'old' | 'new' | 'heatmap', title: string) {
    return `
<section class="image-group" data-group="${group}">
  <div class="image-group-title">${title}</div>
  <div class="image-slot"></div>
</section>`;
  }

  private createComparisonGroup (sampleKey: string) {
    const container = document.createElement('div');

    container.classList.add('comparison-group');
    container.dataset.sampleKey = sampleKey;
    container.innerHTML = `
<div class="image-group-wrap">
  <a class="full-preview-link" href="#" aria-label="全预览">全预览</a>
  ${this.createImageGroupTemplate('old', 'OLD')}
  ${this.createImageGroupTemplate('new', 'NEW')}
  ${this.createImageGroupTemplate('heatmap', 'HEATMAP')}
  <small class="image-note"></small>
  <img class="full-preview-target" alt="full-preview" />
</div>`;

    return container;
  }

  private getViewerConstructor () {
    const maybeViewer = (window as Window & { Viewer?: unknown }).Viewer;

    if (typeof maybeViewer !== 'function') {
      return null;
    }

    return maybeViewer as unknown as ViewerConstructor;
  }

  private bindImageZoom (img: HTMLImageElement) {
    const Viewer = this.getViewerConstructor();
    const target = img as ZoomableImage;

    if (!Viewer || target.__previewBound) {
      return;
    }

    target.__previewBound = true;
    target.__viewerInstance = new Viewer(target, {
      inline: false,
      navbar: false,
      title: true,
      backdrop: true,
      transition: false,
      movable: true,
      zoomable: true,
      keyboard: false,
      zoomRatio: 0.2,
      maxZoomRatio: 50,
      toolbar: {
        zoomIn: 1,
        zoomOut: 1,
        oneToOne: 1,
        reset: 1,
        prev: 0,
        play: 0,
        next: 0,
        rotateLeft: 0,
        rotateRight: 0,
        flipHorizontal: 0,
        flipVertical: 0,
      },
    });

    target.addEventListener('click', () => {
      target.__viewerInstance?.show?.();
    });
  }

  private bindFullPreviewLink (groupContainer: HTMLElement, dataUrl: string) {
    const link = groupContainer.querySelector<HTMLAnchorElement>('.full-preview-link');
    const target = groupContainer.querySelector<HTMLImageElement>('.full-preview-target') as ZoomableImage | null;

    if (!link || !target || !dataUrl) {
      return;
    }

    target.src = dataUrl;
    this.bindImageZoom(target);
    link.style.display = 'inline-block';
    link.onclick = event => {
      event.preventDefault();
      target.__viewerInstance?.show?.();
    };
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
    const img = document.createElement('img');
    const suite = document.querySelectorAll('.suite');
    const ul = suite[idx[0]]?.querySelector('ul');
    let li = ul?.querySelector(`li.idx-${idx[1]}`);

    if (!ul) {
      return;
    }

    if (!li) {
      const div = document.createElement('div');

      div.classList.add('image-cell');
      li = document.createElement('li');
      li.classList.add('idx');
      li.classList.add(`idx-${idx[1]}`);
      li.appendChild(div);
    }

    const div = li.querySelector('div.image-cell');

    if (!div) {
      return;
    }

    const sampleKey = this.getSampleKey(filename);
    const groupType = this.getImageGroupType(filename, isNew, imageClassName);
    let groupContainer: HTMLElement | null = null;

    div.querySelectorAll<HTMLElement>('.comparison-group').forEach(item => {
      if (item.dataset.sampleKey === sampleKey) {
        groupContainer = item;
      }
    });

    if (!groupContainer) {
      groupContainer = this.createComparisonGroup(sampleKey);
      div.appendChild(groupContainer);
    }

    const groupWrap = groupContainer.querySelector<HTMLElement>('.image-group-wrap');
    const targetGroup = groupWrap?.querySelector<HTMLElement>(`.image-group[data-group="${groupType}"]`);
    const slot = targetGroup?.querySelector<HTMLElement>('.image-slot');
    const noteEl = groupWrap?.querySelector<HTMLElement>('.image-note');

    if (!slot) {
      return;
    }

    slot.innerHTML = '';

    img.title = filename;
    img.src = url;
    img.classList.add('previewable-image');
    if (imageClassName) {
      img.classList.add(imageClassName);
    }
    this.bindImageZoom(img);

    slot.appendChild(img);
    if (noteEl) {
      noteEl.textContent = note || '';
    }

    if (groupType === 'heatmap') {
      const mergedPreviewDataURL = await buildMergedPreviewDataURL(groupContainer);

      if (mergedPreviewDataURL) {
        this.bindFullPreviewLink(groupContainer, mergedPreviewDataURL);
      }
    }

    ul.appendChild(li);
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
