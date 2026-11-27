import { Transform, Geometry, glContext, type Engine, type Material, type Renderer } from '@galacean/effects';
import { createEditorPrimitivesMaterial } from './editor-primitives-material';
import { Gizmo3D } from './gizmo-3d';

/** World-space floor grids drawn with scene depth in the editor overlay. */
export class GridGizmo extends Gizmo3D {
  private geometries: { geometry: Geometry, material: Material }[] = [];
  private readonly transform = new Transform();

  override update (): void {
    if (this.geometries.length) { return; }
    this.transform.setRotation(90, 0, 0);
    this.geometries = [50, 200].map(parts => {
      const geometry = createGridGeometry(this.owner.engine, 100, parts);
      const material = createEditorPrimitivesMaterial(this.owner.engine, [0.5, 0.5, 0.5], 0.5);

      return { geometry, material };
    });
  }

  override draw (renderer: Renderer): void {
    if (this.visible) {
      for (const { geometry, material } of this.geometries) {
        renderer.drawGeometry(geometry, this.transform.getWorldMatrix(), material);
      }
    }
  }

  override dispose (): void {
    for (const { geometry, material } of this.geometries) {
      geometry.dispose();
      material.dispose();
    }
    this.geometries.length = 0;
    super.dispose();
  }
}

export function createGridGeometry (engine: Engine, sideLength = 12, parts = 6): Geometry {
  const data: { points: number[], indices: number[] } = { points: [], indices: [] };

  let index = 0;

  const z = 0;
  const end = sideLength / 2;
  const start = -sideLength / 2;

  for (let i = 0; i <= parts; i++) {
    const v = start + i * sideLength / parts;

    data.points.push(v, start, z, v, end, z, start, v, z, end, v, z);
    data.indices.push(index, index + 1, index + 2, index + 3);
    index += 4;
  }

  return Geometry.create(engine, {
    attributes: { a_Position: { size: 3, data: new Float32Array(data.points) } },
    indices: { data: new Uint16Array(data.indices) }, mode: glContext.LINES, drawCount: data.indices.length,
  });
}
