import type { math } from '@galacean/effects';

export interface CurvePoint { time: number, value: number }
export interface CurveKey extends CurvePoint { id: string, handles?: Partial<Record<'in' | 'out', CurvePoint>> }
export interface CurveModel {
  id: string,
  label: string,
  color: math.Color,
  readOnly: boolean,
  keys(): CurveKey[],
  evaluate(time: number): number,
  setKeyPosition?(id: string, position: CurvePoint): void,
}
export interface CurveBounds { timeMin: number, timeMax: number, valueMin: number, valueMax: number }
export interface CurveRect { x: number, y: number, width: number, height: number }
