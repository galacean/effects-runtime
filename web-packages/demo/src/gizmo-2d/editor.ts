import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { EventEmitter, math, spec, TextComponent } from '@galacean/effects';
import type { InputEventKey, Player, VFXItem } from '@galacean/effects';
import {
  GizmoViewportUtils,
  HandGizmoTool,
  ItemCreateGizmoTool,
  ItemCreateType,
  type RichTextFormat,
  type RichTextSelectionFormats,
  MoveGizmoTool,
  TextEditMode,
  createTextEditMode,
  RichTextEditMode,
  createInteractionPlane,
  getItemViewBox,
  ndcSizeToViewSize,
  viewPositionToWorld,
} from '@galacean/effects-plugin-editor-gizmo';
import type { GizmoActionLifecycleEvent, GizmoActionPhase, GizmoItemCreateInfo, GizmoTextItemCreateInfo, GizmoRichTextItemCreateInfo,
  GestureHandler } from '@galacean/effects-plugin-editor-gizmo';
import { DOMEvents } from './dom';
import type { DemoItem, DemoScene, MediaKind, Point2D } from './scene';

export type DemoTool = 'move' | 'hand' | 'frame' | 'text' | 'richtext';

type EditorEvents = {
  scenechange: [],
  selectionchange: [],
  toolchange: [DemoTool],
  action: [string],
  viewportchange: [number],
};

const SHORTCUTS: Partial<Record<string, DemoTool>> = { KeyV: 'move', KeyH: 'hand', KeyF: 'frame', KeyT: 'text' };

/** 管理 Gizmo 工具、选区和创建会话，通过事件通知视图，不直接操作面板。 */
export class DemoEditor extends EventEmitter<EditorEvents> {
  private readonly domEvents = new DOMEvents();
  private readonly unsubscribes: (() => void)[] = [];
  private activeTool: DemoTool = 'move';
  private draftText?: DemoItem;
  private disposed = false;
  private autoFitViewport = true;
  private fittingViewport = false;

  constructor (
    private readonly player: Player,
    private readonly scene: DemoScene,
    private readonly handler: GestureHandler,
    private readonly viewport: HTMLElement,
  ) {
    super();
    this.unsubscribes.push(
      handler.getSelection().on('selectionchange', () => {
        if (this.isTextEditing() && (this.activeTool === 'text' || this.activeTool === 'richtext')) {
          this.activeTool = 'move';
          this.emit('toolchange', 'move');
        }
        this.emit('selectionchange');
      }),
      handler.on('keyDown', event => this.handleKeyDown(event)),
      handler.on('textinput', event => this.emit('action', `textinput · ${event.itemId}`)),
      handler.on('richtextinput', event => this.emit('action', `richtextinput · ${event.itemId}`)),
      handler.getViewportNavigation().on('change', event => {
        if (!this.fittingViewport) {
          this.autoFitViewport = false;
        }
        this.emit('viewportchange', event.scale);
        this.emit('action', event.source);
      }),
    );
    const phases: GizmoActionPhase[] = ['actionstart', 'actionupdate', 'actioncommit'];

    phases.forEach(phase => {
      this.unsubscribes.push(handler.on(phase, event => this.handleAction(phase, event)));
    });
    this.domEvents.on(viewport, 'keydown', event => {
      if (event.target instanceof HTMLTextAreaElement && event.code === 'Escape' && this.isTextEditing()) {
        handler.resetEditMode();
        player.canvas.focus();
        event.preventDefault();
        event.stopPropagation();
        this.emit('selectionchange');
      }
    });
  }

  get tool (): DemoTool {
    return this.activeTool;
  }

  get selectedItems (): VFXItem[] {
    return this.handler.getSelection().getSelectedPlayerItems();
  }

  get selectedItem (): VFXItem | undefined {
    const items = this.selectedItems;

    return items.length === 1 ? items[0] : undefined;
  }

  setTool (tool: DemoTool): void {
    this.handler.resetEditMode();
    this.discardDraft();
    this.activeTool = tool;
    if (tool === 'frame' || tool === 'text' || tool === 'richtext') {
      const createTool = new ItemCreateGizmoTool(this.handler);

      createTool.createType = tool === 'frame' ? ItemCreateType.FRAME : tool === 'richtext' ? ItemCreateType.RICH_TEXT : ItemCreateType.TEXT;
      this.handler.setActiveTool(createTool);
      this.setSelection([]);
    } else {
      this.handler.setActiveTool(tool === 'move' ? new MoveGizmoTool(this.handler) : new HandGizmoTool(this.handler));
    }
    this.emit('toolchange', tool);
    this.player.canvas.focus();
  }

  select (item: VFXItem, append = false): void {
    this.setTool('move');
    const id = item.getInstanceId();
    const ids = this.handler.getSelection().getSelectedIds();

    this.setSelection(append ? ids.includes(id) ? ids.filter(selectedId => selectedId !== id) : [...ids, id] : [id]);
  }

  /** 属性面板对当前文字选区修改样式，并保留编辑会话。 */
  formatRichTextSelection (attribute: RichTextFormat, value?: string | null): boolean {
    const mode = this.handler.getActiveEditMode();

    return mode instanceof RichTextEditMode && mode.formatSelection(attribute, value);
  }

