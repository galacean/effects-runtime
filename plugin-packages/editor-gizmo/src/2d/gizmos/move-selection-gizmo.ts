import { SceneServer } from '@galacean/effects';
import {
  MouseButton,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { Plane } from '@galacean/effects-math/es/extension/index';
import { Box2, roundNumber } from '@galacean/effects-math/es/extension/index';
import { Euler, EulerOrder, Matrix4, Vector2, Vector3 } from '../math';
import { GestureCursorType } from '../cursor';
import {
  GizmoViewportUtils,
  createInteractionPlane,
  viewPositionToWorld,
} from '../viewport';
import { getItemViewBox } from '../items';
import { TransformType } from './resize-selection-gizmo';
import {
  AssistedLayout,
  type AutoLayoutChangeInfo,
  type SelectionPlacementChange,
} from '../frame/frame-assisted-layout';

/** 拖动选中对象，并处理吸附、重挂载和自动布局。 */
export class MoveSelectionGizmo extends Gizmo {
  readonly type = 'move-selection';

  private active = false;
  private selectedItems: VFXItem[] = [];
  private selectionBox = new Box2();
  private interactionPlane: Plane | undefined;
  private startPoint = new Vector2();
  private lastPoint = new Vector2();
  private cursorPoint = new Vector2();
  private lastWorldPosition = new Vector3();
  private assistedLayout: AssistedLayout | undefined;

  /**
   * 在选区内按下主键时开始移动交互。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left || event.doubleClick || event.shiftPressed) {
      return;
    }

    const viewportPoint = new Vector2(event.position.x, event.position.y);

    if (!this._owner.getSelection().isPointInSelectedViewBox(viewportPoint)) {
      return;
    }

    const selectedItems = this._owner.getSelection().getSelectedPlayerItems();

    if (selectedItems.length === 0) {
      return;
    }

    // Selection 保证父子节点不会同时入选，交互层直接冻结权威选区。
    this.selectedItems = [...selectedItems];
    this.cursorPoint.copyFrom(viewportPoint);
    this.active = true;
    this.startPoint = new Vector2(event.position.x, event.position.y);
    this.lastPoint.copyFrom(this.startPoint);
    this._owner.setSelectionTransformKind('move');
    this._owner.emit('actionstart', {
      source: this,
      transformType: TransformType.TRANSLATION,
      itemIds: this.selectedItems.map(item => item.getInstanceId()),
    });
    this.assistedLayout = new AssistedLayout(this._owner);
    this.assistedLayout.begin(this.selectedItems);
    event.accept();
  }

  /**
   * 忽略未进入拖拽阶段的移动事件。
   * @param _event 鼠标移动事件。
   */
  override onMouseMove (_event: InputEventMouseMotion): void {
    // 选区悬停由 ChangeSelectionGizmo 处理。
  }

  /**
   * 移动选中对象并更新布局辅助状态。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.active) {
      return;
    }

    const currentPoint = new Vector2(event.position.x, event.position.y);

    this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });

    const shift = new Vector2().subtractVectors(currentPoint, this.lastPoint);

    if (this.applyTranslation(shift)) {
      this.lastPoint.copyFrom(currentPoint);
      const pointer = new Vector2(event.position.x, event.position.y);
      const placementChanges = this.assistedLayout?.resolveReparent(pointer) ?? [];

      for (const change of placementChanges) {
        this._owner.emit('placementchange', { source: this, ...change });
      }
      if (placementChanges.length > 0) {
        this.cacheSnapTargets();
      }
      this.assistedLayout?.updateAutoLayout(pointer);
      this._owner.emit('actionupdate', {
        source: this,
        transformType: TransformType.TRANSLATION,
      });
    }
    event.accept();
  }

  /**
   * 结束移动并提交布局与变换结果。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.active) {
      return;
    }

    const finishResult = this.assistedLayout?.finish();

    for (const change of finishResult?.placementChanges ?? []) {
      this._owner.emit('placementchange', { source: this, ...change });
    }
    const actionEvent = {
      source: this,
      transformType: TransformType.TRANSLATION,
      autoLayoutChange: finishResult?.autoLayoutChange,
    };

    this._owner.emit('actioncommit', actionEvent);
    this.resetDragState();
    event.accept();
  }

  /**
   * 绘制移动过程中的布局辅助信息。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    this.assistedLayout?.draw(control);
  }

  /**
   * 将视口位移应用到选中对象。
   * @param shift 本次视口位移。
   * @returns 是否成功应用位移。
   */
  private applyTranslation (shift: Vector2): boolean {
    // 步骤 1：校验位移并准备交互平面。
    if (shift.length() <= 0 || (!this.interactionPlane && !this.prepareTranslationGeometry())) {
      return false;
    }

    // 步骤 2：计算当前选区并应用吸附修正。
    const move = shift.clone();
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const currentSelectionBox = this.computeSelectionBox(containerSize);

    if (currentSelectionBox.isEmpty()) {
      return false;
    }
    this.selectionBox.copyFrom(currentSelectionBox);

    if (this._owner.getSnapManager().enabled) {
      const previousSnap = new Vector2(
        this._owner.getSnapManager().result.x ?? 0,
        this._owner.getSnapManager().result.y ?? 0,
      );

      this._owner.getSnapManager().prepareBox(move, this.selectionBox);
      const snap = new Vector2(
        this._owner.getSnapManager().result.x ?? 0,
        this._owner.getSnapManager().result.y ?? 0,
      );

      move.add(previousSnap).subtract(snap);
    }

    // 步骤 3：将修正后的视口位置转换为世界坐标。
    const worldPosition = viewPositionToWorld(
      this.cursorPoint.add(move).clone(),
      GizmoViewportUtils.getCameraInfo(this._owner.getEngine()),
      this.interactionPlane!,
      containerSize,
    );

    if (!worldPosition) {
      return false;
    }

    // 步骤 4：转换为各对象的局部位移并更新变换。
    const translation = worldPosition.clone().subtract(this.lastWorldPosition);

    translation.x = roundNumber(translation.x, 5);
    translation.y = roundNumber(translation.y, 5);
    translation.z = roundNumber(translation.z, 5);

    for (const item of this.selectedItems) {
      const parentMatrix = new Matrix4().copyFrom(item.transform.getParentMatrix() ?? new Matrix4());

      parentMatrix.setPosition(new Vector3());
      const localTranslation = translation.clone().applyMatrix(parentMatrix.invert());

      item.translate(...localTranslation.toArray());
      item.transform.updateLocalMatrix();
    }
    this.lastWorldPosition.copyFrom(worldPosition);

    return true;
  }

  /**
   * 初始化移动所需的选区、吸附目标与交互平面。
   * @returns 是否成功准备交互几何信息。
   */
  private prepareTranslationGeometry (): boolean {
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const selectionBox = this.computeSelectionBox(containerSize);

    if (selectionBox.isEmpty()) {
      return false;
    }

    this.selectionBox.copyFrom(selectionBox);
    this.cacheSnapTargets(containerSize);
    this.interactionPlane = createInteractionPlane(new Vector3(), new Euler(0, 0, 0, EulerOrder.XYZ));
    this.lastWorldPosition = viewPositionToWorld(
      this.cursorPoint,
      GizmoViewportUtils.getCameraInfo(this._owner.getEngine()),
      this.interactionPlane,
      containerSize,
    ) ?? new Vector3();

    return true;
  }

  /**
   * 计算当前可见选中项的视口包围盒。
   * @param containerSize 视口容器尺寸。
   * @returns 选区包围盒。
   */
  private computeSelectionBox (containerSize: Vector2): Box2 {
    const selectionBox = new Box2();

    for (const item of this.selectedItems) {
      if (item.isVisible) {
        const box = getItemViewBox(item, containerSize);

        if (!box.isEmpty()) {
          selectionBox.union(box);
        }
      }
    }

    return selectionBox;
  }

  /** 按当前父级关系刷新本次移动可用的吸附目标。 */
  private cacheSnapTargets (containerSize?: Vector2): void {
    const snapManager = this._owner.getSnapManager();

    if (!snapManager.enabled) {
      return;
    }
    const engine = this._owner.getEngine();

    snapManager.cacheSnapTargetsForSelection(
      engine.getServer(SceneServer).compositions[0]?.items ?? [],
      this.selectedItems,
      containerSize ?? GizmoViewportUtils.getContainerSize(engine.canvas.parentElement!),
    );
  }

  /** 重置移动交互状态。 */
  private resetDragState (): void {
    if (this._owner.getSelectionTransformKind() === 'move') {
      this._owner.setSelectionTransformKind('idle');
    }
    this.active = false;
    this.selectedItems = [];
    this.selectionBox = new Box2();
    this.interactionPlane = undefined;
    this.startPoint = new Vector2();
    this.lastPoint = new Vector2();
    this.cursorPoint = new Vector2();
    this.lastWorldPosition = new Vector3();
    this.assistedLayout?.cancel();
    this.assistedLayout = undefined;
    this._owner.getSnapManager().reset();
  }
}

export type { AutoLayoutChangeInfo, SelectionPlacementChange };
