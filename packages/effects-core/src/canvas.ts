import type { CanvasItem } from './components/canvas-item';
import { removeItem } from './utils';

/**
 * Internal draw list owned by a Viewport or CanvasLayer.
 *
 * A Canvas only stores top-level CanvasItems. Nested CanvasItems are rendered
 * recursively by their parent CanvasItem.
 * @internal
 */
export class Canvas {
  readonly canvasItems: CanvasItem[] = [];
  orderChanged?: () => void;

  addCanvasItem (canvasItem: CanvasItem): void {
    if (this.canvasItems.includes(canvasItem)) {
      return;
    }
    this.canvasItems.push(canvasItem);
    this.orderChanged?.();
  }

  removeCanvasItem (canvasItem: CanvasItem): void {
    if (this.canvasItems.includes(canvasItem)) {
      removeItem(this.canvasItems, canvasItem);
      this.orderChanged?.();
    }
  }

  draw (): void {
    for (const canvasItem of this.canvasItems) {
      if (canvasItem.isActiveInCanvasTree()) {
        canvasItem.drawInternal();
      }
    }
  }

  clear (): void {
    if (this.canvasItems.length > 0) {
      this.canvasItems.length = 0;
      this.orderChanged?.();
    }
  }
}
