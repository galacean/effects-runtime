import { SceneServer } from '@galacean/effects';
import { EventEmitter, spec, TextComponent, type VFXItem } from '@galacean/effects';
import type { Box2 } from '@galacean/effects-math/es/extension/index';
import type { GizmoOwner } from '../gizmo-owner';
import { type Matrix3, getTransformedBoxCorners } from '../math';
import { TextCaretMapper, type TextCaretLayout, type ViewPoint } from './text-caret-mapper';

/** 文本编辑进入后选中全文或仅聚焦输入框。 */
export type TextEditActivation = 'select' | 'focus';

/** 文本编辑投影结果。 */
export type TextResult = TextValidResult | TextEmptyResult;

/** 有效文本编辑投影。 */
export type TextValidResult = {
  /** 结果类型。 */
  type: 'valid',
  /** 文本视图包围盒。 */
  box: Box2,
  /** 文本局部 Box2 到视图的变换。 */
  transform: Matrix3,
};

/** 空文本编辑投影。 */
export type TextEmptyResult = {
  /** 结果类型。 */
  type: 'empty',
};

/** 文本 Gizmo 的交互状态。 */
export type TextInteractionParam = {
  /** 当前交互类型。 */
  type: 'none' | 'edit',
  /** 文本框激活方式。 */
  textareaType?: TextEditActivation,
};

/** 文本输入事件参数。 */
export type TextInputPayload = {
  /** 文本元素 ID。 */
  itemId: string,
  /** 输入后的文本。 */
  text: string,
  /** 当前字体。 */
  fontFamily: string,
};

/** 文本编辑会话事件参数。 */
type TextEditSessionEvents = {
  /** 文本输入事件。 */
  textInput: [TextInputPayload],
};

/** 指针拖拽选择文本的状态。 */
type PointerSelection = {
  /** 选择起点。 */
  anchor: ViewPoint,
  /** 选择终点。 */
  focus: ViewPoint,
  /** 起点对应的文本偏移。 */
  anchorIndex?: number,
  /** 是否仍在拖拽。 */
  active: boolean,
};

const TEXT_AREA_CLASS_NAME = 'text-gizmo-custom-style';
const POINTER_SELECTION_PREVIEW_CLASS_NAME = 'text-gizmo-pointer-selection-preview';
const TEXT_SELECTION_BACKGROUND_COLOR = 'rgba(59, 130, 246, 0.35)';

const textareaDefaultCssClass = `
  word-break: normal;
  position: absolute;
  z-index: 3;
  border: none;
  margin: 0;
  padding: 0;
  outline: none !important;
  overflow: hidden;
  resize: none;
  display: none;
  background: transparent;
  opacity: .8;
  cursor: text;
  -webkit-user-drag: none;
  color: transparent;
  caret-color: #000000;
  -webkit-text-fill-color: transparent;
  text-fill-color: transparent;
  /* canvas 按单字符 measureText+fillText 排版（无 kerning、无 ligature，含 ff/fi/fl 等 f 连字）；
     DOM 默认会施加 kerning 与 f 连字 → 字序列比 canvas 窄 → 长行累积往左偏（尤其 f）。关闭二者以横向同源。 */
  font-variant-ligatures: none;
  font-kerning: none;
`;

const pointerSelectionPreviewCssClass = `
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  border: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  display: none;
  pointer-events: none;
  opacity: .8;
  color: transparent;
  -webkit-text-fill-color: transparent;
  font-variant-ligatures: none;
  font-kerning: none;
`;

/**
 * 为元素添加一次性 CSS 类和样式规则。
 * @param element 目标元素
 * @param className CSS 类名
 * @param cssText CSS 规则内容
 * @returns 移除类名和样式规则的函数
 */
function applyCSSClass (element: HTMLElement, className: string, cssText: string): () => void {
  const style = document.createElement('style');

  style.textContent = `
    .${className} {
      ${cssText.replace(/&/g, `.${className}`)}
    }
  `;
  document.head.appendChild(style);
  element.classList.add(className);

  return () => {
    element.classList.remove(className);
    style.remove();
  };
}

/**
 * 添加独立样式规则。
 * @param cssText 完整 CSS 规则
 * @returns 移除样式规则的函数
 */
function applyCSSRule (cssText: string): () => void {
  const style = document.createElement('style');

  style.textContent = cssText;
  document.head.appendChild(style);

  return () => {
    style.remove();
  };
}

