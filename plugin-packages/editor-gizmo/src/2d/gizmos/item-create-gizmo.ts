import { SceneServer } from '@galacean/effects';
import { MouseButton, type InputEventMouseButton, type InputEventMouseMotion, FrameComponent, generateGUID, spec } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../math';
import type { ItemCreateConfig } from '../configs/types';
import { itemCreateConfig, selectionPreviewConfig } from '../configs/builtin-configs';
import { getItemViewBox, isFramePlayerItem } from '../items';
import { viewPositionToPixel, viewSizeToPixel } from '../viewport';
import { toColor, drawBox } from '../drawing';
import { DRAG_THRESHOLD_PX } from '../drag-threshold';
import type { GizmoItemCreateInfo } from '../gizmo-action';
import { TEXT_EDIT_BOX_LINE_COLOR, TEXT_EDIT_BOX_LINE_WIDTH } from './text-gizmo';

/** 元素创建类型。 */
export enum ItemCreateType {
  /** 不创建元素。 */
  NONE = 'none',
  /** 创建文本元素。 */
  TEXT = 'text',
  /** 创建视频生成器。 */
  VIDEO_GENERATOR = 'video-generator',
  /** 创建图片生成器。 */
  IMAGE_GENERATOR = 'image-generator',
  /** 创建画板。 */
  FRAME = 'frame',
}

/** 画板创建交互生成的几何与子元素数据。 */
export type FrameCreateData = {
  /** 画板像素位置（中心点） */
  position: [number, number],
  /** 画板像素尺寸 [width, height] */
  size: [number, number],
  /** 框选命中的子元素 ID 列表 */
  children: string[],
};

/** 固定宽度文字创建数据；垂直尺寸仍由文字默认样式决定。 */
export type TextCreateData = {
  /** 文字像素位置（中心点） */
  position: [number, number],
  /** 水平拖拽得到的固定像素宽度 */
  width: number,
};

const DEFAULT_FRAME_SIZE = 1024;
const DEFAULT_TEXT_HEIGHT = 60;
const TEXT_FIXED_WIDTH_DELAY_MS = 150;
// 固定宽度文本使用六倍拖拽阈值，避免轻微抖动生成窄列文本。
const TEXT_FIXED_WIDTH_DRAG_DISTANCE_PX = DRAG_THRESHOLD_PX * 6;

/** 通过点击或拖拽创建文本、生成器和画板元素。 */
export class ItemCreateGizmo extends Gizmo {
  readonly type = 'item-create';

  _createType = ItemCreateType.NONE;
  /** 光标结果（GestureCursorResult） */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  private dragStartPoint: Vector2 | null = null;
  private dragStartViewPoint: Vector2 | null = null;
  private pressStartedAt = 0;
  private mouseGrabbed = false;
  private frameBox: Box2 | null = null;
  private frameChildren: string[] = [];
  private interactiveChildrenBoxes = new Map<string, Box2>();
  private isFixedWidthText = false;
  private textDragDirection = 1;
  private textBox: Box2 | null = null;
  private createItemId: string | null = null;
  private dragCreationStarted = false;

  /** 当前元素创建配置。 */
  get config (): Readonly<ItemCreateConfig> {
    return this._owner.getConfigManager().get(itemCreateConfig);
  }

  /** 当前创建类型 */
  get createType () {
    return this._createType;
  }

  /**
   * 设置创建类型，变化时刷新光标。
   * @param type 元素创建类型
   */
  set createType (type: ItemCreateType) {
    if (type === this._createType) {
      return;
    }

    this._createType = type;
    this.refreshCursorResult();
  }

