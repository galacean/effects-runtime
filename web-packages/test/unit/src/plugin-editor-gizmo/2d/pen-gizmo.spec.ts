import { InputEventKey, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { PenGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/pen-gizmo';
import type { GeometryGizmoHost, GeometryPathTarget, PenPathData, PenToolState, ShapeDrawingActionEvent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/math';
import { PenEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes/pen-edit-mode';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
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

  function createHarness (options: { path?: PenPathData, mode?: PenToolState, zoom?: number, preserveTarget?: boolean, combineCreateAndEdit?: boolean } = {}) {
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
    const snap = {
      enabled: false,
      result: {},
      clearSnappingVisualizations: () => {},
      preparePoint: () => {},
      reset: () => {},
    };
    const configs = new ConfigManager();
    const events: ShapeDrawingActionEvent[] = [];
    const target: { value: GeometryPathTarget | undefined } = { value: options.mode === 'create' && !options.preserveTarget && !options.combineCreateAndEdit ? undefined
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
    const host = {
      canEdit: () => true,
      readPath: () => target.value,
      viewToLocal: (point: Vector2) => point.clone().multiply(1 / zoom),
      localToView: (point: { x: number, y: number }) => new Vector2(point.x * zoom, point.y * zoom),
    } as GeometryGizmoHost;

    return { gizmo: new PenGizmo(owner, host, options.mode ?? 'edit', undefined, options.preserveTarget, undefined, options.combineCreateAndEdit), owner, host, events, target };
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

  it('inserts into an existing segment in the combined creation and editing tool', () => {
    const { gizmo, events } = createHarness({ mode: 'create', combineCreateAndEdit: true });

    click(gizmo, 50, 0);
    const edited = events.at(-1)!.edit!.path;

    expect(edited.shapes).length(1);
    expect(edited.shapes[0].indexes).length(3);
    expect(edited.points[edited.shapes[0].indexes[1].point]).deep.equals({ x: 50, y: 0 });
  });

  it('previews continuation from the first endpoint when prepending', () => {
    const { gizmo } = createHarness({ mode: 'create', combineCreateAndEdit: true });
    const press = mouseButton(0, 0, true);

    press.doubleClick = true;
    gizmo.onMouseDown(press);
    gizmo.onMouseUp(mouseButton(0, 0, false));
    const motion = new InputEventMouseMotion();

    motion.position.set(-20, 20);
    gizmo.onMouseMove(motion);
    const lines: number[][] = [];
    const control = {
      drawLine: (...args: number[]) => lines.push(args.slice(0, 4)),
      drawBezier: () => {}, fillCircle: () => {}, drawCircle: () => {},
    } as unknown as Control;

    gizmo.draw(control);
    expect(lines.filter(line => line[2] === -20 && line[3] === 20)).deep.equals([[0, 0, -20, 20]]);
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
