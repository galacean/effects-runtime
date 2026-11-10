import { MouseButton, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoActionEvent } from '../gizmo-action';
import { RulerManager, type RulerDirection, type RulerGuides } from './ruler-manager';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType } from '../cursor';
import { Matrix3, Vector2 } from '../math';
import { getItemViewBox } from '../items';
import { toColor } from '../drawing';
import { rulerConfig, selectionSnapConfig } from '../configs/builtin-configs';
import type { ConfigChange } from '../configs/config-definition';
import type { RulerConfig, SnapConfig } from '../configs/types';
import type { SnapGuide } from '../selection/snap-manager';
import { GizmoViewportUtils, ndcSizeToViewSize } from '../viewport';

export type { RulerDirection, RulerGuides } from './ruler-manager';

/** 标尺提交事件携带最终参考线，宿主可据此记录历史或同步外部状态。 */
export interface RulerActionEvent extends GizmoActionEvent {
  /** 变更后的全部参考线，水平线记录 y，垂直线记录 x。 */
  guides: RulerGuides,
}

/** 当前选中的参考线，用于宿主快捷键和菜单操作。 */
export interface RulerSelection {
  /** 参考线方向。 */
  direction: RulerDirection,
  /** 参考线在对应方向数组中的索引。 */
  index: number,
  /** 参考线的文档坐标。 */
  value: number,
}

/** 参考线命中结果；index 为 -1 时表示从标尺带创建新参考线。 */
type GuideHit = { direction: RulerDirection, index: number };

type RulerRect = {
  x: number,
  y: number,
  width: number,
  height: number,
};

/** 顶部与左侧标尺带各自的命中区域。 */
type RulerHitRegion = {
  top: RulerRect,
  left: RulerRect,
};

type RulerLayout = {
  outerRect: RulerRect,
  contentRect: RulerRect,
  rulerSize: number,
};

/** 选中参考线位置标签的排版结果。 */
type GuidePositionLayout = {
  text: string,
  fontSize: number,
  box: RulerRect,
  textX: number,
  textY: number,
  rotated: boolean,
};

/** 横、纵标尺刻度统一使用的字号。 */
const RULER_TICK_FONT_SIZE = 10;
/** 刻度文字沿标尺轴向相对刻度线的偏移。 */
const RULER_TICK_LABEL_AXIS_OFFSET = 3;
/** 刻度文字沿标尺外侧相对边缘的内缩。 */
const RULER_TICK_LABEL_EDGE_OFFSET = 1;
/** 标尺与内容区交界线的线宽。 */
const RULER_BORDER_WIDTH = 1;
/** 兼容画布边框和 CSS 像素舍入造成的顶部/左侧命中误差。 */
const RULER_EDGE_HIT_TOLERANCE = 2;

/** 标尺刻度、参考线创建/移动/删除，设计像素与视口缩放独立。 */
export class RulerGizmo extends Gizmo {
  readonly type = GizmoType.RULER;
  /** 已提交的参考线数据由宿主共享管理，Gizmo 只保存交互预览。 */
  private readonly rulerManager: RulerManager;
  private readonly unregisterSnapGuides: () => void;
  private readonly configOff: () => void;
  private readonly snapConfigOff: () => void;
  private selected?: GuideHit;
  private drag?: GuideHit;
  /** 当前拖拽的可变副本；取消操作时丢弃，避免污染已提交状态。 */
  private preview?: RulerGuides;
  private offset = 0;
  /** 默认 Canvas 坐标系的固定文档原点，避免容器 resize 改变已存参考线坐标。 */
  private documentCenter?: Vector2;

  /**
   * 创建标尺 Gizmo。
   * @param owner Gizmo 宿主
   */
  constructor (owner: GizmoOwner) {
    super(owner);
    this.rulerManager = owner.getRulerManager?.() ?? new RulerManager();
    this.unregisterSnapGuides = owner.getSnapManager().registerGuideProvider(() => this.snapGuides());
    this.configOff = owner.getConfigManager().onChange(
      rulerConfig,
      change => this.onConfigChange(change),
    );
    this.snapConfigOff = owner.getConfigManager().onChange(
      selectionSnapConfig,
      change => this.onSnapConfigChange(change),
    );
  }

  /** 返回当前标尺配置。 */
  get config (): Readonly<RulerConfig> {
    return this._owner.getConfigManager().get(rulerConfig);
  }

  /** 返回参考线数据快照。 */
  get guides (): RulerGuides {
    return this.rulerManager.guides;
  }

  /** 设置参考线数据并隔离外部数组。 */
  private set guides (guides: RulerGuides) {
    this.rulerManager.setGuides(guides);
  }

  /**
   * 返回当前选中的参考线；选中状态失效时返回 undefined。
   * @returns 选中参考线的方向、索引和文档坐标
   */
  get selectedGuide (): RulerSelection | undefined {
    const guides = this.preview ?? this.guides;

    if (!this.isValidSelection(guides)) {
      return undefined;
    }
    const { direction, index } = this.selected!;

    return { direction, index, value: guides[direction][index] };
  }

