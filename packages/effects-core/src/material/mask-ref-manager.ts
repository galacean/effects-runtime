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
import { RendererComponent } from '../components/renderer-component';
import type { MaskComponent } from '../components/mask-component';
import type { VFXItem } from '../vfx-item';
import type { CompositionComponent } from '../components/composition-component';
import { getClass } from '../decorators';
import { MaskStencil } from './mask-stencil';

// 8 位 stencil buffer 上限为 255；为反向轨道遮罩的 INCR 预留 1 的递增余量，
// 否则当正向轨道遮罩填满到 255 时，反向 INCR 会饱和、无法排除任何像素。
const MAX_TRACK_MATTE_REFERENCE_COUNT = 254;

/**
 * @internal
 */
export class MaskProcessor {
  /**
   * 丢弃来源中 alpha 低于阈值的像素。
   */
  alphaMaskEnabled = false;

  isTrackMatte = false;
  sourceVisible = false;

  /**
   * 轨道遮罩引用列表，支持正向和反向裁剪
   */
  private trackMatteReferences: MaskReference[] = [];

  /**
   * 计数裁剪的目标 stencil 值，等于正向轨道遮罩的数量
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
   * @deprecated 使用 getMaskReferences() 替代
   */
  get maskable (): Maskable | null {
    return this.trackMatteReferences.length > 0 ? this.trackMatteReferences[0].maskable : null;
  }

  /**
   * @deprecated 使用 clearMaskReferences() 和 addMaskReference() 替代
   */
  set maskable (value: Maskable | null) {
    this.trackMatteReferences = [];
    if (value) {
      this.trackMatteReferences.push({ maskable: value, inverted: false });
    }
  }

  constructor () {
    this.stencilClearAction = { stencilAction: TextureLoadAction.clear };
  }

  fromData (engine: Engine, data: { trackMatte?: spec.TrackMatteOptions }): void {
    if (data.trackMatte !== undefined) {
      this.applyTrackMatteOptions(engine, data.trackMatte);
    }
  }

  /**
   * @internal
   */
  get isTrackMatteOnly (): boolean { return this.isTrackMatte && !this.sourceVisible; }

