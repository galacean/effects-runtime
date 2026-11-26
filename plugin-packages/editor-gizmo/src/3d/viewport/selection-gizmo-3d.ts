import type { math } from '@galacean/effects';
import { MouseButton, spec, VFXItem, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Point2 } from '../../math/types';
import { Gizmo3D } from './gizmo-3d';
import { getItemWorldBoundsCorners } from './item-bounds';

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

/** Ray selection and projected world-bounds marquee for the 3D viewport. */
export class SelectionGizmo3D extends Gizmo3D {
  readonly type = 'selection-3d';
  /** An editor can restrict picking to its document roots, e.g. a model with internal meshes. */
  selectableItems?: ReadonlySet<VFXItem>;
  lockedItems: ReadonlySet<VFXItem> = new Set();
  private start?: math.Vector2;
  private rect?: MarqueeRect;

  get marqueeRect (): MarqueeRect | undefined { return this.rect; }

  get items (): readonly VFXItem[] {
    return this.owner.selection.getSelectedPlayerItems().filter(item => this.isSelectable(item));
  }

  private isSelectable (item: VFXItem): boolean {
    const root = this.owner.gizmoRoot;

    return (!this.selectableItems || this.selectableItems.has(item))
      && (!root || (item !== root && !VFXItem.isAncestor(root, item)));
  }

  private selectHits (hits: Set<VFXItem>): void {
    // A 3D marquee that hits both a container and its descendants selects the container.
    const roots = Array.from(hits).filter(item => {
      for (let parent = item.parent; parent; parent = parent.parent) {
        if (hits.has(parent)) { return false; }
      }

      return true;
    });

    this.owner.selection.setSelectedItems(roots.map(item => item.getInstanceId()));
  }

  canTransform (item: VFXItem): boolean {
    if (item.composition !== this.owner.composition || !this.isSelectable(item)) { return false; }
    for (let node: VFXItem | undefined = item; node; node = node.parent) {
      if (!node.isVisible || !node.isActive || this.lockedItems.has(node)) { return false; }
    }

    return true;
  }

  private candidates (): VFXItem[] {
    const composition = this.owner.composition;

    if (!composition) { return []; }
    const helpers = new Set<VFXItem>(composition.loaderData.gizmoItems);

    return Array.from(this.selectableItems ?? composition.items).filter(item => {
      if (item.composition !== composition || item.type === spec.ItemType.skybox || !this.isSelectable(item)) { return false; }
      for (let node: VFXItem | undefined = item; node; node = node.parent) {
        if (helpers.has(node) || !node.isActive || !node.isVisible) { return false; }
      }

      return true;
    });
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.start = event.position.clone();
    this.rect = undefined;
    event.accept();
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.start) { return; }
    this.rect = rectBetween(this.start, event.position);
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.start) { return; }
    if (!event.isCanceled()) {
      const additive = event.shiftPressed || event.ctrlPressed || event.metaPressed;
      const hits = this.rect ? this.itemsInRect(rectBetween(this.start, event.position)) : this.itemAt(this.start);
      const result = new Set<VFXItem>(additive ? this.items : []);

      for (const item of hits) {
        if (additive && !this.rect && result.has(item)) { result.delete(item); } else { result.add(item); }
      }
      this.selectHits(result);
    }
    this.cancel();
    event.accept();
  }

  private itemAt (point: math.Vector2): VFXItem[] {
    const composition = this.owner.composition;
    const ndc = this.owner.toNDC(point);

    if (!composition || !ndc) { return []; }
    const { x, y } = ndc;
    const origin = composition.getHitTestRay(x, y).origin;
    const candidates = new Set(this.candidates());
    const helpers = new Set<VFXItem>(composition.loaderData.gizmoItems);
    const hits = composition.hitTest(x, y, true, { skip: item => item === this.owner.gizmoRoot || helpers.has(item) || !item.isVisible });
    let nearest: VFXItem | undefined;
    let distance = Infinity;

    for (const hit of hits) {
      let item: VFXItem | undefined = hit.item;

      while (item && !candidates.has(item)) { item = item.parent; }
      const depth = origin.distanceSquared(hit.position);

      if (item && depth <= distance) {
        nearest = item;
        distance = depth;
      }
    }

    return nearest ? [nearest] : [];
  }

  private itemsInRect (rect: MarqueeRect): VFXItem[] {
    const hits: VFXItem[] = [];

    for (const item of this.candidates()) {
      const points = getItemWorldBoundsCorners([item]).map(point => this.owner.project(point)).filter((point): point is math.Vector2 => !!point);

      if (!points.length) { continue; }
      const xs = points.map(p => p.x), ys = points.map(p => p.y);

      if (Math.min(...xs) <= rect.right && Math.max(...xs) >= rect.left && Math.min(...ys) <= rect.bottom && Math.max(...ys) >= rect.top) {
        hits.push(item);
      }
    }

    return hits;
  }

  override cancel (): void {
    this.start = undefined;
    this.rect = undefined;
  }
}