  /** @returns 当前是否选中了可删除的参考线。 */
  hasSelectedGuide (): boolean {
    return this.config.enabled && this.selectedGuide !== undefined;
  }

  /**
   * 删除当前选中的参考线。
   *
   * 删除操作通过与拖拽相同的 actioncommit 事件通知宿主，事件携带更新后的快照。
   * @returns 是否删除了参考线
   */
  deleteRuler (): boolean {
    const selected = this.selectedGuide;

    if (!selected || this.drag) {
      return false;
    }
    const guides = this.guides;

    guides[selected.direction].splice(selected.index, 1);
    this._owner.emit('actionstart', { source: this });
    const changed = this.commit(guides);

    if (changed) {
      this.emitActionCommit();
    }

    this.clearInteraction();

    return changed;
  }

  /**
   * 取消当前参考线交互并结束动作。
   *
   * 取消只丢弃 preview，不修改已提交的 guides；仍发送一次 actioncommit，
   * 使 actionstart/actionupdate/actioncommit 生命周期与其它交互 Gizmo 一致。
   * @returns 是否取消了正在进行的交互
   */
  cancelInteraction (): boolean {
    if (!this.drag || !this.preview) {
      return false;
    }
    this.clearInteraction();
    this.emitActionCommit();

    return true;
  }

  /** 替换当前标尺中的全部参考线。 */
  setRuler (guides: RulerGuides): void {
    const wasDragging = !!this.drag;

    // 外部替换不能留下未闭合的 actionstart；提交替换后的快照作为本次动作终点。
    if (wasDragging) {
      this.clearDrag();
    }
    this.guides = guides;
    this.clearInteraction();
    if (wasDragging) {
      this.emitActionCommit();
    }
  }

  /** 每帧检查选中索引，防止外部更新标尺数据后继续操作旧参考线。 */
  override onUpdate (): void {
    const guides = this.preview ?? this.guides;

    if (this.selected && !this.isValidSelection(guides)) {
      this.selected = undefined;
    }
  }

  /**
   * 命中标尺带时创建参考线，命中已有参考线时开始移动。
   * @param event 鼠标按下事件
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.config.enabled || event.buttonIndex !== MouseButton.Left
      || this._owner.getActiveEditMode?.()?.id === 'text-edit') {
      return;
    }
    const hit = this.hitTest(event.position);

    if (!hit) {
      this.selected = undefined;

      return;
    }
    event.accept();
    // 创建新线时先复制命中结果，随后把新索引明确写入选中状态，保证预览阶段一直高亮。
    const selected = { ...hit };

    this.selected = selected;
    this.setGuideCursor(selected.direction);
    const guides = this.guides;

    this.preview = guides;
    const coordinate = this.coordinate(event.position, selected.direction);

    if (selected.index < 0) {
      selected.index = guides[selected.direction].length;
      guides[selected.direction].push(coordinate);
    }
    this.offset = guides[selected.direction][selected.index] - coordinate;
    this.drag = selected;
    this.cacheSnapTargets();
    this._owner.emit('actionstart', { source: this });
  }

  /**
   * 命中参考线或标尺带时接管光标，避免移动选择工具抢占。
   * @param event 鼠标移动事件
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this._owner.getActiveEditMode?.()?.id === 'text-edit') {
      this.resetCursor();

      return;
    }
    const hit = this.config.enabled ? this.hitTest(event.position) : undefined;

    if (hit) {
      this.setGuideCursor(hit.direction);
      event.accept();
    } else if (!this.drag) {
      this.resetCursor();
    }
  }

  /**
   * 更新临时参考线，按住 Shift 时吸附参考元素的包围盒角点和中心点。
   * @param event 鼠标拖拽事件
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.drag || !this.preview) {
      return;
    }
    this.setGuideCursor(this.drag.direction);
    this.updatePreview(event);
    this._owner.emit('actionupdate', { source: this });
    event.accept();
  }

  /**
   * 拖回标尺或画布外删除，否则一次性提交最终参考线。
   * @param event 鼠标抬起事件
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.drag || !this.preview) {
      this.resetCursor();

      return;
    }
    const direction = this.drag.direction;

    if (!event.isCanceled()) {
      this.updatePreview(event);
      const layout = this.getLayout();
      const content = layout.contentRect;
      const axis = this.getAxis(direction);
      const extent = axis === 'y' ? content.height : content.width;
      const location = event.position[axis];
      const outsideOuter = !this.isPointInRect(event.position, layout.outerRect);

      if (outsideOuter || location < content[axis] || location > content[axis] + extent) {
        this.preview[direction].splice(this.drag.index, 1);
        this.selected = undefined;
      }
      this.commit(this.preview);
      this.emitActionCommit();
    } else {
      this.clearDrag();
      this.resetCursor();
      this.emitActionCommit();
      event.accept();

      return;
    }
    this.clearDrag();
    this.resetCursor();
    event.accept();
  }

  /**
   * 删除选中参考线；Escape 与拖拽中的 Delete 都按取消本次参考线操作处理，避免删除画布元素。
   * @param event 键盘按下事件
   */
  override onKeyDown (event: InputEventKey): void {
    if (!this.config.enabled || this._owner.getActiveEditMode?.()?.id === 'text-edit') {
      return;
    }
    const keycode = event.keycode.toLowerCase();
    const physicalKeycode = event.physicalKeycode.toLowerCase();
    const isKey = (...keys: string[]): boolean => keys.includes(keycode) || keys.includes(physicalKeycode);

    if ((isKey('escape') || isKey('z', 'keyz') && (event.ctrlPressed || event.metaPressed)) && this.drag) {
      if (this.cancelInteraction()) {
        event.accept();
      }
    } else if (!event.ctrlPressed && !event.metaPressed && !event.altPressed
      && isKey('delete', 'backspace') && this.hasSelectedGuide()) {
      if (this.drag) {
        // 拖拽中按下删除按取消处理，同样发送终止事件，保证 actionstart 有唯一结束通知。
        if (this.cancelInteraction()) {
          event.accept();
        }
      } else {
        this.deleteRuler();
        event.accept();
      }
    }
  }

