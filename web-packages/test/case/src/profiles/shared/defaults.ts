export const DEFAULT_CANVAS_SIZE = {
  width: 512,
  height: 512,
} as const;

export const DEFAULT_PIXEL_DIFF_THRESHOLD = 1;

const TIME_POINTS_2D_INTERACT = [
  0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.66, 0.71, 0.83, 0.96,
  1.1, 1.23, 1.45, 1.67, 1.88, 2.1, 2.5, 3.3, 4.7, 5.2, 6.8,
  7.5, 8.6, 9.7, 9.99,
];

const TIME_POINTS_2D_DYNAMIC = [
  0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.66, 0.71, 0.83, 0.96,
  1.1, 1.23, 1.45, 1.67, 1.88, 2.1, 2.5, 3.3, 4.7, 5.2, 6.8,
  7.5, 8.6, 9.7, 10.01,
];

const TIME_POINTS_2D_INSPIRE = [
  0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.71, 0.83, 0.96,
  1.1, 1.2, 1.4, 1.7, 1.9, 2.2, 2.5, 2.7, 3.3, 3.8,
  4.7, 5.2, 6.8, 7.5, 8.6, 9.7, 9.99, 12.5, 18.9,
];

const TIME_POINTS_3D_FULL = [
  0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.65, 0.71, 0.83, 0.96, 1.0,
  1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.9, 2.0, 2.2, 2.5, 2.7, 3.0, 3.3, 3.8,
  4.1, 4.7, 5.2, 5.9, 6.8, 7.5, 8.6, 9.7, 9.99, 11.23, 12.5, 15.8, 18.9,
];

const TIME_POINTS_GLTF_FULL = [
  0, 0.11, 0.34, 0.57, 0.71, 1.0,
  1.1, 1.5, 2.0, 3.0, 5.2, 7.4, 9.99, 12.5, 15.8,
];

export const TIME_POINTS_BY_POLICY = {
  single: [0],
  '2d-interact': TIME_POINTS_2D_INTERACT,
  '2d-dynamic': TIME_POINTS_2D_DYNAMIC,
  '2d-inspire': TIME_POINTS_2D_INSPIRE,
  spine: TIME_POINTS_2D_INSPIRE,
  '3d-full': TIME_POINTS_3D_FULL,
  'gltf-full': TIME_POINTS_GLTF_FULL,
} as const;

export type TimePointPolicy = keyof typeof TIME_POINTS_BY_POLICY;

export function getTimePointsByPolicy (policy: TimePointPolicy) {
  return [...TIME_POINTS_BY_POLICY[policy]];
}
