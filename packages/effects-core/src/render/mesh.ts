import type * as spec from '@galacean/effects-specification';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import { getConfig, POST_PROCESS_SETTINGS } from '../config';
import type { Engine } from '../engine';
import type { Material, MaterialDestroyOptions } from '../material';
import type { Geometry, Renderer } from '../render';
import type { Disposable } from '../utils';
import { DestroyOptions } from '../utils';

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
  material?: MaterialDestroyOptions | DestroyOptions.keep,
}

let seed = 1;

/**
 * Mesh 抽象类
 */
export class Mesh implements Disposable {
  /**
   * Mesh 的全局唯一 id
   */
  readonly id: string;
  /**
   * Mesh 名称，缺省是 \<unnamed>
   */
  readonly name: string;
  /**
   * Mesh 的世界矩阵
   */
  worldMatrix: Matrix4;
  /**
   * Mesh 的材质
   */
  material: Material;
  /**
   * Mesh 的 Geometry
   */
  geometry: Geometry;

  protected destroyed = false;

  // 各引擎独立实现 priority，重写 getter/setter
  private _priority: number;
  private visible = true;

  /**
   * 创建一个新的 Mesh 对象。
   */
  static create: (engine: Engine, props: GeometryMeshProps) => Mesh;

  constructor (
    private engine: Engine,
    props: GeometryMeshProps,
  ) {
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
  }

  get priority (): number {
    return this._priority;
  }

  set priority (value: number) {
    this._priority = value;
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

  render (renderer: Renderer) {
    const renderingData = renderer.renderingData;
    const material = this.material;

    if (renderingData.currentFrame.globalUniforms) {
      if (renderingData.currentCamera) {
        renderer.setGlobalMatrix('effects_MatrixInvV', renderingData.currentCamera.getInverseViewMatrix());
        renderer.setGlobalMatrix('effects_MatrixV', renderingData.currentCamera.getViewMatrix());
        renderer.setGlobalMatrix('effects_MatrixVP', renderingData.currentCamera.getViewProjectionMatrix());
        renderer.setGlobalMatrix('_MatrixP', renderingData.currentCamera.getProjectionMatrix());
      }
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.worldMatrix);
    }
    if (renderingData.currentFrame.editorTransform) {
      material.setVector4('uEditorTransform', renderingData.currentFrame.editorTransform);
    }
    // 测试后处理 Bloom 和 ToneMapping 逻辑
    if (__DEBUG__) {
      if (getConfig<Record<string, number[]>>(POST_PROCESS_SETTINGS)) {
        const emissionColor = getConfig<Record<string, number[]>>(POST_PROCESS_SETTINGS)['color'].slice() as spec.vec3;

        emissionColor[0] /= 255;
        emissionColor[1] /= 255;
        emissionColor[2] /= 255;
        material.setVector3('emissionColor', Vector3.fromArray(emissionColor));
        material.setFloat('emissionIntensity', getConfig<Record<string, number>>(POST_PROCESS_SETTINGS)['intensity']);
      }
    }
    material.use(renderer, renderingData.currentFrame.globalUniforms);

    const geo = this.geometry;

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

  restore (): void {

  }

  /**
   * 销毁当前资源
   * @param options - 可选的销毁选项
   */
  dispose (options?: MeshDestroyOptions) {
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
      this.engine.removeMesh(this);
      // @ts-expect-error
      this.engine = undefined;
    }
  }
}