  /** 鼠标离开时释放悬停光标；拖拽捕获期间保留方向光标。 */
  override onMouseLeave (): void {
    if (!this.drag) {
      this.resetCursor();
    }
  }

  /**
   * 绘制随缩放变化的刻度、标签、参考线和当前位置。
   * @param control 绘制器
   */
  override draw (control: Control): void {
    const config = this.config;

    if (!config.enabled) {
      return;
    }
    const layout = this.getLayout();
    const outer = layout.outerRect;
    const content = layout.contentRect;
    const guides = this.preview ?? this.guides;

    const rulerBackground = toColor(config.rulerBackgroundColor, 1);

    control.fillRect(outer.x, outer.y, outer.width, layout.rulerSize, rulerBackground);
    control.fillRect(outer.x, outer.y, layout.rulerSize, outer.height, rulerBackground);
    this.drawSelection(control, layout, content);
    this.drawGuides(control, outer, content, guides);
    const guidePosition = this.getGuidePositionLayout(control, layout, content, guides);

    const gridColor = toColor(config.rulerGridColor, 1);
    const textColor = toColor(config.rulerTextColor, 1);
    const rulerValueScale = this.getRulerValueScale();
    // 一次性投影内容区角点，两个方向各取自己轴向的分量即可。
    const docMin = this.toDocument(new Vector2(content.x, content.y));
    const docMax = this.toDocument(new Vector2(content.x + content.width, content.y + content.height));

    for (const direction of ['horizontal', 'vertical'] as const) {
      const axis = this.getAxis(direction);
      const from = Math.min(docMin[axis], docMax[axis]);
      const to = Math.max(docMin[axis], docMax[axis]);
      const extent = axis === 'y' ? content.height : content.width;
      const zoom = extent / (to - from);

      if (!Number.isFinite(zoom) || zoom <= 0) {
        continue;
      }
      // 刻度间距按显示值选择，再换回文档坐标，保证 scale 改变后屏幕间距仍然合理。
      const displayStep = this.getTickStep(zoom / rulerValueScale);
      const step = displayStep / rulerValueScale;
      const begin = Math.floor(from / step) * step;
      const locationMin = content[axis];
      const locationMax = locationMin + extent;

      for (let i = 0; i < 1000; i++) {
        const value = begin + i * step / 2;

        if (value > to) {
          break;
        }
        const location = this.location(value, direction);

        if (location < locationMin || location > locationMax) {
          continue;
        }
        const tick = i % 2 === 0 ? 8 : 4;
        const text = this.formatRulerValue(value * rulerValueScale, 4);

        if (direction === 'vertical') {
          control.drawLine(location, outer.y + layout.rulerSize - tick, location, outer.y + layout.rulerSize, gridColor, 1);
          if (i % 2 === 0 && this.shouldDrawRulerTickLabel(control, layout, direction, location, text, guidePosition)) {
            const label = this.getRulerTickLabelBox(control, layout, direction, location, text);

            control.drawText(label.x, label.y, text, RULER_TICK_FONT_SIZE, textColor);
          }
        } else {
          control.drawLine(outer.x + layout.rulerSize - tick, location, outer.x + layout.rulerSize, location, gridColor, 1);

          if (i % 2 === 0 && this.shouldDrawRulerTickLabel(control, layout, direction, location, text, guidePosition)) {
            this.drawVerticalRulerLabel(control, layout, location, text, textColor);
          }
        }
      }
    }
    control.fillRect(outer.x, outer.y, layout.rulerSize, layout.rulerSize, rulerBackground);
    this.drawRulerBoundary(control, layout, gridColor);
    this.drawGuidePosition(control, guidePosition);
  }

  /** 释放配置监听、参考线吸附来源和当前交互。 */
  override dispose (): void {
    this.clearInteraction();
    this.configOff();
    this.snapConfigOff();
    this.unregisterSnapGuides();
    super.dispose();
  }

