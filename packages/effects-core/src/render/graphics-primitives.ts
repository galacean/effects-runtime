const MITER_LIMIT = 3;
const circleSamples = new Map<number, Float64Array>();
const MAX_CACHED_CIRCLES = 16;
// Keep both rings within a batch's 16-bit vertex range and the segment count divisible by four.
const MAX_CIRCLE_SEGMENTS = Math.floor(0xffff / 8) * 4;

/** Builds a centered line quad with butt caps, overwriting the supplied vertex and index arrays. */
export function buildLineMesh (x1: number, y1: number, x2: number, y2: number, width: number, vertices: number[], indices: number[]): void {
  vertices.length = indices.length = 0;
  const dx = x2 - x1, dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (width <= 0 || length === 0) { return; }
  const scale = width * .5 / length;
  const nx = dy * scale, ny = -dx * scale;

  vertices.push(x1 + nx, y1 + ny, x1 - nx, y1 - ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny);
  indices.push(0, 1, 2, 1, 3, 2);
}

/**
 * Builds a centered, uniform-width polyline with butt caps and miter offsets capped at three half-widths.
 * Input is finite x/y pairs without consecutive duplicates or a repeated closing point.
 * The supplied vertex and index arrays are overwritten.
 */
export function buildPolylineMesh (points: readonly number[], width: number, closed: boolean, vertices: number[], indices: number[]): void {
  vertices.length = indices.length = 0;
  const count = points.length / 2;

  if (count < 2 || width <= 0) { return; }
  if (count === 2) {
    buildLineMesh(points[0], points[1], points[2], points[3], width, vertices, indices);

    return;
  }
  const halfWidth = width * .5;
  let previousX = 0, previousY = 0;

  if (closed) {
    previousX = points[0] - points[points.length - 2];
    previousY = points[1] - points[points.length - 1];
    const length = Math.sqrt(previousX * previousX + previousY * previousY);

    previousX /= length; previousY /= length;
  }
  for (let index = 0; index < count; index++) {
    const x = points[index * 2], y = points[index * 2 + 1];
    let dx = previousX, dy = previousY;

    if (index < count - 1 || closed) {
      const next = (index + 1) % count;

      dx = points[next * 2] - x; dy = points[next * 2 + 1] - y;
      const length = Math.sqrt(dx * dx + dy * dy);

      dx /= length; dy /= length;
    }
    let nx = dy * halfWidth, ny = -dx * halfWidth;

    if (index > 0 || closed) {
      let mx = previousY + dy, my = -previousX - dx;
      const length = Math.sqrt(mx * mx + my * my);

      if (length > 1e-6) {
        mx /= length; my /= length;
        const projection = mx * dy - my * dx;
        const distance = halfWidth * Math.min(MITER_LIMIT, 1 / projection);

        nx = mx * distance; ny = my * distance;
      }
    }
    vertices.push(x + nx, y + ny, x - nx, y - ny);
    if (index > 0) {
      const current = index * 2, previous = current - 2;

      indices.push(previous, previous + 1, current, previous + 1, current + 1, current);
    }
    previousX = dx; previousY = dy;
  }
  if (closed) {
    const last = (count - 1) * 2;

    indices.push(last, last + 1, 0, last + 1, 1, 0);
  }
}

/** Builds a centered rectangular border, filling the outer rectangle when no inner opening remains. */
export function buildRectangleStrokeMesh (x: number, y: number, width: number, height: number, thickness: number, vertices: number[], indices: number[]): void {
  vertices.length = indices.length = 0;
  if (thickness <= 0) { return; }
  const left = Math.min(x, x + width), top = Math.min(y, y + height);
  const right = Math.max(x, x + width), bottom = Math.max(y, y + height);
  const halfWidth = thickness * .5;

  vertices.push(left - halfWidth, top - halfWidth, right + halfWidth, top - halfWidth,
    right + halfWidth, bottom + halfWidth, left - halfWidth, bottom + halfWidth);
  if (Math.abs(width) <= thickness || Math.abs(height) <= thickness) {
    indices.push(0, 1, 2, 0, 2, 3);

    return;
  }
  vertices.push(left + halfWidth, top + halfWidth, right - halfWidth, top + halfWidth,
    right - halfWidth, bottom - halfWidth, left + halfWidth, bottom - halfWidth);
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;

    indices.push(index, next, index + 4, next, next + 4, index + 4);
  }
}

/**
 * Builds a centered circular border, or a disk when the stroke reaches the center.
 * Sampling density follows screenScale; unit-circle samples are cached by segment count.
 */
export function buildCircleStrokeMesh (x: number, y: number, radius: number, width: number, screenScale: number, vertices: number[], indices: number[]): void {
  vertices.length = indices.length = 0;
  if (width <= 0 || radius <= 0) { return; }
  const outer = radius + width * .5;
  const inner = Math.max(0, radius - width * .5);

  const count = Math.min(MAX_CIRCLE_SEGMENTS, Math.max(8, 4 * Math.ceil(Math.sqrt(outer * 2 * screenScale))));
  const samples = getCircleSamples(count);

  if (inner === 0) { vertices.push(x, y); }
  for (let index = 0; index < count; index++) {
    const nx = samples[index * 2], ny = samples[index * 2 + 1];

    vertices.push(x + nx * outer, y + ny * outer);
    if (inner > 0) { vertices.push(x + nx * inner, y + ny * inner); }
    const next = (index + 1) % count;

    if (inner === 0) {
      indices.push(0, index + 1, next + 1);
    } else {
      const current = index * 2, following = next * 2;

      indices.push(current, following, current + 1, following, following + 1, current + 1);
    }
  }
}

function getCircleSamples (count: number): Float64Array {
  let samples = circleSamples.get(count);

  if (!samples) {
    samples = new Float64Array(count * 2);
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count;

      samples[index * 2] = Math.cos(angle); samples[index * 2 + 1] = Math.sin(angle);
    }
    if (circleSamples.size >= MAX_CACHED_CIRCLES) { circleSamples.delete(circleSamples.keys().next().value); }
    circleSamples.set(count, samples);
  }

  return samples;
}
