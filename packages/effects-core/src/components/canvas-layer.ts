import { Canvas } from '../canvas';
import type { Engine } from '../engine';
import type { Viewport } from '../viewport';
import type { CanvasItem } from './canvas-item';
import { Component } from './component';

/**
 * An additional 2D canvas attached to the closest Viewport.
 *
 * CanvasItems without a CanvasLayer use the Viewport default Canvas. A
 * CanvasLayer is therefore only needed when a separate draw layer is desired.
 */
export class CanvasLayer extends Component {
  /** @internal */
  readonly canvas = new Canvas();

  private _layer = 1;
  private viewport: Viewport | null = null;
  private destroyed = false;

  constructor (engine: Engine) {
    super(engine);
    this.canvas.orderChanged = () => this.viewport?.markRootsOrderDirty();
  }

  /**
   * Top-level CanvasItems in this layer, in attachment order.
   * @internal
   */
  get canvasItems (): CanvasItem[] {
    return this.canvas.canvasItems;
  }

  get layer (): number {
    return this._layer;
  }

  set layer (value: number) {
    if (this._layer !== value) {
      this._layer = value;
      this.viewport?.markRootsOrderDirty();
    }
  }

  /** @internal */
  addCanvasItem (canvasItem: CanvasItem): void {
    this.canvas.addCanvasItem(canvasItem);
  }

  /** @internal */
  removeCanvasItem (canvasItem: CanvasItem): void {
    this.canvas.removeCanvasItem(canvasItem);
  }

  override onEnable (): void {
    this.viewport?.canvasLayerVisibilityChanged();
  }

  override onDisable (): void {
    this.viewport?.canvasLayerVisibilityChanged();
  }

  override onEnterTree (): void {
    this.updateViewport();
    this.refreshCanvasItems();
  }

  override onExitTree (): void {
    this.detachFromViewport();
  }

  override onParentChanged (): void {
    if (this.item.isInsideTree) {
      const previousViewport = this.viewport;

      this.updateViewport();
      previousViewport?.refreshCanvasItemsInSubtree(this.item);
      if (this.viewport !== previousViewport) {
        this.viewport?.refreshCanvasItemsInSubtree(this.item);
      }
    }
  }

  override onDestroy (): void {
    this.destroyCanvasLayer();
  }

  override dispose (): void {
    super.dispose();
    // Components can be disposed before their VFXItem enters play, in which
    // case Component.dispose() does not invoke onDestroy(). Canvas ownership
    // must still be released because topology is established at bind time.
    this.destroyCanvasLayer();
  }

  private destroyCanvasLayer (): void {
    if (this.destroyed) {
      return;
    }
    const previousViewport = this.viewport;

    this.destroyed = true;
    this.detachFromViewport();
    previousViewport?.refreshCanvasItemsInSubtree(this.item);
    this.canvas.clear();
  }

  /**
   * Rebinds this layer to the closest Viewport after a tree change.
   * @internal
   */
  updateViewport (): void {
    if (this.destroyed || !this.item?.isInsideTree) {
      this.detachFromViewport();

      return;
    }
    const viewport = this.item?.getViewport() ?? this.engine.viewport;

    if (viewport === this.viewport) {
      viewport.addCanvasLayer(this);

      return;
    }

    this.detachFromViewport();
    this.viewport = viewport;
    viewport.addCanvasLayer(this);
  }

  /** @internal */
  getViewport (): Viewport {
    return this.viewport ?? this.item?.getViewport() ?? this.engine.viewport;
  }

  /** @internal */
  isActiveInCanvasTree (): boolean {
    return !this.destroyed && this.item.isInsideTree && this.viewport !== null;
  }

  /** @internal */
  draw (): void {
    if (this.enabled) {
      this.canvas.draw();
    }
  }

  private detachFromViewport (): void {
    if (this.viewport) {
      this.viewport.removeCanvasLayer(this);
      this.viewport = null;
    }
  }

  private refreshCanvasItems (): void {
    this.getViewport().refreshCanvasItemsInSubtree(this.item);
  }
}