  /**
   * 响应标尺配置变化。
   * @param change 标尺配置变更详情
   */
  private onConfigChange (change: ConfigChange<RulerConfig>): void {
    if (!change.current.enabled && change.previous.enabled) {
      if (!this.cancelInteraction()) {
        this.clearInteraction();
      }
    }
  }

  /** 全局关闭吸附时立即清理提示，并把当前预览恢复到未吸附位置。 */
  private onSnapConfigChange (change: ConfigChange<SnapConfig>): void {
    if (change.current.enabled || !change.previous.enabled) {
      return;
    }
    this._owner.getSnapManager().clearSnappingVisualizations();
    if (this.drag && this.preview) {
      const direction = this.drag.direction;

      this.preview[direction][this.drag.index] = this.coordinate(this._owner.getMousePosition(), direction) + this.offset;
    }
  }

  /** 清理拖拽预览和参考元素吸附状态，但保留当前选中参考线。 */
  private clearDrag (): void {
    const wasDragging = !!this.drag;

    this.drag = undefined;
    this.preview = undefined;
    if (wasDragging) {
      this._owner.getSnapManager().reset();
    }
  }

  /** 清理拖拽、选中状态和参考元素吸附状态。 */
  private clearInteraction (): void {
    this.clearDrag();
    this.selected = undefined;
    this.resetCursor();
  }

  /**
   * 设置与参考线移动方向一致的横向或纵向光标。
   * @param direction 参考线方向
   */
  private setGuideCursor (direction: RulerDirection): void {
    this._owner.setCursor({
      type: direction === 'horizontal' ? GestureCursorType.VERTICAL_ARROW : GestureCursorType.HORIZONTAL_ARROW,
      angle: 0,
    });
  }

  /** 恢复默认光标。 */
  private resetCursor (): void {
    this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
  }

  /**
   * 检查选中参考线是否仍然存在。
   * @param guides 当前参考线快照
   * @returns 选中索引是否有效
   */
  private isValidSelection (guides: RulerGuides): boolean {
    return !!this.selected
      && this.selected.index >= 0
      && this.selected.index < guides[this.selected.direction].length;
  }

  /**
   * 将当前选区实时投影到标尺带，跟随元素变换和视口缩放。
   * @param control 绘制器
   * @param layout 当前标尺布局
   * @param content 标尺内容区域
   */
  private drawSelection (control: Control, layout: RulerLayout, content: RulerRect): void {
    const outer = layout.outerRect;
    const size = new Vector2(outer.width, outer.height);
    const box = new Box2();

    for (const item of this._owner.getSelection().getSelectedPlayerItems()) {
      if (item.isVisible) {
        box.union(getItemViewBox(item, size));
      }
    }
    if (box.isEmpty()) {
      return;
    }
    const minX = Math.max(content.x, box.min.x);
    const maxX = Math.min(content.x + content.width, box.max.x);
    const minY = Math.max(content.y, box.min.y);
    const maxY = Math.min(content.y + content.height, box.max.y);
    const color = toColor(this.config.guideColor, 0.25);

    if (maxX > minX) {
      control.fillRect(minX, outer.y, maxX - minX, layout.rulerSize, color);
    }
    if (maxY > minY) {
      control.fillRect(outer.x, minY, layout.rulerSize, maxY - minY, color);
    }
  }

  /**
   * 绘制参考线。参考线需要覆盖内容区和对应的标尺带，且必须在标尺底色之后绘制。
   * @param control 绘制器
   * @param outer 标尺覆盖的视口区域
   * @param content 可绘制内容区
   * @param guides 当前用于绘制的参考线快照
   */
  private drawGuides (control: Control, outer: RulerRect, content: RulerRect, guides: RulerGuides): void {
    const config = this.config;

    for (const direction of ['horizontal', 'vertical'] as const) {
      guides[direction].forEach((value, index) => {
        const location = this.location(value, direction);
        const selected = this.selected?.direction === direction && this.selected.index === index;
        const color = toColor(
          selected ? config.selectedGuideColor : config.guideColor,
          selected ? config.selectedGuideAlpha : config.guideAlpha,
        );

        if (direction === 'horizontal') {
          // 水平参考线对应 Y 坐标，向左延伸到纵向标尺带。
          control.drawLine(outer.x, location, content.x + content.width, location, color, config.guideLineWidth);
        } else {
          // 垂直参考线对应 X 坐标，向上延伸到横向标尺带。
          control.drawLine(location, outer.y, location, content.y + content.height, color, config.guideLineWidth);
        }
      });
    }
  }

