import type { math } from '@galacean/effects';
import { MouseButton, type VFXItem, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Point2 } from '../../math/types';
import type { Editor3D } from '../editor-3d';
import { getItemWorldBoundsCorners } from '../viewport/item-bounds';

interface MarqueeRect {
  readonly left: number,
  readonly top: number,
  readonly right: number,
  readonly bottom: number,
}

function rectBetween (start: Point2, end: Point2): MarqueeRect {
  return {
    left: Math.min(start.x, end.x), top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y),
  };
}

/** Selects projected item bounds inside a viewport drag rectangle. */
export class BoxSelection3D {
  constructor (private readonly viewport: Editor3D) {}
  private start?: math.Vector2;
  private rect?: MarqueeRect;

  get marqueeRect (): MarqueeRect | undefined { return this.rect; }

  onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.start = event.position.clone();
    this.rect = undefined;
    event.accept();
  }

  onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.start) { return; }
    this.rect = rectBetween(this.start, event.position);
    event.accept();
  }

  onMouseUp (event: InputEventMouseButton): void {
    if (!this.start) { return; }
    if (!event.isCanceled()) {
      if (!this.rect) {
        this.viewport.transformGizmo.pick(event);
      } else {
        const subtractive = event.ctrlPressed || event.metaPressed;
        const additive = event.shiftPressed || subtractive;
        const hits = this.itemsInRect(rectBetween(this.start, event.position));
        const result = new Set<VFXItem>(additive ? this.viewport.selectedItems : []);
        const active = additive ? this.viewport.transformGizmo.activeItem : undefined;

        for (const item of hits) {
          if (subtractive) { result.delete(item); } else { result.add(item); }
        }
        this.viewport.select(Array.from(result), active);
      }
    }
    this.cancel();
    event.accept();
  }

  private itemsInRect (rect: MarqueeRect): VFXItem[] {
    const hits: VFXItem[] = [];

    for (const item of this.viewport.getSelectionCandidates()) {
      const points = getItemWorldBoundsCorners([item]).map(point => this.viewport.project(point)).filter((point): point is math.Vector2 => !!point);

      if (!points.length) { continue; }
      const xs = points.map(p => p.x), ys = points.map(p => p.y);

      if (Math.min(...xs) <= rect.right && Math.max(...xs) >= rect.left && Math.min(...ys) <= rect.bottom && Math.max(...ys) >= rect.top) {
        hits.push(item);
      }
    }

    return hits;
  }

  cancel (): void {
    this.start = undefined;
    this.rect = undefined;
  }
}
