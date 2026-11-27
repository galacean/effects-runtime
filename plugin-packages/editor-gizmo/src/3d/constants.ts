import { glContext } from '@galacean/effects';

export const color = {
  xAxisColor: [0.96, 0.20, 0.32],
  yAxisColor: [0.53, 0.84, 0.01],
  zAxisColor: [0.16, 0.55, 0.96],
  highlightColor: [1, 1, 0],
};
export const renderMode = glContext.TRIANGLES;
export const gizmoOpacity = 0.9;
/** Screen-space sizes in CSS pixels. */
export const viewHelperStyle = { size: 80, margin: 12, axisLength: 26, markerSize: 20, lineWidth: 1.5 };
// 坐标轴默认图标
export const axisIconMap: Map<string, string> = new Map();

function addSvgIcon (name: string, size: number, content: string): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${content}</svg>`;

  axisIconMap.set(name, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}

addSvgIcon('light', 76, `
  <g fill="none" stroke="#8e8e8e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 25a20 20 0 0 1 40 0v13a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7Z"/>
    <path d="M38 60v12M14 60 4 70M62 60l10 10"/>
  </g>
`);
addSvgIcon('camera', 188, `
  <g fill="none" stroke="#8e8e8e" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="36" width="126" height="118" rx="22"/>
    <path d="m134 72 32-15q14-6 14 11v57q0 17-14 11l-32-14"/>
  </g>
  <circle cx="45" cy="71" r="15" fill="#8e8e8e"/>
`);

// Monochrome labels receive their axis tint from the material.
for (const axis of ['X', 'Y', 'Z']) {
  for (const positive of [true, false]) {
    addSvgIcon((positive ? 'pos' : 'neg') + axis, 100, `
      <circle cx="50" cy="50" r="42" fill="white"/>
      ${positive ? '' : '<circle cx="50" cy="50" r="33" fill="#bfbfbf"/>'}
      ${positive ? `<text x="50" y="52" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="50" font-weight="bold">${axis}</text>` : ''}
    `);
  }
}
