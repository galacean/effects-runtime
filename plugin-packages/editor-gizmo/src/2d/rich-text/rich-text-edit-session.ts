import { EventEmitter, spec, type VFXItem } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import type { GizmoOwner } from '../gizmo-owner';
import { richTextViewportTransform, resolveRichTextCaretPosition, type RichTextCaretPosition, type RichTextViewport, type RichTextPoint } from './rich-text-geometry';
import { RichTextEditor, type RichTextFormat, type RichTextSelectionFormats } from './rich-text-editor';

/** 富文本编辑进入后选中全文或仅聚焦输入框。 */
export type RichTextEditActivation = 'select' | 'focus';
type RichTextSelectionOptions = { extend?: boolean, word?: boolean };

/** 富文本变更同时提供持久化源码与可见文字。 */
export type RichTextInputPayload = {
  itemId: string,
  markup: string,
  plainText: string,
};

type RichTextSessionEvents = { richTextInput: [RichTextInputPayload] };
type PointerSelection = RichTextSelectionOptions & {
  handle: object,
  anchor: RichTextPoint,
  focus: RichTextPoint,
  anchorIndex?: number,
  active: boolean,
};

/** 独立管理富文本输入、投影和选区，不依赖普通文本的 DOM 排版。 */
export class RichTextEditSession extends EventEmitter<RichTextSessionEvents> {
  readonly textAreaElement: HTMLTextAreaElement;
  private target: VFXItem | undefined;
  private editor: RichTextEditor | undefined;
  private activation: RichTextEditActivation = 'focus';
  private readonly projections = new Set<object>();
  private layout: (RichTextViewport & { caretPositions: RichTextCaretPosition[] }) | undefined;
  private pointerSelection: PointerSelection | undefined;
  private savedSelection: { start: number, end: number, direction: 'forward' | 'backward' | 'none' } | undefined;
  private disposed = false;

  constructor (owner: GizmoOwner) {
    super();
    this.textAreaElement = document.createElement('textarea');
    this.textAreaElement.className = 'rich-text-gizmo-input';
    this.textAreaElement.setAttribute('aria-label', '编辑富文本');
    Object.assign(this.textAreaElement.style, {
      position: 'absolute', display: 'none', opacity: '0', pointerEvents: 'none',
      margin: '0', padding: '0', border: 'none', resize: 'none', overflow: 'hidden',
      transformOrigin: '0 0', whiteSpace: 'pre-wrap',
    });
    owner.getEngine().canvas.parentElement?.appendChild(this.textAreaElement);
    this.textAreaElement.addEventListener('input', this.handleInput);
    this.textAreaElement.addEventListener('keydown', this.handleKeyDown);
  }

  get editingItem (): VFXItem | undefined { return this.target; }
  get isEditing (): boolean { return !!this.target; }
  get hasSelection (): boolean {
    return !!this.editor && this.textAreaElement.selectionStart !== this.textAreaElement.selectionEnd;
  }
  get selectionFormats (): RichTextSelectionFormats | undefined { return this.editor?.selectionFormats; }

  formatSelection (attribute: RichTextFormat, value?: string | null): boolean {
    return this.editor?.format(attribute, value) ?? false;
  }

  retarget (item: VFXItem, activation: RichTextEditActivation = 'focus'): boolean {
    const component = item.type === spec.ItemType.richtext ? item.getComponent(RichTextComponent) : undefined;

    if (this.disposed || !component || component.textLayout.useLegacyRichText) { return false; }
    if (this.target === item) { return true; }
    this.hide();
    this.editor?.dispose();
    this.target = item;
    this.activation = activation;
    this.savedSelection = undefined;
    this.layout = undefined;
    this.pointerSelection = undefined;
    this.textAreaElement.setSelectionRange(0, 0);
    this.editor = new RichTextEditor(component, this.textAreaElement, () => {
      const payload = { itemId: item.getInstanceId(), markup: component.text, plainText: this.editor!.text };

      this.emit('richTextInput', payload);
    });
    if (activation === 'select') { this.openInput(); }

    return true;
  }

  /** 在读取元素尺寸前完成富文本排版。 */
  prepareLayout (): void { this.editor?.component.getEditingLayout(); }

  attachProjection (token: object): void {
    if (!this.disposed) {
      this.projections.add(token);
      if (this.activation === 'select') {
        this.openInput();
      }
    }
  }

  detachProjection (token: object): void {
    if (!this.projections.delete(token) || this.projections.size) { return; }
    this.hide();
  }

