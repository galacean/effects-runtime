import type {
  Geometry, Material, MaterialDestroyOptions, MeshDestroyOptions, GeometryMeshProps, Sortable,
  Engine, Renderer,
} from '@galacean/effects-core';
import { DestroyOptions, glContext, Mesh } from '@galacean/effects-core';
import * as THREE from 'three';
import type { ThreeMaterial } from './material';
import type { ThreeGeometry } from './three-geometry';
import type { ThreeEngine } from './three-engine';

/**
 * mesh 抽象类的 THREE 实现
 */
export class ThreeMesh extends Mesh implements Sortable {
  /**
   * mesh 对象
   */
  mesh: THREE.Mesh | THREE.LineSegments;

  /**
   * 构造函数
   * @param props - mesh 创建参数
   */
  constructor (engine: Engine, props?: GeometryMeshProps) {
    if (!props) {
      return;
    }

    const {
      material, geometry,
      priority = 0,
    } = props;

    super(engine, props);

    this.geometry = geometry;
    this.material = material;

    if ((geometry as ThreeGeometry).mode === glContext.LINES) {
      this.mesh = new THREE.LineSegments(
        (geometry as ThreeGeometry).geometry,
        (material as ThreeMaterial).material);
    } else {
      this.mesh = new THREE.Mesh(
        (geometry as ThreeGeometry).geometry,
        (material as ThreeMaterial).material
      );
    }
    // 在抽象Mesh设置priority时，THREE 的 Mesh 还未创建
    this.priority = priority;
  }

  /**
   * 设置 mesh 的渲染顺序
   *
   * @param v - 顺序 index
   */
  override set priority (v: number) {
    if (this.mesh) {
      this.mesh.renderOrder = v;
    }
  }

  /**
   * 获取 mesh 的渲染顺序
   */
  override get priority () {
    return this.mesh.renderOrder;
  }

  /**
   * 设置 mesh 可见性
   *
   * @param val - 可见性开关
   */
  override setVisible (val: boolean): void {
    this.mesh.visible = val;
  }

  /**
   * 获取 mesh 的可见性
   *
   * @returns
   */
  override getVisible (): boolean {
    return this.mesh.visible;
  }

  /**
   * 获取 mesh 中的首个 geometry
   *
   * @returns 返回 geometry 对象
   */
  override firstGeometry (): Geometry {
    return this.geometry;
  }

  /**
   * 设置 material
   *
   * @param mtl - material 对象
   * @param destroy 销毁参数
   */
  override setMaterial (mtl: Material, destroy?: MaterialDestroyOptions | DestroyOptions.keep): void {
    // TODO: 这里可以放到抽象类里
    if (destroy !== DestroyOptions.keep) {
      this.material.dispose(destroy);
    }
    this.material = mtl;
    this.mesh.material = (mtl as ThreeMaterial).material;
  }

  override onStart (): void {
    super.onStart();
    (this.engine as ThreeEngine).threeGroup.add(this.mesh);
  }

  /**
   * 重建方法
   */
  override restore (): void {
  }

  override render (renderer: Renderer): void {
    if (this.isDestroyed) {
      return;
    }
    if (!this.getVisible()) {
      return;
    }
    this.material.setMatrix('effects_ObjectToWorld', this.worldMatrix);
    this.material.use(renderer, renderer.renderingData.currentFrame.globalUniforms);
  }

  /**
   * 销毁方法
   *
   * @param options - 销毁参数
   */
  override dispose (options?: MeshDestroyOptions): void {
    if (!this.destroyed) {
      this.mesh.clear();
      this.destroyed = true;
    }
  }
}
