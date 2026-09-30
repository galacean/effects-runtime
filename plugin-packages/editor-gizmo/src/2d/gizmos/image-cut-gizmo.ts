import { Box2, Line2 } from '@galacean/effects-math/es/extension/index';
import { isEqual, RAD2DEG, Vector2, getBoxCorners, getTransformedBoxCorners, inverseTransformBoxPoint, scaleBox, setBoxFromPoints, transformedBoxContainsPoint, type Matrix3 } from '../math';
import type { ImageCutConfig } from '../configs/types';
import { imageCutConfig } from '../configs/builtin-configs';
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
 * 图片裁切工具结果
 */
export type ImageCutResult = {
  /** 归一化裁切盒，不依赖渲染帧投影。 */
  normalizeCutBox: Box2,
};

/** 图片裁剪在当前视口中的几何。 */
type ImageCutGeometry = {
  /** 图片元素包围盒。 */
  itemBox: Box2,
  /** 图片归一化 Box2 到视图的变换。 */
  boxTransform: Matrix3,
};

/**
 * 图片裁切缩放交互参数
 */
export type ImageCutScaleParam = {
  /** 交互类型 */
  type: ImageInteractionType.SCALE,
  /** 归一化裁切框 */
  box: Box2,
  /** 锚点（对角点） */
  anchor: Vector2,
  /** 归一化起始鼠标位置 */
  startMouse: Vector2,
  /** 归一化起始角点 */
  startCorner: Vector2,
  /** 锁定的宽高比 */
  lockedAspect?: number,
};

/**
 * 图片裁切交互参数
 */
export type ImageCutInteractionParam = ImageNoneParam | ImageCutScaleParam | ImageDirectionScaleParam | ImageMoveParam;

/**
 * 裁剪工具交互类型
 */
export type ImageCutInteractionType = ImageInteractionType;

/** 在图片元素范围内移动或缩放归一化裁剪框。 */
export class ImageCutGizmo extends Gizmo {
  result: ImageCutResult = {
    normalizeCutBox: new Box2(new Vector2(), new Vector2(1, 1)),
  };

  interactionParam: ImageCutInteractionParam = { type: ImageInteractionType.NONE };

  readonly type = GizmoType.IMAGE_CUT;

  /** 光标结果。 */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  /** 仅供当前渲染帧使用的几何快照；输入不读取它。 */
  private renderGeometry?: ImageCutGeometry;

  private _isLockScale = false;

  private mouseGrabbed = false;

