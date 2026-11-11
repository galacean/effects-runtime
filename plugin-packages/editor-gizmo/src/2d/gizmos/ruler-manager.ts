/** 参考线使用文档坐标；水平线记录 y，垂直线记录 x。 */
export type RulerGuides = { horizontal: number[], vertical: number[] };
export type RulerDirection = keyof RulerGuides;

function isFiniteNumber (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeGuides (guides: unknown): RulerGuides {
  if (!guides || typeof guides !== 'object') {
    return { horizontal: [], vertical: [] };
  }
  const source = guides as { horizontal?: unknown, vertical?: unknown };
  const normalizeDirection = (values: unknown): number[] =>
    Array.isArray(values) ? values.filter(isFiniteNumber) : [];

  return {
    horizontal: normalizeDirection(source.horizontal),
    vertical: normalizeDirection(source.vertical),
  };
}

function cloneGuides (guides: RulerGuides): RulerGuides {
  return { horizontal: [...guides.horizontal], vertical: [...guides.vertical] };
}

function equalGuides (a: RulerGuides, b: RulerGuides): boolean {
  return (['horizontal', 'vertical'] as const).every(direction =>
    a[direction].length === b[direction].length
      && a[direction].every((value, index) => value === b[direction][index]),
  );
}

/** 管理标尺的已提交数据，使标尺 Gizmo 可以安全地重建。 */
export class RulerManager {
  private value: RulerGuides = { horizontal: [], vertical: [] };

  /** 返回隔离后的标尺快照。 */
  snapshot (): RulerGuides {
    return cloneGuides(this.value);
  }

  /** 返回当前标尺数据的副本。 */
  get guides (): RulerGuides {
    return this.snapshot();
  }

  /** 替换标尺数据；返回值表示数据是否发生变化。 */
  setGuides (guides: RulerGuides): boolean {
    if (!guides.horizontal.every(Number.isFinite) || !guides.vertical.every(Number.isFinite)) {
      throw new Error('[editor-gizmo] Ruler coordinates must be finite.');
    }
    if (equalGuides(guides, this.value)) {
      return false;
    }
    this.value = cloneGuides(guides);

    return true;
  }

  /** 从场景编辑数据恢复标尺；恢复操作本身不产生交互事件。 */
  hydrate (guides: unknown): void {
    this.value = normalizeGuides(guides);
  }

  /** 清空全部标尺。 */
  clear (): boolean {
    return this.setGuides({ horizontal: [], vertical: [] });
  }
}
