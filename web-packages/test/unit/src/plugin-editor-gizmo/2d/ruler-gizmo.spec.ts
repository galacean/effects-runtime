import { InputEventKey, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, type Engine } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { RulerGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/ruler-gizmo';
import { RulerManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/ruler-manager';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { restoreTestState } from '../helpers/spies';

const { expect } = chai;

describe('plugin-editor-gizmo/ruler-gizmo', () => {
  afterEach(restoreTestState);

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
    const rulerManager = new RulerManager();
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
      getRulerManager: () => rulerManager,
      getActiveEditMode: () => ({ id: 'default-selection' }),
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    return { gizmo: new RulerGizmo(owner), snapManager, actions };
  }

  it('creates and moves a guide through the complete action lifecycle', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    context.gizmo.onMouseUp(mouseButton(100, 40, false));

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [40], vertical: [] });
    expect(context.actions.start).to.have.lengthOf(1);
    expect(context.actions.update).to.have.lengthOf(1);
    expect(context.actions.commit).to.have.lengthOf(1);

    context.gizmo.onMouseDown(mouseButton(100, 40, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 60));
    context.gizmo.onMouseUp(mouseButton(100, 60, false));

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [60], vertical: [] });
    expect(context.actions.start).to.have.lengthOf(2);
    expect(context.actions.update).to.have.lengthOf(2);
    expect(context.actions.commit).to.have.lengthOf(2);
  });

  it('cancels an in-progress guide interaction with Escape', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    const escape = new InputEventKey();

    escape.pressed = true;
    escape.keycode = 'Escape';
    escape.physicalKeycode = 'Escape';
    context.gizmo.onKeyDown(escape);

    expect(escape.isAccepted()).to.equal(true);
    expect(context.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
    expect(context.actions.commit).to.have.lengthOf(1);
  });

  it('snaps a dragged guide to a nearby cached target when Shift is held', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.snapManager.cacheSnapTargetBoxes([
      new Box2(new Vector2(0, 44), new Vector2(20, 54)),
    ]);
    context.gizmo.onMouseDrag(mouseMotion(100, 40, { shiftPressed: true }));
    context.gizmo.onMouseUp(mouseButton(100, 40, false, { shiftPressed: true }));

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [44], vertical: [] });
  });

  it('未按 Shift 时保持原始拖拽坐标', () => {
    const context = createHarness();

    context.gizmo.onMouseDown(mouseButton(100, 10, true));
    context.snapManager.cacheSnapTargetBoxes([
      new Box2(new Vector2(0, 44), new Vector2(20, 54)),
    ]);
    context.gizmo.onMouseDrag(mouseMotion(100, 40));
    context.gizmo.onMouseUp(mouseButton(100, 40, false));

    expect(context.gizmo.guides).to.deep.equal({ horizontal: [40], vertical: [] });
  });

  it('释放到画布四边界外会删除当前参考线', () => {
    const horizontal = createHarness();

    horizontal.gizmo.setRuler({ horizontal: [40], vertical: [] });
    horizontal.gizmo.onMouseDown(mouseButton(100, 40, true));
    horizontal.gizmo.onMouseUp(mouseButton(-1, 40, false));
    expect(horizontal.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });

    const vertical = createHarness();

    vertical.gizmo.setRuler({ horizontal: [], vertical: [40] });
    vertical.gizmo.onMouseDown(mouseButton(40, 100, true));
    vertical.gizmo.onMouseUp(mouseButton(40, -1, false));
    expect(vertical.gizmo.guides).to.deep.equal({ horizontal: [], vertical: [] });
  });

  it('deletes the selected guide and emits its final actioncommit', () => {
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
