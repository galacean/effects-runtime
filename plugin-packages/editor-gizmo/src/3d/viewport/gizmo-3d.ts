import type { InputEventKey, InputEventMouseButton, InputEventMouseMotion, Renderer } from '@galacean/effects';
import type { CameraEditData } from './camera-navigation';
import type { Editor3D } from '../editor-3d';
import type { TransformGizmo3D } from './transform-gizmo-3d';

export type Transform3DOperation = 'translate' | 'rotate' | 'scale';
export type Viewport3DTool = Transform3DOperation | 'camera';
export type Viewport3DSpace = 'local' | 'world';
export type Viewport3DPivotMode = 'pivot' | 'center';

/** IDs identify the top-level items whose live transforms the gizmo edits. */
export interface Transform3DActionEvent {
  source: TransformGizmo3D,
  transformType: Transform3DOperation,
  itemIds: readonly string[],
  /** On a canceled commit the gizmo has already rolled back its preview. */
  canceled?: boolean,
  reason?: string,
}

export interface Viewport3DCameraEvent {
  camera: CameraEditData,
  phase: 'start' | 'update' | 'commit' | 'cancel',
}

export type Gizmo3DEvents = {
  keyDown: [event: InputEventKey],
  actionstart: [event: Transform3DActionEvent],
  actionupdate: [event: Transform3DActionEvent],
  actioncommit: [event: Transform3DActionEvent],
  camerachange: [event: Viewport3DCameraEvent],
  toolchange: [tool: Viewport3DTool, space: Viewport3DSpace],
};

/** Viewport-owned input, drawing and resource lifecycle for a 3D tool. */
export abstract class Gizmo3D {
  abstract readonly type: string;
  constructor (protected readonly owner: Editor3D) {}

  onMouseDown (event: InputEventMouseButton): void {}
  onMouseDrag (event: InputEventMouseMotion): void {}
  onMouseUp (event: InputEventMouseButton): void {}
  onKeyDown (event: InputEventKey): void {}
  onKeyUp (event: InputEventKey): void {}
  onUpdate (): void {}
  draw (renderer: Renderer): void {}
  dispose (): void {}
  cancel (reason: string): void {}
}
