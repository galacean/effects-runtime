import { restoreTestState, resetSpy } from '../helpers/spies';
import type { Engine } from '@galacean/effects';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

import { ChangeSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/change-selection-gizmo';
import type { Selection, SelectionHitSnapshot } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { LoadingManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/change-selection-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(10, 20);
    event.globalPosition.set(10, 20);
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;

    Object.assign(event, overrides);

    return event;
  }

  function mouseMotion (overrides: Partial<InputEventMouseMotion> = {}): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(10, 20);
    event.globalPosition.set(10, 20);
    event.buttonMask = MouseButtonMask.Left;

    Object.assign(event, overrides);
    event.pressed = (overrides.buttonMask ?? MouseButtonMask.Left) !== MouseButtonMask.None;

    return event;
  }

  function harness (
    initialIds: string[],
    hits: SelectionHitSnapshot[],
  ): {
      gizmo: ChangeSelectionGizmo,
      selection: Selection,
      selectedIds: () => string[],
      selectionChanges: { oldSelectedIds: string[], newSelectedIds: string[] }[],
      loadingManager: LoadingManager,
    } {
    let ids = [...initialIds];
    let preSelectedId: string | undefined;
    let hoverOverlayItemId: string | undefined;
    const queue = [...hits];
    const selectionChanges: { oldSelectedIds: string[], newSelectedIds: string[] }[] = [];
    const selectionValue = {
      interactionStartSelectedIds: [],
      getSelectedIds: () => ids,
      isItemSelected: (id: string) => ids.includes(id),
      createHitSnapshot: chai.spy(() => queue.shift() ?? hits.at(-1)),
      commitSelectedItems: chai.spy((next: string[]) => {
        if (ids.length === next.length && ids.every((id, index) => id === next[index])) {
          return false;
        }
        const oldSelectedIds = [...ids];

        ids = [...next];
        selectionChanges.push({ oldSelectedIds, newSelectedIds: [...ids] });

        return true;
      }),
      commitHoverTarget: chai.spy(() => {
        preSelectedId = hits[0]?.topmostId;
        hoverOverlayItemId = preSelectedId;
      }),
      setHoverOverlayTarget: chai.spy((itemId: string | undefined) => {
        hoverOverlayItemId = itemId;
      }),
      clearHover: chai.spy(() => {
        preSelectedId = undefined;
        hoverOverlayItemId = undefined;
      }),
      isPointInSelectedViewBox: () => false,
      getFocusedGroupId: () => 'group',
      isPointInFocusedGroup: chai.spy(() => false),
      setFocusedGroup: chai.spy(),
      getSelectedPlayerItems: () => [],
    };

    Object.defineProperties(selectionValue, {
      preSelectedId: { get: () => preSelectedId },
      hoverOverlayItemId: { get: () => hoverOverlayItemId },
    });
    const selection = selectionValue as unknown as Selection;
    const items = ['A', 'B', 'C'].map(id => ({
      getInstanceId: () => id,
      children: [],
    }));
    const engine = {
      sceneServer: { compositions: [{ items }] },
      canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
    } as unknown as Engine;
    const loadingManager = new LoadingManager();
    const owner = {
      emit: () => {},
      getSelection: () => selection,
      getLoadingManager: () => loadingManager,
      getMousePosition: () => new Vector2(10, 20),
      getEngine: () => engine,
    } as unknown as GizmoOwner;

    return {
      gizmo: new ChangeSelectionGizmo(owner),
      selection,
      selectedIds: () => ids,
      selectionChanges,
      loadingManager,
    };
  }

  function hit (
    selectableIds: string[],
    selectedScopeHitIds: string[] = [],
    drillTargetId?: string,
  ): SelectionHitSnapshot {
    return {
      point: new Vector2(10, 20),
      selectableIds,
      topmostId: selectableIds[0],
      selectedScopeHitIds,
      drillTargetId,
    };
  }

  describe('ChangeSelectionGizmo', () => {
    it('loading 元素仍可通过点击选中', () => {
      const context = harness([], [hit(['B'])]);

      context.loadingManager.add('B');
      const down = mouseButton(true);

      context.gizmo.onMouseDown(down);

      expect(down.isAccepted()).to.equal(true);
      expect(context.selectedIds()).to.deep.equal(['B']);
    });

    it('mouseMove 解析并提交 primary hover', () => {
      const context = harness([], [hit(['B'])]);
      const move = mouseMotion({ buttonMask: MouseButtonMask.None });

      context.gizmo.onMouseMove(move);

      expect(move.isAccepted()).to.equal(true);
      expect(context.selection.commitHoverTarget).to.have.been.called.with.exactly(new Vector2(10, 20));
      expect(context.selection.hoverOverlayItemId).to.equal('B');
    });

    it('Down 重新提交局部目标，Drag 不重新提交', () => {
      const context = harness(['A'], [hit(['B', 'A'], ['A'])]);

      context.gizmo.onMouseMove(mouseMotion({ buttonMask: MouseButtonMask.None }));
      context.selection.clearHover();
      context.gizmo.onMouseDown(mouseButton(true));
      expect(context.selection.hoverOverlayItemId).to.equal('B');

      context.selection.clearHover();
      context.gizmo.onMouseDrag(mouseMotion());
      expect(context.selection.hoverOverlayItemId).to.equal(undefined);
    });

    it('普通元素在 mousedown 立即选中', () => {
      const context = harness([], [hit(['B'])]);
      const down = mouseButton(true);

      context.gizmo.onMouseDown(down);

      expect(down.isAccepted()).to.equal(true);
      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: [], newSelectedIds: ['B'] },
      ]);
      expect(context.selection.commitHoverTarget).not.to.have.been.called();
    });

    it('空选区时右键元素会先选中命中元素', () => {
      const context = harness([], [hit(['B'])]);
      const down = mouseButton(true, { buttonIndex: MouseButton.Right, buttonMask: MouseButtonMask.Right });

      context.gizmo.onMouseDown(down);

      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: [], newSelectedIds: ['B'] },
      ]);
    });

    it('重叠下层已选时 down 保持下层，未拖 mouseup 切到同一上层', () => {
      const context = harness(['A'], [
        hit(['B', 'A'], ['A']),
        hit(['B', 'A'], ['A']),
      ]);
      const down = mouseButton(true);
      const up = mouseButton(false);

      context.gizmo.onMouseDown(down);
      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);

      context.gizmo.onMouseUp(up);
      expect(up.isAccepted()).to.equal(true);
      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: ['A'], newSelectedIds: ['B'] },
      ]);
    });

    it('按下已选画板内的子元素时延迟切换到 mouseup', () => {
      const context = harness(['A'], [
        hit(['B'], ['B']),
        hit(['B'], ['B']),
      ]);

      context.gizmo.onMouseDown(mouseButton(true));
      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);

      context.gizmo.onMouseUp(mouseButton(false));
      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: ['A'], newSelectedIds: ['B'] },
      ]);
    });

    it('从已选画板内的子元素开始拖动时保持画板选中', () => {
      const context = harness(['A'], [hit(['B'], ['B'])]);

      context.gizmo.onMouseDown(mouseButton(true));
      const canceledUp = mouseButton(false);

      canceledUp.canceled = true;

      context.gizmo.onMouseUp(canceledUp);

      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);
    });

    it('drag winner 发出的 canceled mouseup 只清会话，不在行为内清 primary hover', () => {
      const context = harness(['A'], [hit(['B', 'A'], ['A'])]);

      context.gizmo.onMouseDown(mouseButton(true));
      const canceledUp = mouseButton(false);

      canceledUp.canceled = true;

      context.gizmo.onMouseUp(canceledUp);

      expect(context.selection.clearHover).not.to.have.been.called();
      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);
    });

    it('释放点 topmost 改变时放弃 deferred target', () => {
      const context = harness(['A'], [
        hit(['B', 'A'], ['A']),
        hit(['C']),
      ]);

      context.gizmo.onMouseDown(mouseButton(true));

      context.gizmo.onMouseUp(mouseButton(false, { position: new math.Vector2(30, 20) }));

      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);
    });

    it('drills into a selected group on pointer up without affecting drag start', () => {
      const context = harness(['A'], [hit(['A'], ['A'], 'B')]);

      context.gizmo.onMouseDown(mouseButton(true));
      expect(context.selectedIds()).to.deep.equal(['A']);
      context.gizmo.onMouseUp(mouseButton(false));

      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: ['A'], newSelectedIds: ['B'] },
      ]);
    });

    it('does not drill into a selected group when drag cancels the click session', () => {
      const context = harness(['A'], [hit(['A'], ['A'], 'B')]);

      context.gizmo.onMouseDown(mouseButton(true));
      const canceledUp = mouseButton(false);

      canceledUp.canceled = true;

      context.gizmo.onMouseUp(canceledUp);

      expect(context.selectedIds()).to.deep.equal(['A']);
      expect(context.selectionChanges).to.have.lengthOf(0);
    });

    it('selects a child of the selected group on double-click', () => {
      const context = harness(['A'], [hit(['A'], ['A'], 'B')]);

      context.gizmo.onMouseDown(mouseButton(true, { doubleClick: true }));
      context.gizmo.onMouseUp(mouseButton(false));

      expect(context.selection.commitHoverTarget).not.to.have.been.called();
      expect(context.selectedIds()).to.deep.equal(['B']);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: ['A'], newSelectedIds: ['B'] },
      ]);
    });

    it('clears selection when an unchanged-position follow-up click is classified as a blank double-click', () => {
      const context = harness(['A'], [hit([])]);
      const down = mouseButton(true, { doubleClick: true });

      context.gizmo.onMouseDown(down);

      expect(down.isAccepted()).to.equal(true);
      expect(context.selectedIds()).to.deep.equal([]);
      expect(context.selectionChanges).to.deep.equal([
        { oldSelectedIds: ['A'], newSelectedIds: [] },
      ]);
    });

    it('clears the focused group after clicking blank canvas outside it', () => {
      const context = harness(['A'], [hit([])]);

      context.gizmo.onMouseDown(mouseButton(true));
      context.gizmo.onMouseUp(mouseButton(false));

      expect(context.selection.setFocusedGroup).to.have.been.called.with.exactly(null);
    });

    it('keeps the focused group after clicking blank canvas inside it', () => {
      const context = harness(['A'], [hit([])]);

      context.selection.isPointInFocusedGroup = chai.spy(() => (true));

      context.gizmo.onMouseDown(mouseButton(true));
      context.gizmo.onMouseUp(mouseButton(false));

      expect(context.selection.setFocusedGroup).not.to.have.been.called();
    });
  });
});