  /** 当前图片裁剪配置。 */
  get config (): Readonly<ImageCutConfig> {
    return this._owner.getConfigManager().get(imageCutConfig);
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
   * 更新裁剪框交互或悬停状态。
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
   * 继续当前裁剪框拖拽。
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
   * 命中裁剪框交互区域时开始操作。
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
   * 结束裁剪框操作并提交结果。
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

  /** 为本帧绘制创建裁剪投影。 */
  override onUpdate (): void {
    this.renderGeometry = this.getSelectionGeometry();
  }

  /**
   * 绘制裁剪蒙版、网格、边框与角点。
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
      cutBoxLineWidth,
      cutBoxLineColor,
      cutBoxLineAlpha,
      itemBoxLineWidth,
      itemBoxLineColor,
      itemBoxLineAlpha,
      cutBoxCornerRadius,
      cutBoxCornerFillColor,
      cutBoxCornerLineWidth,
      cutBoxCornerLineColor,
      cutBoxCornerLineAlpha,
      gridLineWidth,
      gridLineColor,
      gridLineAlpha,
      gridCount,
    } = this.config;

    const itemCorners = getTransformedBoxCorners(geometry.boxTransform);
    const cutCorners = getTransformedBoxCorners(geometry.boxTransform, this.result.normalizeCutBox);

    // 步骤 2：绘制裁剪区域外的蒙版。
    const maskFill = toColor(maskColor, maskAlpha);

    fillBoxByCorners(control, [itemCorners[0], itemCorners[1], cutCorners[1], cutCorners[0]], maskFill);
    fillBoxByCorners(control, [itemCorners[1], itemCorners[2], cutCorners[2], cutCorners[1]], maskFill);
    fillBoxByCorners(control, [itemCorners[2], itemCorners[3], cutCorners[3], cutCorners[2]], maskFill);
    fillBoxByCorners(control, [itemCorners[3], itemCorners[0], cutCorners[0], cutCorners[3]], maskFill);

    // 步骤 3：绘制裁剪辅助网格。
    const gridColor = toColor(gridLineColor, gridLineAlpha);

    for (let i = 1; i <= gridCount; i++) {
      const ratio = i / (gridCount + 1);
      const top = cutCorners[0].clone().add(cutCorners[1].clone().subtract(cutCorners[0]).multiply(ratio));
      const bottom = cutCorners[3].clone().add(cutCorners[2].clone().subtract(cutCorners[3]).multiply(ratio));
      const left = cutCorners[0].clone().add(cutCorners[3].clone().subtract(cutCorners[0]).multiply(ratio));
      const right = cutCorners[1].clone().add(cutCorners[2].clone().subtract(cutCorners[1]).multiply(ratio));

      control.drawLine(top.x, top.y, bottom.x, bottom.y, gridColor, gridLineWidth);
      control.drawLine(left.x, left.y, right.x, right.y, gridColor, gridLineWidth);
    }

    // 步骤 4：绘制元素、裁剪框和角点。
    drawCorners(control, itemCorners, toColor(itemBoxLineColor, itemBoxLineAlpha), itemBoxLineWidth);
    drawCorners(control, cutCorners, toColor(cutBoxLineColor, cutBoxLineAlpha), cutBoxLineWidth);
    const cornerFill = toColor(cutBoxCornerFillColor, 1);
    const cornerStroke = toColor(cutBoxCornerLineColor, cutBoxCornerLineAlpha);

    cutCorners.forEach(corner => {
      control.fillCircle(corner.x, corner.y, cutBoxCornerRadius, cornerFill);
      control.drawCircle(corner.x, corner.y, cutBoxCornerRadius, cornerStroke, cutBoxCornerLineWidth);
    });
  }

  /**
   * 刷新指针结果。
   * @param activeType 交互类型
   * @param angle 指针方向
   */
  refreshCursorResult (activeType: ImageCutInteractionType, angle = 0) {
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
   * 获取当前裁切信息（裁切框 + 元素包围盒）。
   * @returns 裁切信息对象，不可交互时返回 undefined
   */
  getCutInfo () {
    const geometry = this.getSelectionGeometry();

    if (!geometry) {
      return undefined;
    }

    return {
      cutBox: this.result.normalizeCutBox.clone(),
      itemBox: geometry.itemBox,
    };
  }

  /**
   * 获取归一化裁切包围盒（min/max 取值 [0, 1]，相对元素包围盒）。
   */
  getCutBox () {
    if (!this.isApplicableSelection()) {
      return undefined;
    }

    return this.result.normalizeCutBox.clone();
  }

  /**
   * 设置归一化裁切包围盒（入参为归一化坐标，钳制到 [0, 1]）。
   * @param normalizeBox 归一化裁切包围盒
   * @returns 设置成功时返回更新后的裁切框，不可交互时返回 undefined
   */
  setCutBox (normalizeBox: Box2) {
    if (!this.isApplicableSelection()) {
      return undefined;
    }

    this.result.normalizeCutBox.copyFrom(normalizeBox);

    return this.result.normalizeCutBox.clone();
  }

  /** @returns 是否仅选中了一个可裁剪元素。 */
  private isApplicableSelection (): boolean {
    return this._owner.getSelection().getSelectedPlayerItems().length === 1;
  }

  /**
   * drag：按交互类型处理裁切框移动/缩放/单向缩放。
   * 支持 shift 锁定宽高比，结果以归一化裁切盒写入 result。
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

    // 步骤 3：按移动、角点缩放或边缩放更新归一化裁剪框。
    switch (this.interactionParam.type) {
      case ImageInteractionType.MOVE: {
        const { min: originMin, max: originMax } = box;

        const xMinShift = itemBoxMin.x - originMin.x;
        const xMaxShift = itemBoxMax.x - originMax.x;
        const yMinShift = itemBoxMin.y - originMin.y;
        const yMaxShift = itemBoxMax.y - originMax.y;

        shift.x = Math.min(Math.max(shift.x, xMinShift), xMaxShift);
        shift.y = Math.min(Math.max(shift.y, yMinShift), yMaxShift);

        const resultBox = box.clone().translate(shift);

        this.result.normalizeCutBox = resultBox;

        break;
      }
      case ImageInteractionType.SCALE: {
        const { startCorner, anchor } = this.interactionParam;
        const resultCorner = new Vector2();

        resultCorner.x = Math.min(Math.max(startCorner.x + shift.x, itemBoxMin.x), itemBoxMax.x);
        resultCorner.y = Math.min(Math.max(startCorner.y + shift.y, itemBoxMin.y), itemBoxMax.y);

        if (event.shiftPressed || this.isLockScale) {
          const cornerSignFactor = (startCorner.x - anchor.x) * (startCorner.y - anchor.y) >= 0 ? 1 : -1;
          const { x: boxWidth, y: boxHeight } = this.result.normalizeCutBox.getSize();
          const { x: originWidth, y: originHeight } = box.getSize();

          this.interactionParam.lockedAspect ??= boxWidth / boxHeight;

          if (Math.abs(resultCorner.x - anchor.x) / originWidth > Math.abs(resultCorner.y - anchor.y) / originHeight) {
            const resultSignFactor = Math.abs(resultCorner.x - anchor.x) / (resultCorner.x - anchor.x);
            const resultHeight = Math.abs(resultCorner.x - anchor.x) / this.interactionParam.lockedAspect;

            if (isEqual(startCorner.y, anchor.y)) {
              resultCorner.y = startCorner.y;
            } else {
              resultCorner.y = resultSignFactor * cornerSignFactor * resultHeight + anchor.y;
            }
            resultCorner.y = Math.min(Math.max(resultCorner.y, itemBoxMin.y), itemBoxMax.y);
            const shiftY = resultCorner.y - anchor.y;

            if (isEqual(startCorner.y, anchor.y)) {
              resultCorner.x = startCorner.x;
            } else {
              resultCorner.x = cornerSignFactor * shiftY * this.interactionParam.lockedAspect + anchor.x;
            }
          } else {
            const resultWidth = Math.abs(resultCorner.y - anchor.y) * this.interactionParam.lockedAspect;
            const resultSignFactor = Math.abs(resultCorner.y - anchor.y) / (resultCorner.y - anchor.y);

            if (isEqual(startCorner.x, anchor.x)) {
              resultCorner.x = startCorner.x;
            } else {
              resultCorner.x = resultSignFactor * cornerSignFactor * resultWidth + anchor.x;
            }
            resultCorner.x = Math.min(Math.max(resultCorner.x, itemBoxMin.x), itemBoxMax.x);
            const shiftX = resultCorner.x - anchor.x;

            if (isEqual(startCorner.x, anchor.x)) {
              resultCorner.y = startCorner.y;
            } else {
              resultCorner.y = cornerSignFactor * shiftX / this.interactionParam.lockedAspect + anchor.y;
            }
          }
        }

        if (isEqual(startCorner.x, anchor.x) || isEqual(startCorner.y, anchor.y)) {
          const boxCorners = getBoxCorners(box);
          const farthestCorner = boxCorners[0].clone();
          let length = farthestCorner.distance(startCorner);

          boxCorners.forEach(corner => {
            if (corner.distance(startCorner) > length) {
              farthestCorner.copyFrom(corner);
              length = corner.distance(startCorner);
            }
          });

          this.result.normalizeCutBox = setBoxFromPoints(new Box2(), [farthestCorner, resultCorner]);
        } else {
          const xScalar = (resultCorner.x - anchor.x) / (startCorner.x - anchor.x);
          const yScalar = (resultCorner.y - anchor.y) / (startCorner.y - anchor.y);

          const scalar = new Vector2(xScalar, yScalar);

          this.result.normalizeCutBox = scaleBox(box.clone(), scalar, anchor);
        }

        break;
      }
      case ImageInteractionType.DIRECTION_SCALE: {
        const { index } = this.interactionParam;
        const { x: boxWidth, y: boxHeight } = this.result.normalizeCutBox.getSize();

        this.interactionParam.lockedAspect ??= boxWidth / boxHeight;
        const boxCorners = getBoxCorners(box);
        const startPoint = boxCorners[index].clone();
        const nextCorner = boxCorners[(index + 1) % 4].clone();

        // 四角固定顺序中偶数索引是水平边、奇数索引是竖直边。
        const shiftDirection = index % 2 === 0 ? 'y' : 'x';

        if (shiftDirection === 'x') {
          shift.x = Math.min(Math.max(startPoint.x + shift.x, itemBoxMin.x), itemBoxMax.x) - startPoint.x;
          if (event.shiftPressed || this.isLockScale) {
            shift.y = shift.x / this.interactionParam.lockedAspect;
            const resuleTargetCornerY = nextCorner.y + shift.y;
            const clampResultCornerY = Math.min(Math.max(resuleTargetCornerY, itemBoxMin.y), itemBoxMax.y);

            shift.y = clampResultCornerY - nextCorner.y;
            shift.x = shift.y * this.interactionParam.lockedAspect;
          } else {
            shift.y = 0;
          }
        } else {
          shift.y = Math.min(Math.max(startPoint.y + shift.y, itemBoxMin.y), itemBoxMax.y) - startPoint.y;
          if (event.shiftPressed || this.isLockScale) {
            shift.x = -shift.y * this.interactionParam.lockedAspect;
            const resuleTargetCornerX = nextCorner.x + shift.x;
            const clampResultCornerX = Math.min(Math.max(resuleTargetCornerX, itemBoxMin.x), itemBoxMax.x);

            shift.x = clampResultCornerX - nextCorner.x;
            shift.y = -shift.x / this.interactionParam.lockedAspect;
          } else {
            shift.x = 0;
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
        this.result.normalizeCutBox = setBoxFromPoints(new Box2(), resultCorners);

        break;
      }
      default:
        break;
    }

    return true;
  }

  /** @returns 当前图片与裁剪框的视口投影。 */
  private getSelectionGeometry (): ImageCutGeometry | undefined {
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
   * 根据鼠标位置判定裁切框的交互类型（角点缩放/边线单向缩放/整体移动），
   * 同时刷新光标方向。
   * @param point 视图坐标鼠标位置
   * @param inputPosition Control 本地坐标鼠标位置
   */
  private refreshInteractionType (point: Vector2, inputPosition: Vector2) {
    // 步骤 1：重置交互状态并获取实时裁剪投影。
    this.interactionParam = {
      type: ImageInteractionType.NONE,
    };

    const geometry = this.getSelectionGeometry();

    if (!geometry) {
      return;
    }

    const itemCorners = getTransformedBoxCorners(geometry.boxTransform);
    const cutCorners = getTransformedBoxCorners(geometry.boxTransform, this.result.normalizeCutBox);
    let hasInteractionType = false;
    let angle = 0;

    // 步骤 2：优先检测角点缩放。
    cutCorners.forEach((corner, index) => {
      if (hasInteractionType) {
        return;
      }
      if (corner.distance(point) < this.config.scaleInteractionDistance) {
        hasInteractionType = true;
        this.interactionParam = {
          type: ImageInteractionType.SCALE,
          box: this.result.normalizeCutBox.clone(),
          startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
          startCorner: getBoxCorners(this.result.normalizeCutBox)[index],
          anchor: getBoxCorners(this.result.normalizeCutBox)[(index + 2) % 4],
        };

        const rotation = Math.atan2(itemCorners[1].y - itemCorners[0].y, itemCorners[1].x - itemCorners[0].x);

        angle = Math.PI / 2 * ((index + 3) % 4) + rotation;
      }
    });

    // 步骤 3：其次检测边缘单向缩放。
    cutCorners.forEach((corner, index) => {
      if (hasInteractionType) {
        return;
      }
      const edge = new Line2(corner.clone(), cutCorners[(index + 1) % 4]);
      const t = edge.distanceSq() === 0 ? 0 : edge.closestPointToPointParameter(point, true);
      const dis = { d: edge.at(t).distance(point), t };

      const state = dis.d >= 0 && dis.d <= 8 && dis.t >= 0 && dis.t <= 1;

      if (state) {
        hasInteractionType = true;
        this.interactionParam = {
          type: ImageInteractionType.DIRECTION_SCALE,
          index,
          box: this.result.normalizeCutBox.clone(),
          startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
        };
        const rotation = Math.atan2(itemCorners[1].y - itemCorners[0].y, itemCorners[1].x - itemCorners[0].x);

        angle = Math.PI / 2 * ((index + 3) % 4) + Math.PI / 4 + rotation;
      }
    });

    // 步骤 4：最后检测裁剪区域整体移动并刷新光标。
    if (transformedBoxContainsPoint(geometry.boxTransform, point, this.result.normalizeCutBox) && !hasInteractionType) {
      this.interactionParam = {
        type: ImageInteractionType.MOVE,
        box: this.result.normalizeCutBox.clone(),
        startMouse: inverseTransformBoxPoint(geometry.boxTransform, inputPosition),
      };

      hasInteractionType = true;
    }

    this.refreshCursorResult(this.interactionParam.type, angle * RAD2DEG);
  }
}
