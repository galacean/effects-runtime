import { InputEventMouseButton, MouseButton, MouseButtonMask } from '@galacean/effects';
import { restoreTestState } from '../helpers/spies';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection';
import { LeaveEffectsEditGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/leave-effects-edit-gizmo';

const { expect } = chai;

describe('plugin-editor-gizmo/leave-effects-edit-gizmo', () => {
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

  function createFixture (hitIds: string[], pointInScope: boolean) {
    const resetEditMode = chai.spy();
    const selection = {
      hitTest: chai.spy(() => hitIds),
      isPointInEffectsEditScope: chai.spy(() => pointInScope),
    } as unknown as Selection;
    const owner = {
      resetEditMode,
      getSelection: () => selection,
    } as unknown as GizmoOwner;

    return {
      resetEditMode,
      gizmo: new LeaveEffectsEditGizmo(owner),
    };
  }

  describe('LeaveEffectsEditGizmo', () => {
    it('点击特效外部空白区域时退出 EffectsEditMode', () => {
      const { gizmo, resetEditMode } = createFixture([], false);
      const event = mouseButton(true);

      gizmo.onMouseDown(event);

      expect(resetEditMode).to.have.been.called.once;
      expect(event.isAccepted()).to.equal(true);
    });

    ([
      { title: '特效内部空白', hitIds: [], pointInScope: true },
      { title: '其他可命中元素', hitIds: ['outside-item'], pointInScope: false },
    ]).forEach(caseData => {
      const { hitIds, pointInScope } = caseData;

      it(`点击${caseData.title}时保持 EffectsEditMode`, () => {
        const { gizmo, resetEditMode } = createFixture(hitIds, pointInScope);
        const event = mouseButton(true);

        gizmo.onMouseDown(event);

        expect(resetEditMode).not.to.have.been.called();
        expect(event.isAccepted()).to.equal(false);
      });
    });
  });
});