  get hasRichTextSelection (): boolean {
    const mode = this.handler.getActiveEditMode();

    return mode instanceof RichTextEditMode && mode.hasSelection;
  }

  get richTextSelectionFormats (): RichTextSelectionFormats | undefined {
    const mode = this.handler.getActiveEditMode();

    return mode instanceof RichTextEditMode ? mode.selectionFormats : undefined;
  }

  editSelected (label: string, edit: (item: VFXItem) => void): void {
    const item = this.selectedItem;

    if (item) {
      this.handler.resetEditMode();
      edit(item);
      this.emit('action', label);
      this.emit('selectionchange');
    }
  }

  /** 在当前视口中央插入媒体素材。 */
  async addMedia (kind: MediaKind): Promise<void> {
    this.setTool('move');
    const position = this.pixelToWorld([this.viewport.clientWidth / 2, this.viewport.clientHeight / 2]);
    const point: Point2D = [position.x, position.y];
    const data = kind === 'Video'
      ? await this.scene.createVideo(point, [3.2, 1.8])
      : await this.scene.createEffects(point, [3.2, 1.8]);

    if (this.disposed) {
      return;
    }
    this.select(data.item);
    this.emit('action', data.status === 'error' ? `${data.name} 加载失败` : `创建 ${data.name}`);
  }

  zoom (factor: number): void {
    this.handler.getViewportNavigation().zoomByFactor(
      factor,
      new math.Vector2(this.viewport.clientWidth / 2, this.viewport.clientHeight / 2),
      'wheel-zoom',
    );
  }

  /** 将全部图层放入视口，为浮动工具栏预留底部空间。 */
  fitToView (): void {
    const size = GizmoViewportUtils.getContainerSize(this.viewport);
    const boxes = this.scene.getItems()
      .map(data => getItemViewBox(data.item, size))
      .filter(box => !box.isEmpty());

    if (!boxes.length || size.x <= 96 || size.y <= 160) {
      return;
    }
    const minX = Math.min(...boxes.map(box => box.min.x));
    const minY = Math.min(...boxes.map(box => box.min.y));
    const maxX = Math.max(...boxes.map(box => box.max.x));
    const maxY = Math.max(...boxes.map(box => box.max.y));
    const center = new math.Vector2((minX + maxX) / 2, (minY + maxY) / 2);
    const target = new math.Vector2(size.x / 2, (size.y - 80) / 2);
    const factor = Math.min((size.x - 96) / Math.max(maxX - minX, 1), (size.y - 160) / Math.max(maxY - minY, 1));
    const navigation = this.handler.getViewportNavigation();

    this.autoFitViewport = true;
    this.fittingViewport = true;
    try {
      navigation.zoomByFactor(factor, center, 'wheel-zoom');
      navigation.panByViewDelta(target.clone().subtract(center), target, 'hand-pan');
    } finally {
      this.fittingViewport = false;
    }
    this.emit('action', '适应画布');
  }

  /** 自动适应模式随窗口调整，手动缩放和平移后保留用户视图。 */
  resizeViewport (): void {
    if (this.autoFitViewport) {
      this.fitToView();
    }
  }

  dispose (): void {
    this.disposed = true;
    this.domEvents.dispose();
    this.unsubscribes.splice(0).forEach(unsubscribe => unsubscribe());
    this.discardDraft();
  }

  private setSelection (ids: string[]): void {
    this.handler.getSelection().commitSelectedItems(ids);
  }

  private isTextEditing (): boolean {
    const mode = this.handler.getActiveEditMode();

    return mode instanceof TextEditMode || mode instanceof RichTextEditMode;
  }

  private handleKeyDown (event: InputEventKey): void {
    if (event.ctrlPressed || event.metaPressed || event.altPressed) {
      return;
    }
    if (event.physicalKeycode === 'Escape') {
      if (this.isTextEditing()) {
        this.handler.resetEditMode();
      } else if (this.activeTool === 'frame' || this.activeTool === 'text' || this.activeTool === 'richtext') {
        this.setTool('move');
      } else {
        this.setSelection([]);
      }
      event.accept();
      this.emit('selectionchange');

      return;
    }
    if (event.physicalKeycode === 'Enter' && this.activeTool === 'move' && this.selectedItem?.type === spec.ItemType.richtext) {
      this.handler.setActiveEditMode(createTextEditMode(this.handler, this.selectedItem, 'select'));
      event.accept();

      return;
    }
    const tool = event.physicalKeycode === 'KeyT' && event.shiftPressed ? 'richtext' : SHORTCUTS[event.physicalKeycode];

    if (tool) {
      this.setTool(tool);
      event.accept();
    }
  }

