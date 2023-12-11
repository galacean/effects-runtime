import type { Mesh, RenderPass, Texture, RenderFrameOptions, UniformValue } from '@galacean/effects-core';
import {
  RenderFrame, SEMANTIC_PRE_COLOR_ATTACHMENT_0, SEMANTIC_PRE_COLOR_ATTACHMENT_SIZE_0,
  SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_0, SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_SIZE_0, sortByOrder, addByOrder,
} from '@galacean/effects-core';
import * as THREE from 'three';
import { setUniformValue } from './material';
import type { ThreeMaterial } from './material';
import type { ThreeMesh } from './three-mesh';

/**
 * runtime 中对渲染中的一帧的流程管理对象
 * THREE 对此抽象类的实现
 */
export class ThreeRenderFrame extends RenderFrame {
  group: THREE.Group;
  threeCamera: THREE.Camera | undefined;

  constructor (options: RenderFrameOptions) {
    super(options);
    this.semantics.setSemantic(SEMANTIC_PRE_COLOR_ATTACHMENT_0);
    this.semantics.setSemantic(SEMANTIC_PRE_COLOR_ATTACHMENT_SIZE_0);
    this.semantics.setSemantic(SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_0);
    this.semantics.setSemantic(SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_SIZE_0);
  }

  /**
   * 设置 pass 数组
   *
   * @param passes - pass 数组
   */
  override setRenderPasses (passes: RenderPass[]) {

    this._renderPasses = sortByOrder(passes.slice());
  }

  /**
   * 添加 render pass
   *
   * @param pass - render pass 对象
   */
  override addRenderPass (pass: RenderPass): void {
    addByOrder(this._renderPasses, pass);
  }

  /**
   * 创建资源（滤镜元素会用到）
   */
  override createResource (): void {
    // @ts-expect-error
    this.resource = {};
  }

  /**
   * 创建默认 mesh（滤镜元素会用到）
   *
   * @param semantics - mesh 创建参数
   */
  override createCopyMesh (semantics?: { tex?: string, size?: string, blend?: boolean, depthTexture?: Texture }): Mesh {
    // @ts-expect-error
    return;
  }

  /**
   * 添加 mesh 到默认 render pass 中
   *
   * @param mesh - mesh 对象
   */
  override addMeshToDefaultRenderPass (mesh: Mesh): void {
    const material = (mesh.material as ThreeMaterial).material;
    const uniforms = material.uniforms;
    const uniformSemantics = mesh.material.uniformSemantics;

    let uniformSemanticsMap: Record<string, UniformValue | THREE.Matrix4>;

    if (this.threeCamera) {
      const camera = this.threeCamera;
      const threeViewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      uniformSemanticsMap = {
        'effects_ObjectToWorld': (mesh as ThreeMesh).mesh.matrixWorld,
        'effects_MatrixV': camera.matrixWorldInverse,
        'effects_MatrixVP': threeViewProjectionMatrix,
        'effects_MatrixInvV': camera.matrixWorld,
      };
    } else {
      const camera = this.camera;

      uniformSemanticsMap = {
        'effects_ObjectToWorld': mesh.worldMatrix.toArray(),
        'effects_MatrixV': camera.getViewMatrix().toArray(),
        'effects_MatrixVP': camera.getViewProjectionMatrix().toArray(),
        'effects_MatrixInvV': camera.getInverseViewMatrix().toArray(),
      };
    }

    Object.keys(uniformSemantics).forEach(name => {
      if (uniformSemanticsMap[name]) {
        setUniformValue(uniforms, name, uniformSemanticsMap[name]);
      }
    });
    material.uniformsNeedUpdate = true;
    this.group.add((mesh as ThreeMesh).mesh);
  }

  /**
   * 从默认 render pass 删除 mesh
   *
   * @param mesh - mesh 对象
   */
  override removeMeshFromDefaultRenderPass (mesh: Mesh): void {
    this.group.remove((mesh as ThreeMesh).mesh);
  }

  updateMatrix () {
    const group = this.group;
    const camera = this.threeCamera;

    if (!camera) {
      return;
    }

    group.children.forEach(mesh => {
      const material = (mesh as THREE.Mesh).material as THREE.ShaderMaterial;
      const uniforms = material.uniforms;
      const threeViewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      setUniformValue(uniforms, 'effects_ObjectToWorld', mesh.matrixWorld);
      setUniformValue(uniforms, 'effects_MatrixVP', threeViewProjectionMatrix);
      material.uniformsNeedUpdate = true;
    });
  }

  updateUniform () {
    const group = this.group;
    const camera = this.camera;

    group.children.forEach(mesh => {
      const material = (mesh as THREE.Mesh).material as THREE.ShaderMaterial;

      setUniformValue(material.uniforms, 'effects_MatrixInvV', camera.getInverseViewMatrix().toArray());
      setUniformValue(material.uniforms, 'effects_MatrixVP', camera.getViewProjectionMatrix().toArray());
      setUniformValue(material.uniforms, 'effects_MatrixV', camera.getViewMatrix().toArray());
      material.uniformsNeedUpdate = true;
    });
  }

  /**
   * 主要用来做 group 和 composition 的清理
   */
  override dispose (): void {
    super.dispose();
    if (this.group) {
      this.group.clear();
    }
  }
}

