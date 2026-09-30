import { SceneServer } from '@galacean/effects';
import {
  EventEmitter,
  MouseButton,
  MouseButtonMask,
  type Engine,
  type InputEventMouseButton,
} from '@galacean/effects';
import { clamp, Vector2 } from '../math';
import type { Box2 } from '@galacean/effects-math/es/extension/index';
import type { ViewportNavigationRange } from './types';
import { getViewportTranslationRange } from './viewport-range';
import type { ViewportNavigationConfig } from '../configs/types';
import { viewportNavigationConfig } from '../configs/builtin-configs';
import type { GizmoOwner } from '../gizmo-owner';
import { ndcSizeToViewSize, viewPositionToNDC, viewSizeToNDC } from './coordinates';
import { panView, zoomView } from './viewport-operations';
import { GizmoViewportUtils } from './viewport-utils';

/** 视口平移或缩放后的相机快照。 */
export type ViewportParam = {
  /** 视口缩放。 */
  scale: number,
  /** 视口平移。 */
  translation: Vector2,
  /** 本次变换中心。 */
  center: Vector2,
};

/** 视口导航操作来源。 */
export type ViewportNavigationSource =
  | 'hand-pan'
  | 'wheel-pan'
  | 'wheel-zoom'
  | 'pinch-zoom';

/** 带操作来源的视口变更快照。 */
export type ViewportNavigationChange = ViewportParam & {
  /** 触发视口变更的操作。 */
  source: ViewportNavigationSource,
};

/** 视口导航控制器事件参数。 */
export type ViewportNavigationEvents = {
  /** 视口变更事件。 */
  change: [ViewportNavigationChange],
};

/** 滚轮操作模式。 */
type WheelMode = 'pan' | 'zoom';

/** Effects 将 DOM 像素滚轮量除以 100 后写入 InputEventMouseButton.factor。 */
const EFFECTS_WHEEL_FACTOR_TO_VIEW_PIXELS = 100;

/** 统一处理手形工具和滚轮触发的视口平移与缩放。 */
export class ViewportNavigationController extends EventEmitter<ViewportNavigationEvents> {
  private readonly owner: GizmoOwner;
  private minScale = 0.01;
  private maxScale = 20;
  private minTranslation = new Vector2(-Infinity, -Infinity);
  private maxTranslation = new Vector2(Infinity, Infinity);
  private translationBounds?: Box2;

  /**
   * @param owner Gizmo 宿主
   */
  constructor (owner: GizmoOwner) {
    super();
    this.owner = owner;
  }

  /** 当前视口导航配置。 */
  get config (): Readonly<ViewportNavigationConfig> {
    return this.owner.getConfigManager().get(viewportNavigationConfig);
  }

  /** 当前 Effects 引擎。 */
  private get engine (): Engine {
    return this.owner.getEngine();
  }

  /**
   * 设置允许的视口缩放范围。
   * @param minScale 最小缩放
   * @param maxScale 最大缩放
   */
  setScaleRange (minScale: number, maxScale: number): void {
    if (!Number.isFinite(minScale)
      || !Number.isFinite(maxScale)
      || minScale <= 0
      || maxScale <= 0
      || minScale > maxScale) {
      throw new RangeError('Viewport scale range must be finite, positive, and ordered.');
    }
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.clampCurrentViewport();
  }

  /**
   * 设置视口缩放和平移范围。
   * @param range 视口边界；未提供的缩放边界保留当前值，未提供的平移边界表示不设限
   */
  setViewportRange (range: ViewportNavigationRange): void {
    const minScale = range.minScale ?? this.minScale;
    const maxScale = range.maxScale ?? this.maxScale;

    if (!Number.isFinite(minScale)
      || !Number.isFinite(maxScale)
      || minScale <= 0
      || maxScale <= 0
      || minScale > maxScale) {
      throw new RangeError('Viewport scale range must be finite, positive, and ordered.');
    }

    const minTranslation = range.minTranslation?.clone() ?? new Vector2(-Infinity, -Infinity);
    const maxTranslation = range.maxTranslation?.clone() ?? new Vector2(Infinity, Infinity);

    if (!this.isTranslationRangeValid(minTranslation, maxTranslation)) {
      throw new RangeError('Viewport translation range must be ordered and finite or infinite.');
    }

    const translationBounds = range.translationBounds?.clone();

    if (translationBounds && (translationBounds.isEmpty()
      || !translationBounds.min.toArray().every(Number.isFinite)
      || !translationBounds.max.toArray().every(Number.isFinite))) {
      throw new RangeError('Viewport content bounds must be finite and ordered.');
    }
    this.translationBounds = translationBounds;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.minTranslation = minTranslation;
    this.maxTranslation = maxTranslation;
    this.clampCurrentViewport();
  }