  /**
   * 读取旧 mask 选项，保留轨道遮罩来源的颜色绘制。
   */
  setMaskOptions (engine: Engine, data: spec.MaskOptions): void {
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
   *   传入空数组表示不引用轨道遮罩。
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
   * @param inverted - 是否反向裁剪
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

  /**
   * 对轨道遮罩、Frame 裁剪和图层自有路径蒙版取交集。
   */
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

    const sources = this.trackMatteReferences.map(reference => {
      const source = reference.maskable;
      // 来源未继承 RendererComponent 时，从同一图层的渲染组件读取 Frame 裁剪。
      const sourceRenderer = source instanceof RendererComponent ? source : source.item.getComponent(RendererComponent);
      const frames = sourceRenderer?.frameClipMasks ?? [];
      const paths = new Set(this.getPathMasks(source.item));

      for (const frame of frames) {
        for (const path of this.getPathMasks(frame.item)) {
          paths.add(path);
        }
      }

      return { reference, paths: Array.from(paths), frames };
    });
    const hasSourceClipping = sources.some(source => source.paths.length > 0 || source.frames.length > 0);

    if (hasSourceClipping) {
      this.drawTrackMattesWithClipping(renderer, sources);
    } else if (this.trackMatteReferences.length > 0) {
      this.drawTrackMatteCounter(renderer);
    }

    const pathMasks = this.getPathMasks(maskedComponent.item);

    if (pathMasks.length > 0) {
      if (!hasSourceClipping && this.trackMatteReferences.length > 0) {
        // 将计数结果转为覆盖标记；正向遮罩数量为 0 时也需保留匹配区域。
        renderer.drawFullscreenStencil(MaskStencil.All, this.expectedStencilValue, glContext.EQUAL, glContext.ZERO, glContext.INCR);
        renderer.drawFullscreenStencil(MaskStencil.All, 0, glContext.EQUAL, glContext.INCR, glContext.ZERO);
        renderer.drawFullscreenStencil(
          MaskStencil.Path, MaskStencil.Target | MaskStencil.Path, glContext.EQUAL, glContext.REPLACE, glContext.ZERO, MaskStencil.Target,
        );
      } else if (!hasSourceClipping) {
        renderer.drawFullscreenStencil(MaskStencil.All, MaskStencil.Target, glContext.ALWAYS, glContext.REPLACE);
      }
      for (const pathMask of pathMasks) {
        // 目标图层的 Billboard 变换仅作用于自有路径，预合成路径使用自身变换。
        pathMask.drawStencilStack(renderer, pathMask.item === maskedComponent.item ? maskedComponent.getPathMaskWorldMatrix(renderer) : undefined);
        const intersection = MaskStencil.Target | MaskStencil.Path;

        renderer.drawFullscreenStencil(intersection, intersection, glContext.EQUAL, glContext.KEEP, glContext.ZERO, MaskStencil.Target);
      }
    }

    for (const material of maskedComponent.materials) {
      if (hasSourceClipping || pathMasks.length > 0) {
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

  private drawTrackMattesWithClipping (renderer: Renderer, sources: { reference: MaskReference, paths: MaskComponent[], frames: Maskable[] }[]): void {
    const pathBits = MaskStencil.Path | MaskStencil.Scratch;
    const sourceIntersection = MaskStencil.Source | MaskStencil.Path;
    const targetIntersection = MaskStencil.Target | MaskStencil.Path;

    renderer.drawFullscreenStencil(MaskStencil.All, MaskStencil.Target, glContext.ALWAYS, glContext.REPLACE);
    for (const { reference, paths, frames } of sources) {
      renderer.drawFullscreenStencil(MaskStencil.Source | pathBits, MaskStencil.Source, glContext.ALWAYS, glContext.REPLACE);
      for (const path of paths) {
        path.drawStencilStack(renderer, path.item === reference.maskable.item ? reference.maskable.getPathMaskWorldMatrix?.(renderer) : undefined);
        renderer.drawFullscreenStencil(sourceIntersection, sourceIntersection, glContext.EQUAL, glContext.KEEP, glContext.ZERO, MaskStencil.Source);
      }
      // 来源先经过 Frame 裁剪再反转，计算期间保留已有的目标覆盖结果。
      for (const frame of frames) {
        renderer.drawFullscreenStencil(pathBits, 0, glContext.ALWAYS, glContext.ZERO);
        frame.drawStencilMask(MaskStencil.Source | MaskStencil.Target);
        renderer.drawFullscreenStencil(sourceIntersection, sourceIntersection, glContext.EQUAL, glContext.KEEP, glContext.ZERO, MaskStencil.Source);
      }
      renderer.drawFullscreenStencil(pathBits, 0, glContext.ALWAYS, glContext.ZERO);
      // EQUAL/INCR 使来源仅在 Source 与 Target 的交集内置位 Path。
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

    // 先累计正向来源的交集，再排除反向来源，结果不受引用顺序影响。
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
      // 仅继承上层预合成的路径裁剪，普通父子变换关系不传递裁剪。
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
   * 绘制轨道遮罩来源的几何体，仅写入 stencil，不写入颜色和深度。
   */
  drawGeometryMask (renderer: Renderer, geometry: Geometry, worldMatrix: Matrix4, material: Material, maskRef: number, subMeshIndex = 0): void {
    const prevColorMask = material.colorMask;
    const prevDepthMask = material.depthMask;
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
      material.depthMask = false;
      material.stencilWriteMask = undefined;
      renderer.drawGeometry(geometry, worldMatrix, material, subMeshIndex);
    } finally {
      material.colorMask = prevColorMask;
      material.depthMask = prevDepthMask;
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
   * 设置轨道遮罩来源材质的 stencil 属性
   *
   * 使用递增计数法：
   * - stencilFunc=EQUAL, ref=maskRef：仅在 stencil 值等于 maskRef 时通过
   * - stencilOpZPass=INCR：通过时递增 stencil 值
   * - stencilOpFail=KEEP：不通过时保持不变
   *
   * @param material - 要设置的材质
   * @param maskRef - 递增前需要匹配的 stencil 值
   */
  private setupMaskMaterial (material: Material, maskRef: number): void {
    material.stencilTest = true;
    // 仅在 stencil 值等于 maskRef 时通过
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
   * 设置目标材质的 stencil 属性（多轨道遮罩交集）
   *
   * stencil 值等于 expectedStencilValue（正向轨道遮罩数量）表示：
   * - 该像素通过了所有正向来源（每个正向来源递增一次）
   * - 未被任何反向来源覆盖（否则会被进一步递增，值 > expectedStencilValue）
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
      // 无轨道遮罩引用时关闭 stencil 测试
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
