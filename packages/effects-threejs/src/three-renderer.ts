import type { Engine, Geometry, Material, math, RenderOptions, SceneRendering } from '@galacean/effects-core';
import { Renderer, RenderingData } from '@galacean/effects-core';

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

  override renderScene (scene: SceneRendering, options: RenderOptions): void {
    if (this.disposed) {
      return;
    }
    const previousData = this.engine.renderingData;
    const data = new RenderingData(options);

    this.engine.renderingData = data;
    this.prepareRenderingData(scene, data);
    this.renderMeshes(data.renderList.objects);
    data.frameData.dispose();
    this.engine.renderingData = previousData;
  }

  override drawGeometry (
    geometry: Geometry,
    matrix: math.Matrix4,
    material: Material,
    subMeshIndex = 0,
  ): void {
  }
}
