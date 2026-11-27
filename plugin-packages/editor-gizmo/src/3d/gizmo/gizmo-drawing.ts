import { Transform, math, type Engine, type Geometry, type GeometryDrawMode, type Material, type Renderer, type Texture, type spec } from '@galacean/effects';
import { createPrimitiveGeometry, PrimitiveType, type PrimitiveGeometryOptions } from '../geometry/primitives';
import { type GizmoBounds } from './gizmo-bounds';
import { color as palette, renderMode } from './gizmo-settings';
import { createGizmoMaterial, createRotationRingMaterial, createTransparentGizmoMaterial, createGizmoIconMaterial } from './gizmo-materials';

const { Matrix4, Vector3 } = math;

export interface GizmoGeometryOptions {
  size: PrimitiveGeometryOptions,
  color?: spec.vec3,
  renderMode: GeometryDrawMode,
  depthTest?: boolean,
  name?: string,
  alpha?: number,
}

export interface GizmoMesh {
  name: string,
  geometry: Geometry,
  material: Material,
}

/** Procedural mesh resources owned and released by the drawing tool. */
export interface GizmoDrawing {
  bounds: Map<string, GizmoBounds>,
  matrix: math.Matrix4,
  projection?: math.Matrix4,
  meshes: {
    data: GizmoMesh, local: Transform, matrix: math.Matrix4,
    position: math.Vector3, scale: math.Vector3, color: math.Vector3 | null,
  }[],
}

export function createGizmoDrawing (data: GizmoMesh | Map<GizmoMesh, Transform>, bounds = new Map<string, GizmoBounds>()): GizmoDrawing {
  const meshes = data instanceof Map ? data : new Map([[data, new Transform()]]);

  return {
    bounds, matrix: new Matrix4(),
    meshes: Array.from(meshes, ([data, local]) => ({
      data, local, matrix: new Matrix4(), position: local.position.clone(), scale: local.scale.clone(),
      color: data.material.getVector3('u_color')?.clone() ?? null,
    })),
  };
}

export function highlightGizmo (drawing: GizmoDrawing, key?: string): void {
  for (const { data, color } of drawing.meshes) {
    const selected = key !== undefined && (data.name === key || data.name === key + 'Line');

    if (color) {
      data.material.setVector3('u_color', selected ? Vector3.fromArray(palette.highlightColor) : color);
    } else {
      data.material.setFloat('u_highlight', selected ? 1 : 0);
    }
  }
}

export function updateGizmoMatrices (drawing: GizmoDrawing, matrix: math.Matrix4): void {
  drawing.matrix.copyFrom(matrix);
  for (const part of drawing.meshes) { part.matrix.copyFrom(matrix).multiply(part.local.getWorldMatrix()); }
}

export function drawGizmo (drawing: GizmoDrawing, renderer: Renderer): void {
  for (const { data: { geometry, material }, matrix } of drawing.meshes) {
    material.setMatrix('u_model', matrix);
    if (drawing.projection) { material.setMatrix('_MatrixP', drawing.projection); }
    renderer.drawGeometry(geometry, matrix, material);
  }
}

export function disposeGizmoDrawing (drawing: GizmoDrawing): void {
  for (const { data } of drawing.meshes) {
    data.geometry.dispose();
    data.material.dispose();
  }
  drawing.meshes.length = 0;
  drawing.bounds.clear();
}

/**
 * 创建基础几何体和材质
 * @internal
 * @param geometryType - 几何体类型
 * @param options - 几何体参数
 * @returns 基础绘制数据
 */
export function createGizmoMesh (engine: Engine, geometryType: PrimitiveType, options: GizmoGeometryOptions, materialType = 'default'): GizmoMesh {
  const {
    size, color, alpha, renderMode, depthTest, name,
  } = options;
  const geometry = createPrimitiveGeometry(engine, geometryType, size, renderMode);
  let material;

  switch (materialType) {
    case 'blend':
      material = createTransparentGizmoMaterial(engine, color, depthTest, alpha);

      break;
    case 'hideBack':
      material = createRotationRingMaterial(engine, color, depthTest);

      break;
    default:
      material = createGizmoMaterial(engine, color, depthTest);

      break;
  }

  return { name: name ? name : geometryType.toString(), geometry, material };
}

/**
 * @internal
 * @param options
 * @param texture
 * @returns
 */
export function createGizmoIcon (engine: Engine, options: GizmoGeometryOptions, texture?: Texture): GizmoMesh {
  const geometry = createPrimitiveGeometry(engine, PrimitiveType.Plane, options.size, renderMode);
  let spriteColor;

  if (texture) {
    spriteColor = texture;
  } else {
    spriteColor = options.color;
  }

  const material = createGizmoIconMaterial(engine, spriteColor, options.depthTest);

  material.setVector3('u_color', Vector3.fromArray(options.color ?? [1, 1, 1]));

  return { name: options.name || 'sprite', geometry, material };
}
