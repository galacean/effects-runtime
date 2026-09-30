import type { Engine, Geometry, spec } from '@galacean/effects';
import { glContext, Material, Mesh, Texture, Transform, math } from '@galacean/effects';
import type { MeshOption } from './geometry';
import { createGeometry, GeometryType } from './geometry';
import { GizmoSubType } from './define';
import type { GizmoItemBounding } from './gizmo-vfx-item';
import { BoundingType } from './gizmo-vfx-item';
import { color, renderMode } from './constants';

type vec3 = spec.vec3;
type Vector3 = math.Vector3;
type TriangleLike = math.TriangleLike;
const { Vector2, Vector3, Matrix4 } = math;

/**
 * 根据 gizmoSubType 类型创建几何体 Mesh
 * @param subType - gizmoSubType 类型
 * @param boundingMap - 包围盒 Map
 * @param iconTexture - 图标纹理
 * @param options - 几何体参数
 * @returns 基础几何体 Mesh | 组合几何体 Map<Mesh, Transform>
 */
export function createMeshFromSubType (
  engine: Engine,
  subType: GizmoSubType,
  boundingMap: Map<string, GizmoItemBounding>,
  iconTexture?: Map<string, Texture>,
  options?: MeshOption
): Mesh | Map<Mesh, Transform> {
  let result: Mesh | Map<Mesh, Transform>;

  if (!options) {
    options = { size: 0, renderMode: WebGLRenderingContext['TRIANGLES'] };
  }

  switch (subType) {
    case GizmoSubType.sprite:
      result = createSpriteMesh(engine, options);

      break;
    case GizmoSubType.camera:
      result = createSpriteMesh(engine, options, iconTexture ? iconTexture.get('camera') : undefined, boundingMap);

      break;
    case GizmoSubType.light:
      result = createSpriteMesh(engine, options, iconTexture ? iconTexture.get('light') : undefined, boundingMap);

      break;
    case GizmoSubType.translation:
      result = createTranslationMesh(engine, options, boundingMap);

      break;
    case GizmoSubType.scale:
      result = createScaleMesh(engine, options, boundingMap);

      break;
    case GizmoSubType.viewHelper:
      result = createViewHelperMesh(engine, options, boundingMap, iconTexture as Map<string, Texture>);

      break;
    case GizmoSubType.rotation:
      result = createRotationMesh(engine, options, boundingMap);

      break;
    default:
      result = createBasicMesh(engine, subType, options);

      break;
  }

  return result;
}

/**
 * 创建旋转组件 Mesh 数组
 * @internal
 * @param options
 * @param boundingMap - 包围盒 Map
 * @returns Mesh 数组和对应的 Transform 组成的 Map
 */
