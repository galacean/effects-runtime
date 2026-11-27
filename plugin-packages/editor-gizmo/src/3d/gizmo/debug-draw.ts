import type { Engine, spec } from '@galacean/effects';
import { Geometry, glContext, math } from '@galacean/effects';

type vec3 = spec.vec3;
type Vector3 = math.Vector3;

const { Euler, Vector3, Matrix4 } = math;

const rectSize = 0.04;
const DEG2RAD = Math.PI / 180;

interface LineShapeData {
  points: Vector3[],
  indices: number[],
}

interface ArcPathOptions {
  plane?: string,
  translate?: vec3,
  rotate?: vec3,
}

function arcPath (radius: number, arc: number, options: ArcPathOptions = {}): LineShapeData {
  const { plane, translate = [0, 0, 0], rotate = [0, 0, 0] } = options;
  const rotMat4 = Euler.fromArray(rotate).negate().toMatrix4(new Matrix4());
  const points: Vector3[] = [];
  const indices = [];

  addPoint(radius, 0);
  let i = 1;

  for (; i <= arc; i++) {
    const angle = i * DEG2RAD;

    indices.push(i - 1, i);
    addPoint(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  return {
    points,
    indices,
  };

  function addPoint (cos: number, sin: number) {
    const point = new Vector3();

    if (plane === 'xz') {
      point.set(cos, 0, sin);
    } else if (plane === 'yz') {
      point.set(0, cos, sin);
    } else {
      point.set(cos, sin, 0);
    }
    rotMat4.transformNormal(point);
    points.push(point.add(translate));
  }
}

function line (p0: vec3, p1: vec3): LineShapeData {
  return {
    points: [
      Vector3.fromArray(p0),
      Vector3.fromArray(p1),
    ],
    indices: [0, 1],
  };
}

function box (width: number, height: number, depth: number, center?: number[]): LineShapeData {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const myCenter = center ?? [0, 0, 0];
  const points: Vector3[] = [
    [-w, h, -d], [-w, -h, -d], [-w, h, d], [-w, -h, d],
    [w, h, -d], [w, -h, -d], [w, h, d], [w, -h, d],
  ].map(item => {
    return new Vector3(item[0] + myCenter[0], item[1] + myCenter[1], item[2] + myCenter[2]);
  });

  return {
    points,
    indices: [
      0, 1, 1, 3, 3, 2, 2, 0,
      4, 5, 5, 7, 7, 6, 6, 4,
      0, 4, 2, 6, 3, 7, 1, 5,
    ],
  };
}

function rect (width: number, height: number, pos?: vec3): LineShapeData {
  const w = width / 2;
  const h = height / 2;
  const points: Vector3[] = [
    new Vector3(-w, h, 0),
    new Vector3(w, h, 0),
    new Vector3(w, -h, 0),
    new Vector3(-w, -h, 0),
  ];

  if (pos) {
    points.forEach(vec => {
      vec.add(pos);
    });
  }

  return {
    points,
    indices: [
      0, 1, 1, 2, 2, 3, 3, 0,
    ],
  };
}

function combineGeometries (geometries: LineShapeData[]) {
  const points: number[] = [];
  const indices: number[] = [];

  for (let i = 0, indicesBase = 0; i < geometries.length; i++) {
    const geometry = geometries[i];

    if (geometry) {
      geometry.points.forEach(point => {
        points.push(point.x, point.y, point.z);
      });
      geometry.indices.forEach(index => indices.push(index + indicesBase));
      indicesBase += geometry.points.length;
    }
  }

  return {
    points: new Float32Array(points),
    indices: new Uint16Array(indices),
  };
}

const Shapes: Record<string, (arg: any) => LineShapeData[]> = {
  Texture (arg: any) {
    const ret = [];

    if (arg.detail) {
      const anchors = arg.detail.anchors;
      const block = arg.detail.block;
      const width = arg.width;
      const height = arg.height;

      for (let i = 0; i < anchors.length; i += 2) {
        ret.push(rect(block[0] * width, block[1] * height, [
          width * (anchors[i] - 0.5),
          height * (anchors[i + 1] - 0.5),
          0,
        ]));
      }
    } else {
      ret.unshift(Shapes.Rectangle(arg)[0]);
    }

    return ret;
  },
  Circle (arg: any) {
    const { radius, arc } = arg;

    return [
      arcPath(radius, arc),
      arc !== 360 && line([0, 0, 0], [radius, 0, 0]),
      arc !== 360 && line([0, 0, 0], [Math.cos(arc * DEG2RAD) * radius, Math.sin(arc * DEG2RAD) * radius, 0]),
    ] as LineShapeData[];
  },
  Box: function (arg: any) {
    const {
      width, height, depth, center,
    } = arg;
    const data = box(width, height, depth, center);

    return [data];
  },
  Sphere: function (arg) {
    const { radius, arc } = arg;
    const ret = [
      line([0, 0, -radius], [0, 0, radius]),
      arcPath(radius, arc > 180 ? 360 : 180, { plane: 'xz', rotate: [0, 90, 0] }),
      arcPath(radius, arc, { plane: 'xy' }),
      arcPath(radius, 180, { plane: 'xz', rotate: [0, 90, arc] }),
    ];

    if (arc > 90) {
      ret.push(arcPath(radius, arc > 270 ? 360 : 180, { plane: 'yz', rotate: [-90, 0, 0] }));
    }

    return ret;
  },
  Hemisphere (arg) {
    const { radius, arc } = arg;
    const ret = [
      line([0, 0, radius], [0, 0, 0]), //z
      line([arc > 180 ? -radius : 0, 0, 0], [radius, 0, 0]), //x
      arg > 90 && line([0, arc > 270 ? -radius : 0, 0], [0, radius, 0]), //y
      arcPath(radius, (arc > 180 ? 360 : 180) / 2, { plane: 'xz' }),
      arcPath(radius, arc, { plane: 'xy' }),
      arcPath(radius, 90, { plane: 'xz', rotate: [0, 0, arc] }),
      line([0, 0, 0], [Math.cos(arc * DEG2RAD) * radius, Math.sin(arc * DEG2RAD) * radius, 0]),
    ] as LineShapeData[];

    if (arc > 90) {
      ret.push(arcPath(radius, arc > 270 ? 180 : 90, { plane: 'yz' }));
    }

    return ret;
  },
  Cone (arg) {
    const { radius, arc } = arg;
    const outerRadius = radius * Math.tan(arg.angle * DEG2RAD) + radius;

    return [
      arcPath(outerRadius, arc, { translate: [0, 0, radius] }),
      line([radius, 0, 0], [outerRadius, 0, radius]),
      arc > 90 && line([0, radius, 0], [0, outerRadius, radius]),
      arc > 180 && line([-radius, 0, 0], [-outerRadius, 0, radius]),
      arc > 270 && line([0, -radius, 0], [0, -outerRadius, radius]),
      line([Math.cos(arc * DEG2RAD) * radius, Math.sin(arc * DEG2RAD) * radius, 0],
        [Math.cos(arc * DEG2RAD) * outerRadius, Math.sin(arc * DEG2RAD) * outerRadius, radius]),
    ].concat(Shapes.Circle(arg)) as LineShapeData[];
  },
  Edge (arg) {
    const hw = arg.width / 2;

    return [
      line([-hw, 0, 0], [hw, 0, 0]),
    ];
  },
  Rectangle (arg) {
    return [
      rect(arg.width, arg.height),
    ];
  },
  RectangleEdge (arg) {
    return [
      rect(arg.width, arg.height),
    ];
  },
  Donut (arg) {
    const { arc, radius, donutRadius } = arg;

    return [
      arcPath(donutRadius, 360, { translate: [radius, 0, 0], rotate: [90, 0, 0] }),
      arcPath(radius - donutRadius, arc),
      arcPath(radius + donutRadius, arc),
      arcPath(radius, arc, { translate: [0, 0, donutRadius] }),
      arcPath(radius, arc, { translate: [0, 0, -donutRadius] }),
      arc % 360 === 0 ? arcPath(donutRadius, 360, {
        translate: [-radius, 0, 0],
        rotate: [90, 0, 0],
      }) : arcPath(donutRadius, 360, {
        translate: [Math.cos(arc * DEG2RAD) * radius, Math.sin(arc * DEG2RAD) * radius, 0],
        rotate: [90, 0, arc],
      }),
    ];
  },
  path (arg) {
    const positions = arg.keys;
    const ret = [];

    for (let i = 0; i < positions.length - 1; i++) {
      ret.push(rect(rectSize, rectSize, positions[i]));
      ret.push(line(positions[i], positions[i + 1]));
    }
    ret.push(rect(rectSize, rectSize, positions[positions.length - 1]));

    return ret;
  },
};

Shapes['0'] = Shapes.None;
Shapes['1'] = Shapes.Sphere;
Shapes['2'] = Shapes.Cone;
Shapes['3'] = Shapes.Hemisphere;
Shapes['4'] = Shapes.Circle;
Shapes['5'] = Shapes.Donut;
Shapes['6'] = Shapes.Rectangle;
Shapes['7'] = Shapes.RectangleEdge;
Shapes['8'] = Shapes.Edge;
Shapes['9'] = Shapes.Texture;

export function createLineShapeGeometry (engine: Engine, args: { shape: string, type?: number, [key: string]: unknown }): Geometry {
  const { points, indices } = combineGeometries(Shapes[args.type || args.shape](args));

  return Geometry.create(engine, {
    attributes: {
      a_Position: {
        size: 3,
        data: points,
      },
    },
    indices: { data: indices },
    mode: glContext.LINES,
    drawCount: indices.length,
  });
}

interface GeometryData { points: number[], normals: number[], uvs: number[], indices: number[] }

function createWireGeometry (engine: Engine, points: number[], indices: number[]): Geometry {
  return Geometry.create(engine, {
    attributes: { a_Position: { size: 3, data: new Float32Array(points) } },
    indices: { data: new Uint16Array(indices) }, mode: glContext.LINES, drawCount: indices.length,
  });
}

export function createWireDirectionalLightGeometry (engine: Engine, radius = 1, length = 2, segments = 64, linesNumber = 8, thetaStart = 0, thetaLength = Math.PI * 2): Geometry {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  createXYPlaneCircle(radius, 0, segments, thetaStart, thetaLength, 0, data.points, data.indices);
  const start = segments % linesNumber / 2;
  const step = segments / linesNumber;

  for (let i = 0; i < linesNumber; i++) {
    const index = start + i * step;
    const x = data.points[3 * index];
    const y = data.points[3 * index + 1];
    const z = -length;

    data.points.push(x, y, z);
    data.indices.push(index, segments + i);
  }

  return createWireGeometry(engine, data.points, data.indices);
}

export function createWirePointLightGeometry (engine: Engine, range = 10, segments = 64, thetaStart = 0, thetaLength = Math.PI * 2): Geometry {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  createXYPlaneCircle(range, 0, segments, thetaStart, thetaLength, 0, data.points, data.indices);
  createXZPlaneCircle(range, 0, segments, thetaStart, thetaLength, segments, data.points, data.indices);
  createYZPlaneCircle(range, 0, segments, thetaStart, thetaLength, 2 * segments, data.points, data.indices);

  return createWireGeometry(engine, data.points, data.indices);
}

export function createWireSpotLightGeometry (engine: Engine, range = 10, spotAngle = 30, segments = 64, thetaStart = 0, thetaLength = Math.PI * 2): Geometry {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  const angle = spotAngle / 2 / 180 * Math.PI;
  const radius = range * Math.tan(angle);

  createXYPlaneCircle(radius, -range, segments, thetaStart, thetaLength, 0, data.points, data.indices);
  data.points.push(0, 0, 0);
  const step = segments / 4;
  const start = segments % 4 / 2;

  for (let i = 0; i < 4; i++) {
    data.indices.push(segments, start + i * step);
  }

  return createWireGeometry(engine, data.points, data.indices);
}

export function createWireFrustumGeometry (engine: Engine, position: spec.vec3, rotation: spec.vec3, fov: number, aspect: number, near: number, far: number): Geometry {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  const fovY = fov / 180 * Math.PI;
  const ratio = aspect;
  const halfY = far * Math.tan(fovY / 2);
  const halfX = halfY * ratio;
  const point1 = new Vector3(halfX, halfY, far);
  const point2 = new Vector3(-halfX, halfY, far);
  const point3 = new Vector3(-halfX, -halfY, far);
  const point4 = new Vector3(halfX, -halfY, far);
  const matrix = Euler.fromArray(rotation).toMatrix4(new Matrix4());
  const result1 = matrix.transformPoint(point1).add(position);
  const result2 = matrix.transformPoint(point2).add(position);
  const result3 = matrix.transformPoint(point3).add(position);
  const result4 = matrix.transformPoint(point4).add(position);

  data.points.push(
    ...position,
    ...result1.toArray(), ...result2.toArray(),
    ...result3.toArray(), ...result4.toArray()
  );
  data.indices.push(0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1);

  return createWireGeometry(engine, data.points, data.indices);
}

function createXYPlaneCircle (
  radius: number,
  z: number,
  segments: number,
  thetaStart: number,
  thetaLength: number,
  startIndex: number,
  points: number[],
  indices: number[],
) {
  for (let i = 0; i < segments; i++) {
    const theta = thetaStart + i * thetaLength / segments;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    points.push(x, y, z);
    indices.push(startIndex + i, startIndex + (i + 1) % segments);
  }
}

function createXZPlaneCircle (
  radius: number,
  y: number,
  segments: number,
  thetaStart: number,
  thetaLength: number,
  startIndex: number,
  points: number[],
  indices: number[],
) {
  for (let i = 0; i < segments; i++) {
    const theta = thetaStart + i * thetaLength / segments;
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);

    points.push(x, y, z);
    indices.push(startIndex + i, startIndex + (i + 1) % segments);
  }
}

function createYZPlaneCircle (
  radius: number,
  x: number,
  segments: number,
  thetaStart: number,
  thetaLength: number,
  startIndex: number,
  points: number[],
  indices: number[],
) {
  for (let i = 0; i < segments; i++) {
    const theta = thetaStart + i * thetaLength / segments;
    const z = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    points.push(x, y, z);
    indices.push(startIndex + i, startIndex + (i + 1) % segments);
  }
}
