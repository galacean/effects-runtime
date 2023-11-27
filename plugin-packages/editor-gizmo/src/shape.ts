import type { Engine, spec } from '@galacean/effects';
import { Geometry, Material, Mesh, glContext, math } from '@galacean/effects';

type vec3 = spec.vec3;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;

const { Euler, Vector3, Matrix4 } = math;

const rectSize = 0.04;
const DEG2RAD = Math.PI / 180;

interface GeometryData {
  points: Vector3[],
  indices: number[],
}

interface ArcPathOptions {
  plane?: string,
  translate?: vec3,
  rotate?: vec3,
}

function arcPath (radius: number, arc: number, options: ArcPathOptions = {}): GeometryData {
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

function line (p0: vec3, p1: vec3): GeometryData {
  return {
    points: [
      Vector3.fromArray(p0),
      Vector3.fromArray(p1),
    ],
    indices: [0, 1],
  };
}

function box (width: number, height: number, depth: number, center?: number[]): GeometryData {
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

function rect (width: number, height: number, pos?: vec3): GeometryData {
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

function combineGeometries (geometries: GeometryData[]) {
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

const Shapes: Record<string, (arg: any) => GeometryData[]> = {
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
    ] as GeometryData[];
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
    ] as GeometryData[];

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
    ].concat(Shapes.Circle(arg)) as GeometryData[];
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

export function createMeshFromShape (engine: Engine, args: { shape: string, type?: number }, options: { color?: vec3, depthTest?: boolean }): Mesh {
  const ret = Shapes[args.type || args.shape](args);
  const geo = combineGeometries(ret);

  return createMesh(engine, geo.points, geo.indices, options.color || [1, 0, 0], options.depthTest, args.shape);
}

function createMesh (engine: Engine, points: Float32Array, indices: Uint16Array, color: vec3, depthTest = false, name?: string): Mesh {
  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(color),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      uniformSemantics: {
        u_vp: 'VIEWPROJECTION',
        u_et: 'EDITOR_TRANSFORM',
      },
      shader: {
        shared: true,
        fragment: `
    precision mediump float;

    uniform vec3 u_color;

    void main(){
      gl_FragColor = vec4(u_color,1.0);
    }`,
        vertex: `precision highp float;

    attribute vec3 a_Position;

    uniform mat4 u_model;
    uniform mat4 effects_MatrixVP;
    uniform vec4 uEditorTransform;
    void main(){
      gl_Position = effects_MatrixVP * u_model * vec4(a_Position,1.0);
      gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w,gl_Position.zw);
    }`,
      },
    });

  material.setVector3('u_color', Vector3.fromArray(color));
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.depthTest = depthTest;
  material.stencilTest = false;
  material.blending = false;
  material.depthMask = true;
  const geometry = Geometry.create(
    engine,
    {
      attributes: {
        a_Position: {
          size: 3,
          data: points,
        },
      },
      indices: {
        data: indices,
      },
      mode: glContext.LINES,
      drawCount: indices.length,
    });

  return Mesh.create(
    engine,
    {
      name,
      geometry,
      material,
      priority: 3000,
    });
}