function createRotationMesh (
  engine: Engine,
  options: MeshOption,
  boundingMap: Map<string, GizmoItemBounding>,
): Map<Mesh, Transform> {
  const result: Map<Mesh, Transform> = new Map();
  const scale = options.size.scale || 1;
  const size = {
    radius: 0.8 * scale,
    tube: 0.02 * scale,
    radiusSegments: 10 * scale,
    widthSegments: 20,
    heightSegments: 20,
  };
  const boundSize = { ...size, tube: size.tube * 2 };
  const name = 'rotation';
  const xCircle = createBasicMesh(engine, GizmoSubType.torus, {
    size, color: color.xAxisColor as vec3, renderMode, name,
  }, 'hideBack');
  const yCircle = createBasicMesh(engine, GizmoSubType.torus, {
    size, color: color.yAxisColor as vec3, renderMode, name,
  }, 'hideBack');
  const zCircle = createBasicMesh(engine, GizmoSubType.torus, {
    size, color: color.zAxisColor as vec3, renderMode, name,
  }, 'hideBack');
  const center = createBasicMesh(engine, GizmoSubType.sphere, {
    size, color: [0.3, 0.3, 0.3], alpha: 0.1, renderMode, name,
  }, 'blend');
  const xCircleBounding = createBasicMesh(engine, GizmoSubType.torus, {
    size: boundSize,
    color: color.xAxisColor as vec3,
    renderMode,
  });
  const yCircleBounding = createBasicMesh(engine, GizmoSubType.torus, {
    size: boundSize,
    color: color.yAxisColor as vec3,
    renderMode,
  });
  const zCircleBounding = createBasicMesh(engine, GizmoSubType.torus, {
    size: boundSize,
    color: color.zAxisColor as vec3,
    renderMode,
  });

  const xCircleTransform = new Transform({
    valid: true,
  });
  const yCircleTransform = new Transform({
    valid: true,
  });
  const zCircleTransform = new Transform({
    valid: true,
  });
  const centerTransform = new Transform({
    valid: true,
  });

  xCircleTransform.setRotation(0, 90, 0);
  yCircleTransform.setRotation(-90, 0, 0);
  zCircleTransform.setRotation(0, 0, 0);
  result.set(center, centerTransform);
  result.set(xCircle, xCircleTransform);
  result.set(yCircle, yCircleTransform);
  result.set(zCircle, zCircleTransform);

  boundingMap.set('xAxis', {
    type: BoundingType.triangle,
    triangles: xCircleBounding.firstGeometry() ? getTriangle(xCircleBounding.firstGeometry(), xCircleTransform) : [],
    backfaceCulling: true,
  });
  boundingMap.set('yAxis', {
    type: BoundingType.triangle,
    triangles: yCircleBounding.firstGeometry() ? getTriangle(yCircleBounding.firstGeometry(), yCircleTransform) : [],
    backfaceCulling: true,
  });
  boundingMap.set('zAxis', {
    type: BoundingType.triangle,
    triangles: zCircleBounding.firstGeometry() ? getTriangle(zCircleBounding.firstGeometry(), zCircleTransform) : [],
    backfaceCulling: true,
  });

  return result;
}

/**
 * 获取几何体的三角面数组
 * @internal
 * @param geometry - 几何体
 * @param transform - 变换式
 * @returns 三角面数组
 */
function getTriangle (geometry: Geometry, transform: Transform): TriangleLike[] {
  const result: TriangleLike[] = [];
  const indices = geometry.getIndexData();
  const points = geometry.getAttributeData('a_Position');
  const mat4 = transform.getWorldMatrix();

  if (points && indices && indices.length > 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      const p0 = new Vector3(points[i0], points[i0 + 1], points[i0 + 2]);
      const p1 = new Vector3(points[i1], points[i1 + 1], points[i1 + 2]);
      const p2 = new Vector3(points[i2], points[i2 + 1], points[i2 + 2]);

      result.push({
        p0: mat4.projectPoint(p0),
        p1: mat4.projectPoint(p1),
        p2: mat4.projectPoint(p2),
      });

    }
  }

  return result;
}

/**
 * 创建位移组件 Mesh 数组
 * @internal
 * @param options
 * @param boundingMap - 包围盒 Map
 * @returns Mesh 数组和对应的 Transform 组成的 Map
 */
