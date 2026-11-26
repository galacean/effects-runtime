import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { EventEmitter, ShapeComponent, TextComponent, math, spec } from '@galacean/effects';
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
  PenEditMode,
  ShapeEditMode,
  shapeConfig,
  createInteractionPlane,
  getBoxCorners,
  getItemViewBox,
  ndcSizeToViewSize,
  viewPositionToWorld,
  type GeometryGizmoHost,
  type PenPathData,
  type ShapeDrawingActionEvent,
  type ShapePrimitive,
} from '@galacean/effects-plugin-editor-gizmo';
import type { GizmoActionLifecycleEvent, GizmoActionPhase, GizmoItemCreateInfo, GizmoTextItemCreateInfo, GizmoRichTextItemCreateInfo,
  Editor2D } from '@galacean/effects-plugin-editor-gizmo';
import { DOMEvents } from './dom';
import type { DemoItem, DemoScene, MediaKind, Point2D } from './scene';

export type DemoTool = 'move' | 'hand' | 'frame' | 'text' | 'richtext' | 'pen' | 'shape';
export type DemoPenMode = 'create' | 'edit' | 'lasso';

type EditorEvents = {
  scenechange: [],
  selectionchange: [],
  toolchange: [DemoTool],
  action: [string],
  viewportchange: [number],
};

const SHORTCUTS: Partial<Record<string, DemoTool>> = { KeyV: 'move', KeyH: 'hand', KeyF: 'frame', KeyT: 'text', KeyP: 'pen', KeyS: 'shape' };

type PrimitiveShapeAttributes = {
  type?: spec.ShapePrimitiveType,
  width?: number,
  height?: number,
  xRadius?: number,
  yRadius?: number,
  pointCount?: number,
  radius?: number,
  innerRadius?: number,
  outerRadius?: number,
};

