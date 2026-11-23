import type { Composition } from '@galacean/effects';
import { ShapeComponent, TextComponent, VFXItem, math, spec } from '@galacean/effects';
import {
  GestureHandler,
  GizmoViewportUtils,
  HandGizmoTool,
  ItemCreateGizmoTool,
  ItemCreateType,
  MoveGizmoTool,
  PenEditMode,
  ShapeEditMode,
  TextEditMode,
  EffectsEditMode,
  getItemViewBox,
  isPlayerItemVisible,
  resizeSelectionConfig,
  rulerConfig,
  shapeConfig,
  selectionPreviewConfig,
  selectionSnapConfig,
  viewportNavigationConfig,
} from '@galacean/effects-plugin-editor-gizmo';
import type { GizmoActionLifecycleEvent, HandleMirrorMode, RulerGizmo, ShapePrimitive } from '@galacean/effects-plugin-editor-gizmo';
import { UICanvas } from '@galacean/effects-plugin-gui';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { editorColors } from '../../../ui/theme/control-theme';
import type { SceneDocument } from '../document/scene-document';
import { sameData } from '../serialization/scene-values';
import { sceneWorkspace } from '../scene-workspace';
import type { SceneBrushSettings } from './scene-brush-settings';
import { SceneBrushTool } from './scene-brush-tool';
import { SceneGeometryTools } from './scene-geometry-tools';
import type { SceneTool } from './scene-tools';

type CameraView = {
  position: math.Vector3,
  rotation: math.Quaternion,
  viewport: math.Matrix4,
};

/** 将 Scene 的工具、面板选区和相机视图接入共享的 2D 编辑能力。 */
export class SceneGizmo {
  readonly handler: GestureHandler;
  /** 当前场景的标尺 Gizmo，供场景快捷键和宿主持久化使用。 */
  get ruler (): RulerGizmo { return this.handler.getGizmoManager().get('ruler')!; }
  readonly brush: SceneBrushTool;
  readonly geometry: SceneGeometryTools;
  tool: SceneTool = 'transform';
  pathLasso = false;
  penMirrorMode: HandleMirrorMode = 'angle-length';

  private syncingSelection = false;
  private is2D = false;
  private visible = true;
  private readonly initialView: CameraView;
  private readonly initial2DView: CameraView;
  private view2D: CameraView;
  private view3D: CameraView;
  private readonly unsubscribeSelection: () => void;
  private readonly unsubscribeWorkspace: () => void;
  private readonly unsubscribeRulerStart: () => void;
  private readonly unsubscribeRulerCommit: () => void;
  private readonly unsubscribeShapeInput: () => void;
  private releaseRulerState?: () => void;
  private rulerDocument?: SceneDocument;

