import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Deserializer, EffectComponentData, SceneData } from '../deserializer';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { Material, MaterialDestroyOptions } from '../material';
import type { MeshDestroyOptions, Renderer } from '../render';
import { Geometry } from '../render';
import type { Disposable } from '../utils';
import { DestroyOptions } from '../utils';
import { RendererComponent } from './renderer-component';

let seed = 1;

/**
 * @since 2.0.0
 * @internal
 */
export class EffectComponent extends RendererComponent implements Disposable {
  /**
   * Mesh 的全局唯一 id
   */
  readonly id: string;
  /**
   * Mesh 的世界矩阵
   */
  worldMatrix = Matrix4.fromIdentity();
  /**
   * Mesh 的 Geometry
   */
  geometry: Geometry;

  protected destroyed = false;
  private visible = false;

  constructor (engine: Engine) {
    super(engine);

    this.id = 'Mesh' + seed++;
    this.name = '<unnamed>';
    this._priority = 0;
    this.geometry = Geometry.create(this.engine, {
      mode: glContext.TRIANGLES,
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array([
            -1, 1, 0, //左上
            -1, -1, 0, //左下
            1, 1, 0, //右上
            1, -1, 0, //右下
          ]),
        },
        aUV: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]), releasable: true },
      drawCount: 6,
    });
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

  override render (renderer: Renderer) {
    const material = this.material;
    const geo = this.geometry;

    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }

    // 执行 Geometry 的数据刷新
    geo.flush();

    renderer.drawGeometry(geo, material);
  }

  /**
   * 获取当前 Mesh 的可见性。
   */
  getVisible (): boolean {
    return this.visible;
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
      this.material.dispose(destroy);
    }
    this.material = material;
  }

  override fromData (data: any, deserializer?: Deserializer, sceneData?: SceneData): void {
    super.fromData(data, deserializer, sceneData);
    const effectComponentData: EffectComponentData = data;

    this._priority = effectComponentData._priority;
    if (deserializer && sceneData) {
      this.material = deserializer.deserialize(effectComponentData.materials[0], sceneData);
    }
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
      this.material.dispose(materialDestroyOption);
    }
    this.destroyed = true;

    if (this.engine !== undefined) {
      //this.engine.removeMesh(this);
      // @ts-expect-error
      this.engine = undefined;
    }
  }
}
