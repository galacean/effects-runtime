import { InputEventMouseButton, MaskableGraphic, MouseButton, spec, TextComponent, TextStyle, type VFXItem } from '@galacean/effects';
import { RichTextComponent, richTextParser } from '@galacean/effects-plugin-rich-text';
import { RichTextLayout } from '../../../../../../plugin-packages/rich-text/src/rich-text-layout';
import { RichTextStrategyFactory } from '../../../../../../plugin-packages/rich-text/src/strategies/rich-text-factory';
import { RichTextDocument } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-document';
import { RichTextEditSession } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-edit-session';
import { TextEditSession } from '../../../../../../plugin-packages/editor-gizmo/src/2d/text/text-edit-session';
import { RichTextGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/rich-text-gizmo';
import { EnterEditModeGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/enter-edit-mode-gizmo';
import { SelectRichTextGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/select-rich-text-gizmo';
import { SelectTextGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/select-text-gizmo';
import type { RichTextInputPayload } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-edit-session';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ItemCreateGizmo, ItemCreateType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/item-create-gizmo';
import { RichTextEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes/rich-text-edit-mode';
import { TextEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes/text-edit-mode';
import { getEditableTextComponent, isEditableTextItem } from '../../../../../../plugin-packages/editor-gizmo/src/2d/items/item-predicates';

const { expect } = chai;

/** 使用真实富文本排版和 Canvas 度量，仅省略 GPU 上传。 */
function component (source: string, wrap = false): RichTextComponent {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  const component = Object.create(RichTextComponent.prototype) as RichTextComponent;

  Object.assign(component, {
    text: source, isDirty: true, canvas, context, materials: [], SCALE_FACTOR: 0.11092565,
    textStyle: new TextStyle({ text: source, fontSize: 20 }),
    textLayout: new RichTextLayout({ text: source, fontSize: 20, lineHeight: 32, wrapEnabled: wrap,
      autoResize: spec.TextSizeMode.autoHeight, maxTextWidth: 160, textVerticalAlign: spec.TextVerticalAlign.top }),
    item: { transform: { size: new Vector2() } },
    richHorizontalAlignStrategy: RichTextStrategyFactory.createHorizontalAlignStrategy(),
    richVerticalAlignStrategy: RichTextStrategyFactory.createVerticalAlignStrategy(),
    getMaxCanvasSize: () => 8192,
    renderToTexture: (width: number, height: number, _flip: boolean, draw: (context: CanvasRenderingContext2D) => void) => {
      canvas.width = width;
      canvas.height = height;
      draw(context);
    },
  });

  return component;
}

describe('plugin-editor-gizmo/rich-text-edit', () => {
  const sessions: (TextEditSession | RichTextEditSession)[] = [];

  afterEach(() => {
    sessions.splice(0).forEach(session => session.dispose());
  });

  function edit (source: string, syncImmediately = true) {
    const rich = component(source);
    const item = { type: spec.ItemType.richtext, isVisible: true, getInstanceId: () => 'rich',
      getComponent: (type: unknown) => type === RichTextComponent ? rich : undefined } as unknown as VFXItem;
    const owner = { getEngine: () => ({ canvas: { parentElement: document.body } }),
      getSelection: () => ({ getSelectedPlayerItems: () => [item] }) } as unknown as GizmoOwner;
    const session = new RichTextEditSession(owner);
    const events: RichTextInputPayload[] = [];

    sessions.push(session);
    session.on('richTextInput', event => events.push(event));
    const projection = {};

    session.attachProjection(projection);
    expect(session.retarget(item, 'select')).to.equal(true);
    const sync = () => {
      session.prepareLayout();
      session.syncViewport({ width: rich.textLayout.width, height: rich.textLayout.height, transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 } });
    };

    if (syncImmediately) { sync(); }
    const textarea = session.textAreaElement;
    const input = (start: number, end: number, inserted: string, inputType = 'insertText') => {
      textarea.setSelectionRange(start, end);
      textarea.dispatchEvent(new InputEvent('beforeinput', { inputType, data: inserted, cancelable: true }));
      textarea.setRangeText(inserted, start, end, 'end');
      textarea.dispatchEvent(new InputEvent('input', { inputType, data: inserted }));
      sync();
    };

    return { rich, item, owner, session, textarea, events, sync, input, projection };
  }

  it('marks restored content dirty before rebuilding its texture', () => {
    const rich = Object.create(RichTextComponent.prototype) as RichTextComponent;
    const updateTexture = chai.spy(() => {
      expect(rich.isDirty).to.equal(true);
      rich.isDirty = false;
    });
    const originalFromData = MaskableGraphic.prototype.fromData;

    Object.assign(rich, { isDirty: false, updateTexture });
    Object.defineProperty(rich, 'material', { value: { setColor: () => {} } });
    try {
      (MaskableGraphic.prototype as unknown as { fromData: () => void }).fromData = () => {};
      rich.fromData({ options: { text: 'restored', fontSize: 20 } } as spec.RichTextComponentData);
      expect(updateTexture).to.have.been.called.once;
    } finally {
      (MaskableGraphic.prototype as unknown as { fromData: typeof originalFromData }).fromData = originalFromData;
    }
  });

  it('replaces a selection across nested styles and preserves the remaining runs', () => {
    const doc = new RichTextDocument('<color=#ff0000><b>ABC</b>DE</color><i>FG</i>');

    doc.replace(1, 4, '中文');
    expect(doc.text).to.equal('A中文EFG');
    expect(richTextParser(doc.markup)).to.deep.equal([
      { text: 'A中文', attributes: [{ attributeName: 'color', attributeParam: '#ff0000' }, { attributeName: 'b', attributeParam: '' }] },
      { text: 'E', attributes: [{ attributeName: 'color', attributeParam: '#ff0000' }] },
      { text: 'FG', attributes: [{ attributeName: 'i', attributeParam: '' }] },
    ]);
  });

  it('keeps literal markup, escapes, newlines and emoji editable as visible text', () => {
    const doc = new RichTextDocument('<b>Hello</b>');
    const literal = '<b>=/\\😀\n世界';

    doc.replace(0, 5, literal);
    expect(new RichTextDocument(doc.markup).text).to.equal(literal);
    expect(richTextParser(doc.markup).every(run => run.attributes.some(attribute => attribute.attributeName === 'b'))).to.equal(true);
  });

  it('uses the original selection to disambiguate insertion among repeated characters', () => {
    const doc = new RichTextDocument('<b>aa</b><i>aa</i>');

    doc.updateText('aaaaa', { start: 1, end: 1 });
    expect(doc.markup).to.equal('<b>aaa</b><i>aa</i>');
  });

  it('uses the original selection to keep Backspace in the preceding styled run', () => {
    const doc = new RichTextDocument('<b>aaa</b><i>a</i>');

    doc.updateText('aaa', { start: 3, end: 3 });
    expect(doc.markup).to.equal('<b>aa</b><i>a</i>');
  });

  it('changes a partial style without losing unrelated attributes', () => {
    const doc = new RichTextDocument('<color=#ff0000>ABCD</color>');

    doc.format(1, 3, 'b');
    doc.format(1, 3, 'size', '32');
    doc.format(1, 3, 'b');
    expect(doc.markup).to.equal('<color=#ff0000>A</color><color=#ff0000><size=32>BC</size></color><color=#ff0000>D</color>');
    expect(doc.getFormat(0, 4, 'size')).to.equal(null);
    expect(doc.getFormat(1, 3, 'size')).to.equal('32');
    expect(doc.getFormat(0, 4, 'color')).to.equal('#ff0000');
  });

  it('preserves the legacy texture and dimensions when text becomes empty', () => {
    const rich = component('ABC');

    rich.textLayout.useLegacyRichText = true;
    rich.ensureLayout();
    const pixels = rich.canvas.toDataURL();
    const dimensions = [rich.textLayout.width, rich.textLayout.height];

    rich.setText('');
    rich.ensureLayout();

    expect(rich.canvas.toDataURL()).to.equal(pixels);
    expect([rich.textLayout.width, rich.textLayout.height]).to.deep.equal(dimensions);
  });

  for (const [source, reference] of [['', ' '], ['\n\n', '\n \n '], ['<size=32.5>A</size>', '<size=32>A</size>']]) {
    it(`preserves legacy rendering rules for ${JSON.stringify(source)}`, () => {
      const render = (text: string) => {
        const rich = component(text);

        // 使用实际加载/更新选项路径，覆盖空字符串的旧版占位行为。
        (rich as unknown as { updateWithOptions: (options: spec.RichTextContentOptions & { useLegacyRichText: boolean }) => void })
          .updateWithOptions({ text, fontSize: 20, useLegacyRichText: true });
        rich.ensureLayout();

        return { pixels: rich.canvas.toDataURL(), width: rich.textLayout.width, height: rich.textLayout.height,
          size: rich.item.transform.size.toArray() };
      };

      expect(render(source)).to.deep.equal(render(reference));
    });
  }

  it('rejects legacy text editing and layout updates without changing the content or renderer', () => {
    const { rich, item, session } = edit('<b>ABC</b>');

    session.dispose();
    rich.textLayout.useLegacyRichText = true;
    rich.isDirty = true;
    rich.ensureLayout();
    const pixels = rich.canvas.toDataURL();
    const dimensions = [rich.textLayout.width, rich.textLayout.height];
    const size = rich.item.transform.size.clone();

    expect(getEditableTextComponent(item)).to.equal(rich);
    expect(isEditableTextItem(item)).to.equal(false);
    const next = new RichTextEditSession({ getEngine: () => ({ canvas: { parentElement: document.body } }) } as unknown as GizmoOwner);

    sessions.push(next);
    expect(next.retarget(item)).to.equal(false);
    expect(rich.getEditingLayout().characters).to.deep.equal([]);
    rich.setLayoutProperties({ text: 'Changed', fontSize: 40, maxTextWidth: 80 });
    expect(() => rich.setFontSize(40)).not.to.throw();
    rich.ensureLayout();
    expect(rich.text).to.equal('<b>ABC</b>');
    expect(rich.textStyle.fontSize).to.equal(20);
    expect([rich.textLayout.width, rich.textLayout.height]).to.deep.equal(dimensions);
    expect(rich.item.transform.size.toArray()).to.deep.equal(size.toArray());
    expect(rich.canvas.toDataURL()).to.equal(pixels);
  });

  it('creates and releases a frozen final layout for the editor', () => {
    const rich = component('A<size=40>B</size>\nC');
    const renderTarget = rich as unknown as {
      renderToTexture: (width: number, height: number, flipY: boolean, draw: (context: CanvasRenderingContext2D) => void) => void,
    };
    const renderer = renderTarget.renderToTexture;
    let renderCount = 0;

    renderTarget.renderToTexture = (width, height, flipY, draw) => {
      renderCount++;
      renderer(width, height, flipY, draw);
    };
    const layout = rich.getEditingLayout();

    expect(renderCount).to.equal(1);
    expect(layout.characters.map(box => [box.index, box.length])).to.deep.equal([[0, 1], [1, 1], [3, 1]]);
    expect(Object.isFrozen(layout.characters)).to.equal(true);
    expect(Object.isFrozen(layout.characters[0])).to.equal(true);
    rich.releaseEditingLayout();
    const rebuilt = rich.getEditingLayout();

    expect(renderCount).to.equal(2);
    expect(rebuilt.characters).not.to.equal(layout.characters);
  });

  for (const wrap of [false, true]) {
    for (const source of ['', '\n', '\n\n', 'A\n\nB', 'A\n']) {
      it(`keeps rendering unchanged when editing starts and ends (${JSON.stringify(source)}, wrap=${wrap})`, () => {
        const rich = component(source, wrap);

        rich.ensureLayout();
        const size = rich.item.transform.size.clone();
        const dimensions = [rich.textLayout.width, rich.textLayout.height];
        const pixels = rich.canvas.toDataURL();

        for (let i = 0; i < 2; i++) {
          const editing = rich.getEditingLayout();

          expect([editing.width, editing.height]).to.deep.equal(dimensions);
          expect(rich.item.transform.size.toArray()).to.deep.equal(size.toArray());
          expect(rich.canvas.toDataURL()).to.equal(pixels);
          rich.releaseEditingLayout();
          rich.isDirty = true;
          rich.ensureLayout();
          expect([rich.textLayout.width, rich.textLayout.height]).to.deep.equal(dimensions);
          expect(rich.canvas.toDataURL()).to.equal(pixels);
        }
        expect(dimensions[1]).to.equal(source.split('\n').length * 32);
      });
    }
  }

  for (const createType of [ItemCreateType.TEXT, ItemCreateType.RICH_TEXT]) {
    for (const itemType of [spec.ItemType.text, spec.ItemType.richtext]) {
      it(`${createType} creation tool enters the existing ${itemType} edit mode without creating a duplicate`, () => {
        const rich = component('<b>AB</b>');
        const item = { type: itemType, isVisible: true, getInstanceId: () => 'existing',
          getComponent: (type: unknown) => itemType === spec.ItemType.richtext
            ? type === RichTextComponent ? rich : undefined
            : type === TextComponent ? {} : undefined } as unknown as VFXItem;
        const modes: (TextEditMode | RichTextEditMode)[] = [];
        const create = chai.spy();
        const select = chai.spy();
        const switchTool = chai.spy();
        const owner = {
          getEngine: () => ({ canvas: { parentElement: document.body }, sceneServer: { compositions: [{
            engine: { effectsObjectServer: { objectInstance: {} } }, sceneRoot: { children: [item] },
          }] } }),
          getSelection: () => ({ hitTest: () => ['existing'], commitSelectedItems: select }),
          setActiveTool: switchTool,
          setActiveEditMode: (mode: TextEditMode | RichTextEditMode) => {
            modes.push(mode);
            mode.onEnter();
          },
          emit: create,
        } as unknown as GizmoOwner;
        const gizmo = new ItemCreateGizmo(owner);
        const down = new InputEventMouseButton();

        down.buttonIndex = MouseButton.Left;
        gizmo.createType = createType;
        try {
          gizmo.onMouseDown(down);
          gizmo.onMouseUp(down);
          expect(down.isAccepted()).to.equal(true);
          expect(modes).to.have.lengthOf(1);
          expect(modes[0]).to.be.instanceOf(itemType === spec.ItemType.richtext ? RichTextEditMode : TextEditMode);
          expect(modes[0].editingItem).to.equal(item);
          expect(select).to.have.been.called.with.exactly(['existing']);
          expect(switchTool).to.have.been.called.once;
          expect(create).not.to.have.been.called();
        } finally {
          modes.forEach(mode => mode.onExit());
        }
      });
    }
  }

  for (const wrap of [false, true]) {
    it(`maps mixed sizes, empty lines and text offsets to rendered glyphs (wrap=${wrap})`, () => {
      const rich = component('A<size=40>B</size>\n\n中\n', wrap);
      const layout = rich.getEditingLayout();

      expect(layout.characters.map(box => [box.index, box.length])).to.deep.equal([[0, 1], [1, 1], [3, 0], [4, 1], [6, 0]]);
      expect(layout.characters[1].width).to.be.greaterThan(layout.characters[0].width * 1.5);
      expect(layout.characters[2].y).to.be.greaterThan(layout.characters[0].y);
      expect(layout.characters[4].y).to.be.greaterThan(layout.characters[3].y);
      expect(layout.height).to.equal(128);
    });

    it(`keeps an empty rich text layer editable (wrap=${wrap})`, () => {
      const layout = component('', wrap).getEditingLayout();

      expect(layout.height).to.equal(32);
      expect(layout.characters).to.have.lengthOf(1);
      expect(layout.characters[0]).to.include({ index: 0, length: 0 });
    });
  }

  for (const transform of [
    { a: -2, b: 0, c: 0, d: 1.5, e: 300, f: 100 },
    { a: -1, b: 0, c: 0, d: -2, e: 300, f: 200 },
    { a: 1.2, b: 0.8, c: 0.5, d: -1.4, e: 100, f: 250 },
  ]) {
    it(`aligns clicks, selection and caret through the full projection ${JSON.stringify(transform)}`, () => {
      const { rich, session, textarea } = edit('ABCD');
      const { width, height, characters } = rich.getEditingLayout();
      const point = (index: number) => {
        const box = characters[index];
        const y = box.y + box.height / 2;

        return { x: transform.a * box.x + transform.c * y + transform.e,
          y: transform.b * box.x + transform.d * y + transform.f };
      };

      session.syncViewport({ width, height, transform });
      const handle = session.beginPointerSelection(point(1));

      session.finishPointerSelection(handle, point(3));
      session.syncViewport({ width, height, transform });
      expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);
      const overlay = document.querySelector<HTMLElement>('.text-gizmo-rich-selection')!;

      expect(getComputedStyle(overlay).transform).to.equal(getComputedStyle(textarea).transform);
      textarea.setSelectionRange(2, 2);
      session.syncViewport({ width, height, transform });
      const caret = overlay.firstElementChild as HTMLElement;
      const bounds = caret.getBoundingClientRect();
      const expected = point(2);

      expect((bounds.top + bounds.bottom) / 2).to.be.closeTo(expected.y, 1);
      expect((bounds.left + bounds.right) / 2).to.be.closeTo(expected.x, 1);
    });
  }

  it('clips hidden lines while retaining their text and selection indices', () => {
    const { rich, session, textarea, sync } = edit('A\nB\nC');

    rich.setLayoutProperties({ autoResize: spec.TextSizeMode.fixed, maxTextHeight: 32 });
    rich.textLayout.overflow = spec.TextOverflow.clip;
    sync();
    session.selectAllText();
    sync();
    const overlay = document.querySelector<HTMLElement>('.text-gizmo-rich-selection')!;

    expect(textarea.value).to.equal('A\nB\nC');
    expect(textarea.selectionEnd).to.equal(5);
    expect(rich.getEditingLayout().characters.some(box => box.y >= 64)).to.equal(true);
    expect(overlay.clientHeight).to.equal(32);
    expect(getComputedStyle(overlay).overflow).to.equal('hidden');
  });

  it('keeps the caret visible at the right clipping boundary', () => {
    const { rich, textarea, sync } = edit('ABCD');

    rich.textLayout.textAlign = spec.TextAlignment.right;
    rich.isDirty = true;
    textarea.setSelectionRange(4, 4);
    sync();
    const overlay = document.querySelector<HTMLElement>('.text-gizmo-rich-selection')!;
    const caret = overlay.firstElementChild as HTMLElement;
    const left = parseFloat(caret.style.left);
    const right = left + parseFloat(caret.style.width);

    expect(right).to.be.at.most(rich.textLayout.width);
    expect(right).to.be.closeTo(rich.textLayout.width, 0.1);
    expect(left).to.be.lessThan(right);
  });

  it('merges a continuous row selection and reuses it on unchanged frames', () => {
    const { sync } = edit('ABCDEFGHIJKL');
    const overlay = document.querySelector<HTMLElement>('.text-gizmo-rich-selection')!;

    expect(overlay.children).to.have.lengthOf(1);
    const rectangle = overlay.firstElementChild;

    sync();
    expect(overlay.firstElementChild).to.equal(rectangle);
  });

  it('starts a fresh local history after external content replacement', () => {
    const { rich, textarea, input, sync } = edit('<b>ABC</b>');

    input(1, 2, '中');
    rich.setText('<i>External</i>');
    sync();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, cancelable: true }));
    expect(textarea.value).to.equal('External');
    expect(rich.text).to.equal('<i>External</i>');
  });

  it('accepts the first input before the first projected frame without selecting it again', () => {
    const { rich, textarea, input, sync } = edit('<b>ABC</b>', false);

    expect(document.activeElement).to.equal(textarea);
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([0, 3]);
    input(0, 3, 'XYZ');
    expect(rich.text).to.equal('<b>XYZ</b>');
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([3, 3]);
    sync();
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([3, 3]);
  });

  it('opens visible text, replaces it while preserving styles, and emits persistable markup', () => {
    const { rich, textarea, events, input } = edit('<b>Hello</b> <color=#2563eb>world</color>');

    expect(textarea.value).to.equal('Hello world');
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([0, 11]);
    input(6, 11, '世界');
    expect(rich.text).to.equal('<b>Hello</b> <color=#2563eb>世界</color>');
    expect(events[0]).to.include({ markup: rich.text, plainText: 'Hello 世界', itemId: 'rich' });
  });

  it('routes rich changes through richtextinput without changing the plain event contract', () => {
    const { owner, session, item, input, rich } = edit('<b>ABC</b>');
    const emit = chai.spy();

    owner.emit = emit;
    const gizmo = new RichTextGizmo(owner, session);
    const plain = new TextEditSession(owner);

    sessions.push(plain);
    try {
      expect(plain.retarget(item)).to.equal(false);
      input(1, 2, '中');
      expect(emit).to.have.been.called.once;
      expect(emit).to.have.been.called.with.exactly('richtextinput', {
        source: gizmo, itemId: 'rich', markup: rich.text, plainText: 'A中C',
      });
    } finally {
      gizmo.dispose();
    }
  });

  it('undoes and redoes content and partial formatting together with selection', () => {
    const { rich, textarea, session, input } = edit('<b>ABC</b>');

    input(1, 2, '中');
    textarea.setSelectionRange(1, 2);
    session.formatSelection('color', '#2563eb');
    const formatted = rich.text;
    const key = (shiftKey = false) => textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey, cancelable: true }));

    key();
    expect(rich.text).to.equal('<b>A中C</b>');
    key();
    expect(rich.text).to.equal('<b>ABC</b>');
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 2]);
    key(true);
    key(true);
    expect(rich.text).to.equal(formatted);
  });

  it('groups an IME composition into one undo step and preserves the selected run style', () => {
    const { rich, textarea, input } = edit('<b>ABC</b>');

    textarea.setSelectionRange(1, 2);
    textarea.dispatchEvent(new CompositionEvent('compositionstart'));
    input(1, 2, 'z', 'insertCompositionText');
    input(1, 2, '中', 'insertCompositionText');
    textarea.dispatchEvent(new CompositionEvent('compositionend', { data: '中' }));
    expect(rich.text).to.equal('<b>A中C</b>');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, cancelable: true }));
    expect(rich.text).to.equal('<b>ABC</b>');
  });

  it('uses rich glyph positions and keeps plain text outside the rich session', () => {
    const { rich, session, textarea, sync } = edit('A<size=40>BC</size>D');
    const boxes = rich.getEditingLayout().characters;
    const start = boxes[1];
    const end = boxes[2];

    const handle = session.beginPointerSelection({ x: 10 + start.x, y: 10 + start.y + start.height / 2 });

    session.finishPointerSelection(handle, { x: 10 + end.x + end.width, y: 10 + end.y + end.height / 2 });
    sync();
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);
    const plain = { type: spec.ItemType.text, getComponent: (type: unknown) => type === TextComponent ? {} : undefined } as unknown as VFXItem;

    expect(session.retarget(plain)).to.equal(false);
    expect(session.editingItem?.type).to.equal(spec.ItemType.richtext);
    session.dispose();
    expect(textarea.isConnected).to.equal(false);
    expect(document.querySelector('.text-gizmo-rich-selection')).to.equal(null);
  });

  it('preserves the rich selection while the projection is detached and restored', () => {
    const { rich, session, textarea, sync, projection, input } = edit('<b>ABCD</b>');

    textarea.setSelectionRange(1, 3);
    session.detachProjection(projection);
    expect(textarea.style.display).to.equal('none');
    session.attachProjection(projection);
    sync();
    expect(textarea.value).to.equal('ABCD');
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);
    input(1, 3, '中');
    expect(rich.text).to.equal('<b>A中D</b>');
  });

  it('saves the current selection for every hide and clears it after restoration', () => {
    const { session, textarea, sync } = edit('<b>ABCD</b>');

    textarea.setSelectionRange(1, 3);
    session.syncViewport(undefined);
    textarea.setSelectionRange(0, 0);
    sync();
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);

    textarea.setSelectionRange(0, 1);
    session.syncViewport(undefined);
    sync();
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([0, 1]);
  });

  it('keeps a press-time caret anchor after the viewport moves', () => {
    const { rich, session, textarea } = edit('ABCD');
    const boxes = rich.getEditingLayout().characters;
    const point = (offset: number, index: number) => ({
      x: offset + boxes[index].x + boxes[index].width / 2,
      y: 10 + boxes[index].y + boxes[index].height / 2,
    });

    const handle = session.beginPointerSelection(point(10, 1));

    session.syncViewport({ width: rich.textLayout.width, height: rich.textLayout.height,
      transform: { a: 1, b: 0, c: 0, d: 1, e: 100, f: 10 } });
    session.finishPointerSelection(handle, point(100, 3));
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);
  });

  it('ignores stale drag handles after a newer pointer selection starts', () => {
    const { rich, session, textarea } = edit('ABCD');
    const boxes = rich.getEditingLayout().characters;
    const point = (index: number) => ({ x: 10 + boxes[index].x, y: 10 + boxes[index].y + boxes[index].height / 2 });
    const oldHandle = session.beginPointerSelection(point(0));
    const activeHandle = session.beginPointerSelection(point(1));

    session.updatePointerSelection(oldHandle, point(3));
    session.finishPointerSelection(oldHandle, point(3));
    session.cancelPointerSelection(oldHandle);
    session.finishPointerSelection(activeHandle, point(3));
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 3]);
  });

  it('keeps plain selection unchanged and selects rich text through its own gizmo', () => {
    const rich = component('<b>ABCD</b>');
    const richItem = { type: spec.ItemType.richtext, isVisible: true, children: [], getInstanceId: () => 'rich',
      getComponent: (type: unknown) => type === RichTextComponent ? rich : undefined } as unknown as VFXItem;
    const plainItem = { type: spec.ItemType.text, isVisible: true, children: [], getInstanceId: () => 'plain',
      getComponent: (type: unknown) => type === TextComponent ? {} : undefined } as unknown as VFXItem;
    let hit = 'rich';
    let selected = plainItem;
    const owner = {
      getEngine: () => ({ canvas: { parentElement: document.body }, sceneServer: { compositions: [{
        engine: { effectsObjectServer: { objectInstance: {} } }, sceneRoot: { children: [plainItem, richItem] },
      }] } }),
      getSelection: () => ({ hitTest: () => [hit], filterSelectedItems: (ids: string[]) => ids,
        getSelectedPlayerItems: () => [selected], commitSelectedItems: () => {} }),
      setCursor: () => {},
      setActiveEditMode: (next: TextEditMode | RichTextEditMode) => {
        mode.onExit();
        mode = next;
        mode.onEnter();
      },
    } as unknown as GizmoOwner;
    let mode: TextEditMode | RichTextEditMode = new TextEditMode(owner, plainItem);
    const plainGizmos = mode.createGizmos();

    mode.onEnter();
    const down = new InputEventMouseButton();

    down.buttonIndex = MouseButton.Left;
    down.position.set(10, 25);
    try {
      const plainSelect = plainGizmos.find((gizmo): gizmo is SelectTextGizmo => gizmo instanceof SelectTextGizmo)!;

      plainSelect.onMouseDown(down);
      expect(down.isAccepted()).to.equal(false);
      expect(mode.editingItem).to.equal(plainItem);
      plainGizmos.forEach(gizmo => gizmo.dispose());

      selected = richItem;
      down.doubleClick = true;
      new EnterEditModeGizmo(owner).onMouseDown(down);
      expect(mode).to.be.instanceOf(RichTextEditMode);
      const session = (mode as unknown as RichTextEditMode).session;
      const select = new SelectRichTextGizmo(owner, session);

      session.attachProjection({});
      session.prepareLayout();
      session.syncViewport({ width: rich.textLayout.width, height: rich.textLayout.height, transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 } });
      const pointerDown = new InputEventMouseButton();
      const up = new InputEventMouseButton();
      const boxes = rich.getEditingLayout().characters;

      pointerDown.buttonIndex = MouseButton.Left;
      pointerDown.position.set(10, 25);
      up.position.set(10 + boxes[1].x + boxes[1].width, 25);
      select.onMouseDown(pointerDown);
      select.onMouseUp(up);
      expect([session.textAreaElement.selectionStart, session.textAreaElement.selectionEnd]).to.deep.equal([0, 2]);
      expect(session.formatSelection('i')).to.equal(true);
      const markup = rich.text;

      hit = 'plain';
      const plainDown = new InputEventMouseButton();

      plainDown.buttonIndex = MouseButton.Left;
      select.onMouseDown(plainDown);
      expect(plainDown.isAccepted()).to.equal(false);
      expect(session.editingItem).to.equal(richItem);
      select.dispose();
      mode.onExit();
      expect(session.textAreaElement.isConnected).to.equal(false);
      expect(document.querySelector('.text-gizmo-rich-selection')).to.equal(null);
      expect(rich.text).to.equal(markup);
    } finally {
      mode.onExit();
    }
  });

  it('extends selection with Shift-click and selects a word on double-click', () => {
    const { rich, session, textarea } = edit('hello world');
    const boxes = rich.getEditingLayout().characters;
    const point = (index: number) => ({ x: 10 + boxes[index].x, y: 10 + boxes[index].y + boxes[index].height / 2 });

    textarea.setSelectionRange(1, 3);
    const extendHandle = session.beginPointerSelection(point(8), { extend: true });

    session.finishPointerSelection(extendHandle, point(8));
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([1, 8]);
    const wordHandle = session.beginPointerSelection(point(8), { word: true });

    session.finishPointerSelection(wordHandle, point(8));
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([6, 11]);
  });
});