  constructor (readonly composition: Composition, brushSettings: SceneBrushSettings) {
    this.initialView = this.captureView();
    this.initial2DView = {
      position: new math.Vector3(0, 0, Math.max(Math.abs(composition.camera.position.z), 1)),
      rotation: new math.Quaternion(),
      viewport: new math.Matrix4(),
    };
    this.view2D = this.initial2DView;
    this.view3D = this.initialView;

    const canvas = composition.pluginRoot.getComponent(UICanvas) ?? composition.pluginRoot.addComponent(UICanvas);

    canvas.order = Number.MAX_SAFE_INTEGER;
    this.handler = new GestureHandler(composition.engine);
    this.brush = new SceneBrushTool(this.handler, brushSettings);
    this.geometry = new SceneGeometryTools(composition, this.handler, (kind, continueCreate, finish = true) => {
      if (kind === 'pen' && !finish) {
        this.editPath();
        if (continueCreate) { this.appendPath(); }
      } else {
        this.setTool('transform');
        if (kind === 'text') { this.editText(); }
      }
    });
    this.handler.parent = canvas.rootControl;
    this.handler.visible = false;
    this.handler.enabled = false;
    this.handler.setActiveTool(new MoveGizmoTool(this.handler));
    this.unsubscribeWorkspace = sceneWorkspace.subscribeDocument(document => this.bindRulerDocument(document));
    this.bindRulerDocument(sceneWorkspace.current);
    const configs = this.handler.getConfigManager();
    const rgba = (color: math.Color): number => parseInt(color.toHexString().slice(1), 16);

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    configs.set(shapeConfig, { initialStrokeColor: rgba(editorColors.primaryHover) });
    configs.set(resizeSelectionConfig, { nameTextColor: 0xC8C8C8FF, sizeTextColor: 0xC8C8C8FF });
    configs.set(rulerConfig, {
      enabled: false,
      rulerBackgroundColor: rgba(editorColors.toolbar),
      rulerTextColor: rgba(editorColors.foreground),
      rulerGridColor: rgba(editorColors.hover),
      guideColor: rgba(editorColors.primaryHover),
      selectedGuideColor: rgba(editorColors.dropTarget),
      guidePositionTextColor: rgba(editorColors.foregroundHover),
      guidePositionBackgroundColor: rgba(editorColors.primaryPress),
    });
    this.unsubscribeSelection = this.handler.getSelection().on('selectionchange', () => this.syncToPanels());
    this.handler.on('textinput', event => {
      const item = this.composition.items.find(item => item.getInstanceId() === event.itemId);

      if (item) { sceneWorkspace.recordText(item); }
    });
    this.unsubscribeRulerStart = this.handler.on('actionstart', this.onRulerActionStart);
    this.unsubscribeRulerCommit = this.handler.on('actioncommit', this.onRulerActionCommit);
    this.unsubscribeShapeInput = this.handler.on('shapeinput', () => this.editPath());
    EditorSelection.addSelectionListener(this.syncFromPanels);
    this.syncFromPanels();
  }

  get scale (): number {
    return GizmoViewportUtils.getViewScale(this.composition.engine);
  }

  get selectedItems (): VFXItem[] {
    return this.handler.getSelection().getSelectedPlayerItems();
  }

  refreshSelection (): void { this.syncFromPanels(); }

  get canEditText (): boolean {
    const items = this.selectedItems;

    return items.length === 1 && items[0].type === spec.ItemType.text && !!items[0].getComponent(TextComponent);
  }

  get canEditPath (): boolean {
    return this.selectedItems.length === 1 && this.selectedItems[0].getComponent(ShapeComponent)?.shape.type === spec.ShapePrimitiveType.Custom;
  }

  get canEditChildren (): boolean { return this.selectedItems.length === 1 && this.selectedItems[0].children.length > 0; }

  get editingPath (): boolean { return this.handler.getActiveEditMode() instanceof PenEditMode; }

  get editingNodes (): boolean {
    const mode = this.handler.getActiveEditMode();

    return mode instanceof PenEditMode && mode.state === 'edit';
  }

  update (): void {
    this.geometry.flush();
    if (this.handler.getActiveEditMode().id === 'default-selection' && ['pen', 'rect', 'ellipse', 'polygon', 'star'].includes(this.tool)) { this.tool = 'transform'; }
  }

  set2DMode (value: boolean): void {
    if (this.is2D !== value) {
      if (value) {
        this.view3D = this.captureView();
        this.restoreView(this.view2D);
      } else {
        this.handler.resetEditMode();
        this.view2D = this.captureView();
        this.restoreView(this.view3D);
      }
      this.is2D = value;
      this.setTool('transform');
    }
    this.setVisible(this.visible);
  }

  setVisible (value: boolean): void {
    this.visible = value;
    const enabled = value && this.is2D;

    if (!enabled && this.handler.enabled) {
      this.handler.resetEditMode();
    }
    this.handler.visible = enabled;
    this.handler.enabled = enabled;
    this.handler.ignoreInteraction = !enabled;
  }

  setTool (tool: SceneTool): void {
    this.handler.resetEditMode();
    this.tool = tool;
    this.handler.setActiveTool(tool === 'brush' ? this.brush : tool === 'hand' ? new HandGizmoTool(this.handler) : new MoveGizmoTool(this.handler));
    if (tool === 'pen') {
      this.handler.setActiveEditMode(new PenEditMode(this.handler, this.geometry));
    } else if (['rect', 'ellipse', 'polygon', 'star'].includes(tool)) {
      this.handler.setActiveEditMode(new ShapeEditMode(this.handler, this.geometry, tool as ShapePrimitive));
    } else if (tool === 'text' || tool === 'frame') {
      const create = new ItemCreateGizmoTool(this.handler);

      create.createType = tool === 'text' ? ItemCreateType.TEXT : ItemCreateType.FRAME;
      this.handler.setActiveTool(create);
    }
    this.setPenMirrorMode(this.penMirrorMode); this.setPathLasso(this.pathLasso);
  }