  /**
   * 更新已开始的元素创建交互。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.mouseGrabbed) {
      const handled = this.updateGrab(event);

      this._owner.setCursor(this.cursorResult);
      if (handled) {
        event.accept();
      }

      return;
    }
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 继续画板或固定宽度文本的拖拽创建。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.mouseGrabbed) {
      return;
    }
    const handled = this.updateGrab(event);

    this._owner.setCursor(this.cursorResult);
    if (handled) {
      event.accept();
    }
  }

  /**
   * 初始化元素创建交互与预生成 ID。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this._owner.setCursor(this.cursorResult);
    this.mouseGrabbed = true;
    this.dragStartViewPoint = new Vector2(event.position.x, event.position.y);
    this.dragStartPoint = new Vector2(event.position.x, event.position.y);
    this.pressStartedAt = Date.now();
    this.frameBox = null;
    this.frameChildren = [];
    this.isFixedWidthText = false;
    this.textDragDirection = 1;
    this.textBox = null;
    this.createItemId = generateGUID();
    this.dragCreationStarted = false;

    if (this._createType === ItemCreateType.FRAME) {
      this.refreshInteractiveChildrenBoxes();
    }

    event.accept();
  }

  /**
   * 提交或取消当前元素创建交互。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    // 步骤 1：校验会话并处理取消事件。
    if (!this.mouseGrabbed) {
      return;
    }

    if (event.isCanceled()) {
      const createInfo = this.getCurrentDragCreateInfo();

      if (this.dragCreationStarted && createInfo) {
        this._owner.emit('actioncommit', { source: this, createInfo, canceled: true });
      }
      this.resetInteractionState();
      this._owner.setCursor(this.cursorResult);
      event.accept();

      return;
    }

    // 步骤 2：优先提交已开始的拖拽创建。
    const dragCreateInfo = this.getCurrentDragCreateInfo();

    if (this.dragCreationStarted && dragCreateInfo) {
      this._owner.emit('actioncommit', { source: this, createInfo: dragCreateInfo });
      this.resetInteractionState();
      this._owner.setCursor(this.cursorResult);
      event.accept();

      return;
    }

    // 步骤 3：按创建类型提交点击创建或画板拖拽结果。
    const createItemId = this.createItemId!;

    switch (this._createType) {
      case ItemCreateType.FRAME: {
        if (this.frameBox) {
          this._owner.emit('actioncommit', {
            source: this,
            createInfo: this.getFrameDragCreateInfo(),
          });

          break;
        }
        const pixelPosition = this.viewPositionToPixel(this.dragStartViewPoint!);
        const frameData: FrameCreateData = {
          position: [pixelPosition.x, pixelPosition.y],
          size: [DEFAULT_FRAME_SIZE, DEFAULT_FRAME_SIZE],
          children: [],
        };

        this._owner.emit('actioncommit', {
          source: this,
          createInfo: {
            info: frameData,
            type: ItemCreateType.FRAME,
            id: createItemId,
            position: frameData.position,
          },
        });

        break;
      }
      case ItemCreateType.TEXT: {
        const pixelPosition = this.viewPositionToPixel(this.dragStartViewPoint!);

        this._owner.emit('actioncommit', {
          source: this,
          createInfo: {
            type: ItemCreateType.TEXT,
            id: createItemId,
            position: [pixelPosition.x, pixelPosition.y],
          },
        });

        break;
      }
      case ItemCreateType.IMAGE_GENERATOR:
      case ItemCreateType.VIDEO_GENERATOR: {
        const pixelPosition = viewPositionToPixel(new Vector2(event.position.x, event.position.y), GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!), GizmoViewportUtils.getViewScale(this._owner.getEngine()), GizmoViewportUtils.getViewportTranslation(this._owner.getEngine()));
        const position: [number, number] = [pixelPosition.x, pixelPosition.y];

        this._owner.emit('actioncommit', { source: this, createInfo: { type: this._createType, id: createItemId, position } });

        break;
      }
      case ItemCreateType.NONE:
        break;
    }

    // 步骤 4：清理会话并恢复光标。
    this.resetInteractionState();
    this._owner.setCursor(this.cursorResult);
    event.accept();
  }

  /** 按当前创建类型刷新鼠标光标样式。 */
  refreshCursorResult () {
    switch (this._createType) {
      case ItemCreateType.TEXT: {
        this.cursorResult = {
          type: GestureCursorType.TEXT_CREATE,
          angle: 0,
        };

        break;
      }
      case ItemCreateType.FRAME: {
        this.cursorResult = {
          type: GestureCursorType.FRAME_CREATE,
          angle: 0,
        };

        break;
      }
      case ItemCreateType.NONE:
      case ItemCreateType.IMAGE_GENERATOR:
      case ItemCreateType.VIDEO_GENERATOR: {
        this.cursorResult = {
          type: GestureCursorType.NORMAL,
          angle: 0,
        };

        break;
      }
    }
  }

  /** 刷新可被框选加入画板的子元素包围盒映射：过滤特效元素、画板元素及其子元素。 */
  refreshInteractiveChildrenBoxes () {
    // 步骤 1：获取当前合成并清空旧的候选包围盒。
    this.interactiveChildrenBoxes.clear();
    const playerComposition = this._owner.getEngine().getServer(SceneServer).compositions[0];

    if (!playerComposition?.items.length) {
      return;
    }

    // 步骤 2：收集不可被画板收纳的特效、画板及其子元素。
    const effectsItemIds: string[] = [];
    const frameItemIds: string[] = [];

    playerComposition.items.forEach(item => {
      if (item.name === 'ModelPluginItem') {
        return;
      }
      if (item.name === '特效' && item.getComponent(FrameComponent) !== undefined) {
        effectsItemIds.push(item.getInstanceId());
      }
      if (isFramePlayerItem(item)) {
        frameItemIds.push(item.getInstanceId());
        item.children?.forEach(child => {
          frameItemIds.push(child.getInstanceId());
        });
      }
    });

    const filterItemIds = [...effectsItemIds, ...frameItemIds];

    // 步骤 3：缓存其余可交互元素的视口包围盒。
    playerComposition.items.forEach(item => {
      const itemId = item.getInstanceId();

      if (filterItemIds.includes(itemId)) {
        return;
      }

      const box = getItemViewBox(
        item,
        GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
      );

      this.interactiveChildrenBoxes.set(itemId, box);
    });
  }