function createTranslationMesh (engine: Engine, options: MeshOption, boundingMap: Map<string, GizmoItemBounding>): Map<Mesh, Transform> {
  const result: Map<Mesh, Transform> = new Map();
  const scale = options.size.scale || 1;
  const axisSize = {
    width: 0.8 * scale,
    height: 0.02 * scale,
    depth: 0.02 * scale,
  };
  const name = 'translation';
  const axisMesh = createAxisMesh(engine, axisSize, false, name);

  for (const [mesh, transform] of axisMesh) {
    result.set(mesh, transform);
  }

  const arrowSize = {
    radius: 0.05 * scale,
    height: 0.2 * scale,
  };
  const xArrow = createBasicMesh(engine, GizmoSubType.cone, {
    size: arrowSize,
    color: color.xAxisColor as vec3,
    renderMode,
    depthTest: true,
    name,
  }, 'blend');
  const yArrow = createBasicMesh(engine, GizmoSubType.cone, {
    size: arrowSize,
    color: color.yAxisColor as vec3,
    renderMode,
    depthTest: true,
    name,
  }, 'blend');
  const zArrow = createBasicMesh(engine, GizmoSubType.cone, {
    size: arrowSize,
    color: color.zAxisColor as vec3,
    renderMode,
    name,
    depthTest: true,
  }, 'blend');
  const xArrowTransform = new Transform({
    valid: true,
  });
  const yArrowTransform = new Transform({
    valid: true,
  });
  const zArrowTransform = new Transform({
    valid: true,
  });

  xArrowTransform.setRotation(0, 0, 90);
  yArrowTransform.setRotation(0, 0, 0);
  zArrowTransform.setRotation(-90, 0, 0);
  xArrowTransform.translate(axisSize.width, 0, 0);
  yArrowTransform.translate(0, axisSize.width, 0);
  zArrowTransform.translate(0, 0, axisSize.width);

  const planeSize = {
    width: 0.2 * scale,
    height: 0.2 * scale,
  };
  const xyPlane = createBasicMesh(engine, GizmoSubType.plane, {
    size: planeSize, color: color.zAxisColor as vec3, renderMode, depthTest: true, name,
  });
  const yzPlane = createBasicMesh(engine, GizmoSubType.plane, {
    size: planeSize, color: color.xAxisColor as vec3, renderMode, depthTest: true, name,
  });
  const zxPlane = createBasicMesh(engine, GizmoSubType.plane, {
    size: planeSize, color: color.yAxisColor as vec3, renderMode, depthTest: true, name,
  });
  const xyPlaneTransform = new Transform({
    valid: true,
  });
  const yzPlaneTransform = new Transform({
    valid: true,
  });
  const zxPlaneTransform = new Transform({
    valid: true,
  });
  const delta = axisSize.width / 8;

  xyPlaneTransform.translate(planeSize.width / 2 + delta, planeSize.height / 2 + delta, 0);
  yzPlaneTransform.setRotation(0, 90, 0);
  yzPlaneTransform.translate(0, planeSize.height / 2 + delta, planeSize.width / 2 + delta);
  zxPlaneTransform.setRotation(-90, 0, 0);
  zxPlaneTransform.translate(planeSize.width / 2 + delta, 0, planeSize.height / 2 + delta);

  result.set(xArrow, xArrowTransform);
  result.set(yArrow, yArrowTransform);
  result.set(zArrow, zArrowTransform);
  result.set(xyPlane, xyPlaneTransform);
  result.set(yzPlane, yzPlaneTransform);
  result.set(zxPlane, zxPlaneTransform);

  createAxisBounding({ width: arrowSize.radius * 2.4, length: axisSize.width + arrowSize.height / 2 }, boundingMap);
  boundingMap.set('xyPlane', {
    type: BoundingType.triangle,
    triangles: xyPlane.firstGeometry() ? getTriangle(xyPlane.firstGeometry(), xyPlaneTransform) : [],
    backfaceCulling: false,
  });

  // FIXME: getTriangle 函数调用 getWorldMatrix 后 worldMatrix被修改
  boundingMap.set('yzPlane', {
    type: BoundingType.triangle,
    triangles: yzPlane.firstGeometry() ? getTriangle(yzPlane.firstGeometry(), yzPlaneTransform) : [],
    backfaceCulling: false,
  });
  boundingMap.set('zxPlane', {
    type: BoundingType.triangle,
    triangles: zxPlane.firstGeometry() ? getTriangle(zxPlane.firstGeometry(), zxPlaneTransform) : [],
    backfaceCulling: false,
  });

  return result;
}

/**
 * 创建缩放组件 Mesh 数组
 * @internal
 * @param options
 * @param boundingMap - 包围盒 Map
 * @returns Mesh 数组和对应的 Transform 组成的 Map
 */