  editPath (): void {
    if (!this.canEditPath) { return; }
    this.setTool('transform'); this.tool = 'pen';
    this.handler.setActiveEditMode(new PenEditMode(this.handler, this.geometry, 'edit'));
    this.setPenMirrorMode(this.penMirrorMode); this.setPathLasso(this.pathLasso);
  }

  appendPath (): void {
    const mode = this.handler.getActiveEditMode();

    if (mode instanceof PenEditMode) { mode.enterCreate(true); }
  }
  setPenMirrorMode (value: HandleMirrorMode): void {
    this.penMirrorMode = value;
    const mode = this.handler.getActiveEditMode();

    if (mode instanceof PenEditMode) { mode.setHandleMirrorMode(value); }
  }
  setPathLasso (value: boolean): void {
    this.pathLasso = value;
    const mode = this.handler.getActiveEditMode();

    if (mode instanceof PenEditMode) { mode.setLassoMode(value); }
  }

  editChildren (): void {
    if (!this.canEditChildren) { return; }
    const item = this.selectedItems[0];

    this.setTool('transform');
    this.handler.setActiveEditMode(new EffectsEditMode(this.handler, item.getInstanceId()));
  }

  editText (): void {
    if (this.canEditText) {
      this.setTool('transform');
      this.handler.setActiveEditMode(new TextEditMode(this.handler, this.selectedItems[0], 'select'));
    }
  }

  zoomTo (scale: number): void {
    const size = this.getSize();

    this.handler.getViewportNavigation().zoomByFactor(scale / this.scale, size.multiply(0.5), 'wheel-zoom');
  }

  frameSelection (): void {
    this.frameItems(this.selectedItems);
  }

  frameAll (): boolean {
    return this.frameItems(this.composition.items.filter(isPlayerItemVisible));
  }

  resetView (): void {
    this.restoreView(this.is2D ? this.initial2DView : this.initialView);
  }

  get snapping (): boolean {
    return this.handler.getConfigManager().get(selectionSnapConfig).enabled;
  }

  set snapping (enabled: boolean) {
    this.handler.getConfigManager().set(selectionSnapConfig, { enabled });
  }

  get selectionInfo (): boolean {
    return this.handler.getConfigManager().get(resizeSelectionConfig).infoShowEnabled;
  }

  set selectionInfo (enabled: boolean) {
    this.handler.getConfigManager().set(resizeSelectionConfig, { infoShowEnabled: enabled });
  }

  get hoverHighlight (): boolean {
    return this.handler.getConfigManager().get(selectionPreviewConfig).preSelectedWidth > 0;
  }

  set hoverHighlight (enabled: boolean) {
    this.handler.getConfigManager().set(selectionPreviewConfig, { preSelectedWidth: enabled ? 2 : 0 });
  }

  dispose (): void {
    this.handler.resetEditMode(); this.geometry.dispose();
    EditorSelection.removeSelectionListener(this.syncFromPanels);
    this.unsubscribeSelection();
    this.unsubscribeWorkspace();
    this.unsubscribeRulerStart();
    this.unsubscribeRulerCommit();
    this.unsubscribeShapeInput();
    this.releaseRulerState?.();
    this.releaseRulerState = undefined;
    this.rulerDocument = undefined;
    this.handler.dispose();
  }

  /** 将标尺数据接入当前场景文档的编辑状态和历史记录。 */
  private bindRulerDocument (document?: SceneDocument): void {
    if (document === this.rulerDocument) {
      return;
    }
    this.releaseRulerState?.();
    this.releaseRulerState = undefined;
    this.rulerDocument = undefined;
    const manager = this.handler.getRulerManager();

    if (!document || document.composition !== this.composition) {
      manager.hydrate(undefined);

      return;
    }

    manager.hydrate(document.editor.rulerGuides);
    this.rulerDocument = document;
    this.releaseRulerState = document.registerEditorState({
      read: () => manager.snapshot(),
      restore: state => manager.hydrate(state),
      equal: sameData,
      valid: () => !this.handler.isDisposed && document.composition === this.composition,
    });
  }

