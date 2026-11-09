import { InputEventKey, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, type Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { RulerGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/ruler/ruler-gizmo';
import { toColor } from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';
import { GestureCursorType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/cursor';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { ConfigManager, rulerConfig, selectionSnapConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { restoreTestState } from '../helpers/spies';

const { expect } = chai;

type RulerRectShape = {
  x: number,
  y: number,
  width: number,
  height: number,
};

type RulerLayoutShape = {
  outerRect: RulerRectShape,
  contentRect: RulerRectShape,
  rulerSize: number,
};

type RulerHitRegionShape = {
  top: RulerRectShape,
  left: RulerRectShape,
};

type RulerInternals = {
  _owner: {
    setCursor: (cursor: { type: GestureCursorType, angle: number }) => void,
  },
  getRulerTickLabelBox: (
    control: Control,
    layout: RulerLayoutShape,
    direction: 'horizontal' | 'vertical',
    location: number,
    text: string,
  ) => RulerRectShape,
  getRulerHitRegion: (outer: RulerRectShape, content: RulerRectShape) => RulerHitRegionShape,
  drawRulerBoundary: (control: Control, layout: RulerLayoutShape, color: ReturnType<typeof toColor>) => void,
  getGuidePositionLayout: (
    control: Control,
    layout: RulerLayoutShape,
    content: RulerRectShape,
    guides: { horizontal: number[], vertical: number[] },
  ) => { text: string } | undefined,
  setGuideCursor: (direction: 'horizontal' | 'vertical') => void,
};

describe('plugin-editor-gizmo/ruler-gizmo', () => {
  afterEach(restoreTestState);

  function createInternals (): RulerInternals {
    return Object.create(RulerGizmo.prototype) as RulerInternals;
  }

  function mouseButton (x: number, y: number, pressed: boolean, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonIndex = MouseButton.Left;
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    event.pressed = pressed;
    Object.assign(event, overrides);

    return event;
  }

  function mouseMotion (x: number, y: number, overrides: Partial<InputEventMouseMotion> = {}): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = MouseButtonMask.Left;
    event.pressed = true;
    Object.assign(event, overrides);

    return event;
  }

  function createHarness (): {
    gizmo: RulerGizmo,
    config: ConfigManager,
    snapManager: SnapManager,
    actions: { start: unknown[], update: unknown[], commit: unknown[] },
  } {
    const config = new ConfigManager();
    const actions = { start: [], update: [], commit: [] } as { start: unknown[], update: unknown[], commit: unknown[] };
    const engine = {
      sceneServer: { compositions: [{ items: [] }] },
      canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
    } as unknown as Engine;
    const selection = { getSelectedPlayerItems: () => [] };
    const owner = {
      emit: (event: string, data: unknown) => {
        if (event === 'actionstart') { actions.start.push(data); }
        if (event === 'actionupdate') { actions.update.push(data); }
        if (event === 'actioncommit') { actions.commit.push(data); }
      },
      getConfigManager: () => config,
      getSnapManager: () => snapManager,
      getSelection: () => selection,
      getEngine: () => engine,
      getMousePosition: () => new Vector2(100, 40),
      setCursor: () => {},
    } as unknown as GizmoOwner;

    const snapManager = new SnapManager(owner);

    return { gizmo: new RulerGizmo(owner), config, snapManager, actions };
  }

  it('uses the same edge and axis offsets for both ruler label directions', () => {
    const internals = createInternals();
    const control = {
      measureText: () => ({ width: 18, lineHeight: 10 }),
    } as unknown as Control;
    const layout: RulerLayoutShape = {
      outerRect: { x: 10, y: 20, width: 300, height: 200 },
      contentRect: { x: 30, y: 40, width: 280, height: 180 },
      rulerSize: 20,
    };

    expect(internals.getRulerTickLabelBox(control, layout, 'vertical', 100, '100')).to.deep.equal({
      x: 103,
      y: 21,
      width: 18,
      height: 10,
    });
    expect(internals.getRulerTickLabelBox(control, layout, 'horizontal', 100, '100')).to.deep.equal({
      x: 11,
      y: 103,
      width: 10,
      height: 18,
    });
  });

  it('applies the ruler value scale to labels without changing guide coordinates', () => {
    const context = createHarness();
    const internals = context.gizmo as unknown as RulerInternals & {
      selected: { direction: 'horizontal', index: number },
    };
    const layout: RulerLayoutShape = {
      outerRect: { x: 0, y: 0, width: 800, height: 600 },
      contentRect: { x: 20, y: 20, width: 780, height: 580 },
      rulerSize: 20,
    };
    const control = {
      measureText: () => ({ width: 24, lineHeight: 10 }),
    } as unknown as Control;

    context.gizmo.setRuler({ horizontal: [40], vertical: [] });
    internals.selected = { direction: 'horizontal', index: 0 };
    context.config.set(rulerConfig, { rulerValueScale: 10 });

    const position = internals.getGuidePositionLayout(control, layout, layout.contentRect, context.gizmo.guides);

    expect(position?.text).to.equal('400');
    expect(context.gizmo.selectedGuide?.value).to.equal(40);
  });

  it('uses scaled values when drawing ruler tick labels', () => {
    const context = createHarness();
    const labels: string[] = [];
    const control = {
      engine: { renderingServer: { graphics: { pushTransform: () => {}, popTransform: () => {} } } },
      fillRect: () => {},
      drawLine: () => {},
      measureText: (text: string) => ({ width: text.length * 6, lineHeight: 10 }),
      drawText: (_x: number, _y: number, text: string) => labels.push(text),
    } as unknown as Control;

    context.config.set(rulerConfig, { rulerValueScale: 10 });
    context.gizmo.draw(control);

    expect(labels).to.include('1000');
    expect(labels).not.to.include('100');
  });

  it('keeps the complete top and left ruler bands in the hit regions', () => {
    const internals = createInternals();
    const region = internals.getRulerHitRegion(
      { x: 0, y: 0, width: 300, height: 200 },
      { x: 20, y: 20, width: 280, height: 180 },
    );

    expect(region.top).to.deep.equal({ x: 0, y: -2, width: 300, height: 22 });
    expect(region.left).to.deep.equal({ x: -2, y: 0, width: 22, height: 200 });
    expect(region.top.y + region.top.height).to.equal(20);
    expect(region.left.x + region.left.width).to.equal(20);
  });

  it('draws both inner ruler boundary lines', () => {
    const internals = createInternals();
    const lines: Array<[number, number, number, number, unknown, number]> = [];
    const control = {
      drawLine: (...args: [number, number, number, number, unknown, number]) => lines.push(args),
    } as unknown as Control;
    const layout: RulerLayoutShape = {
      outerRect: { x: 0, y: 0, width: 300, height: 200 },
      contentRect: { x: 20, y: 20, width: 280, height: 180 },
      rulerSize: 20,
    };

    internals.drawRulerBoundary(control, layout, toColor(0x6b7280, 1));

    expect(lines.map(([x1, y1, x2, y2, , width]) => [x1, y1, x2, y2, width])).to.deep.equal([
      [0, 20, 300, 20, 1],
      [20, 0, 20, 200, 1],
    ]);
  });

  it('uses axis cursors for the direction in which a guide moves', () => {
    const cursors: Array<{ type: GestureCursorType, angle: number }> = [];
    const internals = Object.assign(createInternals(), {
      _owner: { setCursor: (cursor: { type: GestureCursorType, angle: number }) => cursors.push(cursor) },
    });

    internals.setGuideCursor('horizontal');
    internals.setGuideCursor('vertical');

    expect(cursors).to.deep.equal([
      { type: GestureCursorType.VERTICAL_ARROW, angle: 0 },
      { type: GestureCursorType.HORIZONTAL_ARROW, angle: 0 },
    ]);
  });

  it('creates a guide from the top ruler and emits a complete action lifecycle', () => {
    const context = createHarness();
    const down = mouseButton(100, 10, true);

    context.gizmo.onMouseDown(down);
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    context.gizmo.onMouseUp(mouseButton(100, 40, false));

    expect(down.isAccepted()).to.equal(true);
    expect(context.actions.start).to.have.lengthOf(1);
    expect(context.actions.update).to.have.lengthOf(1);
    expect(context.actions.commit).to.have.lengthOf(1);
    expect(context.gizmo.guides.horizontal).to.deep.equal([40]);
  });

  it('canceled mouseup discards preview but still ends the action', () => {
    const context = createHarness();
    const down = mouseButton(100, 10, true);

    context.gizmo.onMouseDown(down);
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    const up = mouseButton(100, 40, false, { canceled: true });

    context.gizmo.onMouseUp(up);

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(1);
    expect(up.isAccepted()).to.equal(true);
  });

  it('Escape cancels the guide interaction and does not commit the preview', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    const escape = new InputEventKey();

    escape.pressed = true;
    escape.keycode = 'Escape';
    escape.physicalKeycode = 'Escape';
    context.gizmo.onKeyDown(escape);
    context.gizmo.onMouseUp(mouseButton(100, 40, false));

    expect(escape.isAccepted()).to.equal(true);
    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(1);
  });

  it('Delete during a drag cancels the interaction and still ends the action', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    const remove = new InputEventKey();

    remove.pressed = true;
    remove.keycode = 'Delete';
    remove.physicalKeycode = 'Delete';
    context.gizmo.onKeyDown(remove);
    // 取消后 mouseup 不再产生第二次终止事件。
    context.gizmo.onMouseUp(mouseButton(100, 40, false));

    expect(remove.isAccepted()).to.equal(true);
    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(1);
  });

  it('disabling the ruler during a drag ends the action without committing the preview', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    context.config.set(rulerConfig, { enabled: false });

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(1);
  });

  it('global snapping disabled prevents ruler Shift snapping', () => {
    const context = createHarness();
    const prepareGuide = chai.spy.on(context.snapManager, 'prepareGuide');

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.config.set(selectionSnapConfig, { enabled: false });
    context.gizmo.onMouseDrag(mouseMotion(100, 40, { shiftPressed: true }));

    expect(prepareGuide).not.to.have.been.called();
    expect(context.snapManager.result).to.deep.equal({});
  });

  it('Delete removes the selected guide through actioncommit', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseUp(mouseButton(100, 40, false));
    const remove = new InputEventKey();

    remove.pressed = true;
    remove.keycode = 'Delete';
    remove.physicalKeycode = 'Delete';
    context.gizmo.onKeyDown(remove);

    expect(remove.isAccepted()).to.equal(true);
    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(2);
  });
});