  /** 绘制顶部/左侧标尺与内容区之间的内侧边界。 */
  private drawRulerBoundary (control: Control, layout: RulerLayout, color: ReturnType<typeof toColor>): void {
    const { outerRect: outer, contentRect: content, rulerSize } = layout;

    if (rulerSize <= 0) {
      return;
    }
    if (content.width > 0) {
      control.drawLine(
        outer.x,
        content.y,
        content.x + content.width,
        content.y,
        color,
        RULER_BORDER_WIDTH,
      );
    }
    if (content.height > 0) {
      control.drawLine(
        content.x,
        outer.y,
        content.x,
        content.y + content.height,
        color,
        RULER_BORDER_WIDTH,
      );
    }
  }

  /**
   * 计算选中参考线位置标签在对应标尺栏中的排版结果。
   * @param control 绘制器
   * @param layout 当前标尺布局
   * @param content 标尺内容区域
   * @param guides 当前用于绘制的参考线快照
   * @returns 位置标签排版结果；当前没有有效选中参考线时返回 undefined
   */
  private getGuidePositionLayout (control: Control, layout: RulerLayout, content: RulerRect, guides: RulerGuides): GuidePositionLayout | undefined {
    if (!this.config.guidePositionVisible || !this.isValidSelection(guides)) {
      return undefined;
    }
    const selected = this.selected!;
    const value = guides[selected.direction][selected.index];

    if (!Number.isFinite(value) || layout.rulerSize <= 0) {
      return undefined;
    }
    const outer = layout.outerRect;
    const location = this.location(value, selected.direction);
    const text = this.formatRulerValue(value * this.getRulerValueScale());
    const fontSize = this.config.guidePositionFontSize;
    const measurement = control.measureText(text, fontSize);
    const padding = 3;

    if (selected.direction === 'vertical') {
      const width = measurement.width + padding * 2;
      const height = measurement.lineHeight + padding * 2;
      const minX = content.x;
      const maxX = Math.max(minX, content.x + content.width - width);
      const x = Math.min(maxX, Math.max(minX, location - width / 2));
      const minY = outer.y;
      const maxY = Math.max(minY, outer.y + layout.rulerSize - height);
      const y = Math.min(maxY, Math.max(minY, outer.y + (layout.rulerSize - height) / 2));

      return {
        text,
        fontSize,
        box: { x, y, width, height },
        textX: x + padding,
        textY: y + padding,
        rotated: false,
      };
    }
    const width = layout.rulerSize;
    const height = measurement.width + padding * 2;
    const minY = content.y;
    const maxY = Math.max(minY, content.y + content.height - height);
    const y = Math.min(maxY, Math.max(minY, location - height / 2));
    const centerX = outer.x + width / 2;

    return {
      text,
      fontSize,
      box: { x: outer.x, y, width, height },
      textX: centerX,
      textY: y + height / 2,
      rotated: true,
    };
  }

  /**
   * 绘制选中参考线的文档像素位置，标签始终位于对应标尺栏。
   * @param control 绘制器
   * @param position 位置标签排版结果
   */
  private drawGuidePosition (control: Control, position: GuidePositionLayout | undefined): void {
    if (!position) {
      return;
    }
    control.fillRect(
      position.box.x,
      position.box.y,
      position.box.width,
      position.box.height,
      toColor(this.config.guidePositionBackgroundColor, 0.95),
    );
    const color = toColor(this.config.guidePositionTextColor, 1);

    if (position.rotated) {
      this.drawRotatedRulerText(control, position.text, position.fontSize, position.textX, position.textY, color);
    } else {
      control.drawText(position.textX, position.textY, position.text, position.fontSize, color);
    }
  }

  /**
   * 在指定中心点绘制逆时针旋转 90 度的标尺文字。
   * @param control 绘制器
   * @param text 待绘制文字
   * @param fontSize 文字字号
   * @param centerX 旋转后文字包围盒中心的 X 坐标
   * @param centerY 旋转后文字包围盒中心的 Y 坐标
   * @param color 文字颜色
   */
  private drawRotatedRulerText (control: Control, text: string, fontSize: number, centerX: number, centerY: number, color: ReturnType<typeof toColor>): void {
    const measurement = control.measureText(text, fontSize);
    const graphics = control.engine.renderingServer.graphics;
    // Matrix3.rotate() 左乘当前矩阵；先旋转再平移才能让平移量保持在屏幕坐标系中。
    // 屏幕坐标的 Y 轴向下，+90 度会把文字逆时针转到纵向，并以中心点对齐。
    const transform = new Matrix3()
      .rotate(Math.PI / 2)
      .translate(centerX - measurement.lineHeight / 2, centerY + measurement.width / 2);

    graphics.pushTransform(transform);
    control.drawText(0, 0, text, fontSize, color);
    graphics.popTransform();
  }

