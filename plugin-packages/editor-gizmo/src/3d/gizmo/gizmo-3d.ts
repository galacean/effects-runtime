import type { InputEventKey, InputEventMouseButton, InputEventMouseMotion, Renderer } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';

/** Shared lifecycle for viewport tools and scene helpers. */
export abstract class Gizmo3D {
  visible = true;

  constructor (protected readonly owner: Editor3D) { owner.gizmos.push(this); }

  get isActive (): boolean { return this.owner.activeGizmo === this; }

  onActivated (): void {}
  onDeactivated (): void {}
  onSelectionChanged (): void {}
  onMouseDown (event: InputEventMouseButton): void {}
  onMouseDrag (event: InputEventMouseMotion): void {}
  onMouseUp (event: InputEventMouseButton): void {}
  onKeyDown (event: InputEventKey): void {}
  onKeyUp (event: InputEventKey): void {}
  update (deltaTime?: number): void {}
  draw (renderer: Renderer): void {}
  pick (event: InputEventMouseButton): void {}
  cancel (reason: string): void {}
  dispose (): void {
    if (this.isActive) { this.owner.activeGizmo = undefined; }
    const index = this.owner.gizmos.indexOf(this);

    if (index >= 0) { this.owner.gizmos.splice(index, 1); }
  }
}
