import type { Engine, Geometry, Material, math } from '@galacean/effects-core';
import { Renderer } from '@galacean/effects-core';

export class ThreeRenderer extends Renderer {
  constructor (engine: Engine) {
    super(engine);
  }

  override getWidth (): number {
    return this.engine.canvas.width;
  }

  override getHeight (): number {
    return this.engine.canvas.height;
  }

  override drawGeometry (
    geometry: Geometry,
    matrix: math.Matrix4,
    material: Material,
    subMeshIndex = 0,
  ): void {
  }
}
