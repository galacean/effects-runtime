import { FrameComponent, SpriteComponent, TextComponent, Texture, TextureSourceType, glContext, spec } from '@galacean/effects';
import type { Composition, Player, VFXItem, math } from '@galacean/effects';
import { DefaultVFXItems, VFXItemFactory } from '@galacean/effects-plugin-editor-gizmo';

export type Point2D = [number, number];

/** 图层只保存展示信息；变换和文本内容以运行时元素为准。 */
export interface DemoItem {
  item: VFXItem,
  name: string,
  kind: 'Frame' | 'Text' | 'Sprite',
}

interface TextOptions {
  name?: string,
  value?: string,
  fontSize?: number,
  width?: number,
  parent?: VFXItem,
  id?: string,
}

/** 管理示例场景、元素工厂和图层登记，不依赖编辑器 DOM 或工具状态。 */
export class DemoScene {
  private readonly items: DemoItem[] = [];
  private frameCount = 0;
  private textCount = 0;

  constructor (private readonly player: Player, private readonly composition: Composition) {}

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
    const frame = this.createFrame([0, 0.45], [6.8, 4.6]);
    const cards: { name: string, color: string, position: Point2D, size: Point2D, rotation: number, inFrame: boolean }[] = [
      { name: '移动与缩放', color: '#3478e5', position: [-1.45, 0.05], size: [2.45, 1.72], rotation: 0, inFrame: true },
      { name: '对齐与吸附', color: '#8861d8', position: [1.45, 0.05], size: [2.45, 1.72], rotation: 0, inFrame: true },
      { name: '旋转卡片', color: '#218c7b', position: [2.25, -3.15], size: [2, 1.4], rotation: -12, inFrame: false },
    ];
    const sprites = cards.map((card, index) => {
      const item = DefaultVFXItems.createSprite(this.composition, null, card.name);
      const sprite = item.getComponent(SpriteComponent);

      if (card.inFrame) {
        item.setParent(frame.item);
      }
      item.setPosition(...card.position, 0);
      item.setRotation(0, 0, card.rotation);
      item.transform.setSize(...card.size);
      sprite.setTexture(this.createCardTexture(card.name, card.color));
      sprite.priority = index;
      this.items.push({ item, name: card.name, kind: 'Sprite' });

      return item;
    });

    this.createText([0, 1.6], { name: 'Text 1 · 标题', value: '2D Gizmo Playground', fontSize: 30, width: 430, parent: frame.item });
    this.createText([0, -1.55], { name: 'Text 2 · 可编辑说明', value: '拖动、缩放、旋转；双击修改这段文字。', fontSize: 18, width: 430, parent: frame.item });

    return sprites[0];
  }

  createFrame (position: Point2D, size: Point2D, id?: string): DemoItem {
    // Frame Gizmo 通过“画板”名称识别画板，图层列表使用独立的展示名称。
    const item = VFXItemFactory.createVFXItem(this.composition, null, '画板', FrameComponent);
    const data: DemoItem = { item, name: `Frame ${++this.frameCount}`, kind: 'Frame' };

    item.type = spec.ItemType.null;
    item.setPosition(...position, 0);
    item.transform.setSize(...size);
    item.getComponent(FrameComponent).priority = -100;
    if (id) {
      item.setInstanceId(id);
    }
    this.items.push(data);

    return data;
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
    text.setLineHeight(Math.round(fontSize * 1.35));
    text.setTextWidth(options.width ?? 200);
    text.setAutoResize(spec.TextSizeMode.autoHeight);
    text.setTextColor([0.12, 0.12, 0.12, 1]);
    text.priority = this.items.length;
    text.renderText({ text: value, fontSize });
    this.items.push(data);

    return data;
  }

  removeItem (data: DemoItem): void {
    const index = this.items.indexOf(data);

    if (index !== -1) {
      this.items.splice(index, 1);
      data.item.dispose();
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
