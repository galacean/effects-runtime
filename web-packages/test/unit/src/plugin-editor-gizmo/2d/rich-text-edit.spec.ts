import { Engine, spec, VFXItem } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { RichTextEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes/rich-text-edit-mode';
import { applyRichTextResize, createRichTextResizeSnapshot } from '../../../../../../plugin-packages/editor-gizmo/src/2d/rich-text/rich-text-resize';
import { getSpyCalls } from '../helpers/spies';

const { expect } = chai;

describe('plugin-editor-gizmo/rich-text-edit', () => {
  let engine: Engine;
  let item: VFXItem;
  let rich: RichTextComponent;

  beforeEach(() => {
    engine = new Engine(document.body.appendChild(document.createElement('canvas')), { manualRender: true });
    item = new VFXItem(engine);
    item.type = spec.ItemType.richtext;
    rich = item.addComponent(RichTextComponent);
    rich.fromData({
      id: rich.getInstanceId(),
      dataType: spec.DataType.RichTextComponent,
      item: { id: item.getInstanceId() },
      renderer: {},
      options: {
        text: '<b>Hello</b> <size=30>world</size>', fontFamily: 'sans-serif', fontSize: 20,
        textColor: [1, 1, 1, 1], lineHeight: 32, maxTextWidth: 160, autoResize: spec.TextSizeMode.autoHeight,
      },
    });
  });

  afterEach(() => {
    item.dispose();
    engine.dispose();
    engine.canvas.remove();
  });

  it('edits and formats selected text while preserving the surrounding markup', () => {
    const emit = chai.spy();
    const owner = {
      getEngine: () => engine,
      getSelection: () => ({ commitSelectedItems () {} }),
      emit,
    } as unknown as GizmoOwner;
    const mode = new RichTextEditMode(owner, item, 'select');
    const gizmos = mode.createGizmos();
    const textarea = mode.session.textAreaElement;

    try {
      mode.onEnter();
      expect(textarea.value).to.equal('Hello world');
      textarea.setSelectionRange(6, 11);
      textarea.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '世界' }));
      textarea.setRangeText('世界', 6, 11, 'end');
      textarea.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '世界' }));

      expect(rich.text).to.equal('<b>Hello</b> <size=30>世界</size>');
      const [eventName, payload] = getSpyCalls(emit)[0];

      expect(eventName).to.equal('richtextinput');
      expect(payload).to.include({ itemId: item.getInstanceId(), markup: rich.text, plainText: 'Hello 世界' });

      textarea.setSelectionRange(6, 8);
      mode.formatSelection('size', '40');
      expect(rich.text).to.equal('<b>Hello</b> <size=40>世界</size>');
      textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true }));
      expect(rich.text).to.equal('<b>Hello</b> <size=30>世界</size>');
      textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true }));
      expect(rich.text).to.equal('<b>Hello</b> <size=40>世界</size>');
    } finally {
      gizmos.forEach(gizmo => gizmo.dispose());
      mode.onExit();
    }
  });

  it('scales the base font and inline sizes together', () => {
    const snapshot = createRichTextResizeSnapshot(rich, 'font');

    applyRichTextResize(snapshot, 1.5);
    expect(rich.textStyle.fontSize).to.equal(30);
    expect(rich.textLayout.lineHeight).to.equal(48);
    expect(rich.text).to.equal('<b>Hello</b> <size=45>world</size>');
  });

  it('changes width and reflows without changing font sizes', () => {
    const snapshot = createRichTextResizeSnapshot(rich, 'width');
    const height = rich.textLayout.height;

    applyRichTextResize(snapshot, 0.5, 1);
    expect(rich.textLayout.maxTextWidth).to.equal(80);
    expect(rich.textLayout.height).to.be.greaterThan(height);
    expect(rich.textStyle.fontSize).to.equal(20);
    expect(rich.text).to.equal(snapshot.properties.text);
  });
});