function createScaleMesh (engine: Engine, options: MeshOption, boundingMap: Map<string, GizmoItemBounding>): Map<Mesh, Transform> {
  const result: Map<Mesh, Transform> = new Map();
  const scale = options.size.scale || 1;
  const axisSize = {
    width: 0.8 * scale,
    height: 0.02 * scale,
    depth: 0.02 * scale,
  };
  const name = 'scale';
  const axisMesh = createAxisMesh(engine, axisSize, false, name);

  for (const [mesh, transform] of axisMesh) {
    result.set(mesh, transform);
  }
  const boxSize = {
    width: 0.1 * scale,
    height: 0.1 * scale,
    depth: 0.1 * scale,
  };
  const centerBoxSize = {
    width: 0.2 * scale,
    height: 0.2 * scale,
    depth: 0.2 * scale,
  };
  const xCube = createBasicMesh(engine, GizmoSubType.box, {
    size: boxSize, color: color.xAxisColor as vec3, renderMode, depthTest: true, name,
  }, 'blend');
  const yCube = createBasicMesh(engine, GizmoSubType.box, {
    size: boxSize, color: color.yAxisColor as vec3, renderMode, depthTest: true, name,
  }, 'blend');
  const zCube = createBasicMesh(engine, GizmoSubType.box, {
    size: boxSize, color: color.zAxisColor as vec3, renderMode, depthTest: true, name,
  }, 'blend');
  const centerCube = createBasicMesh(engine, GizmoSubType.box, {
    size: centerBoxSize,
    color: [0.8, 0.8, 0.8],
    renderMode,
    depthTest: true,
    name,
  }, 'blend');
  const xCubeTransform = new Transform({
    valid: true,
  });
  const yCubeTransform = new Transform({
    valid: true,
  });
  const zCubeTransform = new Transform({
    valid: true,
  });
  const centerCubeTransform = new Transform({
    valid: true,
  });

  xCubeTransform.translate(axisSize.width, 0, 0);
  yCubeTransform.translate(0, axisSize.width, 0);
  zCubeTransform.translate(0, 0, axisSize.width);
  result.set(centerCube, centerCubeTransform);
  result.set(xCube, xCubeTransform);
  result.set(yCube, yCubeTransform);
  result.set(zCube, zCubeTransform);

  createAxisBounding({ width: boxSize.width * 1.2, length: axisSize.width + boxSize.width / 2 }, boundingMap);
  boundingMap.set('center', {
    type: BoundingType.sphere,
    center: new Vector3(),
    radius: Math.pow(Math.pow(centerBoxSize.width, 2) + Math.pow(centerBoxSize.height, 2) + Math.pow(centerBoxSize.depth, 2), 0.5) / 2,
  });

  return result;
}

/**
 * 创建视图辅助组件 Mesh 数组
 * @internal
 * @param options
 * @param boundingMap - 包围盒 Map
 * @returns Mesh 数组和对应的 Transform 组成的 Map
 */
