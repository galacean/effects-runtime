/* eslint-disable no-console */
//@ts-nocheck
import { spec } from '@galacean/effects';
import { BezierCurve, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*vO0wT4S4shEAAAAAAAAAAAAAelB4AQ';
const jsons = [
  'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/ILDKKFUFMVJA/1705406034-80896.json',
  'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ',
  'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
  {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ',
    options: {
      autoplay: true,
    },
  },
  {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
    options: {
      autoplay: false,
    },
  },
  'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*qTquTKYbk6EAAAAAAAAAAAAADsF2AQ',
];
const container = document.getElementById('J-container');

(async () => {
  // const player = new Player({
  //   container,
  //   interactive: true,
  //   onError: (err, ...args) => {
  //     console.error(err.message);
  //   },
  // });

  // await player.loadScene(jsons);
  // await player.loadScene(json);

  const x0 = 0;
  const y0 = 0;

  const ctrlx0 = .25;
  const ctrly0 = .1;

  const ctrlx1 = .71;
  const ctrly1 = .93;

  const x1 = 1;
  const y1 = 1;

  const outData: spec.EaseOutKeyframeValue = [spec.BezierKeyframeType.EASE_OUT, [0, 0, ctrlx0, ctrly0]];
  const inData: spec.EaseInKeyframeValue = [spec.BezierKeyframeType.EASE_IN, [ctrlx1, ctrly1, 1, 1]];
  const props: spec.BezierKeyframeValue[] = [outData, inData];

  const beziercurve = new BezierCurve(props);

  const scale = 400;
  const canvas = document.getElementById('canvas')!;

  let startTime = 0;
  let points = [];

  startTime = performance.now();
  points = [];
  const outSlop = ctrly0 / ctrlx0;
  const inSlop = (1 - ctrly1) / (1 - ctrlx1);

  for (let i = 0;i < 1;i += 0.00001) {
    const value = bezierInterpolate(0, ctrly0, ctrly1, 1, i);

    // console.log(beziercurve.getValue(i), Hermite(0, ctrly0 / ctrlx0, 1, (1 - ctrlx1) / (1 - ctrly1), i));
    // points.push(1, 1);
  }

  console.log('Hermite time', performance.now() - startTime);

  // drawCurve(points, 'red');

  startTime = performance.now();
  // points = [];

  for (let i = 0;i < 1;i += 0.00001) {
    const value = beziercurve.getValue(i);

    // console.log(beziercurve.getValue(i), Hermite(0, ctrly0 / ctrlx0, 1, (1 - ctrlx1) / (1 - ctrly1), i));
    // points.push(i * scale, canvas.height - value * scale);
  }

  console.log('Beziercurve time', performance.now() - startTime);
  // drawCurve(points, 'blue');

})();

function drawCurve (points, strokeStyle) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

  ctx.beginPath();
  ctx.moveTo(points[0], points[1]); // Move to the first point

  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]); // Draw line to the next point
  }

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.stroke(); // Display the polyline
}

/**
 * Returns a new scalar located for "amount" (float) on the Hermite spline defined by the scalars "value1", "value3", "tangent1", "tangent2".
 * @see http://mathworld.wolfram.com/HermitePolynomial.html
 * @param value1 defines the first control point
 * @param tangent1 defines the first tangent
 * @param value2 defines the second control point
 * @param tangent2 defines the second tangent
 * @param amount defines the amount on the interpolation spline (between 0 and 1)
 * @returns hermite result
 */
export function Hermite (value1: number, tangent1: number, value2: number, tangent2: number, amount: number): number {
  const squared = amount * amount;
  const cubed = amount * squared;
  const part1 = 2.0 * cubed - 3.0 * squared + 1.0;
  const part2 = -2.0 * cubed + 3.0 * squared;
  const part3 = cubed - 2.0 * squared + amount;
  const part4 = cubed - squared;

  return value1 * part1 + value2 * part2 + tangent1 * part3 + tangent2 * part4;
}

// 第一个函数的 TypeScript 版本
function bezierInterpolate (pStart: number, pControl1: number, pControl2: number, pEnd: number, t: number): number {
  // Formula from Wikipedia article on Bezier curves
  const omt = (1.0 - t);
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;
  const t2 = t * t;
  const t3 = t2 * t;

  return pStart * omt3 + pControl1 * omt2 * t * 3.0 + pControl2 * omt * t2 * 3.0 + pEnd * t3;
}