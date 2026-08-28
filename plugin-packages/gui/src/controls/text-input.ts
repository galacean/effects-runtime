import {
  EventEmitter,
  MouseButton,
  MouseButtonMask,
} from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,

  math } from '@galacean/effects';
import { Control } from '../core/control';
import type { ControlEvent } from '../core/control';
import { CursorShape, FocusMode, MouseFilter } from '../core/enums';

type EditSnapshot = {
  text: string,
  selectionStart: number,
  selectionEnd: number,
};

export type TextInputEvent = ControlEvent & {
  textChanged: [text: string],
  textSubmitted: [text: string],
};

export abstract class TextInput extends Control {
  static override readonly themeType: string = 'TextInput';
  protected abstract readonly multiline: boolean;
  private readonly textEventEmitter = new EventEmitter<TextInputEvent>();
  private _text = '';
  private _placeholderText = '';
  private _editable = true;
  private _maxLength = 0;
  private selectionStart = 0;
  private selectionEnd = 0;
  private selectionAnchor = 0;
  private selecting = false;
  private selectingWords = false;
  private wordSelectionStart = 0;
  private wordSelectionEnd = 0;
  private textarea: HTMLTextAreaElement | null = null;
  private textareaFocusTimer: ReturnType<typeof setTimeout> | null = null;
  private composing = false;
  private readonly undoStack: EditSnapshot[] = [];
  private readonly redoStack: EditSnapshot[] = [];

  constructor (engine: Engine) {
    super(engine);
    this.focusMode = FocusMode.All;
    this.mouseFilter = MouseFilter.Stop;
    this.defaultCursorShape = CursorShape.Ibeam;
  }

  get text (): string { return this._text; }
  set text (value: string) { this.setText(value, false); }