function createViewHelperMesh (engine: Engine, options: MeshOption, boundingMap: Map<string, GizmoItemBounding>, texture: Map<string, Texture>): Map<Mesh, Transform> {
  const result: Map<Mesh, Transform> = new Map();
  const scale = options.size.scale || 1;
  const axisSize = {
    width: 0.8 * scale,
    height: 0.02 * scale,
    depth: 0.02 * scale,
  };
  const axisMesh = createAxisMesh(engine, axisSize, true);

  for (const [mesh, transform] of axisMesh) {
    result.set(mesh, transform);
  }
  const planeSize = {
    width: 0.14 * scale,
    height: 0.14 * scale,
  };
  const length = (axisSize.width + planeSize.width) / 2;
  const depthTest = true;
  const posXSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('posX'));
  const posYSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('posY'));
  const posZSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('posZ'));
  const posXSphereTransform = new Transform({
    valid: true,
  });
  const posYSphereTransform = new Transform({
    valid: true,
  });
  const posZSphereTransform = new Transform({
    valid: true,
  });

  posXSphereTransform.translate(length, 0, 0);
  posYSphereTransform.translate(0, length, 0);
  posZSphereTransform.translate(0, 0, length);
  const negXSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('negX'));
  const negYSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('negY'));
  const negZSphere = createSpriteMesh(engine, { size: planeSize, renderMode, depthTest }, texture.get('negZ'));
  const negXSphereTransform = new Transform({
    valid: true,
  });
  const negYSphereTransform = new Transform({
    valid: true,
  });
  const negZSphereTransform = new Transform({
    valid: true,
  });

  negXSphereTransform.translate(-length, 0, 0);
  negYSphereTransform.translate(0, -length, 0);
  negZSphereTransform.translate(0, 0, -length);

  result.set(posXSphere, posXSphereTransform);
  result.set(posYSphere, posYSphereTransform);
  result.set(posZSphere, posZSphereTransform);
  result.set(negXSphere, negXSphereTransform);
  result.set(negYSphere, negYSphereTransform);
  result.set(negZSphere, negZSphereTransform);

  const radius = (planeSize.height / 2) * 1.2;

  boundingMap.set('posX', {
    type: BoundingType.sphere,
    center: posXSphereTransform.position,
    radius: radius,
  });
  boundingMap.set('posY', {
    type: BoundingType.sphere,
    center: posYSphereTransform.position,
    radius: radius,
  });
  boundingMap.set('posZ', {
    type: BoundingType.sphere,
    center: posZSphereTransform.position,
    radius: radius,
  });
  boundingMap.set('negX', {
    type: BoundingType.sphere,
    center: negXSphereTransform.position,
    radius: radius,
  });
  boundingMap.set('negY', {
    type: BoundingType.sphere,
    center: negYSphereTransform.position,
    radius: radius,
  });
  boundingMap.set('negZ', {
    type: BoundingType.sphere,
    center: negZSphereTransform.position,
    radius: radius,
  });

  return result;
}

/**
 * 创建坐标轴 Mesh 数组
 * @internal
 * @param axisSize - 坐标轴尺寸
 * @param isCentered - 是否居中，默认 false
 * @returns Mesh 数组和对应的 Transform 组成的 Map
 */
function createAxisMesh (engine: Engine, axisSize: { width: number, height: number, depth: number }, isCentered = false, name?: string): Map<Mesh, Transform> {
  const result: Map<Mesh, Transform> = new Map();
  const xAxis = createBasicMesh(engine, GizmoSubType.box, {
    size: axisSize, color: color.xAxisColor as vec3, renderMode, depthTest: true, name,
  });
  const yAxis = createBasicMesh(engine, GizmoSubType.box, {
    size: axisSize, color: color.yAxisColor as vec3, renderMode, depthTest: true, name,
  });
  const zAxis = createBasicMesh(engine, GizmoSubType.box, {
    size: axisSize, color: color.zAxisColor as vec3, renderMode, depthTest: true, name,
  });

  const xAxisTransform = new Transform({
    valid: true,
  });
  const yAxisTransform = new Transform({
    valid: true,
  });
  const zAxisTransform = new Transform({
    valid: true,
  });

  yAxisTransform.setRotation(0, 0, 90);
  zAxisTransform.setRotation(0, -90, 0);
  if (!isCentered) {
    xAxisTransform.translate(axisSize.width / 2, 0, 0);
    yAxisTransform.translate(0, axisSize.width / 2, 0);
    zAxisTransform.translate(0, 0, axisSize.width / 2);
  }
  result.set(xAxis, xAxisTransform);
  result.set(yAxis, yAxisTransform);
  result.set(zAxis, zAxisTransform);

  return result;
}

/**
 * 创建基础几何体 Mesh
 * @internal
 * @param subType - gizmoSubType 类型
 * @param options - 几何体参数
 * @returns 几何体 Mesh
 */