  private readonly onRulerActionStart = (event: GizmoActionLifecycleEvent): void => {
    if (!this.isRulerEvent(event)) {
      return;
    }
    const document = this.rulerDocument;

    if (document && !document.restoring) {
      document.begin('Edit rulers');
    }
  };

  private readonly onRulerActionCommit = (event: GizmoActionLifecycleEvent): void => {
    if (!this.isRulerEvent(event)) {
      return;
    }
    const document = this.rulerDocument;

    if (!document || document.restoring) {
      return;
    }
    // 键盘/菜单删除也会先发送 actionstart；begin 在已有事务时是幂等的。
    document.begin('Edit rulers');
    const guides = this.handler.getRulerManager().snapshot();
    const current = document.editor.rulerGuides;

    // 空参考线保持可选字段的缺省表示，取消空操作时不会凭空制造 dirty 历史。
    if (!sameData(current ?? { horizontal: [], vertical: [] }, guides)) {
      if (guides.horizontal.length || guides.vertical.length) {
        document.editor.rulerGuides = guides;
      } else {
        delete document.editor.rulerGuides;
      }
    }
    document.commit();
  };

  private isRulerEvent (event: GizmoActionLifecycleEvent): boolean {
    return event.source.type === 'ruler';
  }

  private readonly syncFromPanels = (): void => {
    if (this.syncingSelection || this.handler.isDisposed) {
      return;
    }
    this.syncingSelection = true;
    try {
      const items = EditorSelection.getSelectedObjects().filter((object): object is VFXItem =>
        object instanceof VFXItem && object.composition === this.composition,
      );

      if (!this.handler.isMouseButtonPressed()) { this.handler.resetEditMode(); }
      this.handler.getSelection().commitSelectedItems(items.map(item => item.getInstanceId()));
    } finally {
      this.syncingSelection = false;
    }
  };

  private syncToPanels (): void {
    if (this.syncingSelection) {
      return;
    }
    this.syncingSelection = true;
    try {
      EditorSelection.setObjects(this.selectedItems);
    } finally {
      this.syncingSelection = false;
    }
  }

  private getSize (): math.Vector2 {
    return GizmoViewportUtils.getContainerSize(this.composition.engine.canvas.parentElement!);
  }

  private frameItems (items: VFXItem[]): boolean {
    const size = this.getSize();
    const boxes = items.map(item => getItemViewBox(item, size)).filter(box =>
      !box.isEmpty() && [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite),
    );

    if (!boxes.length || size.x < 96 || size.y < 96) {
      return false;
    }
    const minX = Math.min(...boxes.map(box => box.min.x));
    const minY = Math.min(...boxes.map(box => box.min.y));
    const maxX = Math.max(...boxes.map(box => box.max.x));
    const maxY = Math.max(...boxes.map(box => box.max.y));
    const center = new math.Vector2((minX + maxX) / 2, (minY + maxY) / 2);
    const target = size.clone().multiply(0.5);
    const factor = Math.min((size.x - 80) / Math.max(maxX - minX, 1), (size.y - 80) / Math.max(maxY - minY, 1));
    const navigation = this.handler.getViewportNavigation();

    navigation.zoomByFactor(factor, center, 'wheel-zoom');
    navigation.panByViewDelta(target.subtract(center), size.multiply(0.5), 'hand-pan');

    return true;
  }

  private captureView (): CameraView {
    const camera = this.composition.camera;

    return { position: camera.position.clone(), rotation: camera.getQuat(), viewport: camera.getViewportMatrix().clone() };
  }

  private restoreView (view: CameraView): void {
    const camera = this.composition.camera;

    camera.position = view.position.clone();
    camera.setQuat(view.rotation.clone());
    camera.setViewportMatrix(view.viewport);
  }
}
