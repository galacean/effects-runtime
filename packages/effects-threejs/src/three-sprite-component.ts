import type { Renderer, SpriteItemProps, math } from '@galacean/effects-core';
import { SpriteComponent, glContext } from '@galacean/effects-core';
import type { ThreeComposition } from './three-composition';
import type { ThreeGeometry } from './three-geometry';
import type { ThreeMaterial } from './material';
import * as THREE from 'three';

export class ThreeSpriteComponent extends SpriteComponent {
  threeMesh: THREE.Mesh | THREE.LineSegments;
  // constructor(engine: Engine, props?: SpriteItemProps) {
  //     super(engine, props);

  // }

  /**
   * 设置 mesh 的渲染顺序
   *
   * @param v - 顺序 index
   */
  override set priority (v: number) {
    if (this.mesh) {
      this.threeMesh.renderOrder = v;
    }
  }

  /**
     * 获取 mesh 的渲染顺序
     */
  override get priority () {
    return this.threeMesh.renderOrder;
  }

  /**
     * TODO: 待移除
     * 设置 mesh 可见性
     *
     * @param val - 可见性开关
     */
  override setVisible (val: boolean): void {
    this.threeMesh.visible = val;
  }

  /**
     * TODO: 待移除
     * 获取 mesh 的可见性
     *
     * @returns
     */
  override getVisible (): boolean {
    return this.threeMesh.visible;
  }

  override get enabled () {
    return this.threeMesh.visible;
  }
  override set enabled (value: boolean) {
    this.threeMesh.visible = value;
    if (value) {
      this.onEnable();
    }
  }

  /**
     * 销毁方法
     *
     */
  override dispose (): void {
    super.dispose();
    if (!this.isActiveAndEnabled) {
      this.threeMesh.clear();
    }
  }

  override fromData (data: SpriteItemProps): void {
    super.fromData(data);
    if (!this.threeMesh) {
      if ((this.geometry as ThreeGeometry).mode === glContext.LINES) {
        this.threeMesh = new THREE.LineSegments(
          (this.geometry as ThreeGeometry).geometry,
          (this.material as ThreeMaterial).material);
      } else {
        this.threeMesh = new THREE.Mesh(
          (this.geometry as ThreeGeometry).geometry,
          (this.material as ThreeMaterial).material
        );
      }
      // FIXME: 兼容代码
      this.threeMesh.name = 'sprite';
    }
  }

  override start (): void {
    super.start();
    (this.item.composition as ThreeComposition).threeGroup.add(this.threeMesh);
  }

  override render (renderer: Renderer): void {
    const composition = this.item.composition as ThreeComposition;

    if (!this.isActiveAndEnabled) {
      return;
    }
    this.material.setMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    if (composition.threeCamera) {
      const camera = composition.threeCamera;
      const threeViewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      this.material.setMatrix('effects_MatrixVP', threeViewProjectionMatrix as unknown as math.Matrix4);
    } else {
      const camera = composition.camera;

      this.material.setMatrix('effects_MatrixInvV', camera.getInverseProjectionMatrix());
      this.material.setMatrix('effects_MatrixVP', camera.getViewProjectionMatrix());
      this.material.setMatrix('effects_MatrixV', camera.getViewMatrix());
    }
  }

  override onDestroy (): void {
    this.mesh.dispose();
  }
}