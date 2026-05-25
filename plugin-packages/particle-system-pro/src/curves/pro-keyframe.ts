export type ProInterpMode = 'linear' | 'cubic' | 'constant';

export interface ProKeyframe {
  time: number,
  value: number,
  inTangent: number,
  outTangent: number,
  interpMode: ProInterpMode,
}
