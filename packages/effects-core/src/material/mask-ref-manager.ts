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
import type { MaskComponent } from '../components/mask-component';
import type { VFXItem } from '../vfx-item';
import type { CompositionComponent } from '../components/composition-component';
import { getClass } from '../decorators';
import { MaskStencil } from './mask-stencil';

// The existing API accepts unresolved references without a mask path.
type MaskOptions = {
  isMask?: boolean,
  alphaMaskEnabled?: boolean,
  references?: { mask?: spec.DataPath, inverted?: boolean }[],
};

// 8 位 stencil buffer 上限为 255；为反向蒙版的 INCR 预留 1 的递增余量，
// 否则当正向蒙版填满到 255 时，反向 INCR 会饱和、无法排除任何像素。
const MAX_TRACK_MATTE_REFERENCE_COUNT = 254;

/**
 * @internal
 */
export class MaskProcessor {
  /** Discards source pixels below the alpha threshold, producing hard-edge coverage. */
  alphaMaskEnabled = false;

  isTrackMatte = false;
  sourceVisible = false;

  /**
   * 多个轨道遮罩引用列表，支持正面和反面蒙版
   */
  private trackMatteReferences: MaskReference[] = [];

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

  /** @deprecated Use getMaskReferences(). */
  get maskable (): Maskable | null {
    return this.trackMatteReferences.length > 0 ? this.trackMatteReferences[0].maskable : null;
  }

  /** @deprecated Use clearMaskReferences() and addMaskReference(). */
  set maskable (value: Maskable | null) {
    this.trackMatteReferences = [];
    if (value) {
      this.trackMatteReferences.push({ maskable: value, inverted: false });
    }
  }

  constructor () {
    this.stencilClearAction = { stencilAction: TextureLoadAction.clear };
  }

  fromData (engine: Engine, data: { trackMatte?: spec.TrackMatteOptions, mask?: spec.MaskOptions }): void {
    if (data.trackMatte !== undefined) {
      this.applyTrackMatteOptions(engine, data.trackMatte);
    } else if (data.mask !== undefined) {
      this.setMaskOptions(engine, data.mask);
    }
  }

  /** @internal */
  get isTrackMatteOnly (): boolean { return this.isTrackMatte && !this.sourceVisible; }

  /** Accepts the existing mask options format and preserves source color. */
  setMaskOptions (engine: Engine, data: MaskOptions): void {
    const references: spec.TrackMatteReferenceData[] = [];

    for (const reference of data.references ?? []) {
      if (reference.mask) {
        references.push({ source: reference.mask, inverted: reference.inverted });
      }
    }
    this.applyTrackMatteOptions(engine, {
      isTrackMatte: data.isMask,
      sourceVisible: true,
      alphaMaskEnabled: data.alphaMaskEnabled,
      references,
    });
  }

  /**
   * 设置轨道遮罩选项。
   *
   * @param data.references - 轨道遮罩引用列表。
   *   传入空数组等价于无蒙版。
   *   超过 254 个引用时，多余部分将被忽略并打印警告。
   */
  private applyTrackMatteOptions (engine: Engine, data: spec.TrackMatteOptions): void {
    const { isTrackMatte = false, sourceVisible = false, references = [], alphaMaskEnabled = false } = data;

    this.alphaMaskEnabled = alphaMaskEnabled;
    this.isTrackMatte = isTrackMatte;
    this.sourceVisible = sourceVisible;
    this.trackMatteReferences = [];

    if (isTrackMatte || references.length === 0) {
      return;
    }

    const seen = new Map<Maskable, boolean>();

    for (const ref of references) {
      const maskPath = ref.source;
      const maskable = engine.effectsObjectServer.findObject<Maskable>(maskPath);

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

      if (this.trackMatteReferences.length >= MAX_TRACK_MATTE_REFERENCE_COUNT) {
        console.warn(`Maximum of ${MAX_TRACK_MATTE_REFERENCE_COUNT} mask references exceeded. Additional masks will be ignored.`);

        break;
      }

      seen.set(maskable, inverted);
      this.trackMatteReferences.push({ maskable, inverted });
    }
  }

  /**
   * 添加轨道遮罩引用
   * @param maskable - 轨道遮罩来源
   * @param inverted - 是否反向蒙版
   */
  addMaskReference (maskable: Maskable, inverted = false): void {
    const exists = this.trackMatteReferences.some(ref => ref.maskable === maskable);

    if (!exists) {
      if (this.trackMatteReferences.length >= MAX_TRACK_MATTE_REFERENCE_COUNT) {
        console.warn(`Maximum of ${MAX_TRACK_MATTE_REFERENCE_COUNT} mask references exceeded. Additional masks will be ignored.`);

        return;
      }
      this.trackMatteReferences.push({ maskable, inverted });
    }
  }

