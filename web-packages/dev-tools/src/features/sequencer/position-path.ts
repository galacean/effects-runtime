import { BezierCurve, InterpolationMode, spec } from '@galacean/effects';
import type { SequenceKey } from './curve-data';

interface PositionChannel { keys: SequenceKey[], defaultValue: number }

/** Bake the editor's scalar views into the existing time-parameterized position path. */
export function encodePositionPath (channels: PositionChannel[]): spec.FixedVec3Expression | undefined {
  if (!channels.some(channel => channel.keys.length)) { return; }
  const curves = channels.map(channel => {
    const curve = new BezierCurve([]);

    curve.setKeyFrames(channel.keys);

    return curve;
  });
  const sample = (time: number): spec.vec3 => channels.map((channel, axis) =>
    channel.keys.length ? curves[axis].getValue(time) : channel.defaultValue) as spec.vec3;
  const knots = new Set<number>();

  for (const channel of channels) {
    channel.keys.forEach((key, index) => {
      knots.add(Math.max(0, Math.min(1, key.time)));
      if (index && channel.keys[index - 1].interpolationMode === InterpolationMode.Constant) {
        knots.add(Math.max(channel.keys[index - 1].time, key.time - 1e-7));
      }
    });
  }
  const times = Array.from(knots).sort((a, b) => a - b);
  const points: { time: number, value: spec.vec3 }[] = [{ time: times[0], value: sample(times[0]) }];
  const split = (start: number, end: number, first: spec.vec3, last: spec.vec3, depth: number) => {
    const scale = Math.max(1, ...first.map(Math.abs), ...last.map(Math.abs));
    const error = Math.max(...[0.25, 0.5, 0.75].map(ratio => {
      const value = sample(start + (end - start) * ratio);

      return Math.max(...value.map((axis, index) => Math.abs(axis - first[index] - (last[index] - first[index]) * ratio)));
    }));

    if (error > 1e-4 * scale && end - start > 1e-7 && depth < 12 && points.length < 4096) {
      const middle = (start + end) / 2, point = sample(middle);

      split(start, middle, first, point, depth + 1); split(middle, end, point, last, depth + 1);
    } else { points.push({ time: end, value: last }); }
  };

  for (let index = 0; index + 1 < times.length; index++) {
    split(times[index], times[index + 1], sample(times[index]), sample(times[index + 1]), 0);
  }

  return [spec.ValueType.LINEAR_PATH, [points.map(point => [point.time, point.time, 1, 1]), points.map(point => point.value)]];
}