  get placeholderText (): string { return this._placeholderText; }
  set placeholderText (value: string) {
    if (this._placeholderText !== value) {
      this._placeholderText = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
  }

  get editable (): boolean { return this._editable; }
  set editable (value: boolean) {
    if (this._editable !== value) {
      this._editable = value;
      if (this.textarea) {this.textarea.readOnly = !value;}
      this.updateMinimumSize();
    }
  }

  get maxLength (): number { return this._maxLength; }
  set maxLength (value: number) {
    this._maxLength = Math.max(0, Math.floor(value));
    if (this._maxLength > 0 && this._text.length > this._maxLength) {
      this.setText(this._text.slice(0, this._maxLength), false);
    }
    if (this.textarea) {
      if (this._maxLength > 0) {this.textarea.maxLength = this._maxLength;} else {this.textarea.removeAttribute('maxlength');}
    }
  }

  get caretColumn (): number { return this.selectionEnd; }
  set caretColumn (value: number) { this.setSelection(value, value); }

  get hasSelection (): boolean { return this.selectionStart !== this.selectionEnd; }

  override on<E extends keyof TextInputEvent> (
    eventName: E,
    listener: EventEmitterListener<TextInputEvent[E]>,
  ): void {
    if (eventName === 'textChanged' || eventName === 'textSubmitted') {
      this.textEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof TextInputEvent> (
    eventName: E,
    listener: EventEmitterListener<TextInputEvent[E]>,
  ): void {
    if (eventName === 'textChanged' || eventName === 'textSubmitted') {
      this.textEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  selectAll (): void { this.setSelection(0, this._text.length); }
  deselect (): void { this.setSelection(this.selectionEnd, this.selectionEnd); }
  getSelectedText (): string {
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    return this._text.slice(start, end);
  }

  setSelection (start: number, end = start): void {
    this.selectionStart = Math.max(0, Math.min(this._text.length, Math.floor(start)));
    this.selectionEnd = Math.max(0, Math.min(this._text.length, Math.floor(end)));
    this.selectionAnchor = this.selectionStart;
    this.syncTextareaSelection();
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {return;}
    this.grabFocus();
    this.cancelTextareaFocus();
    const index = this.getCharacterIndex(event.position);

    if (event.doubleClick) {
      const [start, end] = this.getWordRange(index);

      this.wordSelectionStart = start;
      this.wordSelectionEnd = end;
      this.setSelection(start, end);
      this.selectingWords = true;
      this.selecting = true;
    } else if (event.shiftPressed) {
      this.moveCaret(index, true);
      this.selectingWords = false;
      this.selecting = true;
    } else {
      this.selectionAnchor = index;
      this.setSelection(index, index);
      this.selectingWords = false;
      this.selecting = true;
    }
    event.accept();
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.selecting || (event.buttonMask & MouseButtonMask.Left) === 0) {return;}
    const index = this.getCharacterIndex(event.position);

    if (this.selectingWords) {
      const [start, end] = this.getWordRange(index);

      if (index < this.wordSelectionStart) {
        this.setSelection(this.wordSelectionEnd, start);
      } else {
        this.setSelection(this.wordSelectionStart, end);
      }
    } else {
      this.setSelection(this.selectionAnchor, index);
    }
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.selecting) {
      this.selecting = false;
      this.selectingWords = false;
      this.focusTextarea();
      event.accept();
    }
  }

  override onKeyDown (event: InputEventKey): void {
    const command = event.ctrlPressed || event.metaPressed;

    if (command && event.keycode.toLowerCase() === 'a') {
      this.selectAll();
      event.accept();

      return;
    }
    if (command && event.keycode.toLowerCase() === 'c') {
      this.copySelection();
      event.accept();

      return;
    }
    if (command && event.keycode.toLowerCase() === 'x' && this.editable) {
      this.copySelection();
      this.replaceSelection('');
      event.accept();

      return;
    }
    if (command && event.keycode.toLowerCase() === 'v' && this.editable) {
      this.pasteClipboard();
      event.accept();

      return;
    }
    if (command && event.keycode.toLowerCase() === 'z' && this.editable) {
      if (event.shiftPressed) {this.redo();} else {this.undo();}
      event.accept();

      return;
    }
    if (command && event.keycode.toLowerCase() === 'y' && this.editable) {
      this.redo();
      event.accept();

      return;
    }
    if (event.keycode === 'ArrowLeft' || event.keycode === 'ArrowRight') {
      const direction = event.keycode === 'ArrowLeft' ? -1 : 1;
      const next = direction < 0
        ? getPreviousCharacterIndex(this._text, this.selectionEnd)
        : getNextCharacterIndex(this._text, this.selectionEnd);

      this.moveCaret(next, event.shiftPressed);
      event.accept();

      return;
    }
    if (event.keycode === 'Home' || event.keycode === 'End') {
      const next = event.keycode === 'Home' ? this.getLineStart(this.selectionEnd) : this.getLineEnd(this.selectionEnd);

      this.moveCaret(next, event.shiftPressed);
      event.accept();

      return;
    }
    if (!this.editable) {return;}
    if (event.keycode === 'Backspace') {
      this.erase(-1);
      event.accept();

      return;
    }
    if (event.keycode === 'Delete') {
      this.erase(1);
      event.accept();

      return;
    }
    if (event.keycode === 'Enter') {
      if (this.multiline) {this.replaceSelection('\n');} else {this.submit();}
      event.accept();

      return;
    }
    if (!command && !event.altPressed && event.unicode >= 32) {
      this.replaceSelection(String.fromCodePoint(event.unicode));
      event.accept();
    }
  }

  override onGotFocus (): void {
    this.activateTextarea();
  }

  override onLostFocus (): void {
    this.selecting = false;
    this.selectingWords = false;
    this.removeTextarea();
  }

  override onDestroy (): void {
    this.removeTextarea();
  }

  protected getDisplayText (): string {
    return this._text;
  }

  protected getSelectionRange (): [number, number] {
    return [Math.min(this.selectionStart, this.selectionEnd), Math.max(this.selectionStart, this.selectionEnd)];
  }

  protected moveCaret (index: number, extendSelection: boolean): void {
    const next = Math.max(0, Math.min(this._text.length, Math.floor(index)));

    if (extendSelection) {
      this.selectionStart = this.selectionAnchor;
      this.selectionEnd = next;
      this.syncTextareaSelection();
    } else {
      this.setSelection(next, next);
    }
  }

  protected getTextFont () {
    return this.getThemeFont('font');
  }

  protected getTextFontSize (): number {
    return this.getThemeFontSize('fontSize');
  }

  protected getTextColor (): math.Color {
    if (!this.editable) {return this.getThemeColor('fontReadOnlyColor');}
    if (this._text.length === 0) {return this.getThemeColor('fontPlaceholderColor');}

    return this.getThemeColor('fontColor');
  }

  protected getTextStyleBox () {
    return this.getThemeStyleBox(this.editable ? 'normal' : 'readOnly');
  }

  protected drawTextBackground (): void {
    this.drawStyleBox(this.getTextStyleBox(), 0, 0, this.width, this.height);
    if (this.hasFocus(true)) {
      this.drawStyleBox(this.getThemeStyleBox('focus'), 0, 0, this.width, this.height);
    }
  }

  protected drawSelection (x: number, y: number, width: number, height: number): void {
    if (width > 0) {this.fillRect(x, y, width, height, this.getThemeColor('selectionColor'));}
  }

  protected drawCaret (x: number, y: number, height: number): void {
    if (this.hasFocus(true) && !this.hasSelection) {
      this.fillRect(x, y, Math.max(1, this.getThemeConstant('caretWidth')), height, this.getThemeColor('caretColor'));
    }
  }

  protected abstract getCharacterIndex (position: math.Vector2): number;
  protected onTextValueChanged (): void {}

  private setText (value: string, signal: boolean): void {
    const limited = this._maxLength > 0 ? value.slice(0, this._maxLength) : value;

    if (this._text === limited) {return;}
    this._text = limited;
    this.selectionStart = Math.min(this.selectionStart, limited.length);
    this.selectionEnd = Math.min(this.selectionEnd, limited.length);
    this.onTextValueChanged();
    if (this.textarea && this.textarea.value !== limited) {this.textarea.value = limited;}
    this.updateMinimumSize();
    this.updateDesiredSize();
    if (signal) {this.textEventEmitter.emit('textChanged', limited);}
  }

  private replaceSelection (value: string): void {
    if (!this.editable) {return;}
    const [start, end] = this.getSelectionRange();

    this.pushUndo();
    const allowed = this._maxLength > 0
      ? value.slice(0, Math.max(0, this._maxLength - (this._text.length - (end - start))))
      : value;
    const next = `${this._text.slice(0, start)}${allowed}${this._text.slice(end)}`;
    const caret = start + allowed.length;

    this.setText(next, true);
    this.setSelection(caret, caret);
    this.redoStack.length = 0;
  }

  private erase (direction: number): void {
    if (this.hasSelection) {
      this.replaceSelection('');

      return;
    }
    const caret = this.selectionEnd;
    const start = direction < 0 ? getPreviousCharacterIndex(this._text, caret) : caret;
    const end = direction < 0 ? caret : getNextCharacterIndex(this._text, caret);

    if (start === end) {return;}
    this.setSelection(start, end);
    this.replaceSelection('');
  }

  private getLineStart (index: number): number {
    return this.multiline ? this._text.lastIndexOf('\n', Math.max(0, index - 1)) + 1 : 0;
  }

  private getLineEnd (index: number): number {
    if (!this.multiline) {return this._text.length;}
    const end = this._text.indexOf('\n', index);

    return end === -1 ? this._text.length : end;
  }

  private submit (): void {
    this.textEventEmitter.emit('textSubmitted', this._text);
    this.releaseFocus();
  }

  private pushUndo (): void {
    const snapshot = this.snapshot();
    const previous = this.undoStack[this.undoStack.length - 1];

    if (!previous || previous.text !== snapshot.text || previous.selectionStart !== snapshot.selectionStart
      || previous.selectionEnd !== snapshot.selectionEnd) {
      this.undoStack.push(snapshot);
      if (this.undoStack.length > 100) {this.undoStack.shift();}
    }
  }

  private undo (): void {
    const snapshot = this.undoStack.pop();

    if (!snapshot) {return;}
    this.redoStack.push(this.snapshot());
    this.restore(snapshot);
  }

  private redo (): void {
    const snapshot = this.redoStack.pop();

    if (!snapshot) {return;}
    this.undoStack.push(this.snapshot());
    this.restore(snapshot);
  }

  private snapshot (): EditSnapshot {
    return { text: this._text, selectionStart: this.selectionStart, selectionEnd: this.selectionEnd };
  }

  private restore (snapshot: EditSnapshot): void {
    this.setText(snapshot.text, true);
    this.setSelection(snapshot.selectionStart, snapshot.selectionEnd);
  }

  private copySelection (): void {
    const value = this.getSelectedText();

    if (value && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
  }

  private pasteClipboard (): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.readText().then(value => this.replaceSelection(value));
    }
  }

  private getWordRange (index: number): [number, number] {
    if (this._text.length === 0) {return [0, 0];}
    const position = Math.max(0, Math.min(this._text.length - 1, index));

    for (const match of this._text.matchAll(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]+/gu)) {
      const start = match.index;
      const end = start + match[0].length;

      if (position >= start && position < end) {return [start, end];}
    }

    return [position, position + 1];
  }

  private activateTextarea (): void {
    if (typeof document === 'undefined' || this.textarea) {return;}
    const textarea = document.createElement('textarea');

    textarea.value = this._text;
    textarea.readOnly = !this.editable;
    if (this._maxLength > 0) {textarea.maxLength = this._maxLength;}
    textarea.wrap = this.multiline ? 'soft' : 'off';
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    textarea.addEventListener('beforeinput', this.onBeforeInput);
    textarea.addEventListener('input', this.onTextareaInput);
    textarea.addEventListener('select', this.onTextareaSelect);
    textarea.addEventListener('compositionstart', this.onCompositionStart);
    textarea.addEventListener('compositionend', this.onCompositionEnd);
    textarea.addEventListener('keydown', this.onTextareaKeyDown);
    textarea.addEventListener('blur', this.onTextareaBlur);
    document.body.appendChild(textarea);
    this.textarea = textarea;
    this.syncTextareaSelection();
    this.scheduleTextareaFocus();
  }

  private removeTextarea (): void {
    this.cancelTextareaFocus();
    const textarea = this.textarea;

    if (!textarea) {return;}
    this.textarea = null;
    textarea.removeEventListener('beforeinput', this.onBeforeInput);
    textarea.removeEventListener('input', this.onTextareaInput);
    textarea.removeEventListener('select', this.onTextareaSelect);
    textarea.removeEventListener('compositionstart', this.onCompositionStart);
    textarea.removeEventListener('compositionend', this.onCompositionEnd);
    textarea.removeEventListener('keydown', this.onTextareaKeyDown);
    textarea.removeEventListener('blur', this.onTextareaBlur);
    textarea.remove();
    this.composing = false;
  }

  private syncTextareaSelection (): void {
    if (!this.textarea) {return;}
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    this.textarea.setSelectionRange(start, end, this.selectionEnd < this.selectionStart ? 'backward' : 'forward');
  }

  private scheduleTextareaFocus (): void {
    this.cancelTextareaFocus();
    this.textareaFocusTimer = setTimeout(() => {
      this.textareaFocusTimer = null;
      this.focusTextarea();
    });
  }

  private cancelTextareaFocus (): void {
    if (this.textareaFocusTimer !== null) {
      clearTimeout(this.textareaFocusTimer);
      this.textareaFocusTimer = null;
    }
  }

  private focusTextarea (): void {
    if (this.textarea && this.hasFocus() && document.activeElement !== this.textarea) {
      this.textarea.focus({ preventScroll: true });
    }
  }

  private readonly onBeforeInput = (): void => {
    this.pushUndo();
  };

  private readonly onTextareaInput = (): void => {
    if (!this.textarea) {return;}
    this.setText(this.textarea.value, true);
    this.selectionStart = this.textarea.selectionStart;
    this.selectionEnd = this.textarea.selectionEnd;
    if (!this.composing) {this.redoStack.length = 0;}
  };

  private readonly onTextareaSelect = (): void => {
    if (!this.textarea) {return;}
    if (this.textarea.selectionDirection === 'backward') {
      this.selectionStart = this.textarea.selectionEnd;
      this.selectionEnd = this.textarea.selectionStart;
    } else {
      this.selectionStart = this.textarea.selectionStart;
      this.selectionEnd = this.textarea.selectionEnd;
    }
    this.selectionAnchor = this.selectionStart;
  };

  private readonly onCompositionStart = (): void => { this.composing = true; };
  private readonly onCompositionEnd = (): void => { this.composing = false; };

  private readonly onTextareaKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !this.multiline && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  };

  private readonly onTextareaBlur = (): void => {
    if (this.textarea && this.hasFocus()) {this.releaseFocus();}
  };
}

function getPreviousCharacterIndex (value: string, index: number): number {
  const previous = Math.max(0, index - 1);

  if (previous > 0 && isLowSurrogate(value.charCodeAt(previous)) && isHighSurrogate(value.charCodeAt(previous - 1))) {
    return previous - 1;
  }

  return previous;
}

function getNextCharacterIndex (value: string, index: number): number {
  if (index >= value.length) {return value.length;}

  return Math.min(
    value.length,
    index + (isHighSurrogate(value.charCodeAt(index)) && isLowSurrogate(value.charCodeAt(index + 1)) ? 2 : 1),
  );
}

function isHighSurrogate (value: number): boolean {
  return value >= 0xd800 && value <= 0xdbff;
}

function isLowSurrogate (value: number): boolean {
  return value >= 0xdc00 && value <= 0xdfff;
}