function createBasicMesh (engine: Engine, subType: GizmoSubType, options: MeshOption, materialType = 'default'): Mesh {
  const {
    size, color, alpha, renderMode, depthTest, name,
  } = options;
  let geometryType: GeometryType;

  switch (subType) {
    case GizmoSubType.sphere:
      geometryType = GeometryType.Sphere;

      break;
    case GizmoSubType.cylinder:
      geometryType = GeometryType.Cylinder;

      break;
    case GizmoSubType.cone:
      geometryType = GeometryType.Cone;

      break;
    case GizmoSubType.torus:
      geometryType = GeometryType.Torus;

      break;
    case GizmoSubType.sprite:
      geometryType = GeometryType.Sprite;

      break;
    case GizmoSubType.plane:
      geometryType = GeometryType.Plane;

      break;
    case GizmoSubType.frustum:
      geometryType = GeometryType.Frustum;

      break;
    case GizmoSubType.directionLight:
      geometryType = GeometryType.DirectionLight;

      break;
    case GizmoSubType.spotLight:
      geometryType = GeometryType.SpotLight;

      break;
    case GizmoSubType.pointLight:
      geometryType = GeometryType.PointLight;

      break;
    case GizmoSubType.floorGrid:
      geometryType = GeometryType.FloorGrid;

      break;
    default:
      geometryType = GeometryType.Box;

      break;
  }
  const geometry = createGeometry(engine, geometryType, size, renderMode);
  let material;

  switch (materialType) {
    case 'blend':
      material = createBlendMaterial(engine, color, depthTest, alpha);

      break;
    case 'hideBack':
      material = createHideBackMaterial(engine, color, depthTest);

      break;
    default:
      material = createMaterial(engine, color, depthTest);

      break;
  }

  return Mesh.create(
    engine,
    {
      name: name ? name : geometryType.toString(),
      geometry,
      material,
      priority: 3000,
    });
}

/**
 * @internal
 * @param options
 * @param texture
 * @param boundingMap
 * @returns
 */
function createSpriteMesh (engine: Engine, options: MeshOption, texture?: Texture, boundingMap?: Map<string, GizmoItemBounding>): Mesh {
  const geometry = createGeometry(engine, GeometryType.Sprite, options.size, renderMode);
  let spriteColor;

  if (texture) {
    spriteColor = texture;
  } else {
    spriteColor = options.color;
  }

  const material = createSpriteMaterial(engine, spriteColor, options.depthTest);

  if (boundingMap) {
    boundingMap.set('sprite', {
      type: BoundingType.sphere,
      radius: Math.pow(Math.pow(options.size.width, 2) + Math.pow(options.size.height, 2), 0.5) / 2,
    });
  }

  return Mesh.create(
    engine,
    {
      name: options.name || 'sprite',
      geometry,
      material,
      priority: 3000,
    });
}

/**
 * 创建材质
 * @internal
 * @param color - 颜色
 * @param depthTest
 * @returns 纯色材质，无光照，无透明
 */
function createMaterial (engine: Engine, color?: vec3, depthTest?: boolean): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      shader: {
        fragment: `
        precision mediump float;

        uniform vec3 u_color;

        void main(){
          gl_FragColor = vec4(u_color,1.0);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;

        void main(){
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
        shared: true,
      },
    });

  material.setVector3('u_color', myColor);
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = false;
  material.depthMask = true;

  return material;
}

/**
 *
 * @internal
 * @param color
 * @param depthTest
 * @returns
 */
function createHideBackMaterial (engine: Engine, color?: vec3, depthTest?: boolean): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        u_cameraPos: new Float32Array([0, 0, 0]),
        u_center: new Float32Array([0, 0, 0]),
      },
      shader: {
        fragment: `
        precision mediump float;

        uniform vec3 u_color;

        varying float flag;

        void main(){
          if(flag > 0.0) {
            discard;
          }

          gl_FragColor = vec4(u_color,1.0);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;

        uniform vec3 u_cameraPos;
        uniform vec3 u_center;

        varying float flag;
        void main(){
          float distance = length(u_cameraPos - u_center);
          vec3 worldPosition = (u_model * vec4(a_Position,1.0)).xyz;
          flag = length(u_cameraPos - worldPosition) - distance;
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
        shared: true,
      },
    });

  material.setVector3('u_color', myColor);
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.setVector3('u_cameraPos', Vector3.ZERO);
  material.setVector3('u_center', Vector3.ZERO);

  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = false;
  material.depthMask = true;

  return material;
}

