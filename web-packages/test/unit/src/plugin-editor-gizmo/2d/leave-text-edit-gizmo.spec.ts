import { InputEventMouseButton, MouseButton, MouseButtonMask } from '@galacean/effects';
import { restoreTestState } from '../helpers/spies';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

import { LeaveTextEditGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/leave-text-edit-gizmo';

const { expect } = chai;

describe('plugin-editor-gizmo/leave-text-edit-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(10, 20);
    event.globalPosition.set(10, 20);
    event.buttonMask = MouseButtonMask.Left;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;

    Object.assign(event, overrides);

    return event;
  }

  describe('State transition Gizmos', () => {
    it('LeaveTextEditGizmo 在画布左键按下时退出 TextEditMode', () => {
      const resetEditMode = chai.spy();
      const owner = { resetEditMode } as unknown as GizmoOwner;
      const gizmo = new LeaveTextEditGizmo(owner);

      const secondary = mouseButton(true, { buttonIndex: MouseButton.Right });

      gizmo.onMouseDown(secondary);
      expect(secondary.isAccepted()).to.equal(false);
      const primary = mouseButton(true);

      gizmo.onMouseDown(primary);
      expect(primary.isAccepted()).to.equal(true);
      expect(resetEditMode).to.have.been.called.once;
    });
  });
});
