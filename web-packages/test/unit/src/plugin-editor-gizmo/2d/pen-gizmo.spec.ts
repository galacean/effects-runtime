import { InputEventMouseButton, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { PenGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/pen-gizmo';
import type { GeometryGizmoHost, PenPathData } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';

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

  function createHarness (): PenGizmo {
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
    const owner = {
      emit: () => {},
      getConfigManager: () => configs,
      getSnapManager: () => snap,
      getMousePosition: () => new Vector2(),
      setCursor: () => {},
    } as unknown as GizmoOwner;
    const host = {
      canEdit: () => true,
      readPath: () => ({ itemId: 'shape', path, revision: 1 }),
      viewToLocal: (point: Vector2) => point.clone(),
      localToView: (point: { x: number, y: number }) => new Vector2(point.x, point.y),
    } as GeometryGizmoHost;

    return new PenGizmo(owner, host, 'edit');
  }

  function click (gizmo: PenGizmo, x: number, y: number): void {
    gizmo.onMouseDown(mouseButton(x, y, true));
    gizmo.onMouseUp(mouseButton(x, y, false));
  }

  it('clears selected points and segments when clicking blank canvas in edit mode', () => {
    const gizmo = createHarness();

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
});