  /**
   * 移除轨道遮罩引用
   * @param maskable - 要移除的轨道遮罩来源
   */
  removeMaskReference (maskable: Maskable): void {
    const index = this.trackMatteReferences.findIndex(ref => ref.maskable === maskable);

    if (index !== -1) {
      this.trackMatteReferences.splice(index, 1);
    }
  }

  /**
   * 清空所有轨道遮罩引用
   */
  clearMaskReferences (): void {
    this.trackMatteReferences = [];
  }

  /**
   * 获取当前轨道遮罩引用列表的浅拷贝。
   */
  getMaskReferences (): ReadonlyArray<MaskReference> {
    return this.trackMatteReferences.slice();
  }

  /** Intersects track mattes, frame clipping and layer-owned path stacks. */
  drawStencilMask (renderer: Renderer, maskedComponent: RendererComponent): void {
    const frameClipMasks = maskedComponent.frameClipMasks;
    const addedFrameClipMasks: Maskable[] = [];

    for (const frameClipMask of frameClipMasks) {
      const referenceCount = this.trackMatteReferences.length;

      this.addMaskReference(frameClipMask, false);

      if (this.trackMatteReferences.length > referenceCount) {
        addedFrameClipMasks.push(frameClipMask);
      }
    }

    const sources = this.trackMatteReferences.map(reference => ({
      reference,
      paths: this.getPathMasks(reference.maskable.item),
    }));
    const hasSourcePaths = sources.some(source => source.paths.length > 0);

    if (hasSourcePaths) {
      this.drawTrackMattesWithPaths(renderer, sources);
    } else if (this.trackMatteReferences.length > 0) {
      this.drawTrackMatteCounter(renderer);
    }

    const pathMasks = this.getPathMasks(maskedComponent.item);

    if (pathMasks.length > 0) {
      if (!hasSourcePaths && this.trackMatteReferences.length > 0) {
        // Convert the legacy counter to binary coverage without losing the count == 0 case.
        renderer.drawFullscreenStencil(MaskStencil.All, this.expectedStencilValue, glContext.EQUAL, glContext.ZERO, glContext.INCR);
        renderer.drawFullscreenStencil(MaskStencil.All, 0, glContext.EQUAL, glContext.INCR, glContext.ZERO);
        renderer.drawFullscreenStencil(
          MaskStencil.Path, MaskStencil.Target | MaskStencil.Path, glContext.EQUAL, glContext.REPLACE, glContext.ZERO, MaskStencil.Target,
        );
      } else if (!hasSourcePaths) {
        renderer.drawFullscreenStencil(MaskStencil.All, MaskStencil.Target, glContext.ALWAYS, glContext.REPLACE);
      }
      for (const pathMask of pathMasks) {
        // A target's billboard basis must not affect an enclosing precomposition's paths.
        pathMask.drawStencilStack(renderer, pathMask.item === maskedComponent.item ? maskedComponent.getPathMaskWorldMatrix(renderer) : undefined);
        const intersection = MaskStencil.Target | MaskStencil.Path;

        renderer.drawFullscreenStencil(intersection, intersection, glContext.EQUAL, glContext.KEEP, glContext.ZERO, MaskStencil.Target);
      }
    }

    for (const material of maskedComponent.materials) {
      if (hasSourcePaths || pathMasks.length > 0) {
        material.stencilTest = true;
        material.stencilMask = [MaskStencil.Target, MaskStencil.Target];
        material.stencilRef = [MaskStencil.Target, MaskStencil.Target];
        material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
        material.stencilOpFail = [glContext.KEEP, glContext.KEEP];
        material.stencilOpZFail = [glContext.KEEP, glContext.KEEP];
        material.stencilOpZPass = [glContext.KEEP, glContext.KEEP];
      } else {
        this.setupMaskedMaterial(material);
      }
    }

    for (const frameClipMask of addedFrameClipMasks) {
      this.removeMaskReference(frameClipMask);
    }
  }