/**
 *
 * @internal
 * @param color
 * @param depthTest
 * @param alpha
 * @returns
 */
function createBlendMaterial (engine: Engine, color?: vec3, depthTest?: boolean, alpha?: number): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;
  const myAlpha = alpha ? alpha : 1;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_alpha: new Float32Array([myAlpha, 0]),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      shader: {
        shared: true,
        fragment: `
        precision mediump float;

        uniform vec3 u_color;
        uniform vec2 u_alpha;

        void main(){
          gl_FragColor = vec4(u_color,u_alpha);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;
        void main(){
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
      },
    });

  material.setVector3('u_color', myColor);
  material.setVector2('u_alpha', new Vector2(myAlpha, 0));
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = true;
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];
  material.depthMask = true;

  return material;
}

function createSpriteMaterial (engine: Engine, data?: vec3 | Texture, depthTest?: boolean): Material {
  const myDepthTest = depthTest ? depthTest : false;
  const uniformValues = {
    u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    u_alpha: new Float32Array([1, 0]),
  };

  const material = Material.create(
    engine,
    {
      uniformValues,
      shader: {
        shared: true,
        fragment: `
        precision highp float;

        uniform vec2 u_alpha;
        uniform vec3 u_color;
        uniform sampler2D u_iconTex;

        varying vec2 v_uv;

        void main(){
          vec4 color = texture2D(u_iconTex, vec2(v_uv.x, 1.0 - v_uv.y));
          if(color.a < 0.001)
          {
              discard;
          }
          gl_FragColor = vec4(color.xyz, color.w * u_alpha.x);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;
        attribute vec2 a_UV1;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;
        uniform mat4 effects_MatrixInvV;
        varying vec2 v_uv;

        void main(){
          v_uv = a_UV1;
          vec4 pos = u_model * vec4(0., 0., 0., 1.0);
         // vec4 pos = u_model * vec4(a_Position,1.0);

          pos.xyz += effects_MatrixInvV[0].xyz * a_Position.x + effects_MatrixInvV[1].xyz * a_Position.y;
          gl_Position = _MatrixP * effects_MatrixV * pos;
        }`,
      },
    });

  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.setVector2('u_alpha', new Vector2(1, 0));

  if (data instanceof Texture) {
    material.setTexture('u_iconTex', data);
    // uniformValues.u_iconTex = data;
  } else {
    let color: Vector3;

    if (data === undefined) {
      color = new Vector3(255, 255, 255);
    } else {
      color = Vector3.fromArray(data);
    }
    material.setVector3('u_color', color);
    // uniformValues.u_color = new Float32Array(color);
  }

  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = true;
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];

  return material;
}

/**
 * 创建坐标轴包围盒
 * @internal
 * @param size 包围盒尺寸
 * @param boundingMap 包围盒 Map
 */
function createAxisBounding (size: { width: number, length: number }, boundingMap: Map<string, GizmoItemBounding>) {
  boundingMap.set('xAxis', {
    type: BoundingType.line,
    points: [new Vector3(0, 0, 0), new Vector3(size.length, 0, 0)],
    width: size.width,
  });
  boundingMap.set('yAxis', {
    type: BoundingType.line,
    points: [new Vector3(0, 0, 0), new Vector3(0, size.length, 0)],
    width: size.width,
  });
  boundingMap.set('zAxis', {
    type: BoundingType.line,
    points: [new Vector3(0, 0, 0), new Vector3(0, 0, size.length)],
    width: size.width,
  });
}
