import type { VariableWidthPoint } from '@galacean/effects';

export const STROKE_WIDTH_PRESETS: { name: string, points: VariableWidthPoint[] }[] = [
  { name: 'Uniform', points: [] },
  { name: 'Wedge', points: [{ position: 0, ascent: .5, descent: .5 }, { position: 1, ascent: 0, descent: 0 }] },
  { name: 'Taper', points: [{ position: 0, ascent: .5, descent: .5 }, { position: 1, ascent: .1875, descent: .1875 }] },
  { name: 'Quarter Taper', points: [{ position: 0, ascent: .1875, descent: .1875 }, { position: .25, ascent: .5, descent: .5 }, { position: 1, ascent: .1875, descent: .1875 }] },
  { name: 'Eye', points: [{ position: 0, ascent: 0, descent: 0 }, { position: .5, ascent: .5, descent: .5 }, { position: 1, ascent: 0, descent: 0 }] },
  { name: 'Mirrored Taper', points: [{ position: 0, ascent: .1875, descent: .1875 }, { position: .5, ascent: .5, descent: .5 }, { position: 1, ascent: .1875, descent: .1875 }] },
];
