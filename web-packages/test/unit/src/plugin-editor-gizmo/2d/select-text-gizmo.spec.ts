import { restoreTestState, getSpyCalls, resetSpy, type TestSpy } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, spec, TextComponent, type Engine, type VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { FrameManager, GestureCursorType, ConfigManager, SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxTransformFromBox } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection';
import { SelectTextGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/select-text-gizmo';
import { TextEditSession } from '../../../../../../plugin-packages/editor-gizmo/src/2d/text/text-edit-session';

const { expect } = chai;

describe('plugin-editor-gizmo/select-text-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (pressed = true, buttonIndex = MouseButton.Left, x = 40, y = 30): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = buttonIndex === MouseButton.Left ? MouseButtonMask.Left : MouseButtonMask.Right;
    event.buttonIndex = buttonIndex;
    event.pressed = pressed;

    return event;
  }

  function mouseMotion (buttonMask = MouseButtonMask.Left, x = 40, y = 30): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = buttonMask;

    event.pressed = event.buttonMask !== MouseButtonMask.None;

    return event;
  }

  function createTextItem (id: string): VFXItem {
    return {
      type: spec.ItemType.text,
      isVisible: true,
      children: [],
      getInstanceId: () => id,
      getComponent: (component: unknown) => component === TextComponent ? {} : undefined,
    } as unknown as VFXItem;
  }

  function createFixture (): {
    gizmo: SelectTextGizmo,
    session: TextEditSession,
    current: VFXItem,
    other: VFXItem,
    selection: Selection,
    resetEditMode: TestSpy,
    setCursor: TestSpy,
    inputOrder: string[],
    setHitIds: (ids: string[]) => void,
    setHitResolver: (resolver: (point: Vector2) => string[]) => void,
  } {
    const current = createTextItem('text-1');
    const other = createTextItem('text-2');
    let selectedItems = [current];
    let hitIds: string[] = [];
    let hitResolver: ((point: Vector2) => string[]) | undefined;
    const inputOrder: string[] = [];
    const commitSelectedItems = chai.spy((ids: string[]) => {
      inputOrder.push('selection');
      selectedItems = ids.map(id => id === 'text-1' ? current : other);

      return true;
    });
    const selection = {
      getSelectedPlayerItems: () => selectedItems,
      hitTest: (point: Vector2) => hitResolver?.(point) ?? hitIds,
      commitSelectedItems,
    } as unknown as Selection;
    const composition = { items: [current, other] };
    const container = document.createElement('div');

    Object.defineProperties(container, {
      offsetWidth: { configurable: true, value: TEST_VIEW_SIZE.x },
      offsetHeight: { configurable: true, value: TEST_VIEW_SIZE.y },
    });
    document.body.appendChild(container);
    const engine = {
      compositions: [composition],
      canvas: { parentElement: container },
      getServer (this: { compositions: unknown[] }) { return { compositions: this.compositions }; },

    } as unknown as Engine;
    const resetEditMode = chai.spy();
    const setCursor = chai.spy(() => { inputOrder.push('cursor'); });
    const configs = new ConfigManager();
    const frames = new FrameManager({} as Engine);
    const owner = {
      getSelection: () => selection,
      getFrameManager: () => frames,
      getViewportNavigation: () => ({} as never),
      getMousePosition: () => new Vector2(),
      setCursor,
      isPanning: () => false,
      isHandToolMode: () => false,
      isMouseButtonPressed: () => false,
      rebuildGizmos: () => {},
      resetEditMode,
      getGizmoManager: () => undefined,
      getConfigManager: () => configs,
      getEngine: () => engine,
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    owner.getSnapManager = () => snapManager;
    const session = new TextEditSession(owner);
    const gizmo = new SelectTextGizmo(owner, session);

    expect(session.beginFromCurrentSelection('focus')).to.equal(true);

    return {
      gizmo,
      session,
      current,
      other,
      selection,
      resetEditMode,
      setCursor,
      setHitIds: ids => {
        hitIds = ids;
      },
      setHitResolver: resolver => {
        hitResolver = resolver;
      },
      inputOrder,
    };
  }

  afterEach(() => {
    document.head.querySelectorAll('style').forEach(style => style.remove());
  });

  describe('SelectTextGizmo', () => {
    it('retargets the active edit session to another text item on one click', () => {
      const { gizmo, session, other, selection, resetEditMode, setHitIds } = createFixture();

      setHitIds(['text-2']);
      session.textAreaElement.value = 'previous';
      session.textAreaElement.setSelectionRange(2, 6);
      const event = mouseButton(true);

      gizmo.onMouseDown(event);

      expect(event.isAccepted()).to.equal(true);
      expect(session.editingItem).to.equal(other);
      expect(session.textAreaElement.selectionStart).to.equal(0);
      expect(session.textAreaElement.selectionEnd).to.equal(0);
      expect(selection.commitSelectedItems).to.have.been.called.with.exactly(['text-2']);
      expect(resetEditMode).not.to.have.been.called();
    });

    it('accepts a click on the current text without leaving edit mode', () => {
      const { gizmo, session, current, selection, setHitIds } = createFixture();

      setHitIds(['text-1']);
      const event = mouseButton(true);

      gizmo.onMouseDown(event);

      expect(event.isAccepted()).to.equal(true);
      expect(session.editingItem).to.equal(current);
      expect(selection.commitSelectedItems).to.have.been.called.with.exactly(['text-1']);
    });

    it('lets non-text and right-button clicks fall through', () => {
      const { gizmo, selection, setHitIds } = createFixture();

      setHitIds([]);
      const outside = mouseButton(true);
      const rightClick = mouseButton(true, MouseButton.Right);

      gizmo.onMouseDown(outside);
      gizmo.onMouseDown(rightClick);

      expect(outside.isAccepted()).to.equal(false);
      expect(rightClick.isAccepted()).to.equal(false);
      expect(selection.commitSelectedItems).not.to.have.been.called();
    });

    it('accepts hover on another text with a dedicated text cursor', () => {
      const { gizmo, setCursor, setHitIds } = createFixture();

      setHitIds(['text-2']);
      const move = mouseMotion();

      gizmo.onMouseMove(move);

      expect(move.isAccepted()).to.equal(true);
      expect(gizmo.hoverTextId).to.equal('text-2');
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{
        type: GestureCursorType.TEXT,
        angle: 0,
      }]);
    });

    it('does not hover the current text and clears stale hover on blank space', () => {
      const { gizmo, setCursor, setHitIds } = createFixture();

      setHitIds(['text-2']);
      gizmo.onMouseMove(mouseMotion());
      expect(gizmo.hoverTextId).to.equal('text-2');

      setHitIds(['text-1']);
      resetSpy(setCursor);
      const current = mouseMotion();

      gizmo.onMouseMove(current);
      expect(current.isAccepted()).to.equal(false);
      expect(gizmo.hoverTextId).to.equal(undefined);
      expect(setCursor).not.to.have.been.called();

      setHitIds([]);
      const blank = mouseMotion();

      gizmo.onMouseMove(blank);
      expect(blank.isAccepted()).to.equal(false);
      expect(gizmo.hoverTextId).to.equal(undefined);
    });

    it('uses a four-pixel nearby query for hover but not for click retargeting', () => {
      const { gizmo, session, current, setHitResolver } = createFixture();

      setHitResolver(point => point.x === 44 && point.y === 30 ? ['text-2'] : []);

      const move = mouseMotion();

      gizmo.onMouseMove(move);
      expect(move.isAccepted()).to.equal(true);
      expect(gizmo.hoverTextId).to.equal('text-2');

      const down = mouseButton(true);

      gizmo.onMouseDown(down);
      expect(down.isAccepted()).to.equal(false);
      expect(session.editingItem).to.equal(current);
    });

    it('does not expand hover beyond four screen pixels', () => {
      const { gizmo, setHitResolver } = createFixture();

      setHitResolver(point => point.x === 45 && point.y === 30 ? ['text-2'] : []);
      const move = mouseMotion();

      gizmo.onMouseMove(move);

      expect(move.isAccepted()).to.equal(false);
      expect(gizmo.hoverTextId).to.equal(undefined);
    });

    it('clears hover on leave, dispose and target invalidation', () => {
      const {
        gizmo,
        other,
        setCursor,
        setHitIds,
      } = createFixture();
      const hover = () => {
        setHitIds(['text-2']);
        gizmo.onMouseMove(mouseMotion());
        expect(gizmo.hoverTextId).to.equal('text-2');
      };

      hover();
      gizmo.onMouseLeave();
      expect(gizmo.hoverTextId).to.equal(undefined);
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{ type: GestureCursorType.NORMAL, angle: 0 }]);

      hover()
      ;(other as unknown as { isVisible: boolean }).isVisible = false;
      gizmo.onUpdate();
      expect(gizmo.hoverTextId).to.equal(undefined)

      ;(other as unknown as { isVisible: boolean }).isVisible = true;
      hover();
      gizmo.dispose();
      expect(gizmo.hoverTextId).to.equal(undefined);
    });

    it('recomputes the down target instead of using a stale hover target', () => {
      const { gizmo, session, current, setHitIds } = createFixture();

      setHitIds(['text-2']);
      gizmo.onMouseMove(mouseMotion());
      expect(gizmo.hoverTextId).to.equal('text-2');

      setHitIds([]);
      const down = mouseButton(true);

      gizmo.onMouseDown(down);

      expect(down.isAccepted()).to.equal(false);
      expect(session.editingItem).to.equal(current);
    });

    it('continues the switching down as a pointer-selection drag on the new text', () => {
      const {
        gizmo,
        session,
        selection,
        setCursor,
        inputOrder,
        setHitIds,
      } = createFixture();
      const begin = chai.spy.on(session, 'beginPointerSelection');
      const update = chai.spy.on(session, 'updatePointerSelection');
      const finish = chai.spy.on(session, 'finishPointerSelection');

      setHitIds(['text-2']);

      const down = mouseButton(true, MouseButton.Left, 20, 20);

      gizmo.onMouseDown(down);
      expect(begin).to.have.been.called.with.exactly({ x: 20, y: 20 });
      expect(session.textAreaElement.style.pointerEvents).to.equal('none');
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{
        type: GestureCursorType.TEXT,
        angle: 0,
      }]);
      expect(inputOrder.lastIndexOf('cursor')).to.be.greaterThan(inputOrder.lastIndexOf('selection'));

      const pressedMove = mouseMotion(MouseButtonMask.Left, 24, 20);

      gizmo.onMouseMove(pressedMove);
      expect(pressedMove.isAccepted()).to.equal(true);
      expect(getSpyCalls(update).at(-1)).to.deep.equal([{ x: 24, y: 20 }]);

      const drag = mouseMotion(MouseButtonMask.Left, 32, 20);

      gizmo.onMouseDrag(drag);
      expect(drag.isAccepted()).to.equal(true);
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{ type: GestureCursorType.TEXT, angle: 0 }]);
      expect(getSpyCalls(update).at(-1)).to.deep.equal([{ x: 32, y: 20 }]);

      const up = mouseButton(false, MouseButton.Left, 36, 20);

      gizmo.onMouseUp(up);
      expect(up.isAccepted()).to.equal(true);
      expect(finish).to.have.been.called.with.exactly({ x: 36, y: 20 });
      expect(session.textAreaElement.style.pointerEvents).to.equal('');
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{
        type: GestureCursorType.TEXT,
        angle: 0,
      }]);
    });

    it('re-resolves hover geometry on every draw and renders only dashed segments', () => {
      const { gizmo, other, setHitIds } = createFixture();

      setHitIds(['text-2']);
      gizmo.onMouseMove(mouseMotion());

      const firstTransform = getBoxTransformFromBox(new Box2(new Vector2(10, 10), new Vector2(20, 20)));
      const secondTransform = getBoxTransformFromBox(new Box2(new Vector2(50, 40), new Vector2(60, 50)));
      let transform = firstTransform;
      const getTransform = setItemViewTransform(other, () => transform);
      const drawLine = chai.spy();
      const control = { drawLine } as unknown as Control;

      gizmo.draw(control);
      expect(drawLine).to.have.been.called();
      expect(getSpyCalls(drawLine)[0][0]).to.equal(10);
      expect(getSpyCalls(drawLine)[0][4]).to.have.nested.property('r').that.is.a('number');
      expect(getSpyCalls(drawLine)[0][4]).to.have.nested.property('g').that.is.a('number');
      expect(getSpyCalls(drawLine)[0][4]).to.have.nested.property('b').that.is.a('number');
      expect(getSpyCalls(drawLine)[0][4]).to.have.deep.nested.property('a', 1);
      expect(getSpyCalls(drawLine).every(call => call[5] === 1)).to.equal(true);

      resetSpy(drawLine);
      transform = secondTransform;
      gizmo.draw(control);
      expect(getSpyCalls(drawLine)[0][0]).to.equal(50);
      expect(getTransform).to.have.been.called.exactly(2);
    });
  });
});