  private drawTrackMattesWithPaths (renderer: Renderer, sources: { reference: MaskReference, paths: MaskComponent[] }[]): void {
    const pathBits = MaskStencil.Path | MaskStencil.Scratch;
    const sourceIntersection = MaskStencil.Source | MaskStencil.Path;
    const targetIntersection = MaskStencil.Target | MaskStencil.Path;

    renderer.drawFullscreenStencil(MaskStencil.All, MaskStencil.Target, glContext.ALWAYS, glContext.REPLACE);
    for (const { reference, paths } of sources) {
      renderer.drawFullscreenStencil(MaskStencil.Source | pathBits, MaskStencil.Source, glContext.ALWAYS, glContext.REPLACE);
      for (const path of paths) {
        path.drawStencilStack(renderer, path.item === reference.maskable.item ? reference.maskable.getPathMaskWorldMatrix?.(renderer) : undefined);
        renderer.drawFullscreenStencil(sourceIntersection, sourceIntersection, glContext.EQUAL, glContext.KEEP, glContext.ZERO, MaskStencil.Source);
      }
      renderer.drawFullscreenStencil(pathBits, 0, glContext.ALWAYS, glContext.ZERO);
      // EQUAL/INCR source callbacks set the Path bit only inside both Source and Target coverage.
      reference.maskable.drawStencilMask(MaskStencil.Source | MaskStencil.Target);
      if (reference.inverted) {
        renderer.drawFullscreenStencil(MaskStencil.Path, MaskStencil.Path, glContext.EQUAL, glContext.ZERO, glContext.KEEP, MaskStencil.Target);
      } else {
        renderer.drawFullscreenStencil(MaskStencil.Path, targetIntersection, glContext.EQUAL, glContext.REPLACE, glContext.ZERO, MaskStencil.Target);
      }
    }
  }

  private drawTrackMatteCounter (renderer: Renderer): void {
    renderer.clear(this.stencilClearAction);
    let forwardCount = 0;

    // EQUAL/INCR keeps only pixels covered by every forward source, regardless of reference order.
    for (const reference of this.trackMatteReferences) {
      if (!reference.inverted) {
        reference.maskable.drawStencilMask(forwardCount++);
      }
    }
    for (const reference of this.trackMatteReferences) {
      if (reference.inverted) {
        reference.maskable.drawStencilMask(forwardCount);
      }
    }
    this.expectedStencilValue = forwardCount;
  }

  private getPathMasks (owner: VFXItem): MaskComponent[] {
    const MaskClass: typeof MaskComponent = getClass('MaskComponent');
    const CompositionClass: typeof CompositionComponent = getClass('CompositionComponent');
    const masks: MaskComponent[] = [];

    if (!MaskClass) {
      return masks;
    }
    for (let item = owner; item; item = item.parent!) {
      // Only precomposition boundaries propagate clipping, not transform parenting.
      if (item !== owner && (!CompositionClass || !item.getComponent(CompositionClass))) {
        continue;
      }
      const mask = item.getComponent(MaskClass);

      if (mask?.hasActivePaths()) {
        masks.push(mask);
      }
    }

    return masks;
  }

  /**
   *  绘制几何体蒙版，蒙版元素绘制时调用
   */
  drawGeometryMask (renderer: Renderer, geometry: Geometry, worldMatrix: Matrix4, material: Material, maskRef: number, subMeshIndex = 0): void {
    const prevColorMask = material.colorMask;
    const prevStencilTest = material.stencilTest;
    const prevStencilWriteMask = material.stencilWriteMask;

    this.copyStencilArrayValue(this.prevStencilFunc, material.stencilFunc);
    this.copyStencilArrayValue(this.prevStencilOpFail, material.stencilOpFail);
    this.copyStencilArrayValue(this.prevStencilOpZFail, material.stencilOpZFail);
    this.copyStencilArrayValue(this.prevStencilOpZPass, material.stencilOpZPass);
    this.copyStencilArrayValue(this.prevStencilRef, material.stencilRef);
    this.copyStencilArrayValue(this.prevStencilMask, material.stencilMask);

    try {
      this.setupMaskMaterial(material, maskRef);
      material.stencilWriteMask = undefined;
      renderer.drawGeometry(geometry, worldMatrix, material, subMeshIndex);
    } finally {
      material.colorMask = prevColorMask;
      material.stencilTest = prevStencilTest;
      material.stencilFunc = this.prevStencilFunc;
      material.stencilOpFail = this.prevStencilOpFail;
      material.stencilOpZFail = this.prevStencilOpZFail;
      material.stencilOpZPass = this.prevStencilOpZPass;
      material.stencilRef = this.prevStencilRef;
      material.stencilMask = this.prevStencilMask;
      material.stencilWriteMask = prevStencilWriteMask;
    }
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
    if (this.trackMatteReferences.length > 0) {
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
