import { Transform, glContext, type Geometry, type Material, type Renderer } from '@galacean/effects';
import { createGeometry, GeometryType } from '../geometry';
import { createSceneShapeMaterial } from '../shape';
import { Gizmo3D } from './gizmo-3d';

/** World-space floor grids drawn with scene depth in the editor overlay. */
export class GridGizmo3D extends Gizmo3D {
  readonly type = 'grid-3d';
  visible = true;
  private geometries: { geometry: Geometry, material: Material }[] = [];
  private readonly transform = new Transform();

  override onUpdate (): void {
    if (this.geometries.length) { return; }
    this.transform.setRotation(90, 0, 0);
    this.geometries = [50, 200].map((parts, index) => {
      const gray = (index ? 50 : 100) / 255;
      const geometry = createGeometry(this.owner.engine, GeometryType.FloorGrid, { sideLength: 100, parts }, glContext.LINES);
      const material = createSceneShapeMaterial(this.owner.engine, [gray, gray, gray]);

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
  }
}
