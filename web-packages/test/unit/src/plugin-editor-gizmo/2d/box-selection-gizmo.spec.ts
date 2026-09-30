import { restoreTestState, getSpyCalls } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math, type InputEventMouse } from '@galacean/effects';
import { spec, type Engine, type VFXItem } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';

import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/selection';
import { BoxSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/box-selection-gizmo';
import { getBoxTransform, getBoxTransformFromBox, Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { FrameManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/frame-manager';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { selectionPreviewConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import type { GizmoSelectionActionEvent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-action';
import * as items from '../../../../../../plugin-packages/editor-gizmo/src/2d/items';

const { expect } = chai;

describe('plugin-editor-gizmo/box-selection-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(10, 20);
    event.globalPosition.set(100, 200);
    event.buttonMask = MouseButtonMask.Left;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;

    Object.assign(event, overrides);

    return event;
  }

  function mouseMotion (overrides: Partial<InputEventMouseMotion> = {}): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(10, 20);
    event.globalPosition.set(100, 200);
    event.buttonMask = MouseButtonMask.Left;

    Object.assign(event, overrides);
    event.pressed = (overrides.buttonMask ?? MouseButtonMask.Left) !== MouseButtonMask.None;

    return event;
  }

  function accepted (event: InputEventMouse, dispatch: () => void): boolean {
    event.clearAccepted();
    dispatch();

    return event.isAccepted();
  }

  function createHarness (initialIds: string[], deferToHitTarget = true) {
    let selectedIds = [...initialIds];
    const selection = {
      interactionStartSelectedIds: [...initialIds],
      ignoreIds: ['sceneRoot'],
      ignoreNames: [],
      hitTest: chai.spy(() => []),
      filterSelectedItems: chai.spy((ids: string[]) => ids),
      resolveMarqueeSelectableItem: chai.spy((item: VFXItem) => items.getEffectsPlayerItemOwner(item) ?? item),
      getSelectedIds: chai.spy(() => selectedIds),
      clearHover: chai.spy(),
      setSelectedIds: chai.spy((ids: string[]) => {
        selectedIds = [...ids];
      }),
      commitSelectedItems: chai.spy((ids: string[]) => {
        const changed = selectedIds.length !== ids.length || selectedIds.some((id, index) => id !== ids[index]);

        selectedIds = [...ids];

        return changed;
      }),
    } as unknown as Selection;
    const engine = {
      sceneServer: { compositions: [{ items: [] }] },
      // getContainerSize 直读 engine.canvas.parentElement 的 offsetWidth/Height。
      canvas: { parentElement: { offsetWidth: TEST_VIEW_SIZE.x, offsetHeight: TEST_VIEW_SIZE.y } },
    } as unknown as Engine;
    const configs = new ConfigManager();
    const frames = new FrameManager({} as unknown as Engine);
    const events: string[] = [];
    const mouseupEvents: { selectedIds: string[], oldSelectedIds: string[] }[] = [];
    const emit: GizmoOwner['emit'] = (event, data) => {
      events.push(event);
      if (event === 'actioncommit') {
        const actionData = data as GizmoSelectionActionEvent;

        mouseupEvents.push({
          selectedIds: [...(actionData.selectedIds)],
          oldSelectedIds: [...(actionData.oldSelectedIds!)],
        });
      }
    };
    const owner = {
      emit,
      getMousePosition: () => new Vector2(),
      getSelection: () => selection,
      getFrameManager: () => frames,
      getViewportNavigation: () => ({} as never),
      isHandToolMode: () => false,
      isMouseButtonPressed: () => false,
      rebuildGizmos: () => {},
      getGizmoManager: () => undefined,
      getEngine: () => engine,
      getConfigManager: () => configs,
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    owner.getSnapManager = () => snapManager;
    const controller = new BoxSelectionGizmo(owner, deferToHitTarget);

    return { controller, owner, selection, engine, configs, events, mouseupEvents, getSelectedIds: () => selectedIds };
  }

  describe('BoxSelectionGizmo', () => {
    it('auxiliary 框选允许从命中元素的位置开始', () => {
      const regular = createHarness(['old']);

      regular.selection.hitTest = chai.spy(() => (['hit']));
      const regularDown = mouseButton(true, { ctrlPressed: true });

      expect(accepted(regularDown, () => regular.controller.onMouseDown(regularDown))).to.equal(false);
      expect(regular.getSelectedIds()).to.deep.equal(['old']);

      const auxiliary = createHarness(['old'], false);

      auxiliary.selection.hitTest = chai.spy(() => (['hit']));
      const auxiliaryDown = mouseButton(true, { ctrlPressed: true });

      expect(accepted(auxiliaryDown, () => auxiliary.controller.onMouseDown(auxiliaryDown))).to.equal(true);
      expect(auxiliary.getSelectedIds()).to.deep.equal([]);
      expect(auxiliary.events).to.deep.equal(['actionstart']);
    });

    it('uses the unified semantic action lifecycle event names', () => {
      const { controller, selection, events, mouseupEvents, getSelectedIds } = createHarness(['old']);

      const down = mouseButton(true);

      expect(accepted(down, () => controller.onMouseDown(down))).to.equal(true);
      expect(getSelectedIds()).to.deep.equal([]);
      const drag = mouseMotion({ globalPosition: new math.Vector2(120, 230) });

      expect(accepted(drag, () => controller.onMouseDrag(drag))).to.equal(true);
      // hover 由 click 侧 ChangeSelection 在 canceled Up 交接点清理，Box 不重复处理。
      expect(selection.clearHover).not.to.have.been.called();
      controller.onMouseUp(mouseButton(false, { }));

      expect(events).to.deep.equal(['actionstart', 'actioncommit']);
      expect(mouseupEvents.at(-1)).to.deep.include({ selectedIds: [], oldSelectedIds: ['old'] });
    });

    it('keeps the interaction-start selection during shift rubber-band selection', () => {
      const { controller, getSelectedIds } = createHarness(['old']);
      const input = mouseButton(true, { shiftPressed: true });

      controller.onMouseDown(input);
      controller.onMouseMove(mouseMotion({ globalPosition: new math.Vector2(120, 230), shiftPressed: true }));

      expect(getSelectedIds()).to.deep.equal(['old']);
    });

    it('首个已准入 Drag 立即画框并原子更新选区', () => {
      const { controller, events, selection, getSelectedIds } = createHarness(['old']);

      // 空白命中（hitTest 返回 []）→ replay Down 建立框选会话。
      const down = mouseButton(true);

      expect(accepted(down, () => controller.onMouseDown(down))).to.equal(true);
      expect(getSelectedIds()).to.deep.equal([]);

      const firstDrag = mouseMotion({ globalPosition: new math.Vector2(101, 201) });

      expect(accepted(firstDrag, () => controller.onMouseDrag(firstDrag))).to.equal(true);
      expect(selection.setSelectedIds).not.to.have.been.called();
      expect(selection.commitSelectedItems).to.have.been.called.exactly(2);
      expect(events).to.deep.equal(['actionstart']);
      //@ts-expect-error fooooooooor test
      expect(controller.overlay.type).to.equal('region');
    });

    it('selects an item as soon as its transformed box intersects the marquee', () => {
      const { controller, engine, getSelectedIds } = createHarness([]);
      const item = {
        type: spec.ItemType.sprite,
        name: 'item',
        children: [],
        getInstanceId: () => 'item-1',
      } as unknown as VFXItem;

      engine.sceneServer.compositions[0].items.push(item);
      let transform = getBoxTransform([
        new Vector2(20, 20),
        new Vector2(110, 20),
        new Vector2(90, 90),
        new Vector2(20, 90),
      ]);

      setItemViewTransform(item, () => transform);
      controller.onMouseDown(mouseButton(true, { position: new math.Vector2(0, 0) }));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));
      expect(getSelectedIds()).to.deep.equal(['item-1']);

      transform = getBoxTransform([
        new Vector2(100, 20),
        new Vector2(180, 20),
        new Vector2(180, 90),
        new Vector2(100, 90),
      ]);
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));
      expect(getSelectedIds()).to.deep.equal(['item-1']);

      transform = getBoxTransform([
        new Vector2(101, 20),
        new Vector2(180, 20),
        new Vector2(180, 90),
        new Vector2(101, 90),
      ]);
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));
      expect(getSelectedIds()).to.deep.equal([]);
    });

    it('treats an Effects subtree as one atomic marquee candidate', () => {
      const { controller, engine, selection, getSelectedIds } = createHarness([]);
      const child = {
        type: spec.ItemType.sprite,
        name: 'effect-child',
        children: [],
        parent: undefined,
        getInstanceId: () => 'effect-child',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const compositionChild = {
        type: spec.ItemType.composition,
        name: 'effect-composition',
        children: [child],
        parent: undefined,
        getInstanceId: () => 'effect-composition',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const effects = {
        type: spec.ItemType.null,
        name: '特效',
        children: [compositionChild],
        parent: undefined,
        getInstanceId: () => 'effects',
        getComponent: () => ({}),
      } as unknown as VFXItem

    ;(compositionChild as VFXItem & { parent?: VFXItem }).parent = effects
      ;(child as VFXItem & { parent?: VFXItem }).parent = compositionChild;

      // 模拟 Effects runtime 的 composition.items：容器与后代可能已经全部扁平暴露。
      engine.sceneServer.compositions[0].items.push(effects, compositionChild, child);
      const viewTransform = getBoxTransform([
        new Vector2(20, 20),
        new Vector2(80, 20),
        new Vector2(80, 80),
        new Vector2(20, 80),
      ]);

      [effects, child].forEach(item => setItemViewTransform(item, viewTransform));

      controller.onMouseDown(mouseButton(true, { position: new math.Vector2(0, 0) }));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));

      expect(getSpyCalls(selection.filterSelectedItems).at(-1)).to.deep.equal([['effects']]);
      expect(getSelectedIds()).to.deep.equal(['effects']);
    });

    it('在 EffectsEditMode 中框选当前特效的内部元素', () => {
      const { controller, engine, selection, getSelectedIds } = createHarness([]);
      const child = {
        type: spec.ItemType.sprite,
        name: 'effect-child',
        children: [],
        parent: undefined,
        getInstanceId: () => 'effect-child',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const compositionChild = {
        type: spec.ItemType.composition,
        name: 'effect-composition',
        children: [child],
        parent: undefined,
        getInstanceId: () => 'effect-composition',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const effects = {
        type: spec.ItemType.null,
        name: '特效',
        children: [compositionChild],
        parent: undefined,
        getInstanceId: () => 'effects',
        getComponent: () => ({}),
      } as unknown as VFXItem

    ;(compositionChild as VFXItem & { parent?: VFXItem }).parent = effects
      ;(child as VFXItem & { parent?: VFXItem }).parent = compositionChild;
      engine.sceneServer.compositions[0].items.push(effects, compositionChild, child);
      selection.resolveMarqueeSelectableItem = chai.spy((item: VFXItem) => (
        item === child ? child : undefined
      ));
      const viewTransform = getBoxTransform([
        new Vector2(20, 20),
        new Vector2(80, 20),
        new Vector2(80, 80),
        new Vector2(20, 80),
      ]);

      [effects, child].forEach(item => setItemViewTransform(item, viewTransform));

      controller.onMouseDown(mouseButton(true, { position: new math.Vector2(0, 0) }));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));

      expect(getSpyCalls(selection.filterSelectedItems).at(-1)).to.deep.equal([['effect-child']]);
      expect(getSelectedIds()).to.deep.equal(['effect-child']);
    });

    it('Frame brushing semantics for children, whole frames, and clipped overflow', () => {
      const { controller, engine, selection, getSelectedIds } = createHarness([]);
      const child = {
        type: spec.ItemType.sprite,
        name: 'frame-child',
        children: [],
        parent: undefined,
        getInstanceId: () => 'frame-child',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const compositionChild = {
        type: spec.ItemType.composition,
        name: 'frame-composition',
        children: [child],
        parent: undefined,
        getInstanceId: () => 'frame-composition',
        getComponent: () => undefined,
      } as unknown as VFXItem;
      const frame = {
        type: spec.ItemType.null,
        name: '画板',
        children: [compositionChild],
        parent: undefined,
        getInstanceId: () => 'frame',
        getComponent: () => ({}),
      } as unknown as VFXItem

    ;(compositionChild as VFXItem & { parent?: VFXItem }).parent = frame
      ;(child as VFXItem & { parent?: VFXItem }).parent = compositionChild;

      // Composition.items 实际返回 sceneRoot.getDescendants()，Frame 与后代会同时出现。
      engine.sceneServer.compositions[0].items.push(frame, compositionChild, child);
      let frameBox = new Box2(new Vector2(20, 20), new Vector2(180, 180));
      let childBox = new Box2(new Vector2(40, 40), new Vector2(80, 80));

      [frame, child].forEach(item => setItemViewTransform(item, () => getBoxTransformFromBox(item === frame ? frameBox : childBox)));

      controller.onMouseDown(mouseButton(true, { position: new math.Vector2(0, 0) }));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));

      // Frame 未被完整包住时，框选进入 Frame 内部可选中其子元素。
      expect(getSpyCalls(selection.filterSelectedItems).at(-1)).to.deep.equal([['frame-child']]);
      expect(getSelectedIds()).to.deep.equal(['frame-child']);

      frameBox = new Box2(new Vector2(20, 20), new Vector2(80, 80));
      childBox = new Box2(new Vector2(30, 30), new Vector2(70, 70));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));

      // 整个 Frame 被框住时只选 Frame，不同时选中子元素。
      expect(getSpyCalls(selection.filterSelectedItems).at(-1)).to.deep.equal([['frame']]);
      expect(getSelectedIds()).to.deep.equal(['frame']);

      frameBox = new Box2(new Vector2(120, 120), new Vector2(180, 180));
      childBox = new Box2(new Vector2(80, 80), new Vector2(140, 140));
      controller.onMouseDrag(mouseMotion({ position: new math.Vector2(100, 100) }));

      // 只框到子元素溢出 Frame 的裁剪部分时不选中。
      expect(getSpyCalls(selection.filterSelectedItems).at(-1)).to.deep.equal([[]]);
      expect(getSelectedIds()).to.deep.equal([]);
    });
  });
});