  /**
   * 计算普通标尺标签在视口中的包围盒。
   * @param control 绘制器
   * @param layout 当前标尺布局
   * @param direction 标尺方向；vertical 表示顶部横向标尺，horizontal 表示左侧纵向标尺
   * @param location 标签对应的视口位置
   * @param text 标签文字
   * @returns 标签包围盒
   */
  private getRulerTickLabelBox (control: Control, layout: RulerLayout, direction: RulerDirection, location: number, text: string): RulerRect {
    const outer = layout.outerRect;
    const measurement = control.measureText(text, RULER_TICK_FONT_SIZE);

    if (direction === 'vertical') {
      return {
        x: location + RULER_TICK_LABEL_AXIS_OFFSET,
        y: outer.y + RULER_TICK_LABEL_EDGE_OFFSET,
        width: measurement.width,
        height: measurement.lineHeight,
      };
    }

    return {
      x: outer.x + RULER_TICK_LABEL_EDGE_OFFSET,
      y: location + RULER_TICK_LABEL_AXIS_OFFSET,
      width: measurement.lineHeight,
      height: measurement.width,
    };
  }

  /**
   * 判断普通刻度标签是否会覆盖选中参考线位置标签。
   * @param control 绘制器
   * @param layout 当前标尺布局
   * @param direction 标尺方向
   * @param location 刻度对应的视口位置
   * @param text 刻度文字
   * @param guidePosition 选中参考线位置标签
   * @returns 没有重叠或没有选中标签时是否允许绘制刻度文字
   */
  private shouldDrawRulerTickLabel (control: Control, layout: RulerLayout, direction: RulerDirection, location: number, text: string, guidePosition: GuidePositionLayout | undefined): boolean {
    if (!guidePosition) {
      return true;
    }
    const tickBox = this.getRulerTickLabelBox(control, layout, direction, location, text);
    const guideBox = guidePosition.box;

    return tickBox.x + tickBox.width <= guideBox.x
      || guideBox.x + guideBox.width <= tickBox.x
      || tickBox.y + tickBox.height <= guideBox.y
      || guideBox.y + guideBox.height <= tickBox.y;
  }

  /**
   * 计算当前缩放下的主刻度步长，保证相邻主刻度投影间距不小于 60 CSS 像素。
   * @param zoom 文档坐标到视口像素的缩放比
   * @returns 主刻度步长
   */
  private getTickStep (zoom: number): number {
    const power = Math.pow(10, Math.floor(Math.log10(75 / zoom)));

    return [1, 2, 5, 10].map(value => value * power).find(value => value * zoom >= 60) ?? power * 10;
  }

  /** 返回用于标尺标签的正数倍数；无效配置回退到默认值。 */
  private getRulerValueScale (): number {
    const scale = this.config.rulerValueScale;

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  /**
   * 将标尺显示值格式化为适合标签展示的文本。
   * @param value 标尺显示值
   * @param decimals 非整数值保留的小数位数
   * @returns 格式化后的坐标文本
   */
  private formatRulerValue (value: number, decimals = 2): string {
    const rounded = Math.abs(value - Math.round(value)) < 0.0001
      ? Math.round(value)
      : Number(value.toFixed(decimals));

    return String(rounded);
  }

  /** 每次吸附时重新投影参考线，保证模型修改、缩放和平移后使用当前 CSS 像素坐标。 */
  private snapGuides (): SnapGuide[] {
    if (!this.config.enabled || this.drag) {
      return [];
    }
    const guides = this.guides;
    const content = this.getLayout().contentRect;

    return [
      ...guides.vertical.map(value => ({ axis: 'x' as const, coordinate: this.location(value, 'vertical'), range: [content.y, content.y + content.height] as const })),
      ...guides.horizontal.map(value => ({ axis: 'y' as const, coordinate: this.location(value, 'horizontal'), range: [content.x, content.x + content.width] as const })),
    ];
  }

  /**
   * 查找参考线或整个标尺刻度区域，新参考线使用 -1 索引。
   * 顶部红框横向标尺创建水平参考线，左侧蓝框纵向标尺创建垂直参考线。
   * @param point 视口坐标
   * @returns 命中的参考线或创建方向
   */
  private hitTest (point: Vector2): GuideHit | undefined {
    const guides = this.guides;
    const layout = this.getLayout();
    const outer = layout.outerRect;
    const content = layout.contentRect;
    const rulerHit = this.getRulerHitRegion(outer, content);

    if (!this.isInsideOuterOrRuler(point, outer, rulerHit)) {
      return undefined;
    }
    const guideHit = this.hitTestGuides(point, content, rulerHit, guides);

    if (guideHit) {
      return guideHit;
    }
    // 整条顶部刻度带（含靠近纵轴的贴边区域）都用于创建水平参考线。
    if (this.isPointInRect(point, rulerHit.top)) {
      return { direction: 'horizontal', index: -1 };
    }
    // 整条左侧刻度带（含靠近横轴的贴边区域）都用于创建垂直参考线。
    if (this.isPointInRect(point, rulerHit.left)) {
      return { direction: 'vertical', index: -1 };
    }

    return undefined;
  }

  /**
   * 在内容区或对应的标尺栏中查找已有参考线。
   * line 模式允许命中整条绘制在内容区的参考线，ruler 模式还允许从对应的标尺栏选中。
   * 水平参考线使用左侧纵向标尺栏，垂直参考线使用顶部横向标尺栏。
   * @param point 视口坐标
   * @param content 标尺内容区域
   * @param rulerHit 顶部/左侧标尺命中区域
   * @param guides 参考线快照
   * @returns 命中的参考线；未命中时返回 undefined
   */
  private hitTestGuides (point: Vector2, content: RulerRect, rulerHit: RulerHitRegion, guides: RulerGuides): GuideHit | undefined {
    const mode = this.config.guideSelectionMode;
    let hit: GuideHit | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const direction of ['horizontal', 'vertical'] as const) {
      const axis = this.getAxis(direction);
      // 水平参考线对应 Y 坐标，在左侧纵向标尺栏中选中；垂直参考线对应 X 坐标，在顶部横向标尺栏中选中。
      const inRuler = this.isPointInRect(point, direction === 'horizontal' ? rulerHit.left : rulerHit.top);

      guides[direction].forEach((value, index) => {
        const location = this.location(value, direction);
        const distance = Math.abs(location - point[axis]);
        const inContent = direction === 'horizontal'
          ? point.x >= content.x && point.x <= content.x + content.width && location >= content.y && location <= content.y + content.height
          : point.y >= content.y && point.y <= content.y + content.height && location >= content.x && location <= content.x + content.width;
        const canHit = mode === 'line' ? inContent : inContent || inRuler;

        if (canHit && distance <= this.config.guideHitDistance && distance < nearestDistance) {
          nearestDistance = distance;
          hit = { direction, index };
        }
      });
    }

    return hit;
  }

