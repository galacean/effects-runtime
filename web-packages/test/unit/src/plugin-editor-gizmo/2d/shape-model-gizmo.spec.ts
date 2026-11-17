import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import type { ShapeDrawingActionEvent } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import { ShapeModelGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/shape-model-gizmo';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { shapeConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';

const { expect } = chai;

describe('plugin-editor-gizmo/shape-model-gizmo', () => {
  function mouseButton (x: number, y: number, pressed: boolean): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonIndex = MouseButton.Left;
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    event.pressed = pressed;

    return event;
  }

  function mouseMotion (x: number, y: number): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = MouseButtonMask.Left;
    event.pressed = true;

    return event;
  }

  function createHarness (): { gizmo: ShapeModelGizmo, events: Array<{ name: string, event: ShapeDrawingActionEvent }> } {
    const events: Array<{ name: string, event: ShapeDrawingActionEvent }> = [];
    const context = {};
    const snap = {
      enabled: false,
      clearSnappingVisualizations: () => {},
      preparePoint: () => {},
      reset: () => {},
      result: {},
    };
    const host = {
      canEdit: () => true,
      readPath: () => undefined,
      viewToLocal: (point: Vector2) => point.clone(),
      localToView: (point: { x: number, y: number }) => new Vector2(point.x, point.y),
      contextKey: () => context,
    };
    const configs = new ConfigManager();

    configs.set(shapeConfig, { defaultWidth: 100, defaultHeight: 80, minWidth: 0.1, minHeight: 0.1, minRadius: 0.1 });
    const owner = {
      emit: (name: string, event: ShapeDrawingActionEvent) => {
        if (name === 'actionstart' || name === 'actionupdate' || name === 'actioncommit') {
          events.push({ name, event });
        }
      },
      getSnapManager: () => snap,
      getConfigManager: () => configs,
      setCursor: () => {},
    } as unknown as GizmoOwner;
    const gizmo = new ShapeModelGizmo(owner, host);

    return { gizmo, events };
  }

  it('defers click creation until mouseup', () => {
    const { gizmo, events } = createHarness();

    gizmo.onMouseDown(mouseButton(10, 20, true));
    expect(events).to.have.lengthOf(0);

    gizmo.onMouseUp(mouseButton(10, 20, false));

    expect(events.map(({ name }) => name)).to.deep.equal(['actionstart', 'actioncommit']);
    expect(events[0].event.create).to.deep.include({ kind: 'shape' });
    expect(events[0].event.create?.kind === 'shape' && events[0].event.create.geometry).to.deep.include({
      center: { x: 10, y: 20 },
      width: 100,
      height: 80,
    });
  });

  it('starts a draft on the first drag and updates it afterwards', () => {
    const { gizmo, events } = createHarness();

    gizmo.onMouseDown(mouseButton(10, 20, true));
    gizmo.onMouseDrag(mouseMotion(30, 50));
    gizmo.onMouseDrag(mouseMotion(40, 70));

    expect(events.map(({ name }) => name)).to.deep.equal(['actionstart', 'actionupdate']);

    gizmo.onMouseUp(mouseButton(40, 70, false));
    expect(events.map(({ name }) => name)).to.deep.equal(['actionstart', 'actionupdate', 'actioncommit']);
  });
});