/** 管理行内文本编辑的 textarea、选区和画布投影。 */
export class TextEditSession extends EventEmitter<TextEditSessionEvents> {
  /** 文本编辑使用的 DOM 输入框。 */
  readonly textAreaElement: HTMLTextAreaElement;

  /** 当前文本交互状态。 */
  interactionParam: TextInteractionParam = { type: 'none' };

  private readonly owner: GizmoOwner;
  private _editingItem: VFXItem | undefined;
  private readonly attachedProjections = new Set<object>();
  private disposed = false;
  private selectionStart: number | null = null;
  private selectionEnd: number | null = null;
  private pointerSelection: PointerSelection | undefined;
  private readonly caretMapper = new TextCaretMapper();
  /** 画布接管拖选期间使用的无焦点选区预览。 */
  private readonly pointerSelectionPreviewElement: HTMLDivElement;
  private readonly removeTextAreaStyle: () => void;
  private readonly removeTextSelectionStyle: () => void;
  private readonly removePointerSelectionPreviewStyle: () => void;

  /**
   * 将 DOM 输入同步到文本组件并发出输入事件。
   * @param event DOM 输入事件。
   */
  private readonly handleInput = (event: Event): void => {
    const editingItem = this._editingItem;
    const textComponent = editingItem?.getComponent(TextComponent);
    const composition = this.owner.getEngine()?.getServer(SceneServer).compositions[0];

    if (!editingItem || !textComponent || !composition) {
      return;
    }

    const text = (event.target as HTMLTextAreaElement).value;
    const fontFamily = textComponent.textStyle?.fontFamily ?? '';

    textComponent.setText(text);
    const lineCount = textComponent.getLineCount(text);
    const textHeight = Math.ceil(textComponent.textLayout.lineHeight * lineCount);

    textComponent.setTextHeight(textHeight);
    composition.gotoAndStop(composition.time);

    this.emit('textInput', {
      itemId: editingItem.getInstanceId(),
      text,
      fontFamily,
    });
  };

