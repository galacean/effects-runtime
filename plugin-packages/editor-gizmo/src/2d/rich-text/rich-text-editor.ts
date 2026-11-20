import type { RichTextComponent, RichTextCharacterBox } from '@galacean/effects-plugin-rich-text';
import { getRichTextInputSelection, RichTextDocument } from './rich-text-document';
import { richTextViewportTransform, type RichTextCaretPosition, type RichTextViewport } from './rich-text-geometry';

type Snapshot = { source: string, start: number, end: number };
export type RichTextFormat = 'b' | 'i' | 'size' | 'color';
export type RichTextSelectionFormats = Partial<Record<RichTextFormat, string | null>>;

/** textarea 负责输入法和系统剪贴板，富文本渲染器负责光标和选区几何。 */
export class RichTextEditor {
  private document: RichTextDocument;
  private readonly overlay = window.document.createElement('div');
  private readonly undoStack: Snapshot[] = [];
  private readonly redoStack: Snapshot[] = [];
  private beforeInput: (Snapshot & { forwardDelete: boolean }) | undefined;
  private composition: { before: Snapshot, text: string } | undefined;
  private pendingCommit: { before: Snapshot, text: string } | undefined;
  private positions: RichTextCaretPosition[] = [];
  private upstreamCaretIndex: number | undefined;
  private characters: readonly RichTextCharacterBox[] = [];
  private caretWidth = 1;
  private viewportWidth = 0;
  private paintKey = '';

  constructor (
    readonly component: RichTextComponent,
    private readonly textarea: HTMLTextAreaElement,
    private readonly onChange: () => void,
  ) {
    this.document = new RichTextDocument(component.text);
    this.overlay.className = 'text-gizmo-rich-selection';
    Object.assign(this.overlay.style, { position: 'absolute', pointerEvents: 'none', zIndex: '3', transformOrigin: '0 0', overflow: 'hidden' });
    textarea.parentElement?.appendChild(this.overlay);
    textarea.addEventListener('beforeinput', this.handleBeforeInput);
    textarea.addEventListener('compositionstart', this.handleCompositionStart);
    textarea.addEventListener('compositionend', this.handleCompositionEnd);
  }

  get text (): string { return this.document.text; }

  get selectionFormats (): RichTextSelectionFormats | undefined {
    const { selectionStart: start, selectionEnd: end } = this.textarea;

    if (start === end) { return; }

    const formats: RichTextSelectionFormats = {};

    for (const attribute of ['b', 'i', 'size', 'color'] as const) {
      formats[attribute] = this.document.getFormat(start, end, attribute);
    }

    return formats;
  }

  /** 将纯文本输入合并到富文本片段，不把标签暴露在输入框中。 */
  input (inputType = ''): void {
    const before = this.beforeInput ?? this.snapshot();
    const pending = this.pendingCommit;
    const value = this.textarea.value;
    const commitsComposition = pending && (value === pending.text || inputType.includes('Composition'));

    this.document.updateText(value, this.beforeInput);
    if (before.source !== this.document.markup) {
      if (!this.composition) { this.remember(commitsComposition ? pending.before : before); }
      if (!commitsComposition || value === pending.text) { this.pendingCommit = undefined; }
      this.publish();
    }
    this.beforeInput = undefined;
  }

  format (attribute: RichTextFormat, value?: string | null): boolean {
    if (this.composition || this.textarea.selectionStart === this.textarea.selectionEnd) { return false; }
    if (attribute === 'size' && value !== null && (!value || !Number.isFinite(+value) || +value <= 0)) { return false; }
    if (attribute === 'color' && value !== null && (!value || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value))) { return false; }
    const before = this.snapshot();

    this.document.format(before.start, before.end, attribute, value);
    if (before.source !== this.document.markup) {
      this.pendingCommit = undefined;
      this.remember(before);
      this.publish();
    }