  /** 只接收视图几何；字形位置和默认输入样式均来自富文本组件。 */
  syncViewport (viewport: RichTextViewport | undefined): void {
    const editor = this.editor;

    if (!editor || !viewport || !this.projections.size) {
      this.hide();

      return;
    }
    const textarea = this.textAreaElement;

    Object.assign(textarea.style, {
      left: '0', top: '0', width: `${viewport.width}px`, height: `${viewport.height}px`,
      transform: richTextViewportTransform(viewport), fontFamily: editor.component.textStyle.fontFamily,
      fontSize: `${editor.component.textStyle.fontSize}px`, lineHeight: `${editor.component.textLayout.lineHeight}px`,
    });
    this.openInput();
    this.layout = { ...viewport, caretPositions: editor.sync(viewport) };
    if (this.pointerSelection) {
      if (this.applyPointerSelection() && !this.pointerSelection.active) { this.pointerSelection = undefined; }
    }
    textarea.scrollTop = 0;
    editor.paint(!!this.pointerSelection?.active);
  }

  selectAllText (): boolean {
    if (!this.editor) { return false; }
    this.savedSelection = { start: 0, end: this.editor.text.length, direction: 'forward' };
    if (this.textAreaElement.style.display !== 'none') {
      this.textAreaElement.focus();
      this.textAreaElement.select();
      this.editor.paint();
    }

    return true;
  }

  beginPointerSelection (point: RichTextPoint, options: RichTextSelectionOptions = {}): object {
    const textarea = this.textAreaElement;
    const handle = {};
    const anchorIndex = options.extend
      ? textarea.selectionDirection === 'backward' ? textarea.selectionEnd : textarea.selectionStart
      : this.layout ? resolveRichTextCaretPosition(this.layout, point) : undefined;

    this.pointerSelection = { ...options, handle, anchor: { ...point }, focus: { ...point }, active: true,
      anchorIndex };
    this.applyPointerSelection();

    return handle;
  }

  updatePointerSelection (handle: object, point: RichTextPoint): void {
    if (!this.pointerSelection?.active || this.pointerSelection.handle !== handle) { return; }
    this.pointerSelection.focus = { ...point };
    this.applyPointerSelection();
  }

  finishPointerSelection (handle: object, point: RichTextPoint): void {
    if (!this.pointerSelection || this.pointerSelection.handle !== handle) { return; }
    this.pointerSelection.focus = { ...point };
    this.pointerSelection.active = false;
    if (this.applyPointerSelection()) { this.pointerSelection = undefined; }
  }

  cancelPointerSelection (handle?: object): void {
    if (!handle || this.pointerSelection?.handle === handle) { this.pointerSelection = undefined; }
  }

  dispose (): void {
    if (this.disposed) { return; }
    this.disposed = true;
    this.projections.clear();
    this.target = undefined;
    this.layout = undefined;
    this.pointerSelection = undefined;
    this.editor?.dispose();
    this.editor = undefined;
    this.textAreaElement.removeEventListener('input', this.handleInput);
    this.textAreaElement.removeEventListener('keydown', this.handleKeyDown);
    this.textAreaElement.remove();
  }

  private readonly handleInput = (): void => { this.editor?.input(); };
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && !event.isComposing) {
      event.preventDefault();

      return;
    }
    this.editor?.keyDown(event);
    event.stopPropagation();
  };

  /** 全选编辑立即接收首字符，投影位置由正常帧同步。 */
  private openInput (): void {
    if (!this.editor || !this.target?.isVisible || !this.projections.size || this.textAreaElement.style.display !== 'none') { return; }
    const textarea = this.textAreaElement;

    textarea.value = this.editor.text;
    textarea.style.display = 'block';
    textarea.focus({ preventScroll: true });
    if (this.activation === 'select') {
      textarea.select();
    } else if (this.savedSelection) {
      const { start, end, direction } = this.savedSelection;

      textarea.setSelectionRange(start, end, direction);
    }
    this.savedSelection = undefined;
    this.activation = 'focus';
  }

  private hide (): void {
    if (this.textAreaElement.style.display !== 'none') {
      const { selectionStart: start, selectionEnd: end, selectionDirection: direction } = this.textAreaElement;

      this.savedSelection = { start, end, direction };
    }
    this.textAreaElement.style.display = 'none';
    this.editor?.hide();
  }

  private applyPointerSelection (): boolean {
    const selection = this.pointerSelection;
    const layout = this.layout;

    if (!selection || !layout) { return false; }
    selection.anchorIndex ??= resolveRichTextCaretPosition(layout, selection.anchor);
    const focus = resolveRichTextCaretPosition(layout, selection.focus);

    if (selection.anchorIndex === undefined || focus === undefined) { return false; }
    let start = Math.min(selection.anchorIndex, focus);
    let end = Math.max(selection.anchorIndex, focus);

    if (selection.word) {
      const segments = new Intl.Segmenter(undefined, { granularity: 'word' }).segment(this.textAreaElement.value);

      for (const segment of segments) {
        const next = segment.index + segment.segment.length;

        if (segment.index <= start && next > start) { start = segment.index; }
        if (segment.index <= end && next > end) {
          end = next;

          break;
        }
      }
    }
    if (!selection.active) { this.textAreaElement.focus(); }
    this.textAreaElement.setSelectionRange(start, end, focus < selection.anchorIndex ? 'backward' : 'forward');
    this.textAreaElement.scrollTop = 0;
    this.editor?.paint(selection.active);

    return true;
  }
}