  private handleAction (phase: GizmoActionPhase, event: GizmoActionLifecycleEvent): void {
    if ('createInfo' in event) {
      if (event.canceled) {
        this.discardDraft();
        this.setTool('move');
      } else if (phase === 'actionstart') {
        this.draftText = this.createItem(event.createInfo);
      } else if (phase === 'actionupdate' && this.draftText && event.createInfo.type === ItemCreateType.TEXT) {
        this.updateCreatedText(this.draftText, event.createInfo);
      } else if (phase === 'actionupdate' && this.draftText && event.createInfo.type === ItemCreateType.RICH_TEXT) {
        this.updateCreatedRichText(this.draftText, event.createInfo);
      } else if (phase === 'actioncommit') {
        this.finishCreation(event.createInfo);
      }
    }
    this.emit('action', `${phase} · ${event.source.type}`);
  }

  private discardDraft (): void {
    if (this.draftText) {
      this.setSelection([]);
      this.scene.removeItem(this.draftText);
      this.draftText = undefined;
      this.emit('scenechange');
    }
  }

  private createItem (info: GizmoItemCreateInfo): DemoItem | undefined {
    const position = this.pixelToWorld(info.position);
    let data: DemoItem;

    if (info.type === ItemCreateType.FRAME) {
      const corner = this.pixelToWorld([info.position[0] + info.info.size[0], info.position[1] + info.info.size[1]]);

      data = this.scene.createFrame([position.x, position.y], [Math.abs(corner.x - position.x), Math.abs(corner.y - position.y)], info.id);
      info.info.children.forEach(id => {
        const child = this.scene.getItemById(id);

        if (child) {
          this.scene.reparent(child.item, data.item);
        }
      });
    } else if (info.type === ItemCreateType.TEXT) {
      data = this.scene.createText([position.x, position.y], { id: info.id });
      this.updateCreatedText(data, info);
    } else if (info.type === ItemCreateType.RICH_TEXT) {
      data = this.scene.createRichText([position.x, position.y], {
        id: info.id, autoResize: info.info ? spec.TextSizeMode.autoHeight : spec.TextSizeMode.autoWidth,
      });
      this.updateCreatedRichText(data, info);
    } else {
      return;
    }
    this.emit('scenechange');
    this.setSelection([data.item.getInstanceId()]);

    return data;
  }

  private updateCreatedText (data: DemoItem, info: GizmoTextItemCreateInfo): void {
    const position = this.pixelToWorld(info.position);
    const text = data.item.getComponent(TextComponent);

    data.item.setPosition(position.x, position.y, 0);
    if (info.info) {
      const right = this.pixelToWorld([info.position[0] + info.info.width, info.position[1]]);
      const width = Math.abs(right.x - position.x);

      text.setTextWidth(width * text.textLayout.width / data.item.transform.size.x);
      text.renderText({ text: text.text, fontSize: text.textStyle.fontSize });
    }
  }

  private updateCreatedRichText (data: DemoItem, info: GizmoRichTextItemCreateInfo): void {
    const position = this.pixelToWorld(info.position);
    const rich = data.item.getComponent(RichTextComponent);

    data.item.setPosition(position.x, position.y, 0);
    if (info.info) {
      const right = this.pixelToWorld([info.position[0] + info.info.width, info.position[1]]);
      const width = Math.abs(right.x - position.x);

      rich.setLayoutProperties({
        maxTextWidth: width * rich.textLayout.width / data.item.transform.size.x,
        autoResize: spec.TextSizeMode.autoHeight,
        wrapEnabled: true,
      });
      rich.ensureLayout();
    }
  }

  private finishCreation (info: GizmoItemCreateInfo): void {
    const data = this.draftText ?? this.createItem(info);

    if (!data) {
      return;
    }
    if (info.type === ItemCreateType.TEXT || info.type === ItemCreateType.RICH_TEXT) {
      if (info.type === ItemCreateType.RICH_TEXT) {
        this.updateCreatedRichText(data, info);
      } else {
        this.updateCreatedText(data, info);
      }
      const frame = this.scene.findFrameAt(data.item.transform.getWorldPosition());

      if (frame) {
        this.scene.reparent(data.item, frame);
      }
    }
    this.draftText = undefined;
    this.setTool('move');
    this.emit('scenechange');
    this.setSelection([data.item.getInstanceId()]);
    if (data.kind === 'Text' || data.kind === 'RichText') {
      this.handler.setActiveEditMode(createTextEditMode(this.handler, data.item, 'select'));
    }
    this.emit('action', `创建 ${data.name}`);
  }

  /** 创建事件给的是去除视口变换后的像素坐标，需要还原后再投影到世界平面。 */
  private pixelToWorld (position: Point2D): math.Vector3 {
    const engine = this.player.engine;
    const containerSize = GizmoViewportUtils.getContainerSize(this.viewport);
    const center = containerSize.clone().multiply(0.5);
    const viewPosition = new math.Vector2(...position)
      .subtract(center)
      .multiply(GizmoViewportUtils.getViewScale(engine))
      .add(center)
      .add(ndcSizeToViewSize(GizmoViewportUtils.getViewportTranslation(engine), containerSize));
    const worldPosition = viewPositionToWorld(
      viewPosition,
      GizmoViewportUtils.getCameraInfo(engine),
      createInteractionPlane(new math.Vector3(), new math.Euler()),
      containerSize,
    );

    if (!worldPosition) {
      throw new Error('Creation position is outside the canvas plane.');
    }

    return worldPosition;
  }
}
