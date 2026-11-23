export const RUNTIME_PROTOCOL_VERSION = 1;
export const RUNTIME_PORT = 'effects-devtools';
export const RUNTIME_READY = 'effects-devtools:ready';
export const RUNTIME_DISCONNECT = 'effects-devtools:disconnect';

export type RuntimeValue = string | number | boolean | null | RuntimeValue[];
export type RuntimeFieldKind = 'number' | 'string' | 'boolean' | 'vector' | 'color' | 'reference' | 'readonly' | 'group';
export interface RuntimeField {
  id: string,
  name: string,
  kind: RuntimeFieldKind,
  value: RuntimeValue,
  writable: boolean,
  reference?: string,
  children?: RuntimeField[],
}
export interface RuntimeSection { id: string, name: string, fields: RuntimeField[] }
export interface RuntimeNode {
  id: string, name: string, type: string, itemType?: string,
  parent?: string, composition: string, active: boolean, visible: boolean,
}
export interface RuntimeAsset { id: string, name: string, type: string, summary: string }
export interface RuntimePlayer { id: string, name: string, canvas: string, width: number, height: number }
export interface RuntimePreview { id: string, url: string, width: number, height: number }
export interface RuntimeSnapshot {
  version: number,
  sessionId: string,
  registered: boolean,
  players: RuntimePlayer[],
  playerId?: string,
  selectedId?: string,
  selectedName?: string,
  nodes: RuntimeNode[],
  assets: RuntimeAsset[],
  sections: RuntimeSection[],
  paused: boolean,
  time: number,
  duration: number,
  speed: number,
  canUndo: boolean,
  canRedo: boolean,
  picking: boolean,
  highlighting: boolean,
  preview?: RuntimePreview,
  errors: string[],
}
export type RuntimeCommand =
  { type: 'write', id: string, value: RuntimeValue, transaction: string } |
  { type: 'finish', transaction: string } |
  { type: 'select', id?: string } |
  { type: 'visible', id: string, value: boolean } |
  { type: 'seek', time: number } |
  { type: 'speed', value: number } |
  { type: 'pick' | 'highlight', value: boolean } |
  { type: 'pause' | 'resume' | 'restart' | 'undo' | 'redo' | 'log' };
export interface RuntimeRequest { version: number, sessionId?: string, playerId?: string, commands: RuntimeCommand[], previewId?: string }
export interface RuntimeBridge {
  request(request: RuntimeRequest): Promise<RuntimeSnapshot>,
  suspend(): Promise<void>,
  dispose(): void,
}

export function emptyRuntimeSnapshot (): RuntimeSnapshot {
  return { version: RUNTIME_PROTOCOL_VERSION, sessionId: '', registered: false, players: [], nodes: [], assets: [], sections: [],
    paused: true, time: 0, duration: 0, speed: 1, canUndo: false, canRedo: false, picking: false, highlighting: false, errors: [] };
}