  /**
   * 绘制画板或文本的创建区域，以及画板待收纳元素轮廓。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    const isTextPreview = this._createType === ItemCreateType.TEXT;
    const previewBox = this._createType === ItemCreateType.FRAME
      ? this.frameBox
      : isTextPreview ? this.getTextPreviewBox() : null;

    if (!this.mouseGrabbed || !previewBox || previewBox.isEmpty()) {
      return;
    }

    const {
      frameBorderAlpha,
      frameBorderColor,
      frameBorderWidth,
    } = this.config;

    drawBox(
      control,
      previewBox,
      isTextPreview
        ? toColor(TEXT_EDIT_BOX_LINE_COLOR, 1)
        : toColor(frameBorderColor, frameBorderAlpha),
      isTextPreview ? TEXT_EDIT_BOX_LINE_WIDTH : frameBorderWidth,
    );

    if (this._createType === ItemCreateType.FRAME) {
      const hoverConfig = this._owner.getConfigManager().get(selectionPreviewConfig);
      const hoverColor = toColor(hoverConfig.preSelectedColor, 1);

      this.frameChildren.forEach(id => {
        const box = this.interactiveChildrenBoxes.get(id);

        if (!box) {
          return;
        }
        drawBox(control, box, hoverColor, hoverConfig.preSelectedWidth);
      });
    }
  }

  /** 释放元素创建交互状态。 */
  override dispose (): void {
    this.resetInteractionState();
    super.dispose();
  }

  /**
   * 按当前创建类型更新拖拽预览。
   * @param event 鼠标拖拽事件。
   * @returns 是否处理了拖拽。
   */
  private updateGrab (event: InputEventMouseMotion): boolean {
    if (!this.mouseGrabbed) {
      return false;
    }

    switch (this._createType) {
      case ItemCreateType.FRAME:
        this.updateFrameDrag(event);

        break;
      case ItemCreateType.TEXT:
        this.updateTextDrag(event);

        break;
    }

    return true;
  }

  /**
   * 更新画板拖拽区域及其待收纳子元素。
   * @param event 鼠标拖拽事件。
   */
  private updateFrameDrag (event: InputEventMouseMotion): void {
    if (!this.dragStartPoint || !this.dragStartViewPoint) {
      return;
    }

    const endPoint = this.getCurrentViewPoint(event);
    const deltaX = endPoint.x - this.dragStartViewPoint.x;
    const deltaY = endPoint.y - this.dragStartViewPoint.y;
    const resolvedEndPoint = new Vector2(
      this.dragStartViewPoint.x + Math.sign(deltaX || 1) * Math.max(Math.abs(deltaX), 1),
      this.dragStartViewPoint.y + Math.sign(deltaY || 1) * Math.max(Math.abs(deltaY), 1),
    );

    this.frameBox = this.createBox(this.dragStartViewPoint, resolvedEndPoint);
    this.frameChildren = [];

    this.interactiveChildrenBoxes.forEach((box, id) => {
      if (this.frameBox?.containsBox(box) && id !== 'ModelPluginItem') {
        this.frameChildren.push(id);
      }
    });
  }

  /**
   * 超过时间和水平距离阈值后更新固定宽度文本预览。
   * @param event 鼠标拖拽事件。
   */
  private updateTextDrag (event: InputEventMouseMotion): void {
    if (!this.dragStartPoint || !this.dragStartViewPoint) {
      return;
    }

    const endPoint = this.getCurrentViewPoint(event);
    const horizontalDistance = Math.abs(endPoint.x - this.dragStartViewPoint.x);

    if (!this.isFixedWidthText) {
      if (
        Date.now() - this.pressStartedAt < TEXT_FIXED_WIDTH_DELAY_MS
        || horizontalDistance <= TEXT_FIXED_WIDTH_DRAG_DISTANCE_PX
      ) {
        return;
      }
      this.isFixedWidthText = true;
    }

    const deltaX = endPoint.x - this.dragStartViewPoint.x;

    if (deltaX !== 0) {
      this.textDragDirection = Math.sign(deltaX);
    }
    const resolvedEndX = this.dragStartViewPoint.x
      + this.textDragDirection * Math.max(horizontalDistance, 1);
    const textHeight = DEFAULT_TEXT_HEIGHT * GizmoViewportUtils.getViewScale(this._owner.getEngine());

    this.textBox = this.createBox(
      new Vector2(this.dragStartViewPoint.x, this.dragStartViewPoint.y - textHeight / 2),
      new Vector2(resolvedEndX, this.dragStartViewPoint.y + textHeight / 2),
    );
    this.emitDragCreate(this.getTextDragCreateInfo());
  }