  /**
   * 计算完整的顶部/左侧标尺命中区域，并保留贴边像素。
   * @param outer 外层视口矩形
   * @param content 标尺内容区域
   * @returns 顶部/左侧标尺命中区域
   */
  private getRulerHitRegion (outer: RulerRect, content: RulerRect): RulerHitRegion {
    const rulerRight = Math.min(outer.x + outer.width, content.x);
    const rulerBottom = Math.min(outer.y + outer.height, content.y);
    const tolerance = RULER_EDGE_HIT_TOLERANCE;

    return {
      top: {
        x: outer.x,
        y: outer.y - tolerance,
        width: outer.width,
        height: Math.max(0, rulerBottom - outer.y) + tolerance,
      },
      left: {
        x: outer.x - tolerance,
        y: outer.y,
        width: Math.max(0, rulerRight - outer.x) + tolerance,
        height: outer.height,
      },
    };
  }

  /**
   * 判断点是否位于外层视口或扩展后的标尺贴边区域。
   * @param point 视口坐标
   * @param outer 外层视口矩形
   * @param rulerHit 顶部/左侧标尺命中区域
   * @returns 是否在可命中范围内
   */
  private isInsideOuterOrRuler (point: Vector2, outer: RulerRect, rulerHit: RulerHitRegion): boolean {
    const inOuter = point.x >= outer.x && point.y >= outer.y
      && point.x <= outer.x + outer.width && point.y <= outer.y + outer.height;

    return inOuter || this.isPointInRect(point, rulerHit.top) || this.isPointInRect(point, rulerHit.left);
  }

  /**
   * 判断点是否处于矩形区域内。
   * @param point 视口坐标
   * @param rect 目标矩形
   * @returns 点是否在矩形内
   */
  private isPointInRect (point: Vector2, rect: RulerRect): boolean {
    return point.x >= rect.x && point.y >= rect.y
      && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
  }

  /**
   * 更新临时参考线，按住 Shift 时使用参考元素吸附结果。
   * @param event 当前鼠标事件
   */
  private updatePreview (event: InputEventMouseButton | InputEventMouseMotion): void {
    if (!this.drag || !this.preview) {
      return;
    }
    const direction = this.drag.direction;
    const rawValue = this.coordinate(event.position, direction) + this.offset;
    let value = rawValue;
    const snapManager = this._owner.getSnapManager();

    if (event.shiftPressed && this.config.shiftSnapEnabled && snapManager.enabled) {
      const point = this.getGuideViewPoint(rawValue, direction);
      const axis = this.getAxis(direction);

      snapManager.prepareGuide(point, axis, snapManager.getSnapTargetBoxes(), this.config.shiftSnapDistance);
      const correction = snapManager.result[axis];

      if (Number.isFinite(correction)) {
        point[axis] -= correction!;
        value = this.coordinate(point, direction);
      }
    } else {
      snapManager.clearSnappingVisualizations();
    }
    this.preview[direction][this.drag.index] = value;
  }

  /**
   * 获取参考线当前位置对应的视图点。
   * @param value 参考线文档坐标
   * @param direction 参考线方向
   * @returns 参考线上的视图点
   */
  private getGuideViewPoint (value: number, direction: RulerDirection): Vector2 {
    const content = this.getLayout().contentRect;
    const point = new Vector2(content.x + content.width / 2, content.y + content.height / 2);

    point[this.getAxis(direction)] = this.location(value, direction);

    return point;
  }

