import type { Renderer, SpriteItemProps } from '@galacean/effects-core';
import { DataType, SpriteComponent, effectsClass, glContext } from '@galacean/effects-core';
import type { ThreeGeometry } from './three-geometry';
import type { ThreeMaterial } from './material';
import * as THREE from 'three';
import type { ThreeEngine } from './three-engine';

@effectsClass(DataType.SpriteComponent)
export class ThreeSpriteComponent extends SpriteComponent {
  threeMesh: THREE.Mesh | THREE.LineSegments;
  /**
   * 设置 mesh 的渲染顺序
   *
   * @param v - 顺序 index
   */
  override set priority (v: number) {
    if (this.threeMesh) {
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
    }
  }

  override start (): void {
    super.start();
    (this.engine as ThreeEngine).threeGroup.add(this.threeMesh);
  }

  override render (renderer: Renderer): void {

    if (!this.isActiveAndEnabled) {
      return;
    }
    this.material.setVector2('_Size', this.transform.size);
    this.material.setMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    this.material.use(renderer, renderer.renderingData.currentFrame.globalUniforms);
  }

  override onDestroy (): void {
    this.threeMesh.clear();
  }
}
