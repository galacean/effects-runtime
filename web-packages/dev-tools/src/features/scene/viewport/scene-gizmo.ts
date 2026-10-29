import type { Composition } from '@galacean/effects';
import { TextComponent, VFXItem, math, spec } from '@galacean/effects';
import {
  GestureHandler,
  GizmoViewportUtils,
  HandGizmoTool,
  MoveGizmoTool,
  TextEditMode,
  getItemViewBox,
  isPlayerItemVisible,
  resizeSelectionConfig,
  selectionPreviewConfig,
  selectionSnapConfig,
  viewportNavigationConfig,
} from '@galacean/effects-plugin-editor-gizmo';
import { UICanvas } from '@galacean/effects-plugin-gui';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { sceneWorkspace } from '../scene-workspace';

export type SceneTool = 'transform' | 'hand';

type CameraView = {
  position: math.Vector3,
  rotation: math.Quaternion,
  viewport: math.Matrix4,
};

/** 将 Scene 的工具、面板选区和相机视图接入共享的 2D 编辑能力。 */
export class SceneGizmo {
  readonly handler: GestureHandler;
  tool: SceneTool = 'transform';

  private syncingSelection = false;
  private is2D = false;
  private visible = true;
  private readonly initialView: CameraView;
  private readonly initial2DView: CameraView;
  private view2D: CameraView;
  private view3D: CameraView;
  private readonly unsubscribeSelection: () => void;

  constructor (readonly composition: Composition) {
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
    this.handler.parent = canvas.rootControl;
    this.handler.visible = false;
    this.handler.enabled = false;
    this.handler.setActiveTool(new MoveGizmoTool(this.handler));
    const configs = this.handler.getConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    configs.set(resizeSelectionConfig, { nameTextColor: 0xC8C8C8, sizeTextColor: 0xC8C8C8 });
    this.unsubscribeSelection = this.handler.getSelection().on('selectionchange', () => this.syncToPanels());
    this.handler.on('textinput', event => {
      const item = this.composition.items.find(item => item.getInstanceId() === event.itemId);

      if (item) { sceneWorkspace.recordText(item); }
    });
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
    this.handler.setActiveTool(tool === 'hand' ? new HandGizmoTool(this.handler) : new MoveGizmoTool(this.handler));
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
    EditorSelection.removeSelectionListener(this.syncFromPanels);
    this.unsubscribeSelection();
    this.handler.dispose();
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

      this.handler.resetEditMode();
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
