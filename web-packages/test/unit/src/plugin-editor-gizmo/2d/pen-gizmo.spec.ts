import { InputEventKey, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { PenGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/pen-gizmo';
import type { GeometryGizmoHost, GeometryPathTarget, PenPathData, PenToolState, ShapeDrawingActionEvent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { PenEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes/pen-edit-mode';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { penConfig, selectionSnapConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { createPenEditContext } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/pen-edit-context';
import { toColor } from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';
import type { Control } from '@galacean/effects-plugin-gui';

const { expect } = chai;

describe('plugin-editor-gizmo/pen-gizmo', () => {
  function mouseButton (x: number, y: number, pressed: boolean): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonIndex = MouseButton.Left;
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    event.pressed = pressed;

    return event;
  }

  function createHarness (options: { path?: PenPathData, mode?: PenToolState, zoom?: number, preserveTarget?: boolean, snapping?: boolean } = {}) {
    const path: PenPathData = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      easingIns: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      easingOuts: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      shapes: [{
        close: false,
        indexes: [
          { point: 0, easingIn: 0, easingOut: 0 },
          { point: 1, easingIn: 1, easingOut: 1 },
        ],
      }],
    };
    const configs = new ConfigManager();

    configs.set(selectionSnapConfig, { enabled: options.snapping ?? false });
    const events: ShapeDrawingActionEvent[] = [];
    const target: { value: GeometryPathTarget | undefined } = { value: options.mode === 'create' && !options.preserveTarget ? undefined
      : { itemId: 'shape', path: options.path ?? path } };
    const zoom = options.zoom ?? 1;
    const owner = {
      emit: (_name: string, event: ShapeDrawingActionEvent) => events.push(event),
      rebuildGizmos: () => {},
      getSelection: () => ({ commitSelectedItems: () => {} }),
      getConfigManager: () => configs,
      getSnapManager: () => snap,
      getMousePosition: () => new Vector2(),
      setCursor: () => {},
    } as unknown as GizmoOwner;
    const snap = new SnapManager(owner);
    const host = {
      canEdit: () => true,
      readPath: () => target.value,
      viewToLocal: (point: Vector2) => point.clone().multiply(1 / zoom),
      localToView: (point: { x: number, y: number }) => new Vector2(point.x * zoom, point.y * zoom),
    } as GeometryGizmoHost;

    return { gizmo: new PenGizmo(owner, host, options.mode ?? 'edit', undefined, options.preserveTarget), owner, host, events, target, snap };
  }

  function click (gizmo: PenGizmo, x: number, y: number, shift = false): void {
    const down = mouseButton(x, y, true);

    down.shiftPressed = shift;
    gizmo.onMouseDown(down);
    gizmo.onMouseUp(mouseButton(x, y, false));
  }

  it('clears selected points and segments when clicking blank canvas in edit mode', () => {
    const { gizmo } = createHarness();

    click(gizmo, 0, 0);
    expect(gizmo.selectedInfo).to.deep.equal({ shape: 0, point: 0 });
    expect(gizmo.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 0 }]);

    click(gizmo, 200, 200);
    expect(gizmo.selectedInfo).to.equal(undefined);
    expect(gizmo.selectedPointsInfo).to.deep.equal([]);

    click(gizmo, 25, 0);
    expect(gizmo.selectedInfo).to.equal(undefined);
    expect(gizmo.selectedPointsInfo).to.deep.equal([
      { shape: 0, point: 0 },
      { shape: 0, point: 1 },
    ]);

    click(gizmo, 200, 200);
    expect(gizmo.selectedInfo).to.equal(undefined);
    expect(gizmo.selectedPointsInfo).to.deep.equal([]);
  });

  function drag (gizmo: PenGizmo, x: number, y: number): void {
    const event = new InputEventMouseMotion();

    event.position.set(x, y);
    event.buttonMask = MouseButtonMask.Left;
    event.pressed = true;
    gizmo.onMouseDrag(event);
  }

  function key (gizmo: PenGizmo, keycode: string): void {
    const event = new InputEventKey();

    event.keycode = keycode;
    gizmo.onKeyDown(event);
  }

  for (const zoom of [0.5, 3]) {
    it(`includes the release position and boundary nodes in a lasso at zoom ${zoom}`, () => {
      const { gizmo, target } = createHarness({ zoom });

      target.value!.path.points = [{ x: 20, y: 80 }, { x: 0, y: 40 }];
      gizmo.setLassoMode(true);
      gizmo.onMouseDown(mouseButton(0, 0, true));
      drag(gizmo, 100 * zoom, 0);
      drag(gizmo, 100 * zoom, 100 * zoom);
      gizmo.onMouseUp(mouseButton(0, 100 * zoom, false));
      expect(gizmo.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 0 }, { shape: 0, point: 1 }]);
    });
  }

  it('edits visible handles on any selected node after a lasso', () => {
    const { gizmo, target, events } = createHarness();

    target.value!.path.easingOuts[1] = { x: 0, y: 30 };
    gizmo.setLassoMode(true);
    gizmo.onMouseDown(mouseButton(-10, -10, true));
    drag(gizmo, 110, -10);
    drag(gizmo, 110, 50);
    drag(gizmo, -10, 50);
    gizmo.onMouseUp(mouseButton(-10, -10, false));
    gizmo.setLassoMode(false);
    gizmo.onMouseDown(mouseButton(100, 30, true));
    drag(gizmo, 100, 60);
    gizmo.onMouseUp(mouseButton(100, 60, false));
    expect(events.at(-1)!.edit!.path.easingOuts[1]).to.deep.equal({ x: 0, y: 60 });
  });

  it('selects and drags lassoed anchors even when a handle overlaps an anchor', () => {
    const { gizmo, target, events } = createHarness();

    target.value!.path.easingOuts[0] = { x: 100, y: 0 };
    gizmo.setLassoMode(true);
    gizmo.onMouseDown(mouseButton(-10, -10, true));
    drag(gizmo, 110, -10);
    drag(gizmo, 110, 10);
    drag(gizmo, -10, 10);
    gizmo.onMouseUp(mouseButton(-10, -10, false));
    expect(gizmo.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 0 }, { shape: 0, point: 1 }]);
    gizmo.setLassoMode(false);
    gizmo.onMouseDown(mouseButton(100, 0, true));
    expect(gizmo.selectedInfo).to.deep.equal({ shape: 0, point: 1 });
    drag(gizmo, 100, 20);
    gizmo.onMouseUp(mouseButton(100, 20, false));
    expect(events.at(-1)!.edit!.path.points).to.deep.equal([{ x: 0, y: 20 }, { x: 100, y: 20 }]);
    expect(events.at(-1)!.edit!.path.easingOuts[0]).to.deep.equal({ x: 100, y: 0 });
  });

  it('keeps a nearby handle editable when it is closer than an anchor', () => {
    const { gizmo, target, events } = createHarness();

    target.value!.path.easingOuts[0] = { x: 97, y: 0 };
    gizmo.setSelectedPoint({ shape: 0, point: 0 });
    gizmo.onMouseDown(mouseButton(97, 0, true));
    drag(gizmo, 90, 30);
    gizmo.onMouseUp(mouseButton(90, 30, false));
    expect(events.at(-1)!.edit!.path.easingOuts[0]).to.deep.equal({ x: 90, y: 30 });
    expect(events.at(-1)!.edit!.path.points[1]).to.deep.equal({ x: 100, y: 0 });
  });

  it('draws selected anchors over overlapping handles and hides zero-length handles', () => {
    const { gizmo, target, owner } = createHarness();
    const fills: { x: number, y: number, color: unknown }[] = [];
    const control = {
      drawBezier: () => {}, drawLine: () => {}, drawPolyline: () => {}, drawCircle: () => {},
      fillCircle: (x: number, y: number, _radius: number, color: unknown) => fills.push({ x, y, color }),
    } as unknown as Control;

    target.value!.path.easingOuts[0] = { x: 100, y: 0 };
    gizmo.setSelectedPoints([{ shape: 0, point: 0 }, { shape: 0, point: 1 }]);
    gizmo.draw(control);
    const atAnchor = fills.filter(fill => fill.x === 100 && fill.y === 0);

    expect(atAnchor).to.have.lengthOf(2);
    expect(atAnchor.at(-1)!.color).to.equal(toColor(owner.getConfigManager().get(penConfig).selectedPointColor));
    expect(fills.filter(fill => fill.x === 0 && fill.y === 0)).to.have.lengthOf(1);
  });

  function triangle (close = true): PenPathData {
    return {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      easingIns: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      easingOuts: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      shapes: [{ close, indexes: [0, 1, 2].map(point => ({ point, easingIn: point, easingOut: point })) }],
    };
  }

  for (const selection of [[], [{ shape: 0, point: 0 }, { shape: 0, point: 2 }]]) {
    it(`starts an independent subpath after edit-to-create with ${selection.length} selected anchors`, () => {
      const path = triangle();
      const { owner, host, events } = createHarness({ path });
      const mode = new PenEditMode(owner, host, 'edit');
      const editing = mode.createGizmos()[0];

      editing.setSelectedPoints(selection);
      mode.enterCreate(true);
      const creating = mode.createGizmos()[0];

      editing.dispose();
      click(creating, 250, 150);
      const edited = events.at(-1)!.edit!.path;
      const first = edited.shapes[1].indexes;

      expect(edited.shapes[0]).to.deep.equal(path.shapes[0]);
      expect(first).to.have.lengthOf(1);
      expect(first[0].point).to.equal(3);
      expect(edited.points[first[0].point]).to.deep.equal({ x: 250, y: 150 });
      expect(first[0].easingIn).to.be.greaterThan(2);
      expect(first[0].easingOut).to.be.greaterThan(2);
      creating.onCancel('pointer');
      expect(events.at(-1)!.edit!.before).to.deep.equal(path);
      expect(creating.selectedPointsInfo).to.deep.equal([]);
    });
  }

  it('ignores an old primary anchor when there is no actual anchor selection', () => {
    const { owner, host, events } = createHarness({ path: triangle() });
    const context = createPenEditContext();

    context.selected = { shape: 0, index: 0, part: 'point' };
    context.target = 'shape';
    const gizmo = new PenGizmo(owner, host, 'create', undefined, true, context);

    click(gizmo, 250, 150);
    expect(events.at(-1)!.edit!.path.shapes[1].indexes).to.have.lengthOf(1);
  });

  it('does not treat a selected control handle as an anchor for continuation', () => {
    const path = triangle();

    path.easingOuts[0] = { x: 20, y: 30 };
    const { owner, host, events } = createHarness({ path });
    const mode = new PenEditMode(owner, host, 'edit');
    const editing = mode.createGizmos()[0];

    editing.setSelectedPoint({ shape: 0, point: 0 });
    click(editing, 20, 30);
    mode.enterCreate(true);
    const creating = mode.createGizmos()[0];

    editing.dispose();
    click(creating, 250, 150);
    expect(events.at(-1)!.edit!.path.shapes[1].indexes).to.have.lengthOf(1);
  });

  it('leaves lasso mode when entering creation and starts an independent path', () => {
    const { owner, host, events } = createHarness({ path: triangle() });
    const mode = new PenEditMode(owner, host, 'edit');
    const editing = mode.createGizmos()[0];

    mode.setLassoMode(true);
    editing.onMouseDown(mouseButton(200, 100, true));
    drag(editing, 250, 150);
    mode.enterCreate(true);
    const creating = mode.createGizmos()[0];

    editing.dispose();
    expect(mode.lassoMode).to.equal(false);
    click(creating, 250, 150);
    expect(events.at(-1)!.edit!.path.shapes[1].indexes).to.have.lengthOf(1);
  });

  for (const source of [{ close: true, point: 0 }, { close: false, point: 1 }]) {
    it(`branches from one selected ${source.close ? 'closed' : 'interior'} anchor with independent handles`, () => {
      const path = triangle(source.close);
      const { owner, host, events } = createHarness({ path });
      const mode = new PenEditMode(owner, host, 'edit');
      const editing = mode.createGizmos()[0];

      editing.setSelectedPoint({ shape: 0, point: source.point });
      mode.enterCreate(true);
      const creating = mode.createGizmos()[0];

      editing.dispose();
      click(creating, 250, 150);
      const edited = events.at(-1)!.edit!.path;
      const start = edited.shapes[1].indexes[0];

      expect(edited.shapes[0]).to.deep.equal(path.shapes[0]);
      expect(edited.shapes[1].indexes).to.have.lengthOf(2);
      expect(start.point).to.equal(source.point);
      expect(start.easingIn).not.to.equal(path.shapes[0].indexes[source.point].easingIn);
      expect(start.easingOut).not.to.equal(path.shapes[0].indexes[source.point].easingOut);
      expect(edited.points[edited.shapes[1].indexes[1].point]).to.deep.equal({ x: 250, y: 150 });
    });
  }

  for (const point of [0, 2]) {
    it(`continues an open path from selected endpoint ${point} after edit-to-create`, () => {
      const { owner, host, events } = createHarness({ path: triangle(false) });
      const mode = new PenEditMode(owner, host, 'edit');
      const editing = mode.createGizmos()[0];

      editing.setSelectedPoint({ shape: 0, point });
      mode.enterCreate(true);
      const creating = mode.createGizmos()[0];

      editing.dispose();
      click(creating, 250, 150);
      const edited = events.at(-1)!.edit!.path;

      expect(edited.shapes).to.have.lengthOf(1);
      expect(edited.shapes[0].indexes).to.have.lengthOf(4);
      const added = point === 0 ? edited.shapes[0].indexes[0] : edited.shapes[0].indexes[3];

      expect(edited.points[added.point]).to.deep.equal({ x: 250, y: 150 });
    });
  }

  it('clears the previous creation origin after closing and switching modes again', () => {
    const { owner, host, target, events } = createHarness({ path: triangle(false) });
    const mode = new PenEditMode(owner, host, 'edit');
    const editing = mode.createGizmos()[0];

    editing.setSelectedPoint({ shape: 0, point: 0 });
    mode.enterCreate(true);
    const closing = mode.createGizmos()[0];

    editing.dispose();
    click(closing, 100, 100);
    target.value!.path = events.at(-1)!.edit!.path;
    mode.restartCreate();
    mode.enterEdit();
    mode.enterCreate(true);
    const creating = mode.createGizmos()[0];

    closing.dispose();
    click(creating, 250, 150);
    expect(events.at(-1)!.edit!.path.shapes[0].close).to.equal(true);
    expect(events.at(-1)!.edit!.path.shapes[1].indexes).to.have.lengthOf(1);
  });

  it('snaps node edits to handles in the same element and ignores external targets and guides', () => {
    const { gizmo, host, target, snap, events } = createHarness({ snapping: true });

    target.value!.path.easingIns[1] = { x: -20, y: 30 };
    host.snapPoints = () => [new Vector2(83, 33)];
    snap.registerGuideProvider(() => [{ axis: 'x', coordinate: 82 }, { axis: 'y', coordinate: 32 }]);
    gizmo.onMouseDown(mouseButton(0, 0, true));
    drag(gizmo, 83, 33);
    expect(events.at(-1)!.edit!.path.points[0]).to.deep.equal({ x: 80, y: 30 });
  });

  it('does not snap a moving selection to its own nodes or attached handles', () => {
    const { gizmo, events } = createHarness({ snapping: true });

    gizmo.setSelectedPoints([{ shape: 0, point: 0 }, { shape: 0, point: 1 }]);
    gizmo.onMouseDown(mouseButton(0, 0, true));
    drag(gizmo, 98, 2);
    const points = events.at(-1)!.edit!.path.points;

    expect(points).to.deep.equal([{ x: 98, y: 2 }, { x: 198, y: 2 }]);
  });

  it('snaps handle edits to stationary controls in the current element', () => {
    const { gizmo, target, host, snap, events } = createHarness({ snapping: true });

    target.value!.path.points[1] = { x: 100, y: 100 };
    target.value!.path.easingOuts[0] = { x: 20, y: 30 };
    target.value!.path.easingIns[1] = { x: -40, y: -50 };
    host.snapPoints = () => [new Vector2(62, 53)];
    snap.registerGuideProvider(() => [{ axis: 'x', coordinate: 62 }, { axis: 'y', coordinate: 53 }]);
    click(gizmo, 0, 0);
    gizmo.onMouseDown(mouseButton(20, 30, true));
    drag(gizmo, 62, 53);
    const edited = events.at(-1)!.edit!.path;

    expect(edited.easingOuts[0]).to.deep.equal({ x: 60, y: 50 });
    expect(edited.easingIns[0]).to.deep.equal({ x: -60, y: -50 });
  });

  it('does not stick to a dragged handle on successive pointer updates', () => {
    const { gizmo, target, events } = createHarness({ snapping: true });

    target.value!.path.easingOuts[0] = { x: 20, y: 30 };
    click(gizmo, 0, 0);
    gizmo.onMouseDown(mouseButton(20, 30, true));
    drag(gizmo, 22, 32);
    drag(gizmo, 24, 34);
    expect(events.at(-1)!.edit!.path.easingOuts[0]).to.deep.equal({ x: 24, y: 34 });
  });

  it('Shift deselection clears the primary point and cannot delete or drag it', () => {
    const { gizmo, events } = createHarness();

    click(gizmo, 0, 0);
    click(gizmo, 0, 0, true);
    const count = events.length;

    expect(gizmo.selectedInfo).to.equal(undefined);
    expect(gizmo.selectedPointsInfo).to.deep.equal([]);
    drag(gizmo, 50, 0);
    key(gizmo, 'Delete');
    expect(events).to.have.lengthOf(count);

    click(gizmo, 0, 0);
    click(gizmo, 100, 0, true);
    click(gizmo, 0, 0, true);
    expect(gizmo.selectedInfo).to.deep.equal({ shape: 0, point: 1 });
    expect(gizmo.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 1 }]);
  });

  it('angle mode preserves the original opposite length when detaching shared handles', () => {
    const path: PenPathData = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      easingIns: [{ x: -5, y: 0 }],
      easingOuts: [{ x: 20, y: 0 }],
      shapes: [{ close: false, indexes: [
        { point: 0, easingIn: 0, easingOut: 0 }, { point: 1, easingIn: 0, easingOut: 0 },
      ] }],
    };
    const { gizmo, events } = createHarness({ path });

    gizmo.setHandleMirrorMode('angle');
    click(gizmo, 0, 0);
    gizmo.onMouseDown(mouseButton(20, 0, true));
    drag(gizmo, 0, 20);
    drag(gizmo, 0, 40);
    const edited = events.at(-1)!.edit!.path;
    const first = edited.shapes[0].indexes[0];
    const second = edited.shapes[0].indexes[1];
    const opposite = edited.easingIns[first.easingIn];

    expect(Math.hypot(opposite.x, opposite.y)).to.equal(5);
    expect(opposite.y).to.equal(-5);
    expect(edited.easingIns[second.easingIn]).to.deep.equal({ x: -5, y: 0 });
    expect(edited.easingOuts[second.easingOut]).to.deep.equal({ x: 20, y: 0 });
  });

  for (const zoom of [1, 10]) {
    it(`hits the full visible segment at zoom ${zoom} with a pixel-sized threshold`, () => {
      const { gizmo, target } = createHarness({ zoom });

      target.value!.path.points[1].x = 1024;
      click(gizmo, 500 * zoom, 7);
      expect(gizmo.selectedPointsInfo).to.have.lengthOf(2);
      click(gizmo, 500 * zoom, 9);
      expect(gizmo.selectedPointsInfo).to.deep.equal([]);
    });

    it(`hits curved segments between parameter samples at zoom ${zoom}`, () => {
      const { gizmo, target } = createHarness({ zoom });

      target.value!.path.easingOuts[0] = { x: 0, y: 300 };
      target.value!.path.easingIns[1] = { x: 0, y: 300 };
      click(gizmo, 15.625 * zoom, 168.75 * zoom);
      expect(gizmo.selectedPointsInfo).to.have.lengthOf(2);
    });
  }

  it('appends a dragged node without occupying missing handles on existing nodes', () => {
    const path: PenPathData = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
      easingIns: [], easingOuts: [],
      shapes: [{ close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: point, easingOut: point })) }],
    };
    const { gizmo, events } = createHarness({ path, mode: 'create', preserveTarget: true });

    click(gizmo, 200, 0);
    gizmo.onMouseDown(mouseButton(300, 0, true));
    drag(gizmo, 300, 40);
    gizmo.onMouseUp(mouseButton(300, 40, false));
    const edited = events.at(-1)!.edit!.path;
    const indexes = edited.shapes[0].indexes;

    expect(indexes).to.have.lengthOf(4);
    expect(edited.easingOuts[indexes[3].easingOut]).to.deep.equal({ x: 0, y: 40 });
    for (const index of indexes.slice(0, 3)) {
      expect(edited.easingIns[index.easingIn] ?? { x: 0, y: 0 }).to.deep.equal({ x: 0, y: 0 });
      expect(edited.easingOuts[index.easingOut] ?? { x: 0, y: 0 }).to.deep.equal({ x: 0, y: 0 });
    }
  });

  it('detaches shared handles without occupying another node\'s missing handles', () => {
    const path: PenPathData = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
      easingIns: [{ x: -20, y: 0 }], easingOuts: [{ x: 20, y: 0 }],
      shapes: [{ close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: point === 2 ? 1 : 0, easingOut: point === 2 ? 1 : 0 })) }],
    };
    const { gizmo, events } = createHarness({ path });

    click(gizmo, 0, 0);
    gizmo.onMouseDown(mouseButton(20, 0, true));
    drag(gizmo, 0, 40);
    gizmo.onMouseUp(mouseButton(0, 40, false));
    const edited = events.at(-1)!.edit!.path;
    const [first, second, third] = edited.shapes[0].indexes;

    expect(edited.easingOuts[first.easingOut]).to.deep.equal({ x: 0, y: 40 });
    expect(edited.easingOuts[second.easingOut]).to.deep.equal({ x: 20, y: 0 });
    expect(edited.easingIns[third.easingIn] ?? { x: 0, y: 0 }).to.deep.equal({ x: 0, y: 0 });
    expect(edited.easingOuts[third.easingOut] ?? { x: 0, y: 0 }).to.deep.equal({ x: 0, y: 0 });
  });

  it('continues from the same open endpoint and closes only on the other endpoint', () => {
    const path: PenPathData = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
      easingIns: [{ x: 0, y: 0 }], easingOuts: [{ x: 0, y: 0 }],
      shapes: [{ close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: 0, easingOut: 0 })) }],
    };
    const { gizmo, events } = createHarness({ path, mode: 'create', preserveTarget: true });

    click(gizmo, 0, 0);
    click(gizmo, 0, 0);
    expect(events.at(-1)!.phase).to.equal('start');
    expect(events.at(-1)!.edit!.path.shapes[0].close).to.equal(false);
    click(gizmo, 0, 50);
    expect(events.at(-1)!.edit!.path.shapes[0].indexes).to.have.lengthOf(4);

    const other = createHarness({ path, mode: 'create', preserveTarget: true });

    click(other.gizmo, 0, 0);
    click(other.gizmo, 200, 0);
    expect(other.events.at(-1)!.phase).to.equal('commit');
    expect(other.events.at(-1)!.edit!.path.shapes[0].close).to.equal(true);
  });

  for (const revisionChanged of [false, true]) {
    it(`restores editable geometry after cancel (revision changed: ${revisionChanged})`, () => {
      const { gizmo, events, target } = createHarness();

      gizmo.onMouseDown(mouseButton(0, 0, true));
      drag(gizmo, 30, 0);
      if (revisionChanged) {
        target.value!.revision = 2;
        target.value!.path.points[0].x = 40;
      }
      gizmo.onCancel('pointer');
      expect(events.at(-1)!.phase).to.equal('cancel');
      expect(events.at(-1)!.edit!.before.points[0].x).to.equal(0);
      gizmo.onUpdate();
      const x = revisionChanged ? 40 : 0;

      gizmo.onMouseDown(mouseButton(x, 0, true));
      drag(gizmo, x + 10, 0);
      gizmo.onMouseUp(mouseButton(x + 10, 0, false));
      expect(events.at(-1)!.phase).to.equal('commit');
      expect(events.at(-1)!.edit!.path.points[0].x).to.equal(x + 10);
    });
  }

  it('preserves segment selection across rebuilding and clears it for a different target', () => {
    const { owner, host, target } = createHarness();
    const mode = new PenEditMode(owner, host, 'edit');
    const first = mode.createGizmos()[0];

    click(first, 25, 0);
    const second = mode.createGizmos()[0];

    first.dispose();
    expect(second.selectedInfo).to.equal(undefined);
    expect(second.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 0 }, { shape: 0, point: 1 }]);
    target.value!.itemId = 'other';
    const third = mode.createGizmos()[0];

    second.dispose();
    expect(third.selectedPointsInfo).to.deep.equal([]);
  });

  it('reloads an idle target without revision when creating a new projection', () => {
    const { owner, host, target, events } = createHarness();
    const mode = new PenEditMode(owner, host, 'edit');
    const first = mode.createGizmos()[0];

    click(first, 0, 0);
    target.value!.path.points[0].x = 40;
    const second = mode.createGizmos()[0];

    first.dispose();
    expect(second.selectedPointsInfo).to.deep.equal([{ shape: 0, point: 0 }]);
    second.onMouseDown(mouseButton(40, 0, true));
    drag(second, 50, 0);
    second.onMouseUp(mouseButton(50, 0, false));
    expect(events.at(-1)!.edit!.before.points[0].x).to.equal(40);
    expect(events.at(-1)!.edit!.path.points[0].x).to.equal(50);
  });
});
