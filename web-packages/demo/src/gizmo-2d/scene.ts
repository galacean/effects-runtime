import { CompositionComponent, EventEmitter, FrameComponent, PlayState, SpriteComponent, TextComponent, Texture, TextureSourceType, glContext, spec } from '@galacean/effects';
import type { Composition, Player, VFXItem, math } from '@galacean/effects';
import { DefaultVFXItems, VFXItemFactory, pauseVideoComponent, playVideoComponent } from '@galacean/effects-plugin-editor-gizmo';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

export type Point2D = [number, number];
export type MediaKind = 'Video' | 'Effects';

const VIDEO_URL = 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/fYhsTZMNQ00AAAAAgIAAABgAenV5AQBr';
const EFFECTS_URL = 'https://mdn.alipayobjects.com/mars/afts/file/A*sq53SZTqNQkAAAAAR7AAAAgAelB4AQ';

/** 图层只保存展示信息；变换和文本内容以运行时元素为准。 */
export interface DemoItem {
  item: VFXItem,
  name: string,
  kind: 'Frame' | 'Text' | 'Sprite' | MediaKind,
  status?: 'loading' | 'ready' | 'error',
}

export interface MediaState {
  playing: boolean,
  time: number,
  duration: number,
}

type SceneEvents = {
  change: [],
  resourceerror: [string, unknown],
};

interface TextOptions {
  name?: string,
  value?: string,
  fontSize?: number,
  width?: number,
  parent?: VFXItem,
  id?: string,
}

/** 管理示例场景、元素工厂和图层登记，不依赖编辑器 DOM 或工具状态。 */
export class DemoScene extends EventEmitter<SceneEvents> {
  private readonly items: DemoItem[] = [];
  private frameCount = 0;
  private textCount = 0;
  private videoCount = 0;
  private effectsCount = 0;
  private defaultFrame?: VFXItem;
  private disposed = false;

  constructor (private readonly player: Player, private readonly composition: Composition) {
    super();
  }

  getItems (): readonly DemoItem[] {
    return this.items;
  }

  getItem (item: VFXItem): DemoItem | undefined {
    return this.items.find(data => data.item === item);
  }

  getItemById (id: string): DemoItem | undefined {
    return this.items.find(data => data.item.getInstanceId() === id);
  }

  getName (item: VFXItem): string {
    return this.getItem(item)?.name ?? item.name;
  }

  /** 创建初始展示内容，并返回默认选中的卡片。 */
  createDefaultItems (): VFXItem {
    const frame = this.createFrame([0, 0], [8.6, 6.3]);

    this.defaultFrame = frame.item;
    const cards: { name: string, color: string, position: Point2D, size: Point2D }[] = [
      { name: '移动与缩放', color: '#3478e5', position: [-1.95, 1.1], size: [2.15, 1.25] },
      { name: '对齐与吸附', color: '#8861d8', position: [1.95, 1.1], size: [2.15, 1.25] },
    ];
    const sprites = cards.map((card, index) => {
      const item = DefaultVFXItems.createSprite(this.composition, null, card.name);
      const sprite = item.getComponent(SpriteComponent);

      item.setParent(frame.item);
      item.setPosition(...card.position, 0);
      item.transform.setSize(...card.size);
      sprite.setTexture(this.createCardTexture(card.name, card.color));
      sprite.priority = index;
      this.register({ item, name: card.name, kind: 'Sprite' });

      return item;
    });

    this.createText([0, 2.45], { name: 'Text 1 · 标题', value: '2D Gizmo Playground', fontSize: 28, width: 640, parent: frame.item });
    this.createText([0, -2.65], { name: 'Text 2 · 可编辑说明', value: '拖动、缩放、旋转；双击修改文字。', fontSize: 16, width: 600, parent: frame.item });
    this.createText([-1.95, 0.05], { name: 'Video · 说明', value: 'Video · 视频', fontSize: 14, width: 300, parent: frame.item });
    this.createText([1.95, 0.05], { name: 'Effects · 说明', value: 'Effects · 动效', fontSize: 14, width: 300, parent: frame.item });

    return sprites[0];
  }

