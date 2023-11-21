import type { Node } from '../libs/earcut';
import { indexCurve, isEarHashed, eliminateHoles, splitPolygon, isValidDiagonal, isEar, linkedList, equals, intersects, locallyInside, removeNode, filterPoints } from '../libs/earcut';

let indexBase = 0;

export function earcut (data: number[], holeIndices: number[] | null, dim: number, ib: number) {
  dim = dim || 2;
  indexBase = ib || 0;

  const hasHoles = holeIndices && holeIndices.length;
  const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
  let outerNode = linkedList(data, 0, outerLen, dim, true);
  const triangles: number[] = [];

  if (!outerNode || outerNode.next === outerNode.prev) {
    return triangles;
  }

  let minX: number | undefined, minY: number | undefined, maxX, maxY, x, y, invSize: number | undefined;

  if (hasHoles) {
    outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
  }

  // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
  if (data.length > 80 * dim) {
    minX = maxX = data[0];
    minY = maxY = data[1];

    for (let i = dim; i < outerLen; i += dim) {
      x = data[i];
      y = data[i + 1];
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }

    // minX, minY and invSize are later used to transform coords into integers for z-order calculation
    invSize = Math.max(maxX - minX, maxY - minY);
    invSize = invSize !== 0 ? 1 / invSize : 0;
  }

  hackEarcutLinked(outerNode, triangles, dim, minX, minY, invSize);

  return triangles;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function hackEarcutLinked (ear: Node, triangles: number[], dim: number, minX?: number, minY?: number, invSize?: number, pass?: number) {
  if (!ear) {
    return;
  }

  // interlink polygon nodes in z-order
  if (!pass && invSize) {
    indexCurve(ear, minX!, minY!, invSize);
  }

  let stop = ear, prev, next;

  // iterate through ears, slicing them one by one
  while (ear.prev !== ear.next) {
    prev = ear.prev;
    next = ear.next;

    if (invSize ? isEarHashed(ear, minX!, minY!, invSize) : isEar(ear)) {
      // cut off the triangle
      triangles.push(prev.i / dim + indexBase);
      triangles.push(ear.i / dim + indexBase);
      triangles.push(next.i / dim + indexBase);

      removeNode(ear);

      // skipping the next vertex leads to less sliver triangles
      ear = next.next;
      stop = next.next;

      continue;
    }

    ear = next;

    // if we looped through the whole remaining polygon and can't find any more ears
    if (ear === stop) {
      // try filtering triangles and slicing again
      if (!pass) {
        hackEarcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

        // if this didn't work, try curing all small self-intersections locally
      } else if (pass === 1) {
        ear = hackCureLocalIntersections(filterPoints(ear), triangles, dim);
        hackEarcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

        // as a last resort, try splitting the remaining polygon into two
      } else if (pass === 2) {
        hackSplitEarcut(ear, triangles, dim, minX, minY, invSize);
      }

      break;
    }
  }
}

// go through all polygon nodes and cure small local self-intersections
function hackCureLocalIntersections (start: Node, triangles: number[], dim: number) {
  let p = start;

  do {
    const a = p.prev, b = p.next.next;

    if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
      triangles.push(a.i / dim + indexBase);
      triangles.push(p.i / dim + indexBase);
      triangles.push(b.i / dim + indexBase);

      // remove two nodes involved
      removeNode(p);
      removeNode(p.next);

      p = start = b;
    }
    p = p.next;
  } while (p !== start);

  return filterPoints(p);
}

// try splitting polygon into two and triangulate them independently
function hackSplitEarcut (start: Node, triangles: number[], dim: number, minX?: number, minY?: number, invSize?: number) {
  // look for a valid diagonal that divides the polygon into two
  let a = start;

  do {
    let b = a.next.next;

    while (b !== a.prev) {
      if (a.i !== b.i && isValidDiagonal(a, b)) {
        // split the polygon in two by the diagonal
        let c = splitPolygon(a, b);

        // filter colinear triangles around the cuts
        a = filterPoints(a, a.next);
        c = filterPoints(c, c.next);

        // run earcut on each half
        hackEarcutLinked(a, triangles, dim, minX, minY, invSize);
        hackEarcutLinked(c, triangles, dim, minX, minY, invSize);

        return;
      }
      b = b.next;
    }
    a = a.next;
  } while (a !== start);
}
