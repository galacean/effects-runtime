import { escape, richTextParser, type Attribute, type RichTextAST } from '@galacean/effects-plugin-rich-text';

type InputSelection = { start: number, end: number, forwardDelete?: boolean };

/** 在浏览器修改 textarea 前记录选区和删除方向。 */
export function getRichTextInputSelection (textarea: HTMLTextAreaElement, inputType = '') {
  return {
    start: textarea.selectionStart, end: textarea.selectionEnd,
    forwardDelete: inputType.startsWith('delete') && inputType.endsWith('Forward'),
  };
}

/** 使用可见文字的 UTF-16 偏移编辑富文本，保留未修改片段的属性。 */
export class RichTextDocument {
  private runs: RichTextAST[];

  constructor (private source: string) {
    this.runs = richTextParser(source);
  }

  get text (): string {
    return this.runs.map(run => run.text).join('');
  }

  get markup (): string {
    return this.source;
  }

  /** 连同默认字号计算整体缩放的最小字号限制。 */
  getMinimumFontSize (defaultFontSize: number): number {
    let minimum = defaultFontSize;

    for (const run of this.runs) {
      const size = parseFloat(effectiveAttribute(run, 'size') ?? '');

      if (Number.isFinite(size) && size > 0) { minimum = Math.min(minimum, size); }
    }

    return minimum;
  }

  /** 从原始片段生成同比调整字号的 markup，不修改当前文档。 */
  scaleFontSizes (ratio: number): string {
    if (ratio === 1 || !Number.isFinite(ratio) || ratio <= 0) { return this.source; }
    let changed = false;
    const runs = this.runs.map(run => ({
      text: run.text,
      attributes: run.attributes.map(attribute => {
        const size = parseFloat(attribute.attributeParam ?? '');

        if (attribute.attributeName !== 'size' || !Number.isFinite(size) || size <= 0) { return attribute; }
        changed = true;

        return { ...attribute, attributeParam: String(size * ratio) };
      }),
    }));

    return changed ? serializeRuns(runs) : this.source;
  }

  /** undefined 表示继承默认样式，null 表示选区包含混合样式。 */
  getFormat (start: number, end: number, attributeName: string): string | null | undefined {
    const values = this.slice(start, end).map(run => effectiveAttribute(run, attributeName));

    return values.every(value => value === values[0]) ? values[0] : null;
  }

  /** 替换可见文字选区；插入继承左侧样式，替换继承选区首字符样式。 */
  replace (start: number, end: number, text: string): void {
    const length = this.text.length;

    start = Math.max(0, Math.min(start, length));
    end = Math.max(start, Math.min(end, length));
    const attributes = this.attributesAt(start === end ? Math.max(0, start - 1) : start);

    this.runs = [
      ...this.slice(0, start),
      ...(text ? [{ text, attributes }] : []),
      ...this.slice(end, length),
    ];
    this.serialize();
  }

  /** 根据原始选区限定差异范围，避免重复字符导致样式归属错误。 */
  updateText (text: string, selection?: InputSelection): void {
    const before = this.text;

    if (before === text) { return; }
    if (selection?.forwardDelete && selection.start === selection.end && text.length < before.length) {
      // 向前删除从光标开始，实际长度由输入前后的文本决定。
      const start = selection.start;
      const end = start + (before.length - text.length);

      if (before.slice(0, start) + before.slice(end) === text) {
        this.replace(start, end, '');

        return;
      }
    }
    let start = 0;
    let end = before.length;
    let nextEnd = text.length;
    // Backspace 时给选区后的原文留出空间；无选区时优先保留公共前缀。
    const suffixLength = selection ? Math.max(0, end - selection.end) : 0;
    const prefixLimit = Math.min(selection?.start ?? end, end, nextEnd - suffixLength);

    while (start < prefixLimit && before[start] === text[start]) { start++; }
    const suffixLimit = Math.max(start, selection?.end ?? 0);

    while (end > suffixLimit && nextEnd > start && before[end - 1] === text[nextEnd - 1]) {
      end--;
      nextEnd--;
    }
    this.replace(start, end, text.slice(start, nextEnd));
  }

  /** 对选区应用或移除属性；用于加粗、斜体、字号和颜色。 */
  format (start: number, end: number, attributeName: string, value?: string | null): void {
    if (start >= end) { return; }
    const selected = this.slice(start, end);
    const remove = value === null || (value === undefined && selected.every(run =>
      run.attributes.some(attribute => attribute.attributeName === attributeName)));

    this.runs = [
      ...this.slice(0, start),
      ...selected.map(run => ({
        text: run.text,
        attributes: [
          ...run.attributes.filter(attribute => attribute.attributeName !== attributeName),
          ...(remove ? [] : [{ attributeName, attributeParam: value ?? '' }]),
        ],
      })),
      ...this.slice(end, this.text.length),
    ];
    this.serialize();
  }

  private attributesAt (index: number): Attribute[] {
    let offset = 0;

    for (const run of this.runs) {
      offset += run.text.length;
      if (index < offset) { return run.attributes.map(attribute => ({ ...attribute })); }
    }

    return [];
  }

  private slice (start: number, end: number): RichTextAST[] {
    let offset = 0;
    const runs: RichTextAST[] = [];

    for (const run of this.runs) {
      const text = run.text.slice(Math.max(0, start - offset), Math.max(0, end - offset));

      if (text) { runs.push({ text, attributes: run.attributes }); }
      offset += run.text.length;
    }

    return runs;
  }

  private serialize (): void {
    const merged: RichTextAST[] = [];

    for (const run of this.runs) {
      const previous = merged[merged.length - 1];

      if (previous && JSON.stringify(previous.attributes) === JSON.stringify(run.attributes)) {
        previous.text += run.text;
      } else {
        merged.push({ ...run });
      }
    }
    this.runs = merged;
    this.source = serializeRuns(merged);
  }
}

function effectiveAttribute (run: RichTextAST, name: string): string | undefined {
  for (let i = run.attributes.length - 1; i >= 0; i--) {
    const attribute = run.attributes[i];

    if (attribute.attributeName === name) { return attribute.attributeParam; }
  }
}

function serializeRuns (runs: RichTextAST[]): string {
  return runs.map(run => run.attributes.reduceRight((text, attribute) => {
    const { attributeName, attributeParam } = attribute;

    return attributeName
      ? `<${attributeName}${attributeParam ? `=${attributeParam}` : ''}>${text}</${attributeName}>`
      : text;
  }, escape(run.text))).join('');
}
