import * as libtess from 'libtess';

const windingRules = {
  ODD: libtess.windingRule.GLU_TESS_WINDING_ODD,
  NONZERO: libtess.windingRule.GLU_TESS_WINDING_NONZERO,
  POSITIVE: libtess.windingRule.GLU_TESS_WINDING_POSITIVE,
  ABS_GEQ_TWO: libtess.windingRule.GLU_TESS_WINDING_ABS_GEQ_TWO,
};

const tessy = (function initBoundaryTesselator () {
  const tessy = new libtess.GluTesselator();

  tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_BOUNDARY_ONLY, true);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, (data: number[], output: number[][]) => {
    output[output.length - 1].push(data[0], data[1]);
  });
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN_DATA, (_type: number, output: number[][]) => {
    output.push([]);
  });
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, (errno: number) => {
    console.error('boundary error callback, error number: ' + errno);
  });
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, (coords: number[]) => {
    return [coords[0], coords[1], coords[2]];
  });

  return tessy;
})();

function resolveContours (
  contours: number[][],
  winding: keyof typeof windingRules = 'NONZERO',
): number[][] {
  // Reset the rule on every call because union and clipping share the tessellator.
  tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, windingRules[winding]);
  tessy.gluTessNormal(0, 0, 1);
  const output: number[][] = [];

  tessy.gluTessBeginPolygon(output);
  for (const contour of contours) {
    if (contour.length < 6) {
      continue;
    }
    tessy.gluTessBeginContour();
    for (let i = 0; i < contour.length; i += 2) {
      const coords = [contour[i], contour[i + 1], 0];

      tessy.gluTessVertex(coords, coords);
    }
    tessy.gluTessEndContour();
  }
  tessy.gluTessEndPolygon();

  return output.filter(contour => contour.length >= 6);
}

function ensureExplicitlyClosed (contours: number[][]): number[][] {
  return contours.map(contour => {
    const firstX = contour[0];
    const firstY = contour[1];

    if (firstX === contour[contour.length - 2] && firstY === contour[contour.length - 1]) {
      return contour;
    }

    return [...contour, firstX, firstY];
  });
}

/** Resolve the odd-winding regions of a self-intersecting contour. */
export function split (contour: number[], closeOutput = true): number[][] {
  return splitContours([contour], closeOutput);
}

/** Resolve all contours together using the odd winding rule. */
export function splitContours (contours: number[][], closeOutput = true): number[][] {
  const result = resolveContours(contours, 'ODD');

  return closeOutput ? ensureExplicitlyClosed(result) : result;
}

/** Resolve the nonzero-winding regions of a self-intersecting contour. */
export function union (contour: number[], closeOutput = true): number[][] {
  return unionContours([contour], closeOutput);
}

/** Resolve all contours together, retaining holes indicated by opposite winding. */
export function unionContours (contours: number[][], closeOutput = true): number[][] {
  const result = resolveContours(contours);

  return closeOutput ? ensureExplicitlyClosed(result) : result;
}

/** Intersect or subtract nonzero-winding regions without depending on input orientation. */
export function clipContours (
  subject: number[][],
  mask: number[][],
  operation: 'intersect' | 'subtract',
  closeOutput = true,
): number[][] {
  // Normalize each operand first: its interior then contributes exactly +1 to winding.
  // This keeps overlapping patches and self-intersections from changing the boolean operation.
  const subjectBoundary = resolveContours(subject);
  const maskBoundary = resolveContours(mask);
  let result: number[][];

  if (operation === 'intersect') {
    result = resolveContours([...subjectBoundary, ...maskBoundary], 'ABS_GEQ_TWO');
  } else {
    const reversedMask = maskBoundary.map(contour => {
      const reversed: number[] = [];

      for (let i = contour.length - 2; i >= 0; i -= 2) {
        reversed.push(contour[i], contour[i + 1]);
      }

      return reversed;
    });

    result = resolveContours([...subjectBoundary, ...reversedMask], 'POSITIVE');
  }

  return closeOutput ? ensureExplicitlyClosed(result) : result;
}