  /**
   * 隔离输入框键盘事件。
   * @param event DOM 键盘事件。
   */
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code.toLocaleLowerCase() === 'escape') {
      event.preventDefault();

      return;
    }
    event.stopPropagation();
  };

  /**
   * 在新的指针选择开始前折叠原 DOM 选区。
   * @param event DOM 鼠标事件。
   */
  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (
      event.button === 0
      && this.textAreaElement.selectionStart !== this.textAreaElement.selectionEnd
    ) {
      this.textAreaElement.setSelectionRange(
        this.textAreaElement.selectionStart,
        this.textAreaElement.selectionStart,
      );
    }
  };

  /**
   * 阻止浏览器原生文本拖放。
   * @param event DOM 拖拽事件。
   */
  private readonly handleDragStart = (event: DragEvent): void => {
    event.preventDefault();
  };

  /**
   * @param owner Gizmo 宿主
   */
  constructor (owner: GizmoOwner) {
    super();
    this.owner = owner;
    this.textAreaElement = document.createElement('textarea');
    this.pointerSelectionPreviewElement = document.createElement('div');
    owner.getEngine()?.canvas.parentElement?.appendChild(this.textAreaElement);
    owner.getEngine()?.canvas.parentElement?.appendChild(this.pointerSelectionPreviewElement);
    this.removeTextAreaStyle = applyCSSClass(
      this.textAreaElement,
      TEXT_AREA_CLASS_NAME,
      textareaDefaultCssClass,
    );
    this.removeTextSelectionStyle = applyCSSRule(`
      .${TEXT_AREA_CLASS_NAME}::selection {
        background-color: ${TEXT_SELECTION_BACKGROUND_COLOR};
        color: transparent;
        -webkit-text-fill-color: transparent;
      }
    `);
    this.removePointerSelectionPreviewStyle = applyCSSClass(
      this.pointerSelectionPreviewElement,
      POINTER_SELECTION_PREVIEW_CLASS_NAME,
      pointerSelectionPreviewCssClass,
    );
    this.textAreaElement.addEventListener('keydown', this.handleKeyDown);
    this.textAreaElement.addEventListener('mousedown', this.handleMouseDown);
    this.textAreaElement.addEventListener('dragstart', this.handleDragStart);
  }

  /** 当前正在编辑的文本元素。 */
  get editingItem (): VFXItem | undefined {
    return this._editingItem;
  }

  /** 是否存在正在编辑的文本元素。 */
  get isEditing (): boolean {
    return this._editingItem !== undefined;
  }

  /**
   * 选中当前编辑文本的全部内容，并将焦点交给输入框。
   *
   * 输入框尚未完成首次画布投影时会先保存全文选区，待投影打开后恢复。
   * @returns 当前存在可编辑文本时返回 true
   */
  selectAllText (): boolean {
    if (this.disposed) {
      return false;
    }
    const textComponent = this._editingItem?.getComponent(TextComponent);

    if (!textComponent) {
      return false;
    }

    const textLength = this.textAreaElement.style.display === 'block'
      ? this.textAreaElement.value.length
      : (textComponent.text ?? '').length;

    this.selectionStart = 0;
    this.selectionEnd = textLength;

    if (this.textAreaElement.style.display === 'block') {
      this.textAreaElement.focus();
      this.textAreaElement.select();
      this.textAreaElement.scrollTop = 0;
    }

    return true;
  }

  /**
   * 使用当前单选文本元素开始编辑。
   * @param textareaType 文本框激活方式
   * @returns 是否成功开始编辑
   */
  beginFromCurrentSelection (textareaType: TextEditActivation): boolean {
    if (this.disposed) {
      return false;
    }
    const selectedItems = this.owner.getSelection().getSelectedPlayerItems();
    const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined;

    if (selectedItem?.type !== spec.ItemType.text || !selectedItem.getComponent(TextComponent)) {
      return false;
    }

    this._editingItem = selectedItem;
    this.interactionParam = { type: 'edit', textareaType };

    return true;
  }

  /**
   * 将当前会话切换到另一个文本元素。
   * @param item 新的文本元素
   * @param textareaType 文本框激活方式
   * @returns 是否切换成功
   */
  retarget (item: VFXItem, textareaType: TextEditActivation = 'focus'): boolean {
    if (
      this.disposed
      || item.type !== spec.ItemType.text
      || !item.getComponent(TextComponent)
    ) {
      return false;
    }
    if (item === this._editingItem) {
      return true;
    }

    this.hideTextArea();
    this.selectionStart = null;
    this.selectionEnd = null;
    this.cancelPointerSelection();
    this.caretMapper.reset();
    this.textAreaElement.setSelectionRange(0, 0);
    this._editingItem = item;
    this.interactionParam = { type: 'edit', textareaType };

    return true;
  }

  /**
   * 开始使用画布指针拖拽选择文本。
   * @param point 选择起点
   */
  beginPointerSelection (point: ViewPoint): void {
    this.textAreaElement.style.pointerEvents = 'none';
    this.pointerSelection = {
      anchor: { ...point },
      focus: { ...point },
      active: true,
    };
    this.applyPointerSelection();
  }

  /**
   * 更新指针拖拽选择终点。
   * @param point 当前指针位置
   */
  updatePointerSelection (point: ViewPoint): void {
    if (!this.pointerSelection?.active) {
      return;
    }
    this.pointerSelection.focus = { ...point };
    this.applyPointerSelection();
  }

  /**
   * 完成指针拖拽选择。
   * @param point 最终指针位置
   */
  finishPointerSelection (point: ViewPoint): void {
    if (!this.pointerSelection) {
      return;
    }
    this.pointerSelection.focus = { ...point };
    this.pointerSelection.active = false;
    this.textAreaElement.style.pointerEvents = '';
    if (this.applyPointerSelection()) {
      this.pointerSelection = undefined;
    }
  }

  /** 取消指针拖拽选择。 */
  cancelPointerSelection (): void {
    this.textAreaElement.style.pointerEvents = '';
    this.pointerSelection = undefined;
    this.hidePointerSelectionPreview();
  }

  /**
   * 挂接一个画布文本投影。
   * @param projection 投影实例
   */
  attachProjection (projection: object): void {
    if (this.disposed) {
      return;
    }
    this.attachedProjections.add(projection);
  }

  /**
   * 脱离一个画布文本投影。
   * @param projection 投影实例
   */
  detachProjection (projection: object): void {
    if (!this.attachedProjections.delete(projection)) {
      return;
    }
    if (this.attachedProjections.size > 0) {
      return;
    }
    this.saveSelectionRange();
    this.hideTextArea();
  }

  /** 结束编辑并释放 DOM 资源和事件监听器。 */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.attachedProjections.clear();
    this._editingItem = undefined;
    this.interactionParam = { type: 'none' };
    this.cancelPointerSelection();
    this.caretMapper.reset();
    this.hideTextArea();
    this.textAreaElement.removeEventListener('keydown', this.handleKeyDown);
    this.textAreaElement.removeEventListener('mousedown', this.handleMouseDown);
    this.textAreaElement.removeEventListener('dragstart', this.handleDragStart);
    this.textAreaElement.remove();
    this.pointerSelectionPreviewElement.remove();
    this.removeTextAreaStyle();
    this.removeTextSelectionStyle();
    this.removePointerSelectionPreviewStyle();
  }

  /**
   * 将 textarea 的位置和排版同步到画布文本投影。
   * @param result 当前文本投影结果
   * @param viewScale 视口缩放
   */
  syncTextArea (result: TextResult, viewScale: number): void {
    // 1. 校验投影和文本组件，并读取画布文本布局。
    const editingItem = this._editingItem;

    if (this.attachedProjections.size === 0 || !editingItem || result.type === 'empty') {
      return;
    }

    const textComponent = editingItem.getComponent(TextComponent);

    if (!textComponent) {
      this.hideTextArea();

      return;
    }

    const isOpening = this.textAreaElement.style.display !== 'block';
    const {
      textLayout: { lineHeight, letterSpace, textAlign, height: textHeight, keepWordIntact },
      textStyle: { fontSize, textWeight: fontWeight, fontFamily },
      text,
    } = textComponent;
    const [leftTop, rightTop, , leftBottom] = getTransformedBoxCorners(result.transform);
    const width = leftTop.distance(rightTop);
    const height = leftTop.distance(leftBottom);
    const viewRotation = Math.atan2(rightTop.y - leftTop.y, rightTop.x - leftTop.x);
    // 2. 使用投影高度与逻辑文本高度的比例统一 DOM 和画布字号。
    const fontScale = textHeight > 0 ? height / textHeight : viewScale;

    // 3. 首次打开时同步内容和不随帧变化的排版属性。
    if (isOpening) {
      this.textAreaElement.value = text ?? '';
      this.textAreaElement.setSelectionRange(0, 0);
      this.textAreaElement.style.display = 'block';
      this.textAreaElement.style.wordBreak = keepWordIntact ? 'normal' : 'break-all';
      this.textAreaElement.style.whiteSpace = 'pre-wrap';
      this.textAreaElement.style.overflowWrap = 'break-word';
      this.textAreaElement.style.fontWeight = fontWeight;
      this.textAreaElement.style.letterSpacing = `${letterSpace * fontScale}px`;
      this.textAreaElement.style.transformOrigin = '0 0';
      this.textAreaElement.style.paintOrder = 'stroke fill';
      this.textAreaElement.addEventListener('input', this.handleInput);
    }

    // 4. 同步位置、尺寸、旋转和插入点映射。
    this.textAreaElement.style.left = `${leftTop.x}px`;
    this.textAreaElement.style.top = `${leftTop.y}px`;
    this.textAreaElement.style.width = `${width}px`;
    this.textAreaElement.style.height = `${height}px`;
    this.textAreaElement.style.fontFamily = fontFamily;
    this.textAreaElement.style.textAlign = this.getTextAlign(textAlign);
    this.textAreaElement.style.fontSize = `${fontSize * fontScale}px`;
    this.textAreaElement.style.lineHeight = `${lineHeight * fontScale}px`;
    this.textAreaElement.style.transform = `rotateZ(${viewRotation}rad)`;
    Object.assign(this.pointerSelectionPreviewElement.style, {
      left: `${leftTop.x}px`,
      top: `${leftTop.y}px`,
      width: `${width}px`,
      height: `${height}px`,
      fontFamily,
      textAlign: this.getTextAlign(textAlign),
      fontSize: `${fontSize * fontScale}px`,
      fontWeight,
      letterSpacing: `${letterSpace * fontScale}px`,
      lineHeight: `${lineHeight * fontScale}px`,
      transform: `rotateZ(${viewRotation}rad)`,
      transformOrigin: '0 0',
      wordBreak: keepWordIntact ? 'normal' : 'break-all',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
    });
    this.syncPointerLayout({
      left: leftTop.x,
      top: leftTop.y,
      width,
      height,
      rotation: viewRotation,
      text: text ?? '',
      fontFamily,
      fontSize: fontSize * fontScale,
      fontWeight,
      letterSpacing: letterSpace * fontScale,
      lineHeight: lineHeight * fontScale,
      textAlign: this.getTextAlign(textAlign),
      keepWordIntact,
    });
    this.textAreaElement.scrollTop = 0;

    // 5. 首次打开后按激活方式恢复或全选 DOM 选区。
    // 指针拖选期间保持画布持有输入，抬起后再由 applyPointerSelection 聚焦输入框。
    if (isOpening && !this.pointerSelection?.active) {
      if (this.interactionParam.textareaType === 'select') {
        this.textAreaElement.focus();
        this.textAreaElement.select();
      } else {
        this.textAreaElement.focus();
        if (this.selectionStart !== null && this.selectionEnd !== null) {
          this.textAreaElement.setSelectionRange(this.selectionStart, this.selectionEnd);
        }
      }
      this.textAreaElement.scrollTop = 0;
    }
  }

  /** 保存当前 DOM 文本选区。 */
  private saveSelectionRange (): void {
    this.selectionStart = this.textAreaElement.selectionStart;
    this.selectionEnd = this.textAreaElement.selectionEnd;
  }

  /** 隐藏输入框并停止监听输入。 */
  private hideTextArea (): void {
    this.textAreaElement.removeEventListener('input', this.handleInput);
    this.textAreaElement.style.display = 'none';
    this.hidePointerSelectionPreview();
  }

  /**
   * 同步插入点布局并应用待处理的指针选区。
   * @param style 文本插入点布局
   */
  private syncPointerLayout (style: TextCaretLayout): void {
    if (!this.pointerSelection) {
      return;
    }

    this.caretMapper.sync(style);
    if (this.applyPointerSelection() && !this.pointerSelection.active) {
      this.pointerSelection = undefined;
    }
  }

  /** @returns 是否成功将指针选区应用到 DOM 输入框。 */
  private applyPointerSelection (): boolean {
    const selection = this.pointerSelection;

    if (!selection) {
      return false;
    }

    selection.anchorIndex ??= this.caretMapper.resolve(selection.anchor);
    const focusIndex = this.caretMapper.resolve(selection.focus);

    if (selection.anchorIndex === undefined || focusIndex === undefined) {
      return false;
    }
    const start = Math.min(selection.anchorIndex, focusIndex);
    const end = Math.max(selection.anchorIndex, focusIndex);

    if (!selection.active) {
      this.textAreaElement.focus();
    }
    this.textAreaElement.setSelectionRange(
      start,
      end,
      focusIndex < selection.anchorIndex ? 'backward' : 'forward',
    );
    this.textAreaElement.scrollTop = 0;
    if (selection.active) {
      this.renderPointerSelectionPreview(start, end);
    } else {
      this.hidePointerSelectionPreview();
    }

    return true;
  }

  /** 绘制画布指针拖选对应的文字高亮。 */
  private renderPointerSelectionPreview (start: number, end: number): void {
    if (start === end) {
      this.hidePointerSelectionPreview();

      return;
    }

    const text = this.textAreaElement.value;
    const highlight = document.createElement('span');

    highlight.style.backgroundColor = TEXT_SELECTION_BACKGROUND_COLOR;
    highlight.textContent = text.slice(start, end);
    this.pointerSelectionPreviewElement.replaceChildren(
      document.createTextNode(text.slice(0, start)),
      highlight,
      document.createTextNode(text.slice(end)),
    );
    this.pointerSelectionPreviewElement.style.display = 'block';
  }

  /** 隐藏画布指针拖选预览。 */
  private hidePointerSelectionPreview (): void {
    this.pointerSelectionPreviewElement.style.display = 'none';
    this.pointerSelectionPreviewElement.replaceChildren();
  }

  /**
   * 将 Effects 文本对齐转换为 CSS 对齐值。
   * @param textAlign Effects 文本对齐
   * @returns CSS 文本对齐值
   */
  private getTextAlign (textAlign: spec.TextAlignment): 'left' | 'center' | 'right' {
    switch (textAlign) {
      case spec.TextAlignment.middle: return 'center';
      case spec.TextAlignment.right: return 'right';
      default: return 'left';
    }
  }
}