  /** 恢复默认视口范围。 */
  resetViewportRange (): void {
    this.translationBounds = undefined;
    this.minScale = 0.01;
    this.maxScale = 20;
    this.minTranslation = new Vector2(-Infinity, -Infinity);
    this.maxTranslation = new Vector2(Infinity, Infinity);
    this.clampCurrentViewport();
  }

  /** 当前视口范围快照。 */
  get viewportRange (): ViewportNavigationRange {
    const bounds = this.translationBounds && this.hasViewport()
      ? getViewportTranslationRange(this.translationBounds, GizmoViewportUtils.getViewScale(this.engine), this.containerSize())
      : undefined;

    return {
      minScale: this.minScale,
      maxScale: this.maxScale,
      minTranslation: bounds?.min ?? this.minTranslation.clone(),
      maxTranslation: bounds?.max ?? this.maxTranslation.clone(),
      ...(this.translationBounds ? { translationBounds: this.translationBounds.clone() } : {}),
    };
  }

  /**
   * 根据滚轮来源和修饰键执行平移或缩放。
   * @param event 滚轮事件
   * @param _pointerCaptured 指针是否已被捕获
   * @returns 视口是否发生变化
   */
  handleWheel (event: InputEventMouseButton, _pointerCaptured: boolean): boolean {
    if (!this.hasViewport()) {
      return false;
    }

    event.accept();
    if (event.buttonMask !== MouseButtonMask.None) {
      return false;
    }
    const delta = this.normalizeWheel(event);
    const mode = this.classifyWheel(event);
    const center = new Vector2(event.position.x, event.position.y);

    if (mode === 'zoom') {
      if (delta.y === 0) {
        return false;
      }
      const direction = this.config.invertZoom
        ? -delta.y
        : delta.y;
      const zoomStep = this.config.zoomStep;
      const zoomDelta = clamp(direction * 0.01, -zoomStep, zoomStep);

      return this.zoomByFactor(
        1 + zoomDelta,
        center,
        event.ctrlPressed
          ? 'pinch-zoom'
          : 'wheel-zoom',
      );
    }

    if (delta.x === 0 && delta.y === 0) {
      return false;
    }

    return this.panByViewDelta(delta, center, 'wheel-pan');
  }

  /**
   * 按视图像素增量平移视口。
   * @param delta 视图像素位移
   * @param center 操作中心
   * @param source 操作来源
   * @returns 视口是否发生变化
   */
  panByViewDelta (
    delta: Vector2,
    center: Vector2,
    source: 'hand-pan' | 'wheel-pan',
  ): boolean {
    if (!this.hasViewport() || (delta.x === 0 && delta.y === 0)) {
      return false;
    }
    const containerSize = this.containerSize();

    if (containerSize.x <= 0 || containerSize.y <= 0) {
      return false;
    }
    panView(this.engine, viewSizeToNDC(delta, containerSize));
    this.clampCurrentTranslation(containerSize);
    this.emitChange(center, source);

    return true;
  }

  /**
   * 按倍率缩放视口。
   * @param factor 缩放倍率
   * @param center 缩放中心
   * @param source 操作来源
   * @returns 视口是否发生变化
   */
  zoomByFactor (
    factor: number,
    center: Vector2,
    source: 'wheel-zoom' | 'pinch-zoom',
  ): boolean {
    if (!this.hasViewport() || !Number.isFinite(factor) || factor <= 0) {
      return false;
    }
    const currentScale = GizmoViewportUtils.getViewScale(this.engine);
    const nextScale = clamp(currentScale * factor, this.minScale, this.maxScale);

    if (nextScale === currentScale) {
      return false;
    }
    const containerSize = this.containerSize();

    if (containerSize.x <= 0 || containerSize.y <= 0) {
      return false;
    }
    zoomView(
      this.engine,
      nextScale - currentScale,
      viewPositionToNDC(center, containerSize),
    );
    this.clampCurrentTranslation(containerSize);
    this.emitChange(center, source);

    return true;
  }

