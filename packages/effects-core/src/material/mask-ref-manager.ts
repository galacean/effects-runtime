import type { Engine } from '../engine';
import type * as spec from '@galacean/effects-specification';
import type { Maskable, MaskReference } from './types';
import { MaskMode } from './types';
import type { Renderer } from '../render/renderer';
import { TextureLoadAction } from '../texture/types';
import type { RenderPassClearAction } from '../render/render-pass';
import type { Material } from './material';
import { glContext } from '../gl';
import type { Geometry } from '../render/geometry';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { RendererComponent } from '../components';

/**
 * @internal
 */
export class MaskProcessor {
  alphaMaskEnabled = false;

  isMask = false;
  inverted = false;
  maskMode: MaskMode = MaskMode.NONE;

  /**
   * 多个蒙版引用列表，支持正面和反面蒙版
   */
  maskReferences: MaskReference[] = [];

  /**
   * 当前正在绘制的蒙版索引，用于分配 bit
   */
  private currentMaskIndex = 0;

  /**
   * 当前活动蒙版的 bit 组合（所有蒙版的 bit OR）
   */
  private activeMaskBits = 0;

  /**
   * 期望的 stencil 值（根据每个蒙版的 inverted 属性计算）
   */
  private expectedMaskBits = 0;

  private stencilClearAction: RenderPassClearAction;

  /**
   * @deprecated 使用 maskReferences 替代
   */
  get maskable (): Maskable | null {
    return this.maskReferences.length > 0 ? this.maskReferences[0].maskable : null;
  }

  /**
   * @deprecated 使用 maskReferences 替代
   */
  set maskable (value: Maskable | null) {
    this.maskReferences = [];
    if (value) {
      this.maskReferences.push({
        maskable: value,
        inverted: this.maskMode === MaskMode.REVERSE_OBSCURED,
      });
    }
  }

  constructor () {
    this.stencilClearAction = { stencilAction: TextureLoadAction.clear };
  }

  getRefValue (): number {
    return 1 << this.currentMaskIndex;
  }

  /**
   * 设置蒙版选项（兼容旧版单蒙版 API）
   */
  setMaskOptions (engine: Engine, data: spec.MaskOptions): void {
    const { isMask = false, inverted = false, reference, alphaMaskEnabled = false } = data;

    this.alphaMaskEnabled = alphaMaskEnabled;
    this.isMask = isMask;
    this.inverted = inverted;
    this.maskReferences = [];

    if (isMask) {
      this.maskMode = MaskMode.MASK;
    } else {
      this.maskMode = inverted ? MaskMode.REVERSE_OBSCURED : MaskMode.OBSCURED;
      const maskable = engine.findObject<Maskable>(reference);

      if (maskable) {
        this.maskReferences.push({
          maskable,
          inverted,
        });
      }
    }
  }

  /**
   * 添加蒙版引用
   * @param maskable - 蒙版对象
   * @param inverted - 是否反向蒙版
   */
  addMaskReference (maskable: Maskable, inverted = false): void {
    const exists = this.maskReferences.some(ref => ref.maskable === maskable);

    if (!exists) {
      this.maskReferences.push({ maskable, inverted });
    }
  }

  /**
   * 移除蒙版引用
   * @param maskable - 要移除的蒙版对象
   */
  removeMaskReference (maskable: Maskable): void {
    const index = this.maskReferences.findIndex(ref => ref.maskable === maskable);

    if (index !== -1) {
      this.maskReferences.splice(index, 1);
    }
  }

  /**
   * 清空所有蒙版引用
   */
  clearMaskReferences (): void {
    this.maskReferences = [];
  }

  /**
   * 绘制所有蒙版，被蒙版的元素调用
   */
  drawStencilMask (renderer: Renderer, maskedComponent: RendererComponent): void {
    const frameClipMask = maskedComponent.frameClipMask;

    if (frameClipMask) {
      this.addMaskReference(frameClipMask, false);
    }

    if (this.maskReferences.length > 0) {
      renderer.clear(this.stencilClearAction);

      // 重置 bit 组合
      this.activeMaskBits = 0;
      this.expectedMaskBits = 0;

      // 为每个蒙版分配一个 bit 并绘制
      for (let i = 0; i < this.maskReferences.length; i++) {
        const maskBit = 1 << i;

        this.activeMaskBits |= maskBit;

        const reference = this.maskReferences[i];

        // 如果是正向蒙版（不是 inverted），期望该 bit 为 1
        if (!reference.inverted) {
          this.expectedMaskBits |= maskBit;
        }
        // 如果是反向蒙版（inverted），期望该 bit 为 0（不设置）

        // 传入 maskBit 作为 maskref 值
        reference.maskable.drawStencilMask(maskBit);
      }
    }

    for (const material of maskedComponent.materials) {
      this.setupMaskedMaterial(material);
    }

    if (frameClipMask) {
      this.removeMaskReference(frameClipMask);
      maskedComponent.frameClipMask = null;
    }
  }

  /**
   *  绘制几何体蒙版，蒙版元素绘制时调用
   */
  drawGeometryMask (renderer: Renderer, geometry: Geometry, worldMatrix: Matrix4, material: Material, maskRef: number, subMeshIndex = 0): void {
    const previousColorMask = material.colorMask;

    this.setupMaskMaterial(material, maskRef);
    material.colorMask = false;
    renderer.drawGeometry(geometry, worldMatrix, material, subMeshIndex);
    material.colorMask = previousColorMask;
  }

  /**
   * 设置蒙版材质的 stencil 属性（写入蒙版）
   * @param material - 要设置的材质
   * @param maskRef - 蒙版的 bit 值
   */
  private setupMaskMaterial (material: Material, maskRef: number): void {
    // 蒙版元素：写入 stencil buffer
    material.stencilTest = true;
    material.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
    material.stencilOpZPass = [glContext.REPLACE, glContext.REPLACE];

    // 使用传入的 maskRef
    material.stencilRef = [maskRef, maskRef];
    material.stencilMask = [maskRef, maskRef];  // 只写入当前 bit，不影响其他 bit
  }

  /**
   * 设置被蒙版材质的 stencil 属性（多蒙版交集）
   * @param material - 要设置的材质
   */
  private setupMaskedMaterial (material: Material): void {
    if (this.maskReferences.length > 0) {
      // 被蒙版元素：根据 stencil buffer 判断是否绘制
      material.stencilTest = true;

      // 使用期望的 ref 值（根据每个蒙版的 inverted 属性计算）
      // 只有当 stencil 值等于期望值时才绘制（所有蒙版条件都满足，即交集）
      material.stencilRef = [this.expectedMaskBits, this.expectedMaskBits];
      material.stencilMask = [this.activeMaskBits, this.activeMaskBits];  // 检查所有相关 bit
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
    } else {
      // 无蒙版：关闭 stencil 测试
      material.stencilTest = false;
    }
  }
}
