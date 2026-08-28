import {
  Composition,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  MouseButtonMask,
  Player,
  math,
} from '@galacean/effects';
import {
  ColorPicker,
  GUIRootComponent,
  LineEdit,
  OptionButton,
  PopupMenu,
  TextEdit,
  Theme,
  UICanvas,
} from '@galacean/effects-plugin-gui';

const { expect } = chai;

describe('plugin-gui/editor controls', () => {
  let player: Player;
  let composition: Composition;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    });
    composition = new Composition(player.engine);
    composition.root.awake();
    composition.root.beginPlay();
  });

  afterEach(() => player.dispose());

  it('edits, selects, submits, undoes and respects LineEdit read-only state', () => {
    const edit = new LineEdit(player.engine);
    const changed: string[] = [];
    const submitted: string[] = [];

    edit.on('textChanged', value => changed.push(value));
    edit.on('textSubmitted', value => submitted.push(value));
    edit.onKeyDown(characterKey('a'));
    edit.onKeyDown(characterKey('b'));
    expect(edit.text).equals('ab');
    edit.setSelection(0);
    const extend = new InputEventKey();

    extend.keycode = 'ArrowRight';
    extend.shiftPressed = true;
    edit.onKeyDown(extend);
    edit.onKeyDown(extend);
    expect(edit.getSelectedText()).equals('ab');
    edit.setSelection(0, 1);
    expect(edit.getSelectedText()).equals('a');

    const undo = new InputEventKey();

    undo.keycode = 'z';
    undo.ctrlPressed = true;
    edit.onKeyDown(undo);
    expect(edit.text).equals('a');

    const enter = new InputEventKey();

    enter.keycode = 'Enter';
    edit.onKeyDown(enter);
    expect(submitted).deep.equals(['a']);
    edit.editable = false;
    edit.onKeyDown(characterKey('c'));
    expect(edit.text).equals('a');
    expect(changed).deep.equals(['a', 'ab', 'a']);
  });

  it('uses a hidden textarea for composition and removes it with focus', () => {
    const edit = new LineEdit(player.engine);

    edit.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    edit.grabFocus();
    const textarea = document.querySelector('textarea');

    expect(textarea).not.equals(null);
    textarea!.dispatchEvent(new CompositionEvent('compositionstart'));
    textarea!.value = '中文';
    textarea!.setSelectionRange(2, 2);
    textarea!.dispatchEvent(new Event('input'));
    textarea!.dispatchEvent(new CompositionEvent('compositionend'));
    expect(edit.text).equals('中文');
    edit.releaseFocus();
    expect(document.querySelector('textarea')).equals(null);
  });

  it('keeps pointer capture while selecting text and focuses the input bridge on release', async () => {
    const edit = new IndexedLineEdit(player.engine, 'hello world');
    const down = new InputEventMouseButton();
    const move = new InputEventMouseMotion();
    const up = new InputEventMouseButton();

    edit.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    down.buttonIndex = MouseButton.Left;
    down.pressed = true;
    down.position.set(0, 0);
    edit.onMouseDown(down);
    await new Promise(resolve => setTimeout(resolve));
    const textarea = document.querySelector('textarea');

    expect(textarea).not.equals(null);
    expect(document.activeElement).not.equals(textarea);
    move.buttonMask = MouseButtonMask.Left;
    move.position.set(5, 0);
    edit.onMouseMove(move);
    expect(edit.getSelectedText()).equals('hello');
    up.buttonIndex = MouseButton.Left;
    up.pressed = false;
    up.position.set(5, 0);
    edit.onMouseUp(up);
    expect(document.activeElement).equals(textarea);
  });

  it('selects words on double click and preserves reverse drag direction', () => {
    const edit = new IndexedLineEdit(player.engine, 'hello world');
    const doubleClick = new InputEventMouseButton();
    const down = new InputEventMouseButton();
    const move = new InputEventMouseMotion();

    edit.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    doubleClick.buttonIndex = MouseButton.Left;
    doubleClick.pressed = true;
    doubleClick.doubleClick = true;
    doubleClick.position.set(7, 0);
    edit.onMouseDown(doubleClick);
    expect(edit.getSelectedText()).equals('world');
    edit.onMouseUp(doubleClick);
    down.buttonIndex = MouseButton.Left;
    down.pressed = true;
    down.position.set(5, 0);
    edit.onMouseDown(down);
    move.buttonMask = MouseButtonMask.Left;
    move.position.set(0, 0);
    edit.onMouseMove(move);
    expect(edit.getSelectedText()).equals('hello');
  });

  it('supports multiline editing and fromData defaults', () => {
    const edit = new TextEdit(player.engine, 'first');
    const enter = new InputEventKey();

    edit.caretColumn = edit.text.length;
    enter.keycode = 'Enter';
    edit.onKeyDown(enter);
    edit.onKeyDown(characterKey('x'));
    expect(edit.text).equals('first\nx');
    edit.text = 'abc\nx';
    edit.caretColumn = 2;
    const down = new InputEventKey();

    down.keycode = 'ArrowDown';
    edit.onKeyDown(down);
    expect(edit.caretColumn).equals(5);
    edit.fromData({ text: 'loaded', editable: false, maxLength: 12 });
    expect(edit.text).equals('loaded');
    expect(edit.editable).equals(false);
    expect(edit.placeholderText).equals('');
  });

  it('opens PopupMenu on the top layer, clamps it and restores focus', () => {
    const root = player.engine.root.getComponent(GUIRootComponent).windowRoot;
    const source = new OptionButton(player.engine);
    const popup = new PopupMenu(player.engine);

    source.addItem('First', 10);
    source.parent = root;
    const theme = new Theme();

    theme.setColor('PopupMenu', 'fontColor', new math.Color(0.3, 0.4, 0.5, 1));
    source.theme = theme;
    source.grabFocus();
    popup.addItem('Enabled', 'enabled');
    popup.setSize(100, 80);
    popup.popup(new math.Vector2(290, 140), source);
    expect(popup.visible).equals(true);
    expect(popup.x).closeTo(200, 0.1);
    expect(popup.y).equals(70);
    expect(popup.getThemeColor('fontColor').toArray()).deep.equals([0.3, 0.4, 0.5, 1]);
    expect(popup.hasFocus()).equals(true);

    const outside = new InputEventMouseButton();

    outside.buttonIndex = MouseButton.Left;
    outside.pressed = true;
    outside.position.set(10, 10);
    outside.globalPosition.set(10, 10);
    root.pushInput(outside);
    expect(popup.visible).equals(false);
    expect(popup.theme).equals(null);
    expect(source.hasFocus()).equals(true);
  });

  it('navigates OptionButton choices and emits the selected id', () => {
    const root = player.engine.root.getComponent(GUIRootComponent).windowRoot;
    const option = new OptionButton(player.engine);
    const selected: Array<number | string> = [];

    option.parent = root;
    option.addItem('Small', 'small');
    option.addItem('Large', 'large');
    option.onOption('itemSelected', value => selected.push(value));
    option.showPopup();
    const down = new InputEventKey();
    const enter = new InputEventKey();

    down.keycode = 'ArrowDown';
    enter.keycode = 'Enter';
    option.popupMenu.onKeyDown(down);
    option.popupMenu.onKeyDown(enter);
    expect(option.text).equals('Large');
    expect(selected).deep.equals(['large']);
    expect(option.popupMenu.visible).equals(false);
  });

  it('updates ColorPicker in real time without leaking mutable colors', () => {
    const picker = new ColorPicker(player.engine);
    const changes: math.Color[] = [];

    picker.on('colorChanged', value => changes.push(value));
    picker.setColor(new math.Color(0.2, 0.3, 0.4, 0.5), true);
    expect(changes).to.have.length(1);
    changes[0].r = 1;
    expect(picker.color.toArray()).deep.equals([0.2, 0.3, 0.4, 0.5]);
    picker.fromData({ color: { r: 0.6, g: 0.5, b: 0.4, a: 1 }, editAlpha: false });
    expect(picker.color.toArray()).deep.equals([0.6, 0.5, 0.4, 1]);
    expect(picker.editAlpha).equals(false);
  });
});

function characterKey (value: string): InputEventKey {
  const event = new InputEventKey();

  event.keycode = value;
  event.unicode = value.codePointAt(0)!;

  return event;
}

class IndexedLineEdit extends LineEdit {
  protected override getCharacterIndex (position: math.Vector2): number {
    return Math.max(0, Math.min(this.text.length, Math.round(position.x)));
  }
}