  /** 释放事件监听器。 */
  dispose (): void {
    for (const listener of this.getListeners('change').slice()) {
      this.off('change', listener);
    }
  }

  /**
   * 根据显式配置和修饰键确定导航模式。
   * @param event 滚轮事件
   * @returns 滚轮导航模式
   */
  private classifyWheel (event: InputEventMouseButton): WheelMode {
    // Wheel delta 的数值特征无法稳定区分鼠标和触控板，导航模式只由明确意图决定。
    return event.ctrlPressed
      || event.metaPressed
      || this.config.scrollWheelZoom
      ? 'zoom'
      : 'pan';
  }

  /**
   * 将方向型滚轮事件转换为视图位移。
   * @param event 滚轮事件
   * @returns 视图位移
   */
  private normalizeWheel (event: InputEventMouseButton): Vector2 {
    const delta = new Vector2();
    const viewDelta = event.factor * EFFECTS_WHEEL_FACTOR_TO_VIEW_PIXELS;

    switch (event.buttonIndex) {
      case MouseButton.WheelUp:
        delta.y = viewDelta;

        break;
      case MouseButton.WheelDown:
        delta.y = -viewDelta;

        break;
      case MouseButton.WheelLeft:
        delta.x = viewDelta;

        break;
      case MouseButton.WheelRight:
        delta.x = -viewDelta;

        break;
    }

    // Windows 下 Shift + 滚轮映射为水平平移。
    const isApplePlatform = typeof navigator !== 'undefined'
      && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

    if (!isApplePlatform && event.shiftPressed && delta.x === 0) {
      delta.x = delta.y;
      delta.y = 0;
    }

    return delta;
  }

  /**
   * 发出当前视口快照。
   * @param center 操作中心
   * @param source 操作来源
   */
  private emitChange (
    center: Vector2,
    source: ViewportNavigationSource,
  ): void {
    const containerSize = this.containerSize();

    this.emit('change', {
      source,
      scale: GizmoViewportUtils.getViewScale(this.engine),
      translation: ndcSizeToViewSize(
        GizmoViewportUtils.getViewportTranslation(this.engine),
        containerSize,
      ),
      center: center.clone(),
    });
  }

  /** @returns 当前画布容器尺寸。 */
  private containerSize (): Vector2 {
    return GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
  }

  /** 将当前相机平移收敛到范围内。 */
  private clampCurrentTranslation (containerSize: Vector2): void {
    const current = ndcSizeToViewSize(
      GizmoViewportUtils.getViewportTranslation(this.engine),
      containerSize,
    );
    const bounds = this.translationBounds
      ? getViewportTranslationRange(this.translationBounds, GizmoViewportUtils.getViewScale(this.engine), containerSize)
      : undefined;
    const min = bounds?.min ?? this.minTranslation;
    const max = bounds?.max ?? this.maxTranslation;
    const clamped = new Vector2(
      clamp(current.x, min.x, max.x),
      clamp(current.y, min.y, max.y),
    );
    const correction = clamped.subtract(current);

    if (correction.x !== 0 || correction.y !== 0) {
      panView(this.engine, viewSizeToNDC(correction, containerSize));
    }
  }

  /** 将当前相机缩放和平移收敛到范围内。 */
  private clampCurrentViewport (): void {
    if (!this.hasViewport()) {
      return;
    }
    const currentScale = GizmoViewportUtils.getViewScale(this.engine);
    const nextScale = clamp(currentScale, this.minScale, this.maxScale);

    if (nextScale !== currentScale) {
      zoomView(this.engine, nextScale - currentScale);
    }
    this.clampCurrentTranslation(this.containerSize());
  }

  private isTranslationRangeValid (minTranslation: Vector2, maxTranslation: Vector2): boolean {
    return !Number.isNaN(minTranslation.x)
      && !Number.isNaN(minTranslation.y)
      && !Number.isNaN(maxTranslation.x)
      && !Number.isNaN(maxTranslation.y)
      && minTranslation.x <= maxTranslation.x
      && minTranslation.y <= maxTranslation.y;
  }

  /** @returns 是否存在可操作的画布容器和相机。 */
  private hasViewport (): boolean {
    return Boolean(
      this.engine.canvas.parentElement
      && this.engine.getServer(SceneServer).compositions[0]?.camera,
    );
  }

}
