import { glContext } from '@galacean/effects';

export const color = {
  xAxisColor: [0.96, 0.20, 0.32],
  yAxisColor: [0.53, 0.84, 0.01],
  zAxisColor: [0.16, 0.55, 0.96],
  highlightColor: [1, 1, 0],
};
export const renderMode = glContext.TRIANGLES;
export const gizmoOpacity = 0.9;
export const transformGizmoStyle = { size: 80, axisLength: 0.8, lineWidth: 2, screenRingRadius: 1.1 };
/** Screen-space sizes in CSS pixels. */
export const directionGizmoStyle = { size: 80, margin: 12, axisLength: 26, markerSize: 20, lineWidth: 1.5 };
