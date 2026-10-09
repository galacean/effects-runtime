import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

import { MoveSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/move-selection-gizmo';
import { TransformType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/resize-selection-gizmo';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/selection';
import type { Engine, VFXItem } from '@galacean/effects';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math, type InputEventMouse } from '@galacean/effects';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { FrameManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/frame-manager';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { LoadingManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/move-selection-gizmo', () => {
  afterEach(restoreTestState);

  function mouseMotion (overrides: Partial<InputEventMouseMotion> = {}): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(10, 20);
    event.globalPosition.set(10, 20);
    event.buttonMask = MouseButtonMask.Left;

    Object.assign(event, overrides);
    event.pressed = (overrides.buttonMask ?? MouseButtonMask.Left) !== MouseButtonMask.None;

    return event;
  }

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

  function drag (clientX: number): InputEventMouseMotion {
    return mouseMotion({ position: new math.Vector2(clientX, 20), globalPosition: new math.Vector2(clientX, 20), buttonMask: MouseButtonMask.Left });
  }

  function accepted (event: InputEventMouse, dispatch: () => void): boolean {
    event.clearAccepted();
    dispatch();

    return event.isAccepted();
  }

  function setup (startResult = true, translationResult = true): {
    move: MoveSelectionGizmo,
    owner: GizmoOwner,
    applyTranslation: TestSpy,
    actionStart: TestSpy,
    actionUpdate: TestSpy,
    actionCommit: TestSpy,
    loadingManager: LoadingManager,
  } {
    const applyTranslation = chai.spy(() => translationResult);
    const selectedItem = {
      getInstanceId: () => 'selected',
    } as unknown as VFXItem;
    const engine = {
      sceneServer: { compositions: [{ items: [] }] },
      canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
    } as unknown as Engine;
    const selection = {
      getSelectedIds: () => ['selected'],
      createHitSnapshot: () => ({
        point: { x: 10, y: 20 },
        selectableIds: ['selected'],
        topmostId: 'selected',
        selectedScopeHitIds: startResult ? ['selected'] : [],
      }),
      isPointInSelectedViewBox: () => startResult,
      getSelectedPlayerItems: () => [selectedItem],
      clearHover: chai.spy(),
      commitHoverTarget: chai.spy(),
    } as unknown as Selection;
    const configs = new ConfigManager();
    const loadingManager = new LoadingManager();
    const frames = {
      updateViewBoxes: chai.spy(),
      getParentFrame: () => undefined,
      getViewInfos: () => [],
      findFrameAt: () => undefined,
    } as unknown as FrameManager;
    let selectionTransformKind: 'idle' | 'move' | 'resize' = 'idle';
    const actionStart: TestSpy = chai.spy();
    const actionUpdate: TestSpy = chai.spy();
    const actionCommit: TestSpy = chai.spy();
    const emit: GizmoOwner['emit'] = (event, data) => {
      if (event === 'actionstart') {
        actionStart(data);
      }
      if (event === 'actionupdate') {
        actionUpdate(data);
      }
      if (event === 'actioncommit') {
        actionCommit(data);
      }
    };
    const owner = {
      emit,
      getSelection: () => selection,
      getLoadingManager: () => loadingManager,
      getFrameManager: () => frames,
      getEngine: () => engine,
      getGizmoManager: () => undefined,
      getMousePosition: () => new Vector2(),
      setCursor: chai.spy(),
      getConfigManager: () => configs,
      getSelectionTransformKind: () => selectionTransformKind,
      setSelectionTransformKind: (kind: 'idle' | 'move' | 'resize') => {
        selectionTransformKind = kind;
      },
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    owner.getSnapManager = () => snapManager;

    const move = new MoveSelectionGizmo(owner)

  ;(move as unknown as { applyTranslation: typeof applyTranslation }).applyTranslation = applyTranslation;

    return { move, owner, applyTranslation, actionStart, actionUpdate, actionCommit, loadingManager };
  }

  describe('MoveSelectionGizmo', () => {
    it('loading 元素仍可进入移动并提交位移', () => {
      const context = setup();

      context.loadingManager.add('selected');
      const down = mouseButton(true);
      const dragEvent = drag(14);
      const up = mouseButton(false, { globalPosition: new math.Vector2(14, 20) });

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);
      expect(accepted(dragEvent, () => context.move.onMouseDrag(dragEvent))).to.equal(true);
      expect(accepted(up, () => context.move.onMouseUp(up))).to.equal(true);
      expect(getSpyCalls(context.applyTranslation).some(args => args.length === 1 && args[0]?.['x'] === 4 && args[0]?.['y'] === 0)).to.equal(true);
      expect(context.actionCommit).to.have.been.called.once;
    });

    it('纯 drag 生命周期：Down 建会话、Drag 平移、Up 提交', () => {
      const context = setup();
      const down = mouseButton(true);
      const d1 = drag(14);
      const up = mouseButton(false, { globalPosition: new math.Vector2(15, 20) });

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);
      // mouseMove（hover 相位）no-op：drag 候选不刷 hover
      const moveEvent = mouseMotion();

      expect(accepted(moveEvent, () => context.move.onMouseMove(moveEvent))).to.equal(false);
      // mouseDrag 承载平移
      expect(accepted(d1, () => context.move.onMouseDrag(d1))).to.equal(true);
      expect(context.owner.getSelectionTransformKind()).to.equal('move');
      // hover 由 click 侧 ChangeSelection 在 canceled Up 交接点清理，Move 不重复处理。
      expect(context.owner.getSelection().clearHover).not.to.have.been.called();
      expect(accepted(up, () => context.move.onMouseUp(up))).to.equal(true);
      expect(context.owner.getSelectionTransformKind()).to.equal('idle');

      expect(getSpyCalls(context.applyTranslation).some(args => args.length === 1 && args[0]?.['x'] === 4 && args[0]?.['y'] === 0)).to.equal(true);
      expect(getSpyCalls(context.actionStart).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.TRANSLATION)).to.equal(true);
      expect(getSpyCalls(context.actionUpdate).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.TRANSLATION)).to.equal(true);
      // mouseup 不带 selectedIds（cycle 已移至 ChangeSelection，命令侧只走 transform batch）
      expect(getSpyCalls(context.actionCommit).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.TRANSLATION)).to.equal(true);
      // 会话已 reset：再次 mouseUp / mouseDrag 返 false
      expect(accepted(up, () => context.move.onMouseUp(up))).to.equal(false);
      expect(accepted(d1, () => context.move.onMouseDrag(d1))).to.equal(false);
    });

    it('首个已准入 Drag 立即施加完整位移，不在行为内二次判断阈值', () => {
      const context = setup();
      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);

      const firstDrag = drag(11);

      expect(accepted(firstDrag, () => context.move.onMouseDrag(firstDrag))).to.equal(true);
      expect(getSpyCalls(context.applyTranslation).some(args => args.length === 1 && args[0]?.['x'] === 1 && args[0]?.['y'] === 0)).to.equal(true);
      expect(context.actionUpdate).to.have.been.called.once;
    });

    it('平移未推进一帧时不发 actionupdate', () => {
      const context = setup(true, false);

      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);
      // apply 返 false → 不更新 lastPoint
      const dragEvent = drag(13);
      const up = mouseButton(false, { globalPosition: new math.Vector2(13, 20) });

      expect(accepted(dragEvent, () => context.move.onMouseDrag(dragEvent))).to.equal(true);
      expect(accepted(up, () => context.move.onMouseUp(up))).to.equal(true);
      expect(context.actionUpdate).not.to.have.been.called();
    });

    it('父级归属变化后刷新吸附目标缓存', () => {
      const context = setup();
      const cacheTargets = chai.spy.on(context.owner.getSnapManager(), 'cacheSnapTargetsForSelection');
      const assistedLayout = {
        resolveReparent: chai.spy(() => [{
          type: 'moveIn' as const,
          itemIds: ['selected'],
          targetFrameId: 'frame',
        }]),
        updateAutoLayout: chai.spy(),
      };
      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true)
      ;(context.move as unknown as { assistedLayout: typeof assistedLayout }).assistedLayout = assistedLayout;

      const dragEvent = drag(14);

      expect(accepted(dragEvent, () => context.move.onMouseDrag(dragEvent))).to.equal(true);

      expect(cacheTargets).to.have.been.called.once;
    });

    it('Down replay 建立的移动会话在 Up 收尾', () => {
      const context = setup();
      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);

      const up = mouseButton(false);

      expect(accepted(up, () => context.move.onMouseUp(up))).to.equal(true);
      expect(context.applyTranslation).not.to.have.been.called();
      expect(context.actionStart).to.have.been.called.once;
      expect(context.actionCommit).to.have.been.called.once;
    });

    it('按下落在已选 viewBox 外时不建立会话', () => {
      const context = setup(false);
      const down = mouseButton(true);
      const dragEvent = drag(14);
      const moveEvent = mouseMotion();

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(false);
      expect(accepted(dragEvent, () => context.move.onMouseDrag(dragEvent))).to.equal(false);
      expect(accepted(moveEvent, () => context.move.onMouseMove(moveEvent))).to.equal(false);
    });

    it('重叠元素按下顶层未选元素时，只要 point 落在已选 viewBox 仍可进入拖动', () => {
      const context = setup();

      chai.spy.on(context.owner.getSelection(), 'isPointInSelectedViewBox', () => (true));
      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);
    });

    it('直接冻结 Selection 已归一化的权威选区', () => {
      const context = setup();
      const group = {
        getInstanceId: () => 'group',
        parent: undefined,
      } as unknown as VFXItem;
      const other = {
        getInstanceId: () => 'other',
        parent: undefined,
      } as unknown as VFXItem;

      chai.spy.on(context.owner.getSelection(), 'getSelectedPlayerItems', () => ([group, other]));

      const down = mouseButton(true);

      expect(accepted(down, () => context.move.onMouseDown(down))).to.equal(true);
      expect(getSpyCalls(context.actionStart).some(args => args.length === 1 && args[0]?.['itemIds']?.length === 2 && args[0]?.['itemIds']?.[0] === 'group' && args[0]?.['itemIds']?.[1] === 'other')).to.equal(true);
      expect((context.move as unknown as { selectedItems: VFXItem[] }).selectedItems).to.deep.equal([group, other]);
    });

    it('非左键、双击和 Shift 在输入边界直接让出', () => {
      const context = setup();

      for (const blocked of [
        mouseButton(true, { buttonIndex: MouseButton.Right }),
        mouseButton(true, { doubleClick: true }),
        mouseButton(true, { shiftPressed: true }),
      ]) {
        expect(accepted(blocked, () => context.move.onMouseDown(blocked))).to.equal(false);
      }
      expect(context.applyTranslation).not.to.have.been.called();
    });
  });
});