    return true;
  }

  keyDown (event: KeyboardEvent): void {
    if (event.isComposing || this.composition) { return; }
    const command = event.metaKey || event.ctrlKey;

    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { this.upstreamCaretIndex = undefined; }
    if (command && !event.altKey && (event.code === 'KeyZ' || event.code === 'KeyY')) {
      event.preventDefault();
      this.restore(event.code === 'KeyY' || event.shiftKey);
    } else if (command && !event.altKey && (event.code === 'KeyB' || event.code === 'KeyI')) {
      event.preventDefault();
      this.format(event.code === 'KeyB' ? 'b' : 'i');
    } else if (!command && !event.altKey && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.code)) {
      this.navigate(event);
    }
  }

  /** 同步外部修改和渲染坐标。返回供画布命中使用的插入点。 */
  sync (style: RichTextViewport): RichTextCaretPosition[] {
    if (!this.composition && this.component.text !== this.document.markup) {
      const { selectionStart, selectionEnd } = this.textarea;

      this.document = new RichTextDocument(this.component.text);
      this.textarea.value = this.text;
      this.textarea.setSelectionRange(selectionStart, selectionEnd);
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.pendingCommit = undefined;
      this.upstreamCaretIndex = undefined;
    }
    const layout = this.component.getEditingLayout();

    this.caretWidth = 1 / Math.max(0.001, Math.hypot(style.transform.a, style.transform.b));
    this.viewportWidth = style.width;
    if (this.characters !== layout.characters) {
      this.paintKey = '';
      this.characters = layout.characters;
      this.positions = [];
      for (const box of layout.characters) {
        const position = { index: box.index, x: box.x, y: box.y, height: box.height };

        this.positions.push(position);
        if (box.length) { this.positions.push({ ...position, index: box.index + box.length, x: box.x + box.width }); }
      }
      if (!this.positions.length) {
        this.positions.push({ index: 0, x: 0, y: 0, height: this.component.textLayout.lineHeight });
      }
    }
    Object.assign(this.overlay.style, { left: '0', top: '0',
      width: `${style.width}px`, height: `${style.height}px`, transform: richTextViewportTransform(style) });

    return this.positions;
  }

  paint (pointerSelecting = false): void {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const active = pointerSelecting || start !== end || window.document.activeElement === this.textarea;
    const key = JSON.stringify([start, end, active, this.caretWidth, this.upstreamCaretIndex]);

    this.overlay.style.display = active ? 'block' : 'none';
    if (key === this.paintKey) { return; }
    this.paintKey = key;
    this.overlay.replaceChildren();
    if (!active) { return; }
    if (start === end) {
      const caret = this.caretAt(start);

      if (caret) {
        // 边界上的插入点向内留出光标宽度，画布外的隐藏内容仍按原位置裁切。
        const x = caret.x >= 0 && caret.x <= this.viewportWidth
          ? Math.max(0, Math.min(caret.x, this.viewportWidth - this.caretWidth)) : caret.x;

        this.rectangle(x, caret.y, this.caretWidth, caret.height, '#111827');
      }
    } else {
      let rectangle: { x: number, y: number, width: number, height: number } | undefined;
      const flush = () => {
        if (rectangle) { this.rectangle(rectangle.x, rectangle.y, rectangle.width, rectangle.height, 'rgba(59, 130, 246, 0.35)'); }
      };

      for (const box of this.characters) {
        if (box.index >= end || box.index + box.length < start || (box.length && box.index + box.length === start)) { continue; }
        const width = Math.max(box.width, box.length ? 1 : 3);

        if (rectangle && Math.abs(rectangle.y - box.y) < 0.1 && Math.abs(rectangle.height - box.height) < 0.1
          && Math.abs(rectangle.x + rectangle.width - box.x) < 0.5) {
          rectangle.width = box.x + width - rectangle.x;
        } else {
          flush();
          rectangle = { x: box.x, y: box.y, width, height: box.height };
        }
      }
      flush();
    }
  }

  hide (): void {
    this.overlay.style.display = 'none';
    this.paintKey = '';
  }

  dispose (): void {
    this.component.releaseEditingLayout();
    this.textarea.removeEventListener('beforeinput', this.handleBeforeInput);
    this.textarea.removeEventListener('compositionstart', this.handleCompositionStart);
    this.textarea.removeEventListener('compositionend', this.handleCompositionEnd);
    this.overlay.remove();
  }

  private readonly handleBeforeInput = (event: InputEvent): void => {
    const { inputType } = event;

    if (inputType === 'historyUndo' || inputType === 'historyRedo') {
      event.preventDefault();
      this.restore(inputType === 'historyRedo');
    } else {
      this.beforeInput = {
        source: this.document.markup,
        ...getRichTextInputSelection(this.textarea, inputType),
      };
    }
  };

  private readonly handleCompositionStart = (): void => {
    this.pendingCommit = undefined;
    this.composition = { before: this.snapshot(), text: this.text };
  };
  private readonly handleCompositionEnd = (event: CompositionEvent): void => {
    if (!this.composition) { return; }
    const { before, text: original } = this.composition;

    if (before.source !== this.document.markup) { this.remember(before); }
    // 有些浏览器在 compositionend 之后才把最终文字写入 textarea。
    const text = original.slice(0, before.start) + event.data + original.slice(before.end);

    this.pendingCommit = text !== this.text ? { before, text } : undefined;
    this.composition = undefined;
  };

  private snapshot (): Snapshot {
    return { source: this.document.markup, start: this.textarea.selectionStart, end: this.textarea.selectionEnd };
  }

  private remember (snapshot: Snapshot): void {
    if (this.undoStack[this.undoStack.length - 1]?.source !== snapshot.source) { this.undoStack.push(snapshot); }
    if (this.undoStack.length > 100) { this.undoStack.shift(); }
    this.redoStack.length = 0;
  }

  private restore (redo: boolean): void {
    this.pendingCommit = undefined;
    const source = redo ? this.redoStack : this.undoStack;
    const target = redo ? this.undoStack : this.redoStack;
    const snapshot = source.pop();

    if (!snapshot) { return; }
    target.push(this.snapshot());
    this.document = new RichTextDocument(snapshot.source);
    this.textarea.value = this.text;
    this.textarea.setSelectionRange(snapshot.start, snapshot.end);
    this.beforeInput = undefined;
    this.publish();
  }

  private publish (): void {
    this.component.setText(this.document.markup);
    this.upstreamCaretIndex = undefined;
    this.paintKey = '';
    this.onChange();
  }

  /** 软换行两侧共享文本偏移。保留用户选中的上一行末端。 */
  preferCaret (caret: RichTextCaretPosition | undefined): void {
    this.upstreamCaretIndex = caret && this.positions.find(position => position.index === caret.index) === caret
      ? caret.index : undefined;
  }

  private caretAt (index: number): RichTextCaretPosition | undefined {
    if (index === this.upstreamCaretIndex) {
      const upstream = this.positions.find(position => position.index === index);

      if (upstream) { return upstream; }
    }
    for (let i = this.positions.length - 1; i >= 0; i--) {
      if (this.positions[i].index === index) { return this.positions[i]; }
    }

    return this.positions[this.positions.length - 1];
  }

  private navigate (event: KeyboardEvent): void {
    const { selectionStart: start, selectionEnd: end, selectionDirection } = this.textarea;
    const focus = selectionDirection === 'backward' ? start : end;
    const anchor = selectionDirection === 'backward' ? end : start;
    const caret = this.caretAt(focus);

    if (!caret) { return; }
    let candidates = this.positions.filter(position => Math.abs(position.y - caret.y) < 1);

    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      const direction = event.code === 'ArrowUp' ? -1 : 1;
      const rows = this.positions.filter(position => (position.y - caret.y) * direction > 1);
      const distance = Math.min(...rows.map(position => Math.abs(position.y - caret.y)));

      candidates = rows.filter(position => Math.abs(Math.abs(position.y - caret.y) - distance) < 1);
      candidates.sort((a, b) => Math.abs(a.x - caret.x) - Math.abs(b.x - caret.x));
    } else {
      candidates.sort((a, b) => event.code === 'Home' ? a.x - b.x : b.x - a.x);
    }
    this.preferCaret(candidates[0]);
    const next = candidates[0]?.index ?? (event.code === 'ArrowUp' ? 0 : this.text.length);
    const selectionAnchor = event.shiftKey ? anchor : next;

    event.preventDefault();
    this.textarea.setSelectionRange(Math.min(selectionAnchor, next), Math.max(selectionAnchor, next), next < selectionAnchor ? 'backward' : 'forward');
  }

  private rectangle (left: number, top: number, width: number, height: number, color: string): void {
    const rectangle = window.document.createElement('span');

    Object.assign(rectangle.style, { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${width}px`,
      height: `${Math.max(1, height)}px`, backgroundColor: color });
    this.overlay.appendChild(rectangle);
  }
}