  /**
   * 发送拖拽创建的开始或更新事件。
   * @param createInfo 当前元素创建信息。
   */
  private emitDragCreate (createInfo: GizmoItemCreateInfo): void {
    const phase = this.dragCreationStarted ? 'actionupdate' : 'actionstart';

    this.dragCreationStarted = true;
    this._owner.emit(phase, { source: this, createInfo });
  }

  /** @returns 当前画板拖拽预览对应的创建信息。 */
  private getFrameDragCreateInfo (): GizmoItemCreateInfo {
    const frameBox = this.frameBox!;
    const pixelPosition = this.viewPositionToPixel(frameBox.getCenter());
    const pixelSize = viewSizeToPixel(
      frameBox.getSize(),
      GizmoViewportUtils.getViewScale(this._owner.getEngine()),
    );
    const frameData: FrameCreateData = {
      position: [pixelPosition.x, pixelPosition.y],
      size: [pixelSize.x, pixelSize.y],
      children: [...this.frameChildren],
    };

    return {
      type: ItemCreateType.FRAME,
      id: this.createItemId!,
      position: frameData.position,
      info: frameData,
    };
  }

  /** @returns 当前文本拖拽预览对应的创建信息。 */
  private getTextDragCreateInfo (): GizmoItemCreateInfo {
    const textBox = this.textBox!;
    const pixelPosition = this.viewPositionToPixel(textBox.getCenter());
    const pixelWidth = viewSizeToPixel(
      textBox.getSize(),
      GizmoViewportUtils.getViewScale(this._owner.getEngine()),
    ).x;
    const textData: TextCreateData = {
      position: [pixelPosition.x, pixelPosition.y],
      width: pixelWidth,
    };

    return {
      type: ItemCreateType.TEXT,
      id: this.createItemId!,
      position: textData.position,
      info: textData,
    };
  }

  /** @returns 当前有效的拖拽创建信息。 */
  private getCurrentDragCreateInfo (): GizmoItemCreateInfo | undefined {
    if (this._createType === ItemCreateType.TEXT && this.textBox) {
      return this.getTextDragCreateInfo();
    }

    return undefined;
  }

  /**
   * @returns 拖拽创建中文本的实际视图包围盒；元素尚未就绪时退回手势预览盒。
   */
  private getTextPreviewBox (): Box2 | null {
    if (this.dragCreationStarted) {
      const selectedItems = this._owner.getSelection().getSelectedPlayerItems();
      const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined;

      if (selectedItem?.type === spec.ItemType.text) {
        const actualBox = getItemViewBox(
          selectedItem,
          GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
        );

        if (!actualBox.isEmpty()) {
          return actualBox;
        }
      }
    }

    return this.textBox;
  }

  /**
   * 计算当前指针对应的视口位置。
   * @param event 鼠标拖拽事件。
   * @returns 当前视口位置。
   */
  private getCurrentViewPoint (event: InputEventMouseMotion): Vector2 {
    const shift = new Vector2(
      event.position.x - this.dragStartPoint!.x,
      event.position.y - this.dragStartPoint!.y,
    );

    return this.dragStartViewPoint!.clone().add(shift);
  }

  /**
   * 根据两个端点创建轴对齐包围盒。
   * @param start 起点。
   * @param end 终点。
   * @returns 轴对齐包围盒。
   */
  private createBox (start: Vector2, end: Vector2): Box2 {
    return new Box2(
      new Vector2(Math.min(start.x, end.x), Math.min(start.y, end.y)),
      new Vector2(Math.max(start.x, end.x), Math.max(start.y, end.y)),
    );
  }

  /**
   * 将视口位置转换为像素坐标。
   * @param point 视口位置。
   * @returns 像素坐标。
   */
  private viewPositionToPixel (point: Vector2): Vector2 {
    const engine = this._owner.getEngine();

    return viewPositionToPixel(
      point,
      GizmoViewportUtils.getContainerSize(engine.canvas.parentElement!),
      GizmoViewportUtils.getViewScale(engine),
      GizmoViewportUtils.getViewportTranslation(engine),
    );
  }

  /** 重置一次创建交互的全部临时状态。 */
  private resetInteractionState (): void {
    this.mouseGrabbed = false;
    this.dragStartPoint = null;
    this.dragStartViewPoint = null;
    this.pressStartedAt = 0;
    this.frameBox = null;
    this.frameChildren = [];
    this.interactiveChildrenBoxes.clear();
    this.isFixedWidthText = false;
    this.textDragDirection = 1;
    this.textBox = null;
    this.createItemId = null;
    this.dragCreationStarted = false;
  }
}