  /** 异步加载媒体，保留已就绪的画板和基础交互。 */
  async createDefaultMediaItems (): Promise<void> {
    await Promise.allSettled([
      this.createVideo([-1.95, -1.2], [3.2, 1.8], this.defaultFrame),
      this.createEffects([1.95, -1.2], [3.2, 1.8], this.defaultFrame),
    ]);
  }

  createFrame (position: Point2D, size: Point2D, id?: string): DemoItem {
    const data = this.createContainer(position, size, 'Frame', `Frame ${++this.frameCount}`);

    data.item.getComponent(FrameComponent).priority = -100;
    if (id) {
      data.item.setInstanceId(id);
    }

    return data;
  }

  async createVideo (position: Point2D, size: Point2D, parent?: VFXItem): Promise<DemoItem> {
    const name = `Video ${++this.videoCount}`;
    const item = DefaultVFXItems.createVideo(this.composition, null, name);
    const video = item.getComponent(VideoComponent);
    const placeholder = this.createCardTexture('视频加载中', '#25354d');
    const data: DemoItem = { item, name, kind: 'Video', status: 'loading' };

    if (parent) {
      item.setParent(parent);
    }
    item.setPosition(...position, 0);
    item.transform.setSize(...size);
    item.duration = 999;
    item.endBehavior = spec.EndBehavior.restart;
    video.setTexture(placeholder);
    this.register(data);

    try {
      const texture = await Texture.fromVideo(VIDEO_URL, this.player.engine);

      if (this.disposed || !this.items.includes(data)) {
        texture.dispose();

        return data;
      }
      video.setTexture(texture);
      placeholder.dispose();
      const scale = Math.min(size[0] / texture.width, size[1] / texture.height);

      item.transform.setSize(texture.width * scale, texture.height * scale);
      video.setMuted(true);
      video.setLoop(true);
      video.pauseVideo();
      data.status = 'ready';
      this.emit('change');
    } catch (error) {
      this.reportResourceError(data, error);
    }

    return data;
  }

  async createEffects (position: Point2D, size: Point2D, parent?: VFXItem): Promise<DemoItem> {
    const data = this.createContainer(position, size, 'Effects', `Effects ${++this.effectsCount}`, parent);

    data.status = 'loading';
    this.emit('change');
    try {
      const effects = await DefaultVFXItems.createEffects(this.composition, EFFECTS_URL, null, data.name);

      if (this.disposed || !this.items.includes(data)) {
        effects.dispose();

        return data;
      }
      effects.setParent(data.item);
      effects.transform.setPosition(0, 0, 0);
      const component = effects.getComponent(CompositionComponent);

      component.endBehavior = spec.EndBehavior.restart;
      component.setTime(0);
      component.pause();
      this.fitEffects(data.item);
      data.status = 'ready';
      this.emit('change');
    } catch (error) {
      this.reportResourceError(data, error);
    }

    return data;
  }

  getMediaState (item: VFXItem): MediaState | undefined {
    const video = item.getComponent(VideoComponent)?.video;

    if (video) {
      return { playing: !video.paused && !video.ended, time: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 0 };
    }
    const child = this.getItem(item)?.kind === 'Effects' ? item.children[0] : undefined;
    const effects = child?.getComponent(CompositionComponent);

    return effects ? { playing: effects.state === PlayState.Playing, time: effects.getTime(), duration: child!.duration } : undefined;
  }

  setMediaPlaying (item: VFXItem, playing: boolean): void {
    const video = item.getComponent(VideoComponent);

    if (video) {
      if (playing) {
        playVideoComponent(video);
      } else {
        pauseVideoComponent(video);
      }
    } else {
      const effects = item.children[0]?.getComponent(CompositionComponent);

      if (playing) {
        effects?.play();
      } else {
        effects?.pause();
      }
    }
  }

  seekMedia (item: VFXItem, time: number): void {
    const video = item.getComponent(VideoComponent);

    if (video) {
      video.setCurrentTime(time);
    } else {
      item.children[0]?.getComponent(CompositionComponent)?.setTime(time);
    }
  }

  fitEffects (item: VFXItem): void {
    if (this.getItem(item)?.kind !== 'Effects') {
      return;
    }
    const viewSize = this.composition.camera.getInverseVPRatio(0).multiply(2);
    const scale = item.transform.size.x / viewSize.x;

    item.children[0]?.transform.setScale(scale, scale, 1);
  }

