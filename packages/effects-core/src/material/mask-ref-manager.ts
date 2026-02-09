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
  private maskReferences: MaskReference[] = [];

  /**
   * 期望的 stencil 值（等于正向蒙版的数量）
   */
  private expectedStencilValue = 0;

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

  /**
   * @deprecated
   */
  getRefValue (): number {
    return 1;
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
      if (this.maskReferences.length >= 255) {
        console.warn('Maximum of 255 mask references exceeded. Additional masks will be ignored.');

        return;
      }
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
   * 绘制所有蒙版，被蒙版的元素调用。
   *
   * 使用递增 stencil 计数法实现任意数量蒙版的交集：
   * 1. 正向蒙版按顺序渲染，每个仅在 stencil == 当前步数时递增（增量求交集）
   * 2. 反向蒙版渲染，将已通过所有正向蒙版的像素标记为无效
   * 3. 最终只有 stencil == 正向蒙版数量 的像素才通过测试
   *
   * 最多支持 255 个蒙版引用（受 8 位 stencil buffer 限制）
   */
  drawStencilMask (renderer: Renderer, maskedComponent: RendererComponent): void {
    const frameClipMasks = maskedComponent.frameClipMasks;

    for (const frameClipMask of frameClipMasks) {
      this.addMaskReference(frameClipMask, false);
    }

    if (this.maskReferences.length > 0) {
      renderer.clear(this.stencilClearAction);

      // 分离正向和反向蒙版
      const forwardMasks: MaskReference[] = [];
      const reverseMasks: MaskReference[] = [];

      for (const ref of this.maskReferences) {
        if (ref.inverted) {
          reverseMasks.push(ref);
        } else {
          forwardMasks.push(ref);
        }
      }

      // 阶段一：绘制正向蒙版（增量求交集）
      // 每个正向蒙版传入当前步数 i，setupMaskMaterial 会设置
      // stencilFunc=EQUAL ref=i，只有已通过前 i 个蒙版的像素才会递增
      for (let i = 0; i < forwardMasks.length; i++) {
        forwardMasks[i].maskable.drawStencilMask(i);
      }

      // 阶段二：绘制反向蒙版（"dirty"被覆盖的像素）
      // 传入 forwardCount，只在 stencil == forwardCount 的像素上递增
      // 被任意反向蒙版覆盖的像素 stencil 值会 > forwardCount
      const forwardCount = forwardMasks.length;

      for (const ref of reverseMasks) {
        ref.maskable.drawStencilMask(forwardCount);
      }

      // 期望的 stencil 值 = 正向蒙版数量
      this.expectedStencilValue = forwardCount;
    }

    for (const material of maskedComponent.materials) {
      this.setupMaskedMaterial(material);
    }

    for (const frameClipMask of frameClipMasks) {
      this.removeMaskReference(frameClipMask);

      maskedComponent.frameClipMasks = [];
    }
  }

  /**
   *  绘制几何体蒙版，蒙版元素绘制时调用
   */
  drawGeometryMask (renderer: Renderer, geometry: Geometry, worldMatrix: Matrix4, material: Material, maskRef: number, subMeshIndex = 0): void {
    const previousColorMask = material.colorMask;
    const prevStencilTest = material.stencilTest;
    const prevStencilFunc = material.stencilFunc;
    const prevStencilOpZPass = material.stencilOpZPass;
    // const prevStencilOpFail = material.stencilOpFail;
    // const prevStencilOpZFail = material.stencilOpZFail;
    const prevStencilRef = material.stencilRef;
    const prevStencilMask = material.stencilMask;

    this.setupMaskMaterial(material, maskRef);
    renderer.drawGeometry(geometry, worldMatrix, material, subMeshIndex);

    material.colorMask = previousColorMask;
    material.stencilTest = prevStencilTest;
    material.stencilFunc = prevStencilFunc;
    material.stencilOpZPass = prevStencilOpZPass;
    // material.stencilOpFail = prevStencilOpFail;
    // material.stencilOpZFail = prevStencilOpZFail;
    material.stencilRef = prevStencilRef;
    material.stencilMask = prevStencilMask;
  }

  /**
   * 设置蒙版材质的 stencil 属性（写入蒙版）
   *
   * 使用递增计数法：
   * - stencilFunc=EQUAL, ref=maskRef：仅在 stencil 值等于当前步数时通过
   * - stencilOpZPass=INCR：通过时递增 stencil 值
   * - stencilOpFail=KEEP：不通过时保持不变
   *
   * @param material - 要设置的材质
   * @param maskRef - 当前步数（正向蒙版索引或正向蒙版总数）
   */
  private setupMaskMaterial (material: Material, maskRef: number): void {
    material.stencilTest = true;
    // 仅在 stencil 值等于当前步数时通过
    material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
    material.stencilRef = [maskRef, maskRef];
    material.stencilMask = [0xFF, 0xFF];

    // 通过时递增 stencil 值，不通过时保持不变
    material.stencilOpZPass = [glContext.INCR, glContext.INCR];
    // material.stencilOpFail = [glContext.KEEP, glContext.KEEP];
    // material.stencilOpZFail = [glContext.KEEP, glContext.KEEP];

    material.colorMask = false; // 不写入颜色
  }

  /**
   * 设置被蒙版材质的 stencil 属性（多蒙版交集）
   *
   * stencil 值等于 expectedStencilValue（正向蒙版数量）表示：
   * - 该像素通过了所有正向蒙版（每个正向蒙版递增一次）
   * - 未被任何反向蒙版覆盖（否则会被进一步递增，值 > expectedStencilValue）
   *
   * @param material - 要设置的材质
   */
  private setupMaskedMaterial (material: Material): void {
    if (this.maskReferences.length > 0) {
      material.stencilTest = true;
      material.stencilRef = [this.expectedStencilValue, this.expectedStencilValue];
      material.stencilMask = [0xFF, 0xFF];
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
      material.stencilOpZPass = [glContext.KEEP, glContext.KEEP];
    } else {
      // 无蒙版：关闭 stencil 测试
      material.stencilTest = false;
    }
  }
}
