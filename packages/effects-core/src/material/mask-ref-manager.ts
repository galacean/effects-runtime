import type { Engine } from '../engine';
import type * as spec from '@galacean/effects-specification';
import type { Maskable, MaskReference } from './types';
import type { Renderer } from '../render/renderer';
import { TextureLoadAction } from '../texture/types';
import type { RenderPassClearAction } from '../render/render-pass';
import type { Material } from './material';
import { glContext } from '../gl';
import type { Geometry } from '../render/geometry';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { RendererComponent } from '../components';

// spec 更新后直接使用 spec.MaskReferenceData
type MaskOptionReference = {
  mask?: spec.DataPath,
  inverted?: boolean,
};

// spec 更新后直接使用 spec.MaskOptions
type MaskOptions = {
  isMask?: boolean,
  alphaMaskEnabled?: boolean,
  references?: MaskOptionReference[],
};

// 8 位 stencil buffer 上限为 255；为反向蒙版的 INCR 预留 1 的递增余量，
// 否则当正向蒙版填满到 255 时，反向 INCR 会饱和、无法排除任何像素。
const MAX_MASK_REFERENCE_COUNT = 254;

/**
 * @internal
 */
export class MaskProcessor {
  alphaMaskEnabled = false;

  isMask = false;

  /**
   * 多个蒙版引用列表，支持正面和反面蒙版
   */
  private maskReferences: MaskReference[] = [];

  /**
   * 期望的 stencil 值（等于正向蒙版的数量）
   */
  private expectedStencilValue = 0;

  private stencilClearAction: RenderPassClearAction;

  private prevStencilFunc: [number, number] = [0, 0];
  private prevStencilOpFail: [number, number] = [0, 0];
  private prevStencilOpZFail: [number, number] = [0, 0];
  private prevStencilOpZPass: [number, number] = [0, 0];
  private prevStencilRef: [number, number] = [0, 0];
  private prevStencilMask: [number, number] = [0, 0];

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
        inverted: false,
      });
    }
  }

  constructor () {
    this.stencilClearAction = { stencilAction: TextureLoadAction.clear };
  }

  /**
   * 设置蒙版选项。
   *
   * @param data.references - 蒙版引用列表。
   *   传入空数组等价于无蒙版。
   *   超过 254 个引用时，多余部分将被忽略并打印警告。
   */
  setMaskOptions (engine: Engine, data: MaskOptions): void {
    const { isMask = false, references = [], alphaMaskEnabled = false } = data;

    this.alphaMaskEnabled = alphaMaskEnabled;
    this.isMask = isMask;
    this.maskReferences = [];

    if (isMask || references.length === 0) {
      return;
    }

    const seen = new Map<Maskable, boolean>();

    for (const ref of references) {
      const maskPath = ref.mask;

      if (!maskPath) {
        continue;
      }

      const maskable = engine.findObject<Maskable>(maskPath);

      if (!maskable) {
        console.warn(`Mask reference not found: ${JSON.stringify(maskPath)}. Skipping.`);
        continue;
      }

      const inverted = ref.inverted ?? false;
      const existingInverted = seen.get(maskable);

      if (existingInverted !== undefined) {
        if (existingInverted !== inverted) {
          console.warn('Same maskable referenced with conflicting inverted flags; keeping the first occurrence.');
        }
        continue;
      }

      if (this.maskReferences.length >= MAX_MASK_REFERENCE_COUNT) {
        console.warn(`Maximum of ${MAX_MASK_REFERENCE_COUNT} mask references exceeded. Additional masks will be ignored.`);

        break;
      }

      seen.set(maskable, inverted);
      this.maskReferences.push({ maskable, inverted });
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
      if (this.maskReferences.length >= MAX_MASK_REFERENCE_COUNT) {
        console.warn(`Maximum of ${MAX_MASK_REFERENCE_COUNT} mask references exceeded. Additional masks will be ignored.`);

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
   * 获取当前蒙版引用列表的浅拷贝。
   */
  getMaskReferences (): ReadonlyArray<MaskReference> {
    return this.maskReferences.slice();
  }

  /**
   * 绘制所有蒙版，被蒙版的元素调用。
   *
   * 使用递增 stencil 计数法实现任意数量蒙版的交集：
   * 1. 正向蒙版按顺序渲染，每个仅在 stencil == 当前步数时递增（增量求交集）
   * 2. 反向蒙版渲染，将已通过所有正向蒙版的像素标记为无效
   * 3. 最终只有 stencil == 正向蒙版数量 的像素才通过测试
   *
   * 最多支持 254 个蒙版引用（8 位 stencil buffer 上限 255，需为反向 INCR 预留 1）
   */
  drawStencilMask (renderer: Renderer, maskedComponent: RendererComponent): void {
    const frameClipMasks = maskedComponent.frameClipMasks;
    const addedFrameClipMasks: Maskable[] = [];

    for (const frameClipMask of frameClipMasks) {
      const referenceCount = this.maskReferences.length;

      this.addMaskReference(frameClipMask, false);

      if (this.maskReferences.length > referenceCount) {
        addedFrameClipMasks.push(frameClipMask);
      }
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

    for (const frameClipMask of addedFrameClipMasks) {
      this.removeMaskReference(frameClipMask);
    }
  }

  /**
   *  绘制几何体蒙版，蒙版元素绘制时调用
   */
  drawGeometryMask (renderer: Renderer, geometry: Geometry, worldMatrix: Matrix4, material: Material, maskRef: number, subMeshIndex = 0): void {
    const previousColorMask = material.colorMask;
    const prevStencilTest = material.stencilTest;

    this.copyStencilArrayValue(this.prevStencilFunc, material.stencilFunc);
    this.copyStencilArrayValue(this.prevStencilOpFail, material.stencilOpFail);
    this.copyStencilArrayValue(this.prevStencilOpZFail, material.stencilOpZFail);
    this.copyStencilArrayValue(this.prevStencilOpZPass, material.stencilOpZPass);
    this.copyStencilArrayValue(this.prevStencilRef, material.stencilRef);
    this.copyStencilArrayValue(this.prevStencilMask, material.stencilMask);

    this.setupMaskMaterial(material, maskRef);
    renderer.drawGeometry(geometry, worldMatrix, material, subMeshIndex);

    material.colorMask = previousColorMask;
    material.stencilTest = prevStencilTest;
    material.stencilFunc = this.prevStencilFunc;
    material.stencilOpFail = this.prevStencilOpFail;
    material.stencilOpZFail = this.prevStencilOpZFail;
    material.stencilOpZPass = this.prevStencilOpZPass;
    material.stencilRef = this.prevStencilRef;
    material.stencilMask = this.prevStencilMask;
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
    material.stencilOpFail = [glContext.KEEP, glContext.KEEP];
    material.stencilOpZFail = [glContext.KEEP, glContext.KEEP];
    material.stencilOpZPass = [glContext.INCR, glContext.INCR];

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

  private copyStencilArrayValue (target: [number, number], source: [number, number] | undefined): void {
    if (!source) {
      return;
    }

    target[0] = source[0];
    target[1] = source[1];
  }
}
