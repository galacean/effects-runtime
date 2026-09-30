import { Box2, Line2 } from '@galacean/effects-math/es/extension/index';
import { RAD2DEG, Vector2, getBoxCorners, getTransformedBoxCorners, inverseTransformBoxPoint, setBoxFromPoints, transformedBoxContainsPoint, type Matrix3 } from '../math';
import type { ImageExpandConfig } from '../configs/types';
import { imageExpandConfig } from '../configs/builtin-configs';
import type { VFXItem } from '@galacean/effects';
import { MouseButton, MouseButtonMask, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import { ImageInteractionType, type ImageDirectionScaleParam, type ImageMoveParam, type ImageNoneParam } from './image-interaction';
import { getItemViewBox, getItemViewTransform } from '../items';
import { toColor, drawCorners, fillBoxByCorners } from '../drawing';

/**
 * 图片扩边缩放交互参数
 */
export type ImageExpandScaleParam = {
  /** 交互类型 */
  type: ImageInteractionType.SCALE,
  /** 归一化扩边框 */
  box: Box2,
  /** 起始角点索引 */
  index: number,
  /** 归一化起始鼠标位置 */
  startMouse: Vector2,
  /** 锁定的宽高比 */
  lockedAspect?: number,
};

/**
 * 图片扩边交互参数
 */
export type ImageExpandInteractionParam = ImageNoneParam | ImageExpandScaleParam | ImageDirectionScaleParam | ImageMoveParam;

/** 图片扩边交互类型。 */
export type ImageExpandInteractionType = ImageInteractionType;

/**
 * 图片扩边工具结果
 */
export type ImageExpandResult = {
  /** 当前归一化扩边框。 */
  normalizeExpandBox: Box2,
};

/** 图片扩边在当前视口中的几何。 */
type ImageExpandGeometry = {
  /** 图片元素包围盒。 */
  itemBox: Box2,
  /** 图片归一化 Box2 到视图的变换。 */
  boxTransform: Matrix3,
};

/** 在图片范围外移动或缩放归一化扩边框。 */
export class ImageExpandGizmo extends Gizmo {
  result: ImageExpandResult = {
    normalizeExpandBox: new Box2(new Vector2(), new Vector2(1, 1)),
  };

  interactionParam: ImageExpandInteractionParam = { type: ImageInteractionType.NONE };

  readonly type = GizmoType.IMAGE_EXPAND;

  /** 光标结果。 */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  private renderGeometry?: ImageExpandGeometry;

  private _isLockScale = false;

  private mouseGrabbed = false;

  /** 当前图片扩边配置。 */
  get config (): Readonly<ImageExpandConfig> {
    return this._owner.getConfigManager().get(imageExpandConfig);
  }

  /** 当前选中的元素（直读 selection.getSelectedPlayerItems：id→VFXItem 已解析）。 */
  get selectedItems (): VFXItem[] {
    return this._owner.getSelection().getSelectedPlayerItems();
  }

  /** 是否锁定宽高比缩放。 */
  get isLockScale () {
    return this._isLockScale;
  }

  /**
   * 设置是否锁定宽高比缩放。
   * @param state 是否锁定宽高比。
   */
  set isLockScale (state: boolean) {
    if (state === this.isLockScale) {
      return;
    }

    this._isLockScale = state;
  }

  /**
   * 更新扩边框交互或悬停状态。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.isApplicableSelection()) {
      return;
    }
    if (this.mouseGrabbed) {
      const handled = this.updateGrab(event);

      this._owner.setCursor(this.cursorResult);
      if (handled) {
        event.accept();
      }

      return;
    }
    const hover = this._owner.getMousePosition();
    const inputPosition = new Vector2(event.position.x, event.position.y);

    this.refreshInteractionType(hover, inputPosition);
    this._owner.setCursor(this.cursorResult);
    if (event.buttonMask === MouseButtonMask.None
      && (this.interactionParam.type === ImageInteractionType.SCALE
        || this.interactionParam.type === ImageInteractionType.DIRECTION_SCALE)) {
      event.accept();
    }
  }

  /**
   * 继续当前扩边框拖拽。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.isApplicableSelection() || !this.mouseGrabbed) {
      return;
    }
    const handled = this.updateGrab(event);

    this._owner.setCursor(this.cursorResult);
    this._owner.emit('actionupdate', {
      source: this,
    });
    if (handled) {
      event.accept();
    }
  }

  /** 鼠标离开交互层：清交互类型（拖拽中不清）。 */
  override onMouseLeave (): void {
    if (!this.isApplicableSelection()) {
      return;
    }
    if (this.mouseGrabbed) {
      this._owner.setCursor(this.cursorResult);

      return;
    }
    this.interactionParam = { type: ImageInteractionType.NONE };
    this.refreshCursorResult(ImageInteractionType.NONE);
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 命中扩边框交互区域时开始操作。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.isApplicableSelection()) {
      return;
    }
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    const mouse = new Vector2(event.position.x, event.position.y);
    const inputPosition = new Vector2(event.position.x, event.position.y);

    this.refreshInteractionType(mouse, inputPosition);
    this._owner.setCursor(this.cursorResult);
    if (this.interactionParam.type === ImageInteractionType.NONE) {
      return;
    }

    this.mouseGrabbed = true;
    this._owner.emit('actionstart', { source: this });

    event.accept();
  }

  /**
   * 结束扩边框操作并提交结果。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.mouseGrabbed) {
      return;
    }
    this.mouseGrabbed = false;

    const mouse = new Vector2(event.position.x, event.position.y);
    const inputPosition = new Vector2(event.position.x, event.position.y);

    this.refreshInteractionType(mouse, inputPosition);
    this._owner.setCursor(this.cursorResult);

    this._owner.emit('actioncommit', { source: this });

    event.accept();
  }

  /**
   * 键盘松开：清除当前交互的锁定宽高比（下次拖拽重新算）。
   * @param _keyCode 键盘事件
   */
  override onKeyUp (_keyCode: InputEventKey): void {
    if ('lockedAspect' in this.interactionParam) {
      delete this.interactionParam.lockedAspect;
    }
  }

  /** 为本帧绘制创建扩边投影。 */
  override onUpdate (): void {
    this.renderGeometry = this.getSelectionGeometry();
  }

  /**
   * 绘制扩边蒙版、网格、边框与角点。
   * @param control 绘制控制器。
   */
  override draw (control: Control) {
    // 步骤 1：读取本帧投影与绘制配置。
    const geometry = this.renderGeometry;

    if (!geometry) {
      return;
    }

    const {
      maskColor,
      maskAlpha,
      expandBoxLineWidth,
      expandBoxLineColor,
      expandBoxLineAlpha,
      expandBoxCornerRadius,
      expandBoxCornerFillColor,
      expandBoxCornerLineWidth,
      expandBoxCornerLineColor,
      expandBoxCornerLineAlpha,
      gridLineWidth,
      gridLineColor,
      gridLineAlpha,
      gridCount,
    } = this.config;

    const expandCorners = getTransformedBoxCorners(geometry.boxTransform, this.result.normalizeExpandBox);

    // 步骤 2：绘制扩边蒙版。
    fillBoxByCorners(control, expandCorners, toColor(maskColor, maskAlpha));

    // 步骤 3：绘制扩边辅助网格。
    const gridColor = toColor(gridLineColor, gridLineAlpha);

    for (let i = 1; i <= gridCount; i++) {
      const ratio = i / (gridCount + 1);
      const top = expandCorners[0].clone().add(expandCorners[1].clone().subtract(expandCorners[0]).multiply(ratio));
      const bottom = expandCorners[3].clone().add(expandCorners[2].clone().subtract(expandCorners[3]).multiply(ratio));
      const left = expandCorners[0].clone().add(expandCorners[3].clone().subtract(expandCorners[0]).multiply(ratio));
      const right = expandCorners[1].clone().add(expandCorners[2].clone().subtract(expandCorners[1]).multiply(ratio));

      control.drawLine(top.x, top.y, bottom.x, bottom.y, gridColor, gridLineWidth);
      control.drawLine(left.x, left.y, right.x, right.y, gridColor, gridLineWidth);
    }

    // 步骤 4：绘制扩边框和角点。
    drawCorners(control, expandCorners, toColor(expandBoxLineColor, expandBoxLineAlpha), expandBoxLineWidth);
    const cornerFill = toColor(expandBoxCornerFillColor, 1);
    const cornerStroke = toColor(expandBoxCornerLineColor, expandBoxCornerLineAlpha);

    expandCorners.forEach(corner => {
      control.fillCircle(corner.x, corner.y, expandBoxCornerRadius, cornerFill);
      control.drawCircle(corner.x, corner.y, expandBoxCornerRadius, cornerStroke, expandBoxCornerLineWidth);
    });
  }

  /**
   * 刷新指针结果。
   * @param activeType 交互类型。
   * @param angle 指针方向角度。
   */
  refreshCursorResult (activeType: ImageExpandInteractionType, angle = 0) {
    switch (activeType) {
      case ImageInteractionType.SCALE: {
        this.cursorResult = {
          type: GestureCursorType.SCALE,
          angle,
        };

        break;
      }
      case ImageInteractionType.DIRECTION_SCALE: {
        this.cursorResult = {
          type: GestureCursorType.SCALE,
          angle,
        };

        break;
      }
      case ImageInteractionType.MOVE:
      case ImageInteractionType.NONE: {
        this.cursorResult = {
          type: GestureCursorType.NORMAL,
          angle: 0,
        };

        break;
      }
    }
  }

  /**
   * 获取当前扩边信息（扩边框 + 元素包围盒）。
   * @returns 扩边信息对象，不可交互时返回 undefined
   */
  getExpandInfo () {
    const geometry = this.getSelectionGeometry();

    if (!geometry) {
      return undefined;
    }

    return {
      expandBox: this.result.normalizeExpandBox.clone(),
      itemBox: geometry.itemBox,
    };
  }

  /**
   * 获取归一化扩边包围盒（相对元素包围盒，可超出 [0, 1]）。
   */
  getExpandBox () {
    if (!this.isApplicableSelection()) {
      return undefined;
    }

    return this.result.normalizeExpandBox.clone();
  }

  /**
   * 设置归一化扩边包围盒（入参为归一化坐标，钳制为至少覆盖元素范围）。
   * @param normalizeBox 归一化扩边包围盒
   * @returns 更新后的扩边包围盒；未激活或无效状态返回 undefined
   */
  setExpandBox (normalizeBox: Box2) {
    if (!this.isApplicableSelection()) {
      return undefined;
    }

    this.result.normalizeExpandBox.copyFrom(normalizeBox);

    return this.result.normalizeExpandBox.clone();
  }

  /** @returns 是否仅选中了一个可扩边元素。 */
  private isApplicableSelection (): boolean {
    return this._owner.getSelection().getSelectedPlayerItems().length === 1;
  }

  /**
   * drag：按交互类型处理扩边框移动/缩放/单向缩放。
   * 支持 shift 锁定宽高比，结果以归一化扩边盒写入 result。
   * @param event 鼠标事件（drag）
   */
  private updateGrab (event: InputEventMouseMotion): boolean {
    // 步骤 1：校验当前交互会话。
    if (!this.mouseGrabbed) {
      return false;
    }
    if (this.interactionParam.type === ImageInteractionType.NONE) {
      return true;
    }

    // 步骤 2：获取实时投影并计算指针位移。
    const geometry = this.getSelectionGeometry();

    if (!geometry) {
      return true;
    }

    const currentInputPosition = inverseTransformBoxPoint(geometry.boxTransform, new Vector2(event.position.x, event.position.y));
    const { startMouse, box } = this.interactionParam;
    const shift = new Vector2().subtractVectors(currentInputPosition, startMouse);
    const itemBoxMin = new Vector2();
    const itemBoxMax = new Vector2(1, 1);

    // 步骤 3：按移动、角点缩放或边缩放更新归一化扩边框。
    switch (this.interactionParam.type) {
      case ImageInteractionType.MOVE: {
        const { min: originMin, max: originMax } = box;

        const xMinShift = itemBoxMax.x - originMax.x;
        const xMaxShift = itemBoxMin.x - originMin.x;
        const yMinShift = itemBoxMax.y - originMax.y;
        const yMaxShift = itemBoxMin.y - originMin.y;

        shift.x = Math.min(Math.max(shift.x, xMinShift), xMaxShift);
        shift.y = Math.min(Math.max(shift.y, yMinShift), yMaxShift);

        const resultBox = box.clone().translate(shift);

        this.result.normalizeExpandBox = resultBox;

        break;
      }
      case ImageInteractionType.SCALE: {
        const { index } = this.interactionParam;
        const { min, max } = box;
        const boxCorners = getBoxCorners(box);
        const startCorner = boxCorners[index];
        const anchor = boxCorners[(index + 2) % 4];
        const resultCorner = new Vector2(startCorner.x + shift.x, startCorner.y + shift.y);

        if (startCorner.x >= max.x) {
          resultCorner.x = Math.max(resultCorner.x, itemBoxMax.x);
        } else if (startCorner.x <= min.x) {
          resultCorner.x = Math.min(resultCorner.x, itemBoxMin.x);
        } else {
          console.warn('resultCorner has wrong, we have move it to the nearest corner');
          resultCorner.x = Math.abs(resultCorner.x - min.x) > Math.abs(resultCorner.x - max.x) ? max.x : min.x;
        }

        if (startCorner.y >= max.y) {
          resultCorner.y = Math.max(resultCorner.y, itemBoxMax.y);
        } else if (startCorner.y <= min.y) {
          resultCorner.y = Math.min(resultCorner.y, itemBoxMin.y);
        } else {
          console.warn('resultCorner has wrong, we have move it to the nearest corner');
          resultCorner.y = Math.abs(resultCorner.y - min.y) > Math.abs(resultCorner.y - max.y) ? max.y : min.y;
        }

        if (event.shiftPressed || this.isLockScale) {
          const expandBox = this.result.normalizeExpandBox;
          const { x: boxWidth, y: boxHeight } = expandBox.getSize();
          const { x: originWidth, y: originHeight } = box.getSize();

          this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

          if (Math.abs(resultCorner.x - anchor.x) / originWidth > Math.abs(resultCorner.y - anchor.y) / originHeight) {
            const resultHeight = Math.abs(resultCorner.x - anchor.x) / this.interactionParam.lockedAspect;

            resultCorner.y = (startCorner.y - anchor.y) / Math.abs((startCorner.y - anchor.y)) * resultHeight + anchor.y;

            if (startCorner.y >= max.y) {
              resultCorner.y = Math.max(resultCorner.y, itemBoxMax.y);
            } else if (startCorner.y <= min.y) {
              resultCorner.y = Math.min(resultCorner.y, itemBoxMin.y);
            } else {
              console.warn('resultCorner has wrong, we have move it to the nearest corner');
              resultCorner.y = Math.abs(resultCorner.y - min.y) > Math.abs(resultCorner.y - max.y) ? max.y : min.y;
            }
          } else {
            const resultWidth = Math.abs(resultCorner.y - anchor.y) * this.interactionParam.lockedAspect;

            resultCorner.x = (startCorner.x - anchor.x) / Math.abs((startCorner.x - anchor.x)) * resultWidth + anchor.x;

            if (startCorner.x >= max.x) {
              resultCorner.x = Math.max(resultCorner.x, itemBoxMax.x);
            } else if (startCorner.x <= min.x) {
              resultCorner.x = Math.min(resultCorner.x, itemBoxMin.x);
            } else {
              console.warn('resultCorner has wrong, we have move it to the nearest corner');
              resultCorner.x = Math.abs(resultCorner.x - min.x) > Math.abs(resultCorner.x - max.x) ? max.x : min.x;
            }
          }
        }

        this.result.normalizeExpandBox = setBoxFromPoints(new Box2(), [resultCorner, anchor]);

        break;
      }
      case ImageInteractionType.DIRECTION_SCALE: {
        const { index } = this.interactionParam;
        const boxCorners = getBoxCorners(box);
        const startPoint = boxCorners[index].clone();
        const expandBox = this.result.normalizeExpandBox;
        const { x: boxWidth, y: boxHeight } = expandBox.getSize();

        this.interactionParam.lockedAspect ??= boxWidth / boxHeight;
        const nextCorner = boxCorners[(index + 1) % 4].clone();

        // 四条边固定为：0 上、1 右、2 下、3 左。
        const shiftDirection = index % 2 === 0 ? 'y' : 'x';

        if (shiftDirection === 'x') {
          if (index === 1) {
            shift.x = Math.max(boxCorners[index].x + shift.x, itemBoxMax.x) - startPoint.x;
            if (event.shiftPressed || this.isLockScale) {
              const expandBox = this.result.normalizeExpandBox;
              const { x: boxWidth, y: boxHeight } = expandBox.getSize();

              this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

              shift.y = shift.x / this.interactionParam.lockedAspect;
              const resuleTargetCornerY = nextCorner.y + shift.y;
              const clampResultCornerY = Math.max(resuleTargetCornerY, itemBoxMax.y);

              shift.y = clampResultCornerY - nextCorner.y;
              shift.x = shift.y * this.interactionParam.lockedAspect;
            } else {
              shift.y = 0;
            }
          } else if (index === 3) {
            shift.x = Math.min(boxCorners[index].x + shift.x, itemBoxMin.x) - startPoint.x;
            if (event.shiftPressed || this.isLockScale) {
              const expandBox = this.result.normalizeExpandBox;
              const { x: boxWidth, y: boxHeight } = expandBox.getSize();

              this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

              shift.y = shift.x / this.interactionParam.lockedAspect;
              const resuleTargetCornerY = nextCorner.y + shift.y;
              const clampResultCornerY = Math.min(resuleTargetCornerY, itemBoxMin.y);

              shift.y = clampResultCornerY - nextCorner.y;
              shift.x = shift.y * this.interactionParam.lockedAspect;
            } else {
              shift.y = 0;
            }
          }
        } else {
          if (index === 2) {
            shift.y = Math.max(boxCorners[index].y + shift.y, itemBoxMax.y) - startPoint.y;
            if (event.shiftPressed || this.isLockScale) {
              const expandBox = this.result.normalizeExpandBox;
              const { x: boxWidth, y: boxHeight } = expandBox.getSize();

              this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

              shift.x = -shift.y * this.interactionParam.lockedAspect;
              const resuleTargetCornerX = nextCorner.x + shift.x;
              const clampResultCornerX = Math.min(resuleTargetCornerX, itemBoxMin.x);

              shift.x = clampResultCornerX - nextCorner.x;
              shift.y = -shift.x / this.interactionParam.lockedAspect;
            } else {
              shift.x = 0;
            }
          } else if (index === 0) {
            shift.y = Math.min(boxCorners[index].y + shift.y, itemBoxMin.y) - startPoint.y;
            if (event.shiftPressed || this.isLockScale) {
              const expandBox = this.result.normalizeExpandBox;
              const { x: boxWidth, y: boxHeight } = expandBox.getSize();

              this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

              shift.x = -shift.y * this.interactionParam.lockedAspect;
              const resuleTargetCornerX = nextCorner.x + shift.x;
              const clampResultCornerX = Math.max(resuleTargetCornerX, itemBoxMax.x);

              shift.x = clampResultCornerX - nextCorner.x;
              shift.y = -shift.x / this.interactionParam.lockedAspect;
            } else {
              shift.x = 0;
            }
          }
        }

        const resultCorners: Vector2[] = [];

        boxCorners.forEach((corner, i) => {
          const resultCorner = new Vector2();

          if (index === i) {
            if (shiftDirection === 'y') {
              resultCorner.copyFrom(corner.clone().add(new Vector2(0, shift.y)));
            } else {
              resultCorner.copyFrom(corner.clone().add(new Vector2(shift.x, 0)));
            }
          } else if (index === (i + 3) % 4) {
            resultCorner.copyFrom(corner.clone().add(shift));
          } else if (index === (i + 2) % 4) {
            if (shiftDirection === 'x') {
              resultCorner.copyFrom(corner.clone().add(new Vector2(0, shift.y)));
            } else {
              resultCorner.copyFrom(corner.clone().add(new Vector2(shift.x, 0)));
            }
          } else {
            resultCorner.copyFrom(corner.clone());
          }
          resultCorners.push(resultCorner);
        });
        this.result.normalizeExpandBox = setBoxFromPoints(new Box2(), resultCorners);

        break;
      }
      default:
        break;
    }

    return true;
  }

  /** @returns 当前图片与扩边框的视口投影。 */
  private getSelectionGeometry (): ImageExpandGeometry | undefined {
    const selectedItems = this.selectedItems;

    if (selectedItems.length !== 1) {
      return undefined;
    }

    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const boxTransform = getItemViewTransform(selectedItems[0], containerSize);

    if (!boxTransform) {
      return undefined;
    }
    const itemBox = getItemViewBox(selectedItems[0], containerSize);

    return {
      itemBox,
      boxTransform,
    };
  }

  /**
   * 根据鼠标位置判定扩边框的交互类型（角点缩放/边线单向缩放/整体移动），
   * 同时刷新光标方向。
   * @param point 视图坐标鼠标位置
   * @param inputPosition Control 本地坐标鼠标位置
   */
  private refreshInteractionType (point: Vector2, inputPosition: Vector2) {
    // 步骤 1：重置交互状态并获取实时扩边投影。
    this.interactionParam.type = ImageInteractionType.NONE;

    const geometry = this.getSelectionGeometry();

    if (!geometry) {
      return;
    }

    const itemCorners = getTransformedBoxCorners(geometry.boxTransform);
    const expandCorners = getTransformedBoxCorners(geometry.boxTransform, this.result.normalizeExpandBox);
    let hasInteractionType = false;
    let angle = 0;

    // 步骤 2：优先检测角点缩放。
    expandCorners.forEach((corner, index) => {
      if (hasInteractionType) {
        return;
      }
      if (corner.distance(point) < 20) {
        hasInteractionType = true;
        this.interactionParam = {
          type: ImageInteractionType.SCALE,
          index,
          box: this.result.normalizeExpandBox.clone(),
          startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
        };

        const rotation = Math.atan2(itemCorners[1].y - itemCorners[0].y, itemCorners[1].x - itemCorners[0].x);

        angle = Math.PI / 2 * ((index + 3) % 4) + rotation;
      }
    });

    // 步骤 3：其次检测边缘单向缩放。
    expandCorners.forEach((corner, index) => {
      if (hasInteractionType) {
        return;
      }
      const edge = new Line2(corner.clone(), expandCorners[(index + 1) % 4]);
      const t = edge.distanceSq() === 0 ? 0 : edge.closestPointToPointParameter(point, true);
      const dis = { d: edge.at(t).distance(point), t };

      const state = dis.d >= 0 && dis.d <= 8 && dis.t >= 0 && dis.t <= 1;

      if (state) {
        hasInteractionType = true;
        this.interactionParam = {
          type: ImageInteractionType.DIRECTION_SCALE,
          index,
          box: this.result.normalizeExpandBox.clone(),
          startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
        };
        const rotation = Math.atan2(itemCorners[1].y - itemCorners[0].y, itemCorners[1].x - itemCorners[0].x);

        angle = Math.PI / 2 * ((index + 3) % 4) + Math.PI / 4 + rotation;
      }
    });

    // 步骤 4：最后检测扩边区域整体移动并刷新光标。
    if (transformedBoxContainsPoint(geometry.boxTransform, point, this.result.normalizeExpandBox) && !hasInteractionType) {
      this.interactionParam = {
        type: ImageInteractionType.MOVE,
        box: this.result.normalizeExpandBox.clone(),
        startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
      };

      hasInteractionType = true;
    }

    this.refreshCursorResult(this.interactionParam.type, angle * RAD2DEG);
  }
}