  /** 在拖拽开始时按当前选区和 Snap scope 缓存参考元素包围盒。 */
  private cacheSnapTargets (): void {
    const items = this._owner.getEngine().sceneServer.compositions[0]?.items ?? [];

    this._owner.getSnapManager().cacheSnapTargetsForGuide(
      items,
      this._owner.getSelection().getSelectedPlayerItems(),
      this.getSize(),
    );
  }

  /**
   * 读取参考线方向对应的视口坐标轴。
   * @param direction 参考线方向
   * @returns 坐标轴；水平参考线对应 Y 轴，垂直参考线对应 X 轴
   */
  private getAxis (direction: RulerDirection): 'x' | 'y' {
    return direction === 'horizontal' ? 'y' : 'x';
  }

  /**
   * 读取方向对应的设计坐标。
   * @param point 视口点
   * @param direction 参考线方向
   * @returns 参考线文档坐标
   */
  private coordinate (point: Vector2, direction: RulerDirection): number {
    return this.toDocument(point)[this.getAxis(direction)];
  }

  /**
   * 投影参考线到视口。
   * @param value 设计坐标
   * @param direction 参考线方向
   * @returns 参考线在视口中的轴向位置
   */
  private location (value: number, direction: RulerDirection): number {
    const axis = this.getAxis(direction);
    const point = new Vector2();

    point[axis] = value;

    return this.toView(point)[axis];
  }

  /** 获取当前布局；标尺默认覆盖完整视口。 */
  private getLayout (): RulerLayout {
    const size = this.getSize();
    const rulerSize = Number.isFinite(this.config.rulerSize) ? Math.max(0, this.config.rulerSize) : 20;
    const outerRect = {
      x: 0,
      y: 0,
      width: Math.max(0, size.x),
      height: Math.max(0, size.y),
    };

    return {
      outerRect,
      contentRect: {
        x: rulerSize,
        y: rulerSize,
        width: Math.max(0, outerRect.width - rulerSize),
        height: Math.max(0, outerRect.height - rulerSize),
      },
      rulerSize,
    };
  }

  /** 读取当前视口尺寸；尺寸变化后下一帧即可生效。 */
  private getSize (): Vector2 {
    const container = this._owner.getEngine().canvas.parentElement;

    return container ? GizmoViewportUtils.getContainerSize(container) : new Vector2();
  }

  /** 将当前视口坐标转换为标尺使用的文档坐标。 */
  private toDocument (point: Vector2): Vector2 {
    const engine = this._owner.getEngine();
    const size = this.getSize();
    const center = this.getDocumentCenter(size);
    const viewportCenter = size.clone().multiply(0.5);
    const translation = ndcSizeToViewSize(GizmoViewportUtils.getViewportTranslation(engine), size);

    return point.clone()
      .subtract(translation)
      .subtract(viewportCenter)
      .multiply(new Vector2(1 / GizmoViewportUtils.getViewScale(engine), 1 / GizmoViewportUtils.getViewScale(engine)))
      .add(center);
  }

  /** 将标尺使用的文档坐标投影到当前视口坐标。 */
  private toView (point: Vector2): Vector2 {
    const engine = this._owner.getEngine();
    const size = this.getSize();
    const translation = ndcSizeToViewSize(GizmoViewportUtils.getViewportTranslation(engine), size);
    const center = this.getDocumentCenter(size);
    const viewportCenter = size.clone().multiply(0.5);
    const scale = GizmoViewportUtils.getViewScale(engine);

    return point.clone()
      .subtract(center)
      .multiply(new Vector2(scale, scale))
      .add(viewportCenter)
      .add(translation);
  }

  /** 返回默认 Canvas 坐标系的固定文档中心。 */
  private getDocumentCenter (size: Vector2): Vector2 {
    if (!this.documentCenter && size.x > 0 && size.y > 0) {
      this.documentCenter = size.clone().multiply(0.5);
    }

    return this.documentCenter?.clone() ?? size.clone().multiply(0.5);
  }

  /**
   * 绘制左侧纵向标尺数字，数字本身不改变刻度和参考线坐标。
   * @param control 绘制器
   * @param layout 当前标尺布局
   * @param location 文字对应的视口位置
   * @param text 待绘制文字
   * @param color 文字颜色
   */
  private drawVerticalRulerLabel (control: Control, layout: RulerLayout, location: number, text: string, color: ReturnType<typeof toColor>): void {
    const label = this.getRulerTickLabelBox(control, layout, 'horizontal', location, text);

    this.drawRotatedRulerText(
      control,
      text,
      RULER_TICK_FONT_SIZE,
      label.x + label.width / 2,
      label.y + label.height / 2,
      color,
    );
  }

  /**
   * 提交发生变化的参考线，空操作不产生历史。
   * @param guides 最终参考线
   * @returns 是否产生了参考线变更
   */
  private commit (guides: RulerGuides): boolean {
    return this.rulerManager.setGuides(guides);
  }

  /** 发出参考线动作结束通知，携带当前已提交快照。 */
  private emitActionCommit (): void {
    this._owner.emit('actioncommit', { source: this, guides: this.guides } as RulerActionEvent);
  }

}
