import { Matrix4 } from '@galacean/effects-math/es/core/index';
import type { Engine } from '../engine';
import type { Material, MaterialDestroyOptions } from '../material';
import type { Geometry, Renderer } from '../render';
import type { Disposable } from '../utils';
import { DestroyOptions } from '../utils';
import { RendererComponent } from '../components';

export interface MeshOptionsBase {
  material: Material,
  name?: string,
  worldMatrix?: Matrix4,
  priority?: number,
}

export interface GeometryMeshProps extends MeshOptionsBase {
  geometry: Geometry,
}

export interface MeshDestroyOptions {
  geometries?: DestroyOptions,
  material?: MaterialDestroyOptions | DestroyOptions,
}

let seed = 1;

/**
 * Mesh 抽象类
 */
export class Mesh extends RendererComponent implements Disposable {
  /**
   * Mesh 的全局唯一 id
   */
  readonly id: string;
  /**
   * Mesh 的世界矩阵
   */
  worldMatrix: Matrix4;
  /**
   * Mesh 的 Geometry
   */
  geometry: Geometry;

  protected destroyed = false;
  private visible = true;

  /**
   * 创建一个新的 Mesh 对象。
   */
  static create: (engine: Engine, props?: GeometryMeshProps) => Mesh;

  constructor (
    engine: Engine,
    props?: GeometryMeshProps,
  ) {
    super(engine);
    if (props) {
      const {
        material,
        geometry,
        name = '<unnamed>',
        priority = 0,
        worldMatrix = Matrix4.fromIdentity(),
      } = props;

      this.id = 'Mesh' + seed++;
      this.name = name;
      this.geometry = geometry;
      this.material = material;
      this.priority = priority;
      this.worldMatrix = worldMatrix;
    } else {
      this.id = 'Mesh' + seed++;
      this.name = '<unnamed>';
      this.worldMatrix = Matrix4.fromIdentity();
      this._priority = 0;
    }
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /**
   * 设置当前 Mesh 的可见性。
   * @param visible - true：可见，false：不可见
   */
  setVisible (visible: boolean) {
    this.visible = visible;
  }
  /**
   * 获取当前 Mesh 的可见性。
   */
  getVisible (): boolean {
    return this.visible;
  }

  override render (renderer: Renderer) {
    if (this.isDestroyed) {
      // console.error(`mesh ${mesh.name} destroyed`, mesh);
      return;
    }
    if (!this.getVisible()) {
      return;
    }
    this.material.setMatrix('effects_ObjectToWorld', this.worldMatrix);
    renderer.drawGeometry(this.geometry, this.material);
  }

  /**
   * 获取当前 Mesh 的第一个 geometry。
   */
  firstGeometry (): Geometry {
    return this.geometry;
  }

  /**
   * 设置当前 Mesh 的材质
   * @param material - 要设置的材质
   * @param destroy - 可选的材质销毁选项
   */
  setMaterial (material: Material, destroy?: MaterialDestroyOptions | DestroyOptions.keep) {
    if (destroy !== DestroyOptions.keep) {
      this.material.dispose();
    }
    this.material = material;
  }

  restore (): void {
  }

  /**
   * 销毁当前资源
   * @param options - 可选的销毁选项
   */
  override dispose (options?: MeshDestroyOptions) {
    if (this.destroyed) {
      //console.error('call mesh.destroy multiple times', this);
      return;
    }

    if (options?.geometries !== DestroyOptions.keep) {
      this.geometry.dispose();
    }
    const materialDestroyOption = options?.material;

    if (materialDestroyOption !== DestroyOptions.keep) {
      this.material.dispose();
    }
    this.destroyed = true;

    if (this.engine !== undefined) {
      this.engine.removeMesh(this);
      // @ts-expect-error
      this.engine = undefined;
    }
  }
}
