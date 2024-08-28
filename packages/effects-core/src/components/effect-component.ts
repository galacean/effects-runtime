import * as spec from '@galacean/effects-specification';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { effectsClass, serialize } from '../decorators';
import type { Engine } from '../engine';
import type { Material, MaterialDestroyOptions } from '../material';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { HitTestType } from '../plugins';
import type { MeshDestroyOptions, Renderer } from '../render';
import type { Geometry } from '../render';
import { DestroyOptions } from '../utils';
import { RendererComponent } from './renderer-component';

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.EffectComponent)
export class EffectComponent extends RendererComponent {
  /**
   * Mesh 的世界矩阵
   */
  worldMatrix = Matrix4.fromIdentity();
  /**
   * Mesh 的 Geometry
   */
  @serialize()
  geometry: Geometry;

  private triangles: TriangleLike[] = [];
  private destroyed = false;
  // TODO: 抽象到射线碰撞检测组件
  private hitTestGeometry: Geometry;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'EffectComponent';
    this._priority = 0;
  }

  override start (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override render (renderer: Renderer) {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    renderer.drawGeometry(this.geometry, this.material);
  }

  /**
   * 设置当前 Mesh 的材质
   * @param material - 要设置的材质
   * @param destroy - 可选的材质销毁选项
   */
  setMaterial (material: Material, destroy?: MaterialDestroyOptions | DestroyOptions.keep) {
    if (destroy !== DestroyOptions.keep) {
      this.material.dispose(destroy);
    }
    this.material = material;
  }

  // TODO 点击测试后续抽象一个 Collider 组件
  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => {
    const area = this.getBoundingBox();

    if (area) {
      return {
        type: area.type,
        triangles: area.area,
      };
    }
  };

  getBoundingBox (): BoundingBoxTriangle | void {
    const worldMatrix = this.transform.getWorldMatrix();

    if (this.hitTestGeometry !== this.geometry) {
      this.triangles = geometryToTriangles(this.geometry);
      this.hitTestGeometry = this.geometry;
    }
    const area = [];

    for (const triangle of this.triangles) {
      area.push({ p0: triangle.p0, p1: triangle.p1, p2: triangle.p2 });
    }

    area.forEach(triangle => {
      triangle.p0 = worldMatrix.transformPoint(triangle.p0 as Vector3, new Vector3());
      triangle.p1 = worldMatrix.transformPoint(triangle.p1 as Vector3, new Vector3());
      triangle.p2 = worldMatrix.transformPoint(triangle.p2 as Vector3, new Vector3());
    });

    return {
      type: HitTestType.triangle,
      area,
    };
  }

  override fromData (data: unknown): void {
    super.fromData(data);
    this.material = this.materials[0];
  }

  override toData (): void {
    this.taggedProperties.id = this.guid;
  }

  /**
   * 销毁当前资源
   * @param options - 可选的销毁选项
   */
  override dispose (options?: MeshDestroyOptions) {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    super.dispose();
  }
}

function geometryToTriangles (geometry: Geometry) {
  const indices = geometry.getIndexData() ?? [];
  const vertices = geometry.getAttributeData('aPos') ?? [];
  const res: TriangleLike[] = [];

  for (let i = 0; i < indices.length; i += 3) {
    const index0 = indices[i] * 3;
    const index1 = indices[i + 1] * 3;
    const index2 = indices[i + 2] * 3;
    const p0 = { x: vertices[index0], y: vertices[index0 + 1], z: vertices[index0 + 2] };
    const p1 = { x: vertices[index1], y: vertices[index1 + 1], z: vertices[index1 + 2] };
    const p2 = { x: vertices[index2], y: vertices[index2 + 1], z: vertices[index2 + 2] };

    res.push({ p0, p1, p2 });
  }

  return res;
}
