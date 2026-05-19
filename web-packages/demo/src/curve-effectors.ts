/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-for-of */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import type { spec } from '@galacean/effects';
import { BezierCurve, oldBezierKeyFramesToNew } from '@galacean/effects';
import type { BezierKeyframeProcessParameters } from '@galacean/effects-helper';
import { CurveEffectsProcessor, processBezierKeyframe } from '@galacean/effects-helper';

const curveEffector = new CurveEffectsProcessor();
let gui: any;

const parameters: BezierKeyframeProcessParameters = {
  intensity: 1.0,      // 强度 (0.0 - 2.0) step 0.1
  speed: 1.0,          // 速度 (0.5 - 3.0) step 0.1
  loopCount: 1,       // 循环次数 (1 - Infinity)
  noise: 0,      // 随机扰动 (0.0 - 1.0) step 0.1});
};

const canvas = document.getElementById('J-canvas') as HTMLCanvasElement;

fitCanvasToStyle(canvas);

function fitCanvasToStyle (canvas: HTMLCanvasElement, scaleToDPR = true) {
  const dpr = scaleToDPR ? (window.devicePixelRatio || 1) : 1;
  const rect = canvas.getBoundingClientRect(); // CSS 像素尺寸
  const displayWidth = Math.round(rect.width * dpr);
  const displayHeight = Math.round(rect.height * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return true; // 尺寸发生了变化
  }

  return false; // 尺寸未变
}

const bezierCurvePathValue: spec.BezierCurvePathValue = [
  [
    [4, [0, 0]],
    [4, [0.139, 1]],
    [4, [0.298, 2]],
    [4, [0.396, 3]],
  ],
  [
    [2.5743, 4.61, 0],
    [-2.5486, -0.206, 0],
    [0.1545, -6.3613, 0],
    [3.5526, -3.1935, 0],
  ],
  [
    [-0.2317, 6.8469, 0],
    [-1.5961, 2.1671, 0],
    [-3.5011, -2.5792, 0],
    [-1.2357, -6.0228, 0],
    [1.5446, -6.6999, 0],
    [4.2991, -4.7168, 0],
  ],
];

const bezierValue: spec.BezierKeyframeValue[] = [
  [4, [0, 1]],
  [1, [0.1589, 2, 0.2383, 2, 0.3284, 2], 0],
  [1, [0.4185, 1, 0.5086, 1, 0.5897, 1], 0],
  [1, [0.6707, 0.65, 0.7518, 0.65, 0.8296, 0.65], 0],
  [4, [0.9853, 1.34]],
];

const bezierValue2: spec.BezierKeyframeValue[] = [
  [4, [0, -0.8]],
  [4, [0.2025, 2.1018]],
  [4, [0.515, 0.4]],
  [4, [0.725, 1.34]],
  [4, [0.9575, 0.11]],
];

(async () => {
  setDatGUI();
  mainLoop();
})();

function mainLoop () {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const processedBezierKeyframes1 = curveEffector.processCurve(oldBezierKeyFramesToNew(bezierValue));
  // const newBezierKeyframes2 = processBezierKeyframe(oldBezierKeyframesToNew(bezierValue2), parameters);
  // const processedBezierKeyframes2 = curveEffector.processCurve(newBezierKeyframes2);
  const bezierCurve1 = new BezierCurve(processedBezierKeyframes1);

  drawBezier(canvas, bezierCurve1, {
    yOffset: 0.25,
    color: '#df1a1aff',
  });
  requestAnimationFrame(mainLoop);
}

function setDatGUI () {
  if (gui) {
    gui.destroy();
  }
  // @ts-expect-error
  gui = new window.GUI();

  for (const effects of curveEffector.effects) {
    const ParametersFolder = gui.addFolder(effects.name);

    for (const key of Object.keys(effects as object)) {
      if (key === 'intensity') {
        ParametersFolder.add(effects, key, 0, 2).step(0.02);
      } else {
        ParametersFolder.add(effects, key, 0).step(0.02);
      }
      ParametersFolder.open();
    }
  }
}

type drawBezierOptions = {
  yOffset?: number,
  color?: string,
};

function drawBezier (canvas: HTMLCanvasElement, curve: BezierCurve, options?: drawBezierOptions) {
  const fullDrawOptions = {
    yOffset: 0,
    color: '#1b49c9ff',
    ...options,
  };
  const xs = [];
  const ys = [];

  for (let i = 0; i < curve.getMaxTime(); i += 0.0001) {
    const value = curve.getValue(i);

    xs.push(i);
    ys.push(value / 5 + fullDrawOptions.yOffset);
  }
  console.info(ys[0]);
  drawXYCurve(canvas, xs, ys, fullDrawOptions);
}

function drawXYCurve (
  canvas: HTMLCanvasElement,
  xs: number[],
  ys: number[],
  options: Required<drawBezierOptions>
): void {
  if (xs.length !== ys.length || xs.length === 0) {
    return;
  }
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }
  const margin = 30;
  const width = canvas.width - margin * 2;
  const height = canvas.height - margin * 2;
  const xScale = width;
  const yScale = height / 2;

  ctx.beginPath();
  ctx.strokeStyle = options.color;
  ctx.lineWidth = 2;
  const startX = margin + xs[0] * xScale;
  const startY = canvas.height / 2 - (ys[0] * yScale);

  ctx.moveTo(startX, startY);
  for (let i = 1; i < xs.length; i++) {
    const x = margin + xs[i] * xScale;
    const y = canvas.height / 2 - (ys[i] * yScale);

    ctx.lineTo(x, y);
  }
  ctx.stroke();
  drawAxes(ctx, canvas.width, canvas.height, margin);
}

function drawAxes (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: number
): void {
  ctx.beginPath();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.moveTo(margin, height / 2);
  ctx.lineTo(width - margin, height / 2);
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, height - margin);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i <= 10; i++) {
    const x = margin + (width - 2 * margin) * (i / 10);

    ctx.moveTo(x, height / 2 - 5);
    ctx.lineTo(x, height / 2 + 5);
    ctx.fillText((i / 10).toFixed(1), x, height / 2 + 10);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = -10; i <= 10; i++) {
    const y = height / 2 - (height - 2 * margin) * (i / 20);

    ctx.moveTo(margin - 5, y);
    ctx.lineTo(margin + 5, y);
    ctx.fillText((i / 10).toFixed(1), margin - 10, y);
  }
  ctx.stroke();
}
