import type { VFXItem } from '@galacean/effects';
import { MouseButton, MouseButtonMask, spec, TextComponent, Texture, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { Plane } from '@galacean/effects-math/es/extension/index';
import { Box2, Circle, Line2, roundNumber } from '@galacean/effects-math/es/extension/index';
import type { Matrix3 } from '../../math';
import { Euler, EulerOrder, Vector2, Vector3, Matrix4, isEqual, RAD2DEG, Quaternion, getBoxCorners, getBoxTransform, getBoxTransformFromBox, getTransformedBoxCorners, getVector2Angle, transformBoxPoint, transformedBoxContainsPoint } from '../../math';
import { Gizmo } from '../../gizmo';
import { GizmoViewportUtils } from '../../viewport/viewport-utils';
import type { GizmoOwner } from '../../gizmo-owner';
import { GizmoType } from '../../gizmo-type';
import { GestureCursorType, type GestureCursorResult } from '../../cursor';
import {
  calculateAnchoredResize,
  type AnchoredResizeGeometry,
  type AnchoredResizeResult,
} from './anchored-resize';
import type { ResizeSelectionBehavior, ResizeSelectionConfig } from '../../configs/types';
import { resizeSelectionConfig } from '../../configs/builtin-configs';
import type { ConfigChange } from '../../configs/config-definition';
import {
  createInteractionPlane,
  viewPositionToWorld,
} from '../../viewport';
import { resizeFrameItem } from '../../frame/frame-resize';
import {
  decomposeItemTransform,
  getItemViewAnchor,
  getItemViewBox,
  getItemViewTransform,
  getItemWorldSize,
  isEffectsPlayerItem,
  isFramePlayerItem,
  isGeneratorPlayerItem,
  isGroupPlayerItem,
  isVideoGeneratorPlayerItem,
} from '../../items';
import {
  INFO_TEXT_FONT_SIZE,
  INFO_TEXT_FONT_FAMILY,
  toColor,
  measureControlTextCellHeight,
  measureTextWidth,
  truncateText,
  drawCorners,
  drawWithBoxTransform,
  fillRotatedRect,
  getRotatedBoxCorners,
} from '../../drawing';
import { TransformType } from './transform-types';

/** 单选信息标签的元素图标类型。 */
export enum ResizeSelectionIconType {
  /** 图片。 */
  IMAGE = 'image',
  /** 组合。 */
  GROUP = 'group',
  /** 文本。 */
  TEXT = 'text',
  /** 视频。 */
  VIDEO = 'video',
  /** 特效。 */
  EFFECTS = 'effects',
  /** 画板。 */
  FRAME = 'frame',
  /** 不显示图标。 */
  NULL = 'null',
}

/** 文本缩放开始时冻结的排版属性。 */
type TextResizeSnapshot = {
  /** 文本组件。 */
  component: TextComponent,
  /** 文本缩放模式。 */
  mode: 'font' | 'width',
  /** 初始字号。 */
  fontSize: number,
  /** 初始字体宽度偏移。 */
  fontOffset: number,
  /** 初始行高。 */
  lineHeight: number,
  /** 初始排版宽度。 */
  width: number,
  /** 初始排版高度。 */
  height: number,
};

/** 按下时冻结、用于计算绝对缩放结果的会话。 */
type AnchoredResizeSession = {
  /** 被缩放元素。 */
  item: VFXItem,
  /** 手柄类型。 */
  handleKind: 'edge' | 'corner',
  /** 世界空间缩放几何。 */
  geometry: AnchoredResizeGeometry,
  /** 初始手柄视口位置。 */
  initialHandleView: Vector2,
  /** 固定点视口位置。 */
  fixedPointView: Vector2,
  /** 指针到真实手柄的初始偏移。 */
  pointerToHandleView: Vector2,
  /** 初始局部位置。 */
  initialPosition: Vector3,
  /** 初始局部缩放。 */
  initialScale: Vector3,
  /** 父级世界坐标到局部坐标的旋转矩阵。 */
  parentWorldToLocal: Matrix4,
  /** 画板初始世界尺寸。 */
  initialWorldSize?: Vector2,
  /** 画板初始局部尺寸。 */
  initialLocalSize?: Vector2,
  /** 文本排版快照。 */
  text?: TextResizeSnapshot,
  /** 画板已应用的累计位移。 */
  frameAppliedTranslation: Vector3,
  /** 本次元素采用整体缩放或排版尺寸调整。 */
  resizeBehavior?: ResizeSelectionBehavior,
  /** 上一帧由 Gizmo 写入的位置，用于识别自动布局产生的外部位移。 */
  lastAppliedPosition?: Vector3,
  /** 拖拽期间由外部布局累计写入的位置修正。 */
  externalTranslation?: Vector3,
};

/** 缩放角点的桌面端命中区域边长；视觉手柄仍由 scaleCircleSize 控制。 */
export const SCALE_CORNER_HIT_SIZE = 14;

/** 单选信息标签中的类型图标尺寸。 */
const INFO_ICON_SIZE = 15;

/** 信息文字的字形视觉位置高于字号框，单独下移以对齐图标。 */
const INFO_TEXT_BOTTOM = 1;

/** 图标相对选框顶边的底部偏移。 */
const INFO_ICON_BOTTOM = 5.5;

/** 将公开的缩放行为转换为几何计算使用的可变轴。 */
function getResizeAxis (behavior: ResizeSelectionBehavior): 'both' | 'x' | 'y' {
  return behavior === 'resize-x' ? 'x' : behavior === 'resize-y' ? 'y' : 'both';
}

/** 缩放选区 Gizmo 的交互配置。 */
export type ResizeSelectionGizmoOptions = {
  /** 是否允许缩放；关闭时仍绘制选区线框。 */
  interactive?: boolean,
};

/** 绘制选区线框，并通过边与角点手柄缩放选中元素。 */
export class ResizeSelectionGizmo extends Gizmo {
  readonly type: GizmoType = GizmoType.RESIZE_SELECTION;

  /** 光标结果。 */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  /** 当前光标视图坐标，用于绘制指针与变换原点，每 mousemove 更新。 */
  cursorPoint: Vector2 = new Vector2();

  /** ResizeSelection 手柄上一帧的 Control 本地坐标，用于缩放位移增量计算。 */
  lastPoint: Vector2 = new Vector2();

  /** 变换框线框数据。 */
  wireframe: ResizeSelectionWireframe;

  /** 交互类型。 */
  activeType: TransformType = TransformType.NULL;

  /** 上一帧鼠标射线碰撞位置。 */
  lastWorldPosition: Vector3 = new Vector3();

  /** 是否为锁定比例缩放。 */
  _isLockScale = true;

  /** 当前交互平面，initInteractionPlane 写入。 */
  interactionPlane: Plane;
  private configOff?: () => void;

  /** 边与角点共用一次绝对缩放快照。 */
  private resizeSession: AnchoredResizeSession | undefined;

  /** ResizeSelection 自身的缩放手柄是否持有输入；移动与角旋转由独立行为持有。 */
  private handlesActive = false;

  /** 是否忽略所有交互。 */
  private _ignoreInteraction = false;

  /** 当前单选元素的图标类型。 */
  private iconType: ResizeSelectionIconType;

  /** 类型图标纹理缓存（懒加载，URL 变化时刷新）。 */
  private iconTextures = new Map<ResizeSelectionIconType, Texture>();

  /** 类型图标纹理加载中的 Promise，避免重复发起加载。 */
  private iconTexturePromises = new Map<ResizeSelectionIconType, Promise<Texture>>();

  /** 缩放开关。 */
  private scaleEnabled = true;

  /** 是否允许当前 Gizmo 接收缩放输入。 */
  private readonly interactionEnabled: boolean;

  /**
   * 创建选区缩放 Gizmo 并监听配置变化。
   * @param owner Gizmo 宿主。
   * @param options 缩放交互配置。
   */
  constructor (owner: GizmoOwner, options: ResizeSelectionGizmoOptions = {}) {
    super(owner);
    this.interactionEnabled = options.interactive !== false;
    this.configOff = owner.getConfigManager().onChange(
      resizeSelectionConfig,
      change => {
        this.onConfigChange(change);
      },
    );

    this.wireframe = {
      edges: [],
      transform: undefined,
      anchor: new Vector2(),
      scaleCorners: [],
      widthScaleAreas: [],
      interactive: true,
      cornerEnable: true,
      box: new Box2(),
      totalBox: new Box2(),
      childrenTransforms: [],
      activeType: TransformType.NULL,
      interactiveDirection: new Vector2(),
      scaleCorner: new Vector2(),
      scaleEdgeCorners: [],
    };
  }

  /** 选中的元素列表（直读 selection）。 */
  get selectedItems (): VFXItem[] {
    return this._owner.getSelection().getSelectedPlayerItems();
  }

  /** 当前选区缩放配置。 */
  get config (): Readonly<ResizeSelectionConfig> {
    return this._owner.getConfigManager().get(resizeSelectionConfig);
  }

  /** 取是否锁定比例缩放。 */
  get isLockScale () {
    return this._isLockScale;
  }

  /**
   * 设置锁定比例缩放开关。
   * @param state 是否锁定比例。
   */
  set isLockScale (state: boolean) {
    if (state === this.isLockScale) {
      return;
    }

    this._isLockScale = state;
  }

  /** 取当前视口矩阵的水平缩放系数。 */
  get viewScale (): number {
    const viewportMatrix = this._owner.getEngine().sceneServer.compositions[0].camera.getViewportMatrix();
    const scale = new Vector3();

    viewportMatrix.decompose(new Vector3(), new Quaternion(), scale);

    return viewportMatrix.elements[0];
  }

  /** 取是否忽略所有交互。 */
  get ignoreInteraction () {
    return this._ignoreInteraction;
  }

  /**
   * 设置是否忽略交互，并同步角点可用状态。
   * @param state 是否忽略交互。
   */
  set ignoreInteraction (state: boolean) {
    if (state === this._ignoreInteraction) {
      return;
    }

    this._ignoreInteraction = state;
    this.wireframe.cornerEnable = state;
  }

  /**
   * 忽略键盘按下，修饰键状态由鼠标事件提供。
   * @param _keyCode 键盘按下事件。
   */
  override onKeyDown (_keyCode: InputEventKey): void {
    // 修饰键状态由鼠标事件提供。
  }

  /**
   * 忽略键盘抬起，修饰键状态由鼠标事件提供。
   * @param _keyCode 键盘抬起事件。
   */
  override onKeyUp (_keyCode: InputEventKey): void {
    // 修饰键状态由鼠标事件提供。
  }

  /**
   * 更新缩放手柄拖拽或悬停命中状态。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.isApplicableSelection()) {
      if (!this.handlesActive) {
        this.clearHandleHover();
      }

      return;
    }
    if (this.handlesActive) {
      const handled = this.updateHandleDrag(event);

      this._owner.setCursor(this.cursorResult);
      if (handled) {
        event.accept();
      }

      return;
    }
    const hover = this._owner.getMousePosition();

    this.refreshTransformType(hover);
    this.refreshCursorResult(this.activeType, getVector2Angle(this.wireframe.interactiveDirection));
    this._owner.setCursor(this.cursorResult);
    if (event.buttonMask === MouseButtonMask.None
      && (this.activeType === TransformType.SCALE
        || this.activeType === TransformType.WIDTH_SCALE)) {
      event.accept();
    }
  }

  /**
   * 继续当前缩放手柄拖拽。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.isApplicableSelection() || !this.handlesActive) {
      return;
    }
    const handled = this.updateHandleDrag(event);

    this._owner.setCursor(this.cursorResult);
    if (handled) {
      event.accept();
    }
  }

  /** 鼠标离开交互层时清除非拖拽状态下的手柄命中与光标。 */
  override onMouseLeave (): void {
    if (!this.isApplicableSelection()) {
      if (!this.handlesActive) {
        this.clearHandleHover();
      }

      return;
    }
    if (this.handlesActive) {
      this._owner.setCursor(this.cursorResult);

      return;
    }
    this.clearHandleHover();
  }

  /**
   * 命中缩放手柄时开始变换会话。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    // 步骤 1：校验选区、按键与点击次数。
    if (!this.isApplicableSelection()) {
      return;
    }
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.cursorPoint = new Vector2(event.position.x, event.position.y);

    if (event.doubleClick) {
      return;
    }

    // 步骤 2：刷新线框并解析按下位置的手柄类型。
    this.refreshWireframeBySelectedItems();
    this.refreshTransformType(this.cursorPoint);
    this.refreshCursorResult(this.activeType, getVector2Angle(this.wireframe.interactiveDirection));
    this._owner.setCursor(this.cursorResult);

    if (this.activeType === TransformType.NULL || this.activeType === TransformType.TRANSLATION) {
      return;
    }

    // 步骤 3：准备当前选区的吸附目标。
    this._owner.getSnapManager().reset();
    if (
      this._owner.getSnapManager().enabled
      && (this.activeType === TransformType.SCALE || this.activeType === TransformType.WIDTH_SCALE)
    ) {
      const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
      const composition = this._owner.getEngine().sceneServer.compositions[0];

      this._owner.getSnapManager().cacheSnapTargetsForSelection(
        composition?.items ?? [],
        this.selectedItems,
        containerSize,
      );
    }

    // 步骤 4：冻结缩放快照并通知宿主交互开始。
    this.lastPoint = new Vector2(event.position.x, event.position.y);
    this.handlesActive = true;
    this.beginTransformOperation();
    this._owner.emit('actionstart', {
      source: this,
      transformType: this.wireframe.activeType,
    });
    event.accept();
  }

  /**
   * 结束当前缩放手柄拖拽。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.handlesActive && this.finishHandleDrag(event)) {
      event.accept();
    }
  }

  /**
   * 刷新指针结果。
   * @param activeType 交互类型
   * @param angle 指针角度
   */
  refreshCursorResult (activeType: TransformType, angle = 0) {
    switch (activeType) {
      case TransformType.SCALE: {
        this.cursorResult = {
          type: GestureCursorType.SCALE,
          angle: (angle + Math.PI / 4) * RAD2DEG,
        };

        break;
      }
      case TransformType.WIDTH_SCALE: {
        this.cursorResult = {
          type: GestureCursorType.SCALE,
          angle: (angle + Math.PI / 4) * RAD2DEG,
        };

        break;
      }
      case TransformType.TRANSLATION:
      case TransformType.ROTATION:
      case TransformType.NULL: {
        this.cursorResult = {
          type: GestureCursorType.NORMAL,
          angle: 0,
        };

        break;
      }
    }
  }

  /** 在每帧更新时刷新选区线框及失效的光标状态。 */
  override onUpdate () {
    const lastActiveType = this.wireframe.activeType;

    this.refreshWireframeBySelectedItems();
    if (lastActiveType !== this.wireframe.activeType) {
      this.refreshCursorResult(this.wireframe.activeType);
    }
  }

  /**
   * 根据鼠标点位置判定当前交互类型（缩放/平移），
   * 并写入 activeType 与线框的交互方向、缩放角点；未命中则置 NULL。
   * @param point 视口坐标
   */
  refreshTransformType (point: Vector2) {
    // 步骤 1：重置当前命中状态。
    this.activeType = TransformType.NULL;
    this.wireframe.interactiveDirection = new Vector2();
    this.wireframe.scaleCorner = undefined;
    this.wireframe.scaleEdgeCorners = undefined;

    // 步骤 2：解析指针对应的变换类型。
    const type = this.computeTransformType(point);

    if (type === TransformType.NULL) {
      return;
    }

    this.activeType = type;
    this.wireframe.activeType = type;

    // 步骤 3：记录宽度手柄或缩放角点的交互方向。
    if (type === TransformType.WIDTH_SCALE) {
      const widthScaleArea = this.wireframe.widthScaleAreas.find(area => transformedBoxContainsPoint(area, point));

      if (widthScaleArea) {
        const center = transformBoxPoint(widthScaleArea, new Vector2(0.5, 0.5));

        this.wireframe.scaleCorner = center;
        this.wireframe.interactiveDirection.copyFrom(center).subtract(this.wireframe.box.getCenter());
      }
    } else if (type === TransformType.SCALE) {
      const scaleCorner = this.findScaleCorner(point);

      if (scaleCorner) {
        this.wireframe.scaleCorner = scaleCorner.center.clone();
        this.wireframe.interactiveDirection.copyFrom(scaleCorner.center).subtract(this.wireframe.box.getCenter());
      }
      if (!this.wireframe.scaleCorner) {
        const edge = this.findScaleEdge(point, this.isSingleTextSelection());

        if (edge) {
          const edgeCenter = edge.getCenter();

          this.wireframe.scaleCorner = edgeCenter;
          this.wireframe.scaleEdgeCorners = [edge.start.clone(), edge.end.clone()];
          this.wireframe.interactiveDirection.copyFrom(edgeCenter).subtract(this.wireframe.box.getCenter());
        }
      }
    }
  }

  /**
   * 根据选中元素刷新变换线框：计算包围盒、子元素盒与缩放角点；
   * 单选时根据元素类型决定图标类型；成组不生成缩放角点。
   */
  refreshWireframeBySelectedItems () {
    // 步骤 1：解析选区类型并重置线框数据。
    const { selectedItems, scaleEnabled } = this;
    const isSingleText = selectedItems.length === 1 && selectedItems[0].type === spec.ItemType.text;
    const transformEnabled = this.interactionEnabled && !this.hasLoadingSelection(selectedItems);

    this.iconType = selectedItems.length === 1
      ? this.getIconType(selectedItems[0])
      : ResizeSelectionIconType.NULL;

    const box = new Box2();
    let transform: Matrix3 | undefined;

    this.wireframe.edges = [];
    this.wireframe.transform = undefined;
    this.wireframe.scaleCorners = [];
    this.wireframe.widthScaleAreas = [];
    this.wireframe.childrenTransforms = [];

    this.wireframe.cornerEnable = scaleEnabled && transformEnabled;
    this.wireframe.interactive = transformEnabled;
    if (!transformEnabled) {
      this.activeType = TransformType.NULL;
      this.wireframe.activeType = TransformType.NULL;
    }

    // 步骤 2：计算单选或多选包围盒、锚点和子元素轮廓。
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);

    if (selectedItems.length > 1) {
      selectedItems.forEach(item => {
        if (item.isVisible) {
          const itemBox = getItemViewBox(item, containerSize);
          const itemTransform = getItemViewTransform(item, containerSize);

          if (!itemBox.isEmpty()) {
            box.union(itemBox);
          }
          if (itemTransform) {
            this.wireframe.childrenTransforms.push(itemTransform);
          }
        }
      });

      transform = getBoxTransformFromBox(box);
      this.wireframe.anchor = box.getCenter();
      this.wireframe.interactive = transformEnabled;
    } else if (selectedItems.length === 1) {
      const item = selectedItems[0];

      if (item.isVisible) {
        transform = getItemViewTransform(item, containerSize);
        box.copyFrom(getItemViewBox(item, containerSize));

        this.wireframe.anchor = isSingleText
          ? box.getCenter()
          : getItemViewAnchor(item, containerSize) ?? box.getCenter();
      }
    }

    const isBoxEmpty = box.isEmpty();
    const boxExpandScalar = isBoxEmpty || isSingleText ? 0 : 1;
    const totalBoxExpandScalar = isBoxEmpty ? 0 : 16;

    this.wireframe.activeType = !selectedItems.length ? TransformType.NULL : this.wireframe.activeType;

    this.wireframe.box.copyFrom(box).expandByScalar(boxExpandScalar);
    this.wireframe.totalBox.copyFrom(box).expandByScalar(totalBoxExpandScalar);
    this.wireframe.transform = transform;
    const points = transform ? getTransformedBoxCorners(transform) : undefined;

    // 步骤 3：根据最终包围盒创建四条边。
    points?.forEach((point, i) => {
      this.wireframe.edges.push(new Line2(point.clone(), points[(i + 1) % 4].clone()));
    });

    // 步骤 4：为单选文本创建宽度命中带，并为单选元素创建角点手柄。
    if (selectedItems.length === 1 && transformEnabled) {
      const { scaleCircleSize } = this.config;

      if (isSingleText) {
        const boxCorners = points;

        if (!boxCorners) {
          return;
        }
        // 左右命中带沿竖边展开，长度应取文本框高度，不能取宽度。
        const edgeLen = boxCorners[1].distance(boxCorners[2]);

        if (edgeLen > SCALE_CORNER_HIT_SIZE) {
          const { xAxis, yAxis } = this.boxLocalAxes();
          const halfLen = edgeLen / 2 - SCALE_CORNER_HIT_SIZE / 2;
          /**
           * 创建文本宽度边的命中区域。
           * @param mid 边中点。
           * @returns 旋转后的命中包围盒。
           */
          const buildEdgeHit = (mid: Vector2): Matrix3 | undefined => (
            getBoxTransform(getRotatedBoxCorners(mid, xAxis, yAxis, 4, halfLen))
          );
          const areas = [
            buildEdgeHit(new Line2(boxCorners[1], boxCorners[2]).at(0.5)),
            buildEdgeHit(new Line2(boxCorners[3], boxCorners[0]).at(0.5)),
          ];

          this.wireframe.widthScaleAreas = areas.filter((area): area is Matrix3 => !!area);
        }
      }

      points?.forEach(point => {
        this.wireframe.scaleCorners.push(new Circle(point, scaleCircleSize));
      });
    }
  }

  /**
   * 初始化当前变换的交互平面与缩放会话。
   * @param viewportPoint 指针视口坐标。
   */
  initInteractionPlane (viewportPoint: Vector2) {
    // 步骤 1：读取选中元素并按变换类型分流。
    const { selectedItems } = this;

    switch (this.wireframe.activeType) {
      case TransformType.SCALE: {
        // 步骤 2：为边或角点缩放冻结固定点与初始手柄。
        const selectedItem = selectedItems[0];

        if (!selectedItem) {
          this.resizeSession = undefined;

          break;
        }
        const { scaleCorner, scaleEdgeCorners } = this.wireframe;
        const itemTransform = decomposeItemTransform(selectedItem);
        const anchor = new Vector3().copyFrom(selectedItem.transform.anchor).applyMatrix(itemTransform.matrix);

        this.interactionPlane = createInteractionPlane(itemTransform.position, itemTransform.rotation);
        if (scaleEdgeCorners?.length === 2) {
          const initialHandleView = new Line2(scaleEdgeCorners[0], scaleEdgeCorners[1]).getCenter();
          const fixedPointView = this.oppositeScaleEdgeCenter(scaleEdgeCorners);

          this.resizeSession = fixedPointView
            ? this.createAnchoredResizeSession(
              selectedItem,
              itemTransform.matrix,
              anchor,
              viewportPoint,
              initialHandleView,
              fixedPointView,
              'edge',
            )
            : undefined;
        } else if (scaleCorner) {
          const fixedPointView = this.oppositeScaleCorner(scaleCorner);

          this.resizeSession = fixedPointView
            ? this.createAnchoredResizeSession(
              selectedItem,
              itemTransform.matrix,
              anchor,
              viewportPoint,
              scaleCorner,
              fixedPointView,
              'corner',
            )
            : undefined;
        } else {
          this.resizeSession = undefined;
        }

        break;
      }
      case TransformType.TRANSLATION: {
        // 步骤 3：为平移创建世界 XY 平面。
        this.interactionPlane = createInteractionPlane(new Vector3(), new Euler(0, 0, 0, EulerOrder.XYZ));

        break;
      }
      case TransformType.WIDTH_SCALE: {
        // 步骤 4：为文本宽度缩放冻结左右边几何。
        const selectedItem = selectedItems[0];
        const itemTransform = decomposeItemTransform(selectedItem);
        const anchor = new Vector3().copyFrom(selectedItem.transform.anchor).applyMatrix(itemTransform.matrix);
        const edge = this.draggedWidthEdge(this.wireframe.box.getCenter(), this.wireframe.interactiveDirection);

        this.interactionPlane = createInteractionPlane(itemTransform.position, itemTransform.rotation);
        const fixedPointView = edge
          ? this.oppositeScaleEdgeCenter([edge.start, edge.end])
          : undefined;

        this.resizeSession = edge && fixedPointView
          ? this.createAnchoredResizeSession(
            selectedItem,
            itemTransform.matrix,
            anchor,
            viewportPoint,
            edge.getCenter(),
            fixedPointView,
            'edge',
            'width',
          )
          : undefined;

        break;
      }
    }
  }

  /**
   * 绘制选区线框、缩放手柄与单选信息标签。
   * @param control 绘制控制器。
   */
  override draw (control: Control) {
    // 步骤 1：校验线框与当前选区变换状态。
    if (this.wireframe.box.isEmpty()) {
      return;
    }

    if (this._owner.getSelectionTransformKind() === 'move') {
      return;
    }

    // 步骤 2：读取绘制配置并绘制主线框与子元素轮廓。
    const {
      wireframeAlpha,
      wireframeColor,
      wireframeWidth,
      cornerFillColor,
      cornerLineWidth,
      cornerLineColor,
      cornerLineAlpha,
      infoShowEnabled,
      sizeTextColor,
      nameTextColor,
    } = this.config;

    const wireColor = toColor(wireframeColor, wireframeAlpha);

    this.wireframe.edges.forEach(edge => {
      control.drawLine(edge.start.x, edge.start.y, edge.end.x, edge.end.y, wireColor, wireframeWidth);
    });

    this.wireframe.childrenTransforms.forEach(childTransform => {
      drawCorners(control, getTransformedBoxCorners(childTransform), wireColor, wireframeWidth);
    });

    // 步骤 3：沿选框局部轴绘制方形缩放手柄。
    if (this.wireframe.cornerEnable) {
      const fillColor = toColor(cornerFillColor, 1);
      const strokeColor = toColor(cornerLineColor, cornerLineAlpha);
      const { xAxis, yAxis } = this.boxLocalAxes();

      this.wireframe.scaleCorners.forEach(corner => {
        const half = corner.radius;

        fillRotatedRect(control, corner.center, xAxis, yAxis, half * 2, half * 2, fillColor);
        drawCorners(control, getRotatedBoxCorners(corner.center, xAxis, yAxis, half, half), strokeColor, cornerLineWidth);
      });
    }

    // 步骤 4：为非文本单选元素绘制信息标签。
    const isSingleTextSelection = this.selectedItems.length === 1
      && this.selectedItems[0].type === spec.ItemType.text;

    if (this.selectedItems.length === 1 && infoShowEnabled && !isSingleTextSelection) {
      this.renderItemInfo(control, sizeTextColor, nameTextColor);
    }
  }

  /** 释放配置监听器。 */
  override dispose (): void {
    this.configOff?.();
    this.configOff = undefined;
    super.dispose();
  }

  /** @returns 当前是否存在可操作的选中元素。 */
  private isApplicableSelection (): boolean {
    const selectedItems = this.selectedItems;

    return selectedItems.length >= 1 && !this.hasLoadingSelection(selectedItems);
  }

  /** @returns 当前选区是否包含处于 loading 状态的元素。 */
  private hasLoadingSelection (items = this.selectedItems): boolean {
    const loadingManager = this._owner.getLoadingManager();

    return items.some(item => loadingManager.get(item.getInstanceId()) !== undefined);
  }

  /** 清除缩放手柄悬停状态并恢复默认光标。 */
  private clearHandleHover (): void {
    this.activeType = TransformType.NULL;
    this.wireframe.activeType = TransformType.NULL;
    this.wireframe.interactiveDirection = new Vector2();
    this.wireframe.scaleCorner = undefined;
    this.wireframe.scaleEdgeCorners = undefined;
    this.refreshCursorResult(TransformType.NULL);
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 根据指针位移更新缩放手柄交互。
   * @param event 鼠标拖拽事件。
   * @returns 是否处理了拖拽。
   */
  private updateHandleDrag (event: InputEventMouseMotion): boolean {
    if (!this.handlesActive) {
      return false;
    }

    const currentPoint = new Vector2(event.position.x, event.position.y);
    const shift = new Vector2().subtractVectors(currentPoint, this.lastPoint);

    if (!this.wireframe.interactive || shift.length() <= 0) {
      return true;
    }

    this._owner.setSelectionTransformKind('resize');
    const { activeType, interactiveDirection } = this.wireframe;

    let cursorRotation = 0;

    switch (activeType) {
      case TransformType.SCALE:
        cursorRotation = this.handleScale(shift, interactiveDirection, event);

        break;
      case TransformType.WIDTH_SCALE:
        cursorRotation = this.handleWidthScale(shift, interactiveDirection, event);

        break;
    }

    this.refreshCursorResult(activeType, cursorRotation);
    this.lastPoint.copyFrom(currentPoint);
    this._owner.emit('actionupdate', {
      source: this,
      transformType: this.wireframe.activeType,
    });

    return true;
  }

  /** 初始化一次变换算法需要的视口交互平面；事件由持有输入会话的 Gizmo 发出。 */
  private beginTransformOperation (): void {
    const viewportPoint = this.cursorPoint.clone();

    this.initInteractionPlane(viewportPoint);
    this.lastWorldPosition = viewPositionToWorld(viewportPoint, GizmoViewportUtils.getCameraInfo(this._owner.getEngine()), this.interactionPlane, GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!)) ?? new Vector3();
  }

  /** 清理一次变换算法运行态，不改写当前线框命中类型。 */
  private resetTransformOperation (): void {
    if (this._owner.getSelectionTransformKind() === 'resize') {
      this._owner.setSelectionTransformKind('idle');
    }
    this.handlesActive = false;
    this._owner.getSnapManager().reset();
    this.resizeSession = undefined;
    this.lastPoint = new Vector2();
    this.cursorPoint = new Vector2();
  }

  /**
   * 提交缩放手柄拖拽并清理会话。
   * @param event 鼠标抬起事件。
   * @returns 是否完成了提交。
   */
  private finishHandleDrag (event: InputEventMouseButton): boolean {
    const currentPoint = new Vector2(event.position.x, event.position.y);
    const shift = new Vector2().subtractVectors(currentPoint, this.lastPoint);

    this.cursorPoint.add(shift);
    if (this.wireframe.activeType === TransformType.SCALE && isEffectsPlayerItem(this.selectedItems[0])) {
      this._owner.emit('framerefreshchildren', {
        source: this,
        frameId: this.selectedItems[0].getInstanceId(),
      });
    }
    this.refreshAfterPointerUp(event);
    const transformType = this.wireframe.activeType;

    this.resetTransformOperation();
    this._owner.emit('actioncommit', { source: this, transformType });

    return true;
  }

  /**
   * 按最终指针位置刷新线框命中与光标。
   * @param _event 鼠标抬起事件。
   */
  private refreshAfterPointerUp (_event: InputEventMouseButton): void {
    this.refreshTransformType(this.cursorPoint);
    const { activeType, interactiveDirection } = this.wireframe;

    this.refreshCursorResult(activeType, getVector2Angle(interactiveDirection));
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 获取元素的信息标签图标类型。
   * @param item 播放器元素。
   * @returns 图标类型。
   */
  private getIconType (item: VFXItem): ResizeSelectionIconType {
    if (isFramePlayerItem(item)) {
      return ResizeSelectionIconType.FRAME;
    }
    if (isEffectsPlayerItem(item)) {
      return ResizeSelectionIconType.EFFECTS;
    }
    if (isGroupPlayerItem(item)) {
      return ResizeSelectionIconType.GROUP;
    }
    if (isGeneratorPlayerItem(item)) {
      return isVideoGeneratorPlayerItem(item)
        ? ResizeSelectionIconType.VIDEO
        : ResizeSelectionIconType.IMAGE;
    }

    switch (item.type) {
      case spec.ItemType.video:
        return ResizeSelectionIconType.VIDEO;
      case spec.ItemType.text:
        return ResizeSelectionIconType.TEXT;
      default:
        return ResizeSelectionIconType.IMAGE;
    }
  }

  /**
   * 获取元素的信息标签名称。
   * @param item 播放器元素。
   * @returns 显示名称。
   */
  private getItemInfoName (item: VFXItem): string {
    if (item.name !== '生成器') {
      return item.name;
    }

    return isVideoGeneratorPlayerItem(item) ? '视频生成器' : '图片生成器';
  }

  /** @returns 当前选框在视口中的局部单位轴。 */
  private boxLocalAxes (): { xAxis: Vector2, yAxis: Vector2 } {
    const points = this.wireframe.transform ? getTransformedBoxCorners(this.wireframe.transform) : undefined;

    if (!points?.length) {
      return { xAxis: new Vector2(1, 0), yAxis: new Vector2(0, 1) };
    }
    const xVec = new Vector2().subtractVectors(points[1], points[0]);
    const yVec = new Vector2().subtractVectors(points[3], points[0]);
    const xAxis = xVec.length() > 0 ? xVec.normalize() : new Vector2(1, 0);
    const yAxis = yVec.length() > 0 ? yVec.normalize() : new Vector2(0, 1);

    return { xAxis, yAxis };
  }

  /**
   * 查找文本宽度交互正在拖动的边。
   * @param center 选框中心。
   * @param interactiveDirection 交互方向。
   * @returns 当前被拖动的边。
   */
  private draggedWidthEdge (center: Vector2, interactiveDirection: Vector2): Line2 | undefined {
    const points = this.wireframe.transform ? getTransformedBoxCorners(this.wireframe.transform) : undefined;

    if (!points?.length) {
      return undefined;
    }
    const edgeA = new Line2(points[1], points[2]);
    const edgeB = new Line2(points[3], points[0]);
    const dotA = new Vector2().subtractVectors(edgeA.getCenter(), center).dot(interactiveDirection);
    const dotB = new Vector2().subtractVectors(edgeB.getCenter(), center).dot(interactiveDirection);

    return dotA >= dotB ? edgeA : edgeB;
  }

  /** 是否为单个文字元素选区。 */
  private isSingleTextSelection (): boolean {
    return this.selectedItems.length === 1 && this.selectedItems[0].type === spec.ItemType.text;
  }

  /**
   * 命中线框边缩放区域。角点由调用方优先判定，边命中采用到线段的屏幕距离，
   * 因而旋转元素也沿真实边工作，而不是沿轴对齐 AABB 工作。
   * @param point 视口指针
   * @param textVerticalOnly 单文本时只开放上/下边；左/右边保留给文字宽度手柄
   */
  private findScaleEdge (point: Vector2, textVerticalOnly = false): Line2 | undefined {
    if (!this.scaleEnabled || this.selectedItems.length !== 1) {
      return undefined;
    }

    for (let i = 0; i < this.wireframe.edges.length; i++) {
      // 四角顺序下，1/3 是左、右竖边（文字宽度），0/2 是上、下横边（文字字号）。
      if (textVerticalOnly && i % 2 === 1) {
        continue;
      }
      const edge = this.wireframe.edges[i];
      const closest = edge.closestPointToPoint(point, true);

      if (closest.distance(point) <= this.config.scaleCircleSize) {
        return edge;
      }
    }

    return undefined;
  }

  /**
   * 查找指针命中的缩放角点。
   * @param point 指针视口坐标。
   * @returns 命中的缩放角点。
   */
  private findScaleCorner (point: Vector2): Circle | undefined {
    if (!this.wireframe.scaleCorners.length) {
      return undefined;
    }

    const { xAxis, yAxis } = this.boxLocalAxes();
    const halfSize = SCALE_CORNER_HIT_SIZE / 2;

    return this.wireframe.scaleCorners.find(corner => {
      const offset = new Vector2().subtractVectors(point, corner.center);

      return Math.abs(offset.dot(xAxis)) <= halfSize
        && Math.abs(offset.dot(yAxis)) <= halfSize;
    });
  }

  /**
   * 获取被拖边对边的中点。
   * @param scaleEdgeCorners 被拖边的两个端点。
   * @returns 对边中点。
   */
  private oppositeScaleEdgeCenter (scaleEdgeCorners: Vector2[]): Vector2 | undefined {
    const { edges } = this.wireframe;

    if (scaleEdgeCorners.length !== 2 || edges.length !== 4) {
      return undefined;
    }
    const draggedEdge = new Line2(scaleEdgeCorners[0], scaleEdgeCorners[1]);
    const reversedDraggedEdge = new Line2(scaleEdgeCorners[1], scaleEdgeCorners[0]);
    const draggedIndex = edges.findIndex(edge => (
      edge.equals(draggedEdge) || edge.equals(reversedDraggedEdge)
    ));

    if (draggedIndex < 0) {
      return undefined;
    }

    return edges[(draggedIndex + 2) % edges.length].getCenter();
  }

  /**
   * 获取被拖角点的对角点。
   * @param scaleCorner 被拖角点。
   * @returns 对角点。
   */
  private oppositeScaleCorner (scaleCorner: Vector2): Vector2 | undefined {
    const points = this.wireframe.transform ? getTransformedBoxCorners(this.wireframe.transform) : undefined;

    if (!points?.length) {
      return undefined;
    }
    const draggedIndex = points.findIndex(point => point.equals(scaleCorner));

    return draggedIndex < 0 ? undefined : points[(draggedIndex + 2) % points.length].clone();
  }

  /**
   * 创建按下时冻结的绝对缩放会话。
   * @param item 被缩放元素。
   * @param itemMatrix 元素世界矩阵。
   * @param transformOrigin 变换原点。
   * @param viewportPoint 指针视口坐标。
   * @param initialHandleView 初始手柄视口位置。
   * @param fixedPointView 固定点视口位置。
   * @param handleKind 手柄类型。
   * @param textResizeMode 文本缩放模式。
   * @returns 缩放会话；坐标转换失败时返回 undefined。
   */
  private createAnchoredResizeSession (
    item: VFXItem,
    itemMatrix: Matrix4,
    transformOrigin: Vector3,
    viewportPoint: Vector2,
    initialHandleView: Vector2,
    fixedPointView: Vector2,
    handleKind: AnchoredResizeSession['handleKind'],
    textResizeMode: TextResizeSnapshot['mode'] = 'font',
  ): AnchoredResizeSession | undefined {
    // 步骤 1：将手柄与固定点投影到交互平面。
    const cameraInfo = GizmoViewportUtils.getCameraInfo(this._owner.getEngine());
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const initialHandle = viewPositionToWorld(initialHandleView, cameraInfo, this.interactionPlane, containerSize);
    const fixedPoint = viewPositionToWorld(fixedPointView, cameraInfo, this.interactionPlane, containerSize);

    if (!initialHandle || !fixedPoint) {
      return undefined;
    }

    // 步骤 2：冻结父级矩阵与元素类型相关属性。
    const parentWorldToLocal = new Matrix4().copyFrom(item.transform.getParentMatrix() ?? new Matrix4());

    parentWorldToLocal.setPosition(new Vector3()).invert();
    const textComponent = item.type === spec.ItemType.text ? item.getComponent(TextComponent) : undefined;
    const frame = isFramePlayerItem(item);
    const resizeOrigin = textComponent || frame
      ? initialHandle.clone().add(fixedPoint).multiply(0.5)
      : transformOrigin.clone();
    const text = textComponent
      ? {
        component: textComponent,
        mode: textResizeMode,
        fontSize: textComponent.textStyle.fontSize,
        fontOffset: textComponent.textStyle.fontOffset,
        lineHeight: textComponent.textLayout.lineHeight,
        width: textComponent.textLayout.width,
        height: textComponent.textLayout.height,
      }
      : undefined;

    // 步骤 3：组装后续帧只读的绝对缩放快照。
    return {
      item,
      handleKind,
      geometry: {
        initialHandle,
        fixedPoint,
        resizeOrigin,
        worldToLocalRotation: new Matrix4().extractRotation(itemMatrix).invert(),
      },
      initialHandleView,
      fixedPointView,
      pointerToHandleView: viewportPoint.clone().subtract(initialHandleView),
      initialPosition: new Vector3().copyFrom(item.transform.position),
      initialScale: new Vector3().copyFrom(item.transform.scale),
      parentWorldToLocal,
      initialWorldSize: frame ? getItemWorldSize(item) : undefined,
      initialLocalSize: frame ? new Vector2().copyFrom(item.transform.size) : undefined,
      text,
      frameAppliedTranslation: new Vector3(),
      resizeBehavior: this.config.resolveResizeBehavior?.(item.getInstanceId()) ?? 'scale',
      externalTranslation: new Vector3(),
    };
  }

  /**
   * 按 ResizeSelectionIconType 取对应配置的图标 URL。
   * @param type 图标类型
   * @returns 图标 URL；NULL 类型返回空字符串
   */
  private getIconUrl (type: ResizeSelectionIconType): string {
    const urlMap: Record<ResizeSelectionIconType, string> = {
      'null': '',
      'image': this.config.imageLogoUrl,
      'group': this.config.groupLogoUrl,
      'text': this.config.textLogoUrl,
      'video': this.config.videoLogoUrl,
      'frame': this.config.frameLogoUrl,
      'effects': this.config.effectsLogoUrl,
    };

    return urlMap[type];
  }

  /**
   * 配置变更时刷新类型图标纹理：URL 变化的图标销毁旧纹理并清空缓存，
   * 下次 draw 时会按新 URL 懒加载。
   * @param previous 变更前配置
   * @param current 变更后配置
   */
  private refreshIconSprites (
    previous: Readonly<ResizeSelectionConfig>,
    current: Readonly<ResizeSelectionConfig>,
  ): void {
    const logoKeys: { type: ResizeSelectionIconType, key: keyof ResizeSelectionConfig }[] = [
      { type: ResizeSelectionIconType.IMAGE, key: 'imageLogoUrl' },
      { type: ResizeSelectionIconType.GROUP, key: 'groupLogoUrl' },
      { type: ResizeSelectionIconType.TEXT, key: 'textLogoUrl' },
      { type: ResizeSelectionIconType.VIDEO, key: 'videoLogoUrl' },
      { type: ResizeSelectionIconType.FRAME, key: 'frameLogoUrl' },
      { type: ResizeSelectionIconType.EFFECTS, key: 'effectsLogoUrl' },
    ];

    for (const { type, key } of logoKeys) {
      if (previous[key] !== current[key]) {
        const texture = this.iconTextures.get(type);

        if (texture && !texture.isDestroyed) {
          texture.offloadData();
        }
        this.iconTextures.delete(type);
        this.iconTexturePromises.delete(type);
      }
    }
  }

  /**
   * 根据配置变化刷新图标纹理缓存。
   * @param change 选区缩放配置变更。
   */
  private onConfigChange (change: ConfigChange<ResizeSelectionConfig>): void {
    this.refreshIconSprites(change.previous, change.current);
  }

  /**
   * 获取类型图标纹理（懒加载）。
   * 命中且未销毁则直接返回；否则发起一次异步加载并返回 undefined（本帧跳过图标，
   * 加载完成后由持续渲染循环自动重绘）。
   * @param type 图标类型
   * @param engine effects 引擎实例（取自 control）
   * @returns 命中的纹理；未命中或加载中时返回 undefined
   */
  private getIconTexture (type: ResizeSelectionIconType, engine: Control['engine']): Texture | undefined {
    if (type === ResizeSelectionIconType.NULL) {
      return undefined;
    }
    const cached = this.iconTextures.get(type);

    if (cached && !cached.isDestroyed) {
      return cached;
    }
    if (!this.iconTexturePromises.has(type)) {
      const url = this.getIconUrl(type);

      if (!url) {
        return undefined;
      }
      const promise = Texture.fromImage(url, engine).then(texture => {
        this.iconTextures.set(type, texture);

        return texture;
      });

      this.iconTexturePromises.set(type, promise);
    }

    return undefined;
  }

  /**
   * 绘制单选元素的名称、尺寸与类型图标。
   * @param control 绘制控制器。
   * @param sizeTextColor 尺寸文本颜色。
   * @param nameTextColor 名称文本颜色。
   */
  private renderItemInfo (control: Control, sizeTextColor: number, nameTextColor: number): void {
    // 步骤 1：计算元素名称、像素尺寸与图标纹理。
    const item = this.selectedItems[0];
    const name = this.getItemInfoName(item);
    const corners = this.wireframe.transform ? getTransformedBoxCorners(this.wireframe.transform) : getBoxCorners(this.wireframe.box);
    const boxWidth = Math.round(corners[0].distance(corners[1]) / this.viewScale * this.config.contentRatio / this.config.pixelRatio);
    const boxHeight = Math.round(corners[1].distance(corners[2]) / this.viewScale * this.config.contentRatio / this.config.pixelRatio);
    const size = [boxWidth, boxHeight];

    const iconTexture = this.getIconTexture(this.iconType, control.engine);

    // 步骤 2：查找屏幕最上方的选框边并计算旋转角。
    const topCorner = corners[0].clone();
    const anotherCorner = new Vector2();

    corners.forEach(corner => {
      if (corner.y < topCorner.y) {
        topCorner.copyFrom(corner);
      }
    });

    let init = false;

    corners.forEach(corner => {
      if (corner.equals(topCorner)) {
        return;
      }
      if (!init) {
        anotherCorner.copyFrom(corner);
        init = true;
      } else if (corner.y - topCorner.y <= anotherCorner.y - topCorner.y) {
        anotherCorner.copyFrom(corner);
      }
    });

    const leftCorner = topCorner.x < anotherCorner.x ? topCorner : anotherCorner;
    const rightCorner = topCorner.x > anotherCorner.x ? topCorner : anotherCorner;
    const rotation = new Vector2().subtractVectors(rightCorner, leftCorner).angle();

    const viewBoxWidth = leftCorner.distance(rightCorner);

    // 步骤 3：根据顶边可用宽度裁剪名称与尺寸文本。
    let sizeStr = size.map(s => roundNumber(s, 0)).join(' * ');
    const sizeTextWidth = measureTextWidth(sizeStr);

    if (viewBoxWidth < sizeTextWidth * 2) {
      sizeStr = '';
    }

    let nameStr = ` ${name}`;
    const nameTextWidth = measureTextWidth(nameStr);

    if ((20 + nameTextWidth + sizeTextWidth) > viewBoxWidth) {
      if (viewBoxWidth < sizeTextWidth * 2) {
        sizeStr = '';
        nameStr = truncateText(nameStr, viewBoxWidth - 20);
      } else {
        const availableNameWidth = viewBoxWidth - 20 - sizeTextWidth - 5;

        nameStr = truncateText(nameStr, availableNameWidth);
      }
    }

    // 步骤 4：建立标签局部坐标轴与文本基线。
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const ex = new Vector2(cos, sin);
    const ey = new Vector2(-sin, cos);

    const textCellTop = -INFO_TEXT_BOTTOM - measureControlTextCellHeight(
      INFO_TEXT_FONT_SIZE,
      INFO_TEXT_FONT_FAMILY,
      undefined,
      undefined,
      control.engine.displayServer.pixelRatio,
    );

    // 步骤 5：依次绘制图标、尺寸和名称。
    if (iconTexture && !iconTexture.isDestroyed) {
      const anchor = leftCorner.clone().subtract(ey.clone().multiply(INFO_ICON_BOTTOM + INFO_ICON_SIZE));

      drawWithBoxTransform(
        control,
        anchor,
        ex,
        ey,
        () => {
          control.drawTexture(0, 0, INFO_ICON_SIZE, INFO_ICON_SIZE, iconTexture);
        },
      );
    }

    if (sizeStr) {
      const anchor = rightCorner.clone();
      const textWidth = measureTextWidth(sizeStr);

      drawWithBoxTransform(
        control,
        anchor,
        ex,
        ey,
        () => {
          control.drawText(-textWidth, textCellTop, sizeStr, INFO_TEXT_FONT_SIZE, toColor(sizeTextColor, 1), INFO_TEXT_FONT_FAMILY);
        },
      );
    }

    if (nameStr) {
      const anchor = leftCorner.clone().add(ex.clone().multiply(20));

      drawWithBoxTransform(
        control,
        anchor,
        ex,
        ey,
        () => {
          control.drawText(0, textCellTop, nameStr, INFO_TEXT_FONT_SIZE, toColor(nameTextColor, 1), INFO_TEXT_FONT_FAMILY);
        },
      );
    }
  }

  /**
   * 纯判定：鼠标点命中的交互类型（缩放/平移），未命中返回 NULL。
   * 只读，不写 activeType/wireframe。供 refreshTransformType 复用。
   * @param point 视口坐标
   */
  private computeTransformType (point: Vector2): TransformType {
    if (!this.wireframe.interactive || !this.wireframe.totalBox.containsPoint(point)) {
      return TransformType.NULL;
    }

    // 角点优先于边，避免角点附近被边缩放抢占。
    if (this.scaleEnabled) {
      if (this.findScaleCorner(point)) {
        return TransformType.SCALE;
      }
    }

    // 单文本左右边线宽度回流命中带（多边形命中，适配旋转边线带）。
    for (const widthScaleArea of this.wireframe.widthScaleAreas) {
      if (transformedBoxContainsPoint(widthScaleArea, point)) {
        return TransformType.WIDTH_SCALE;
      }
    }

    if (this.scaleEnabled) {
      if (this.findScaleEdge(point, this.isSingleTextSelection())) {
        return TransformType.SCALE;
      }
    }

    // 其次判断平移交互
    if (this.wireframe.transform && transformedBoxContainsPoint(this.wireframe.transform, point)) {
      return TransformType.TRANSLATION;
    }

    return TransformType.NULL;
  }

  /**
   * 处理角点或边缩放交互。
   * @param shift 本次鼠标位移增量。
   * @param interactiveDirection 交互方向向量。
   * @param event 鼠标拖拽事件。
   * @returns 光标旋转角度。
   */
  private handleScale (shift: Vector2, interactiveDirection: Vector2, event: InputEventMouseMotion): number {
    const pointerView = this.cursorPoint.add(shift).clone();

    return this.handleAnchoredResize(pointerView, interactiveDirection, event);
  }

  /**
   * 根据按下快照计算并应用绝对缩放。
   * @param pointerView 当前指针视口位置。
   * @param interactiveDirection 初始交互方向。
   * @param event 鼠标拖拽事件。
   * @returns 光标旋转角度。
   */
  private handleAnchoredResize (
    pointerView: Vector2,
    interactiveDirection: Vector2,
    event: InputEventMouseMotion,
  ): number {
    // 步骤 1：校验会话并将指针还原到真实手柄位置。
    const session = this.resizeSession;

    if (!session) {
      return getVector2Angle(interactiveDirection);
    }

    const handleView = pointerView.clone().subtract(session.pointerToHandleView);
    const snappedHandleView = this.snapHandlePoint(handleView);
    let targetHandleView = snappedHandleView;

    // 步骤 2：边手柄投影到单轴，并计算当前光标方向。
    if (session.handleKind === 'edge') {
      const resizeAxis = new Vector2().subtractVectors(session.initialHandleView, session.fixedPointView);
      const initialViewLength = resizeAxis.length();

      if (isEqual(initialViewLength, 0)) {
        return getVector2Angle(interactiveDirection);
      }
      resizeAxis.divide(initialViewLength);
      const projectedViewLength = new Vector2()
        .subtractVectors(snappedHandleView, session.fixedPointView)
        .dot(resizeAxis);

      targetHandleView = session.fixedPointView.clone().add(resizeAxis.multiply(projectedViewLength));
    }
    const currentHandleDirection = new Vector2().subtractVectors(targetHandleView, session.fixedPointView);
    const cursorDirection = isEqual(currentHandleDirection.length(), 0)
      ? interactiveDirection
      : currentHandleDirection;

    // 步骤 3：将目标手柄投影到世界交互平面。
    const handleWorld = viewPositionToWorld(
      targetHandleView,
      GizmoViewportUtils.getCameraInfo(this._owner.getEngine()),
      this.interactionPlane,
      GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
    );

    if (!handleWorld) {
      return getVector2Angle(cursorDirection);
    }

    // 步骤 4：解析比例约束，计算并应用缩放结果。
    const resizeBehavior = session.resizeBehavior ?? 'scale';
    const resizeAxis = getResizeAxis(resizeBehavior);
    const isFreeScaleByDefault = isFramePlayerItem(session.item) || resizeBehavior === 'resize';
    const isShiftFreeScale = isFreeScaleByDefault ? !event.shiftPressed : event.shiftPressed;
    const lockAspectRatio = session.text
      ? session.text.mode === 'font'
      : resizeAxis === 'both' && this.isLockScale && !isShiftFreeScale;
    const resize = calculateAnchoredResize(session.geometry, handleWorld, {
      handleKind: session.handleKind,
      lockAspectRatio,
      lockedAxis: resizeAxis === 'x' ? 'y' : resizeAxis === 'y' ? 'x' : undefined,
    });

    this.applyAnchoredResize(session, resize);
    this.lastWorldPosition.copyFrom(handleWorld);

    return getVector2Angle(cursorDirection);
  }

  /**
   * 将绝对缩放结果应用到会话快照。
   * @param session 缩放会话。
   * @param resize 绝对缩放结果。
   */
  private applyAnchoredResize (session: AnchoredResizeSession, resize: AnchoredResizeResult): void {
    // 步骤 1：读取按下时冻结的元素属性。
    const { item, initialScale, initialWorldSize, initialLocalSize, text } = session;

    if (text) {
      // 步骤 2：文本宽度模式更新排版宽度并补齐剩余缩放。
      if (text.mode === 'width') {
        const scalar = resize.totalScalar.x;
        const width = text.width * Math.abs(scalar);

        text.component.setTextWidth(width);
        const lineCount = text.component.getLineCount(text.component.text);

        text.component.setTextHeight(Math.ceil(text.lineHeight * lineCount));
        // 排版属性只表达正宽度，transform 补齐越过固定边后的绝对比例。
        const initialBaseWidth = text.width + text.fontOffset;
        const currentBaseWidth = width + text.fontOffset;
        const propertyScalar = isEqual(initialBaseWidth, 0)
          ? Math.abs(scalar)
          : currentBaseWidth / initialBaseWidth;
        const residualScalar = isEqual(propertyScalar, 0) ? 0 : Math.abs(scalar) / propertyScalar;

        item.transform.setScale(
          initialScale.x * residualScalar,
          initialScale.y,
          initialScale.z,
        );
        this.setResizePosition(session, resize.totalTranslation);

        const composition = this._owner.getEngine().sceneServer.compositions[0];

        composition?.gotoAndStop(composition.time);

        return;
      }

      // 步骤 3：文本字号模式同步字号、行高、排版尺寸与剩余缩放。
      const magnitude = Math.max(Math.abs(resize.totalScalar.x), Math.abs(resize.totalScalar.y));
      const propertyScalar = Math.max(magnitude, 1 / text.fontSize);
      // fontOffset 是渲染宽度中的固定留白，排版宽度补齐它，避免用单轴 scale 拉伸字形。
      const width = Math.max(0, (text.width + text.fontOffset) * propertyScalar - text.fontOffset);
      const height = text.height * propertyScalar;

      text.component.setFontSize(text.fontSize * propertyScalar);
      text.component.setLineHeight(text.lineHeight * propertyScalar);
      text.component.setTextWidth(width);
      text.component.setTextHeight(height);
      // 字号的最小值由统一的 transform 比例补偿。换行数与高度取整都不能改变字形比例。
      const residualScalar = magnitude / propertyScalar;

      item.transform.setScale(
        initialScale.x * residualScalar,
        initialScale.y * residualScalar,
        initialScale.z,
      );
      this.setResizePosition(session, resize.totalTranslation);

      const composition = this._owner.getEngine().sceneServer.compositions[0];

      composition?.gotoAndStop(composition.time);

      return;
    }

    // 步骤 4：画板按绝对尺寸与增量位移更新。
    if (isFramePlayerItem(item) && initialWorldSize && initialLocalSize) {
      const translationDelta = resize.totalTranslation.clone().subtract(session.frameAppliedTranslation);

      resizeFrameItem(
        item,
        new Vector2(
          initialWorldSize.x * resize.totalScalar.x,
          initialWorldSize.y * resize.totalScalar.y,
        ),
        translationDelta,
        { localSize: initialLocalSize, worldSize: initialWorldSize },
      );
      session.frameAppliedTranslation.copyFrom(resize.totalTranslation);

      return;
    }

    // 步骤 5：普通元素直接应用绝对缩放与位移。
    item.transform.setScale(
      initialScale.x * resize.totalScalar.x,
      initialScale.y * resize.totalScalar.y,
      initialScale.z * resize.totalScalar.z,
    );
    this.setResizePosition(session, resize.totalTranslation);
  }

  /**
   * 将世界总位移转换到父级局部坐标并写入位置。
   * @param session 缩放会话。
   * @param totalWorldTranslation 世界空间累计位移。
   */
  private setResizePosition (session: AnchoredResizeSession, totalWorldTranslation: Vector3): void {
    const localTranslation = totalWorldTranslation.clone().applyMatrix(session.parentWorldToLocal);
    const resizeBehavior = session.resizeBehavior ?? 'scale';
    const resizeAxis = getResizeAxis(resizeBehavior);
    const externalTranslation = session.externalTranslation ??= new Vector3();

    if (resizeAxis !== 'both' && session.lastAppliedPosition) {
      externalTranslation.add(
        new Vector3().subtractVectors(session.item.transform.position, session.lastAppliedPosition),
      );
    }
    const position = session.initialPosition.clone().add(localTranslation).add(externalTranslation);

    session.item.transform.setPosition(...position.toArray());
    session.lastAppliedPosition = position;
  }

  /**
   * 处理文本左右边的宽度缩放。
   * @param shift 本次鼠标位移增量。
   * @param interactiveDirection 交互方向向量。
   * @param event 鼠标拖拽事件。
   * @returns 光标旋转角度。
   */
  private handleWidthScale (shift: Vector2, interactiveDirection: Vector2, event: InputEventMouseMotion): number {
    const pointerView = this.cursorPoint.add(shift).clone();

    return this.handleAnchoredResize(pointerView, interactiveDirection, event);
  }

  /**
   * 将手柄位置吸附到最近目标。
   * @param point 原始手柄位置。
   * @returns 吸附后的手柄位置。
   */
  private snapHandlePoint (point: Vector2): Vector2 {
    const snapManager = this._owner.getSnapManager();

    snapManager.clearSnappingVisualizations();
    if (!snapManager.enabled) {
      return point;
    }

    snapManager.preparePoint(new Vector2(), point);

    return point.clone().subtract(new Vector2(
      snapManager.result.x ?? 0,
      snapManager.result.y ?? 0,
    ));
  }

}

/** 选区线框的视口几何与交互状态。 */
export type ResizeSelectionWireframe = {
  /** 线框四条边 */
  edges: Line2[],
  /** 主线框归一化 Box2 到视图的变换 */
  transform?: Matrix3,
  /** 缩放角点碰撞圆 */
  scaleCorners: Circle[],
  /** 单文本左右两侧的宽度调整手柄 */
  widthScaleAreas: Matrix3[],
  /** 线框是否可交互 */
  interactive: boolean,
  /** 角点是否可点 */
  cornerEnable: boolean,
  /** 当前元素包围盒 */
  box: Box2,
  /** 变换锚点 */
  anchor: Vector2,
  /** 命中外扩包围盒（含角点区域） */
  totalBox: Box2,
  /** 多选时子元素的视图变换 */
  childrenTransforms: Matrix3[],
  /** 当前交互类型 */
  activeType: TransformType,
  /** 交互方向向量 */
  interactiveDirection: Vector2,
  /** 命中的缩放角点 */
  scaleCorner?: Vector2,
  /** 命中的缩放边的两端角点 */
  scaleEdgeCorners?: Vector2[],
};
