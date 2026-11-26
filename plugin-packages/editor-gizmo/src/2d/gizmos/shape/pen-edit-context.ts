import type { Vector2 } from '../../../math';
import type { GeometryEditKind, HandleMirrorMode, PenInteractionState, PenPathData } from './geometry';

export type PenHit = { shape: number, index: number, part: 'point' | 'in' | 'out' | 'segment', t?: number };

/** 由 PenEditMode 持有、供重建前后 Gizmo 共享的编辑数据；生命周期由模式管理。 */
export interface PenEditContext {
  path: PenPathData,
  drawing: boolean,
  interactionState: PenInteractionState,
  target?: string,
  targetKind?: GeometryEditKind,
  targetRevision?: number,
  selected?: PenHit,
  readonly selectedNodes: Set<string>,
  dragging?: PenHit,
  beforeDrag?: PenPathData,
  dragPath?: PenPathData,
  dragOrigin?: Vector2,
  beforeDrawing?: PenPathData,
  undoDraft: PenPathData[],
  redoDraft: PenPathData[],
  activeShape: number,
  sessionId: number,
  context?: unknown,
  independentHandleEdit: boolean,
  mirrorMode: HandleMirrorMode,
  lassoMode: boolean,
  lassoing: boolean,
  lassoPoints: Vector2[],
  lassoAdditive: boolean,
  prependDrawing: boolean,
}

/** 每次创建独立的可变集合，避免不同钢笔模式共享草稿或选区。 */
export function createPenEditContext (): PenEditContext {
  return {
    path: { points: [], easingIns: [], easingOuts: [], shapes: [{ close: false, indexes: [] }] },
    drawing: false,
    interactionState: 'idle',
    selectedNodes: new Set<string>(),
    undoDraft: [],
    redoDraft: [],
    activeShape: 0,
    sessionId: 0,
    independentHandleEdit: false,
    mirrorMode: 'angle-length',
    lassoMode: false,
    lassoing: false,
    lassoPoints: [],
    lassoAdditive: false,
    prependDrawing: false,
  };
}