  createText (position: Point2D, options: TextOptions = {}): DemoItem {
    const index = ++this.textCount;
    const name = options.name ?? `Text ${index}`;
    const value = options.value ?? '输入文字';
    const fontSize = options.fontSize ?? 24;
    const item = DefaultVFXItems.createText(this.composition, null, name);
    const text = item.getComponent(TextComponent);
    const data: DemoItem = { item, name, kind: 'Text' };

    if (options.parent) {
      item.setParent(options.parent);
    }
    if (options.id) {
      item.setInstanceId(options.id);
    }
    item.setPosition(...position, 0);
    text.setText(value);
    text.setFontFamily('sans-serif');
    text.setFontSize(fontSize);
    text.setFontScale(4);
    text.setLineHeight(Math.round(fontSize * 1.35));
    text.setTextWidth(options.width ?? 200);
    text.setAutoResize(spec.TextSizeMode.autoHeight);
    text.setTextColor([0.12, 0.12, 0.12, 1]);
    text.priority = this.items.length;
    text.renderText({ text: value, fontSize });
    this.register(data);

    return data;
  }

  removeItem (data: DemoItem): void {
    const index = this.items.indexOf(data);

    if (index !== -1) {
      this.items.splice(index, 1);
      data.item.dispose();
      this.emit('change');
    }
  }

  dispose (): void {
    this.disposed = true;
  }

  private register (data: DemoItem): DemoItem {
    this.items.push(data);
    this.emit('change');

    return data;
  }

  private createContainer (position: Point2D, size: Point2D, kind: 'Frame' | 'Effects', name: string, parent?: VFXItem): DemoItem {
    // Gizmo 通过运行时名称区分画板和动效容器，图层使用独立展示名称。
    const item = VFXItemFactory.createVFXItem(this.composition, null, kind === 'Frame' ? '画板' : '动效', FrameComponent);

    item.type = spec.ItemType.null;
    if (parent) {
      item.setParent(parent);
    }
    item.setPosition(...position, 0);
    item.transform.setSize(...size);

    return this.register({ item, name, kind });
  }

  private reportResourceError (data: DemoItem, error: unknown): void {
    if (!this.disposed && this.items.includes(data)) {
      data.status = 'error';
      this.emit('change');
      this.emit('resourceerror', `${data.name} 加载失败：${String(error)}`, error);
    }
  }

  /** 改变层级时保留元素的世界位置、旋转和缩放。 */
  reparent (item: VFXItem, parent: VFXItem): void {
    const worldMatrix = item.transform.getWorldMatrix().clone();

    item.setParent(parent);
    item.transform.cloneFromMatrix(parent.transform.getWorldMatrix().clone().invert().multiply(worldMatrix));
  }

  findFrameAt (position: math.Vector3): VFXItem | undefined {
    return this.items.slice().reverse().find(data => {
      if (data.kind !== 'Frame') {
        return false;
      }
      const local = data.item.transform.getWorldMatrix().clone().invert().projectPoint(position);
      const size = data.item.transform.size;

      return Math.abs(local.x) <= size.x / 2 && Math.abs(local.y) <= size.y / 2;
    })?.item;
  }

  private createCardTexture (title: string, color: string): Texture {
    const canvas = document.createElement('canvas');
    const resolutionScale = 4;

    canvas.width = 320 * resolutionScale;
    canvas.height = 224 * resolutionScale;
    const context = canvas.getContext('2d')!;

    context.scale(resolutionScale, resolutionScale);
    context.fillStyle = color;
    context.fillRect(0, 0, 320, 224);
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    context.fillRect(16, 16, 288, 192);
    context.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    context.lineWidth = 2;
    context.strokeRect(16, 16, 288, 192);
    context.fillStyle = 'white';
    context.font = '600 30px sans-serif';
    context.fillText(title, 32, 104);
    context.font = '18px sans-serif';
    context.fillText('MOVE · RESIZE · ROTATE', 32, 144);
    const texture = Texture.create(this.player.engine, {
      sourceType: TextureSourceType.image,
      image: canvas,
      flipY: true,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
    });

    texture.initialize();

    return texture;
  }
}