function primitiveShapePath (shape: PrimitiveShapeAttributes): PenPathData | undefined {
  const points: Array<{ x: number, y: number }> = [];
  const easingIns: Array<{ x: number, y: number }> = [];
  const easingOuts: Array<{ x: number, y: number }> = [];
  const add = (x: number, y: number, easingIn = { x: 0, y: 0 }, easingOut = { x: 0, y: 0 }): void => {
    points.push({ x, y }); easingIns.push(easingIn); easingOuts.push(easingOut);
  };
  const type = shape.type;

  if (type === spec.ShapePrimitiveType.Rectangle) {
    const width = shape.width ?? 1;
    const height = shape.height ?? 1;

    add(-width / 2, -height / 2); add(width / 2, -height / 2);
    add(width / 2, height / 2); add(-width / 2, height / 2);
  } else if (type === spec.ShapePrimitiveType.Ellipse) {
    const rx = Math.abs(shape.xRadius ?? 0.5);
    const ry = Math.abs(shape.yRadius ?? 0.5);
    const k = 0.5522847498307936;

    add(0, -ry, { x: -k * rx, y: 0 }, { x: k * rx, y: 0 });
    add(rx, 0, { x: 0, y: -k * ry }, { x: 0, y: k * ry });
    add(0, ry, { x: k * rx, y: 0 }, { x: -k * rx, y: 0 });
    add(-rx, 0, { x: 0, y: k * ry }, { x: 0, y: -k * ry });
  } else if (type === spec.ShapePrimitiveType.Polygon || type === spec.ShapePrimitiveType.Star) {
    const count = Math.max(3, Math.floor(shape.pointCount ?? (type === spec.ShapePrimitiveType.Star ? 5 : 6)));
    const total = type === spec.ShapePrimitiveType.Star ? count * 2 : count;
    const outer = Math.abs(shape.outerRadius ?? shape.radius ?? 0.5);
    const inner = Math.abs(shape.innerRadius ?? outer);

    for (let i = 0; i < total; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / total;
      const radius = type === spec.ShapePrimitiveType.Star && i % 2 === 1 ? inner : outer;

      add(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  } else {
    return undefined;
  }

  return {
    points,
    easingIns,
    easingOuts,
    shapes: [{ close: true, indexes: points.map((_, point) => ({ point, easingIn: point, easingOut: point })) }],
  };
}

/** 管理 Gizmo 工具、选区和创建会话，通过事件通知视图，不直接操作面板。 */
export class DemoEditor extends EventEmitter<EditorEvents> {
  private readonly domEvents = new DOMEvents();
  private readonly unsubscribes: (() => void)[] = [];
  private activeTool: DemoTool = 'move';
  private draftText?: DemoItem;
  private disposed = false;
  private autoFitViewport = true;
  private fittingViewport = false;
  private shapePrimitive: ShapePrimitive = 'rect';
  private geometryMode?: PenEditMode | ShapeEditMode;
  private readonly geometryHost: GeometryGizmoHost;
  private draftGeometry?: DemoItem;
  private readonly vectorEditSnapshots = new Map<string, ShapeComponent['shape']>();
  private settingTool = false;

  constructor (
    private readonly player: Player,
    private readonly scene: DemoScene,
    private readonly handler: Editor2D,
    private readonly viewport: HTMLElement,
  ) {
    super();
    this.geometryHost = this.createGeometryHost();
    this.unsubscribes.push(
      handler.getSelection().on('selectionchange', () => {
        if (this.isTextEditing() && (this.activeTool === 'text' || this.activeTool === 'richtext')) {
          this.activeTool = 'move';
          this.emit('toolchange', 'move');
        }
        this.emit('selectionchange');
      }),
      handler.on('keyDown', event => this.handleKeyDown(event)),
      handler.on('shapeinput', item => {
        if (this.enterSelectedShapeEdit(item)) {
          this.emit('selectionchange');
        }
      }),
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

  get primitive (): ShapePrimitive {
    return this.shapePrimitive;
  }

  get selectedItems (): VFXItem[] {
    return this.handler.getSelection().getSelectedPlayerItems();
  }

  get selectedItem (): VFXItem | undefined {
    const items = this.selectedItems;

    return items.length === 1 ? items[0] : undefined;
  }

  setTool (tool: DemoTool): void {
    if (tool === 'pen' && this.activeTool === 'pen' && this.geometryMode instanceof PenEditMode && this.geometryMode.state === 'edit') {
      this.setPenMode('create');

      return;
    }
    this.updateTool(() => {
      this.handler.resetEditMode();
      this.discardDraft();
      this.geometryMode = undefined;
      this.activeTool = tool;
      if (tool === 'pen' || tool === 'shape') {
        this.setSelection([]);
        const mode = tool === 'pen'
          ? this.createPenMode()
          : new ShapeEditMode(this.handler, this.geometryHost, this.shapePrimitive);

        this.geometryMode = mode;
        this.handler.setActiveEditMode(mode);
        this.handler.setActiveTool(new MoveGizmoTool(this.handler));
      } else if (tool === 'frame' || tool === 'text' || tool === 'richtext') {
        const createTool = new ItemCreateGizmoTool(this.handler);

        createTool.createType = tool === 'frame' ? ItemCreateType.FRAME : tool === 'richtext' ? ItemCreateType.RICH_TEXT : ItemCreateType.TEXT;
        this.handler.setActiveTool(createTool);
        this.setSelection([]);
      } else {
        this.handler.setActiveTool(tool === 'move' ? new MoveGizmoTool(this.handler) : new HandGizmoTool(this.handler));
      }
    });
  }

  private enterSelectedShapeEdit (item = this.selectedItem): boolean {
    if (!item?.getComponent(ShapeComponent)) {
      return false;
    }
    this.updateTool(() => {
      this.handler.resetEditMode();
      this.discardDraft();
      const mode = this.createPenMode('edit');

      this.geometryMode = mode;
      this.activeTool = 'pen';
      this.handler.setActiveEditMode(mode);
      this.handler.setActiveTool(new MoveGizmoTool(this.handler));
    });

    return true;
  }

  setShapePrimitive (primitive: ShapePrimitive): void {
    this.shapePrimitive = primitive;
    const mode = this.geometryMode;

    if (this.activeTool === 'shape' && mode instanceof ShapeEditMode) {
      this.updateTool(() => mode.setPrimitive(primitive));
    } else {
      this.setTool('shape');
    }
    this.emit('action', `造型 · ${primitive}`);
  }

  setPenMode (state: DemoPenMode): void {
    const mode = this.geometryMode;

    if (this.activeTool !== 'pen' || !(mode instanceof PenEditMode)) { return; }
    this.updateTool(() => {
      if (state === 'create') {
        mode.enterCreate(true);
      } else {
        mode.enterEdit();
      }
      mode.setLassoMode(state === 'lasso');
    });
    this.emit('action', `钢笔${state === 'create' ? '创建态' : state === 'edit' ? '编辑态' : '套索'} · 开启`);
  }

  get penMode (): DemoPenMode | undefined {
    const mode = this.geometryMode;

    if (this.activeTool !== 'pen' || !(mode instanceof PenEditMode)) { return; }

    return mode.state === 'create' ? 'create' : mode.lassoMode ? 'lasso' : 'edit';
  }

  private updateTool (update: () => void): void {
    const previousSetting = this.settingTool;

    this.settingTool = true;
    try {
      update();
    } finally {
      this.settingTool = previousSetting;
    }
    if (!previousSetting) {
      this.emit('toolchange', this.activeTool);
      this.player.canvas.focus();
    }
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
    this.geometryMode = undefined;
    this.vectorEditSnapshots.clear();
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
    if (event.physicalKeycode === 'KeyQ' && this.activeTool === 'pen') {
      this.setPenMode(this.penMode === 'lasso' ? 'edit' : 'lasso');
      event.accept();

      return;
    }
    if (event.physicalKeycode === 'Escape') {
      if (this.isTextEditing()) {
        this.handler.resetEditMode();
      } else if (this.activeTool === 'frame' || this.activeTool === 'text' || this.activeTool === 'richtext') {
        this.setTool('move');
      } else if (this.activeTool === 'pen' || this.activeTool === 'shape') {
        return;
      } else {
        this.setSelection([]);
      }
      event.accept();
      this.emit('selectionchange');

      return;
    }
    if (event.physicalKeycode === 'Enter' && this.activeTool === 'move') {
      if (this.enterSelectedShapeEdit()) {
        event.accept();
        this.emit('selectionchange');

        return;
      }
      if (this.selectedItem?.type === spec.ItemType.richtext) {
        this.handler.setActiveEditMode(createTextEditMode(this.handler, this.selectedItem, 'select'));
        event.accept();

        return;
      }
    }
    const tool = event.physicalKeycode === 'KeyT' && event.shiftPressed ? 'richtext' : SHORTCUTS[event.physicalKeycode];

    if (tool) {
      this.setTool(tool);
      event.accept();
    }
  }

  private handleAction (phase: GizmoActionPhase, event: GizmoActionLifecycleEvent): void {
    if ('sessionId' in event && 'phase' in event) {
      this.handleGeometryAction(phase, event);
    } else if ('createInfo' in event) {
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

  private handleGeometryAction (phase: GizmoActionPhase, event: ShapeDrawingActionEvent): void {
    if (event.canceled) {
      if (event.edit) {
        const target = this.scene.getItemById(event.edit.itemId);

        const snapshot = this.vectorEditSnapshots.get(event.edit.itemId);

        if (target?.kind === 'Vector' && snapshot) {
          this.scene.restoreVectorShape(target, snapshot);
        } else if (target?.kind === 'CustomShape' || (target?.kind === 'Vector' && event.edit.operations.length > 0)) {
          this.scene.updateCustomShape(target, event.edit.before);
        }
        this.vectorEditSnapshots.delete(event.edit.itemId);
      }
      this.discardDraft();
      if (!this.settingTool && event.finish !== false) {
        this.setTool('move');
      } else if (!this.settingTool && event.finish === false && this.geometryMode) {
        this.handler.rebuildGizmos();
      }

      return;
    }
    if (event.create) {
      if (phase === 'actionstart') {
        const creationConfig = this.handler.getConfigManager().get(shapeConfig);

        this.draftGeometry = event.create.kind === 'pen'
          ? this.scene.createCustomShape(event.create.path, undefined, creationConfig)
          : this.scene.createVectorShape(event.create.geometry, undefined, creationConfig);
      } else if (this.draftGeometry) {
        if (event.create.kind === 'pen' && this.draftGeometry.kind === 'CustomShape') {
          this.scene.updateCustomShape(this.draftGeometry, event.create.path);
        } else if (event.create.kind === 'shape' && this.draftGeometry.kind === 'Vector') {
          this.scene.updateVectorShape(this.draftGeometry, event.create.geometry);
        }
      }
      if (phase === 'actioncommit' && this.draftGeometry) {
        const draft = this.draftGeometry;
        const remainInPenEdit = event.finish === false && event.create.kind === 'pen' && this.geometryMode instanceof PenEditMode;

        if (event.create.kind === 'pen' && draft.kind === 'CustomShape') {
          this.scene.fitCustomShape(draft, event.create.path);
        }
        this.draftGeometry = undefined;
        if (event.finish !== false) {
          this.setTool('move');
        }
        this.setSelection([draft.item.getInstanceId()]);
        this.emit('scenechange');
        if (event.continueCreate && remainInPenEdit && this.geometryMode instanceof PenEditMode) {
          this.geometryMode.restartCreate();
        } else if (remainInPenEdit && this.geometryMode instanceof PenEditMode) {
          this.geometryMode.enterEdit();
        }
      }

      return;
    }
    if (event.edit) {
      const target = this.scene.getItemById(event.edit.itemId);

      if (phase === 'actionstart' && target?.kind === 'Vector') {
        const snapshot = this.scene.snapshotVectorShape(target);

        if (snapshot) { this.vectorEditSnapshots.set(event.edit.itemId, snapshot); }
      }
      if ((target?.kind === 'CustomShape' || target?.kind === 'Vector') && event.edit.operations.length > 0) {
        this.scene.updateCustomShape(target, event.edit.path);
      }
      if (phase === 'actioncommit') {
        this.vectorEditSnapshots.delete(event.edit.itemId);
        if (event.finish !== false) {
          this.setTool('move');
        }
        this.setSelection(target ? [target.item.getInstanceId()] : []);
        this.emit('scenechange');
        if (event.continueCreate && this.geometryMode instanceof PenEditMode) {
          this.geometryMode.restartCreate();
        }
      }
    }
  }

  private discardDraft (): void {
    if (this.draftText) {
      this.setSelection([]);
      this.scene.removeItem(this.draftText);
      this.draftText = undefined;
      this.emit('scenechange');
    }
    if (this.draftGeometry) {
      this.setSelection([]);
      this.scene.removeItem(this.draftGeometry);
      this.draftGeometry = undefined;
      this.emit('scenechange');
    }
  }

  private createItem (info: GizmoItemCreateInfo): DemoItem | undefined {
    const position = this.pixelToWorld(info.position);
    let data: DemoItem;

    if (info.type === ItemCreateType.FRAME) {
      const corner = this.pixelToWorld([info.position[0] + info.info.size[0], info.position[1] + info.info.size[1]]);

      data = this.scene.createFrame([position.x, position.y], [Math.abs(corner.x - position.x), Math.abs(corner.y - position.y)]);
      info.info.children.forEach(id => {
        const child = this.scene.getItemById(id);

        if (child) {
          this.scene.reparent(child.item, data.item);
        }
      });
    } else if (info.type === ItemCreateType.TEXT) {
      data = this.scene.createText([position.x, position.y]);
      this.updateCreatedText(data, info);
    } else if (info.type === ItemCreateType.RICH_TEXT) {
      data = this.scene.createRichText([position.x, position.y], {
        autoResize: info.info ? spec.TextSizeMode.autoHeight : spec.TextSizeMode.autoWidth,
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

  private createGeometryHost (): GeometryGizmoHost {
    return {
      canEdit: itemId => {
        if (!itemId) {
          return !this.disposed;
        }
        const item = this.scene.getItemById(itemId)?.item;

        return !!item && this.selectedItems.includes(item) && !!item.getComponent(ShapeComponent);
      },
      readPath: () => {
        const item = this.selectedItem;
        const component = item?.getComponent(ShapeComponent) as ShapeComponent & { shape?: PrimitiveShapeAttributes & { points?: Array<{ x: number, y: number }>, easingIns?: Array<{ x: number, y: number }>, easingOuts?: Array<{ x: number, y: number }>, shapes?: PenPathData['shapes'] } } | undefined;
        const shape = component?.shape;
        const data = item && this.scene.getItem(item);

        if (!item || !shape) {
          return undefined;
        }
        const itemId = item.getInstanceId();
        let path: PenPathData | undefined;
        let kind: 'custom' | 'vector' = data?.kind === 'Vector' ? 'vector' : 'custom';

        if (shape.type === spec.ShapePrimitiveType.Custom && shape.points && shape.easingIns && shape.easingOuts && shape.shapes) {
          path = {
            points: shape.points.map(point => ({ x: point.x, y: point.y })),
            easingIns: shape.easingIns.map(point => ({ x: point.x, y: point.y })),
            easingOuts: shape.easingOuts.map(point => ({ x: point.x, y: point.y })),
            shapes: shape.shapes.map(current => ({ close: current.close, indexes: current.indexes.map(index => ({ ...index })) })),
          };
        } else if (data?.kind === 'Vector') {
          path = primitiveShapePath(shape);
          kind = 'vector';
        }
        if (!path) {
          return undefined;
        }

        return {
          itemId,
          kind,
          path,
        };
      },
      viewToLocal: (point, itemId) => {
        const target = this.geometryItem(itemId);
        const world = this.viewToWorld(point, target);

        if (!world) {
          return undefined;
        }
        if (!target) {
          return new math.Vector2(world.x, world.y);
        }
        const local = target.transform.getWorldMatrix().clone().invert().projectPoint(world);

        return new math.Vector2(local.x, local.y);
      },
      localToView: (point, itemId) => {
        const target = this.geometryItem(itemId);
        const world = new math.Vector3(point.x, point.y, 0);

        if (target) {
          world.applyMatrix(target.transform.getWorldMatrix());
        }

        return this.worldToView(world);
      },
      snapPoints: () => {
        const size = GizmoViewportUtils.getContainerSize(this.viewport);

        return this.scene.getItems()
          .filter(data => data.item !== this.selectedItem && data !== this.draftGeometry)
          .flatMap(data => {
            const box = getItemViewBox(data.item, size);

            return box.isEmpty() ? [] : [...getBoxCorners(box), box.getCenter()];
          });
      },
      contextKey: () => this.selectedItem?.getInstanceId() ?? 'create',
      appendSubpaths: true,
      deleteBehavior: 'reconnect',
    };
  }

  private createPenMode (state: 'create' | 'edit' = 'create'): PenEditMode {
    const mode = new PenEditMode(this.handler, this.geometryHost, state, () => {
      if (!this.disposed && !this.settingTool) {
        this.emit('toolchange', 'pen');
      }
    }, () => {
      if (!this.disposed && !this.settingTool && this.geometryMode === mode) {
        this.geometryMode = undefined;
        this.activeTool = 'move';
        this.emit('toolchange', 'move');
      }
    });

    return mode;
  }

  private geometryItem (itemId?: string): VFXItem | undefined {
    return itemId ? this.scene.getItemById(itemId)?.item : undefined;
  }

  private viewToWorld (point: math.Vector2, item?: VFXItem): math.Vector3 | undefined {
    const size = GizmoViewportUtils.getContainerSize(this.viewport);
    const position = item?.transform.getWorldPosition() ?? new math.Vector3();
    const rotation = item?.transform.getWorldRotation() ?? new math.Euler();
    const plane = createInteractionPlane(new math.Vector3(position.x, position.y, position.z), rotation);
    const world = viewPositionToWorld(point, GizmoViewportUtils.getCameraInfo(this.player.engine), plane, size);

    return world;
  }

  private worldToView (point: math.Vector3): math.Vector2 {
    const size = GizmoViewportUtils.getContainerSize(this.viewport);
    const composition = this.player.engine.sceneServer.compositions[0];
    const projected = point.clone().applyProjectionMatrix(composition?.camera.getViewProjectionMatrix() ?? new math.Matrix4());

    return new math.Vector2((projected.x + 1) * size.x / 2, (1 - projected.y) * size.y / 2);
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
