import { restoreTestState } from '../helpers/spies';
import {
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  MouseButtonMask,
  math,
  type Engine,
} from '@galacean/effects';
import { FocusMode, MouseFilter } from '@galacean/effects-plugin-gui';
import { GizmoViewport } from '../../../../../../plugin-packages/editor-gizmo/src/2d/viewport/gizmo-viewport';

const { expect } = chai;

describe('plugin-editor-gizmo/gizmo-viewport', () => {
  afterEach(restoreTestState);

  describe('GizmoControl', () => {
    it('作为 runtime GUI 输入入口并允许未接受事件继续传递', () => {
      const viewport = new GizmoViewport({} as Engine);

      expect(viewport.mouseFilter).to.equal(MouseFilter.Pass);
      expect(viewport.focusMode).to.equal(FocusMode.Click);
      expect(viewport.mouseForcePassScrollEvents).to.equal(false);
    });

    it('完整转发 Control 鼠标、滚轮和键盘回调', () => {
      const viewport = new GizmoViewport({} as Engine);
      const location = new math.Vector2(10, 20);
      const motion = new InputEventMouseMotion();
      const button = new InputEventMouseButton();
      const key = new InputEventKey();
      const onMouseEnter = chai.spy();
      const onMouseMove = chai.spy();
      const onMouseDrag = chai.spy();
      const onMouseLeave = chai.spy();
      const onMouseWheel = chai.spy();
      const onMouseDown = chai.spy();
      const onMouseUp = chai.spy();
      const onKeyDown = chai.spy();
      const onKeyUp = chai.spy();

      viewport.onMouseEnterCallback = onMouseEnter;
      viewport.onMouseMoveCallback = onMouseMove;
      viewport.onMouseDragCallback = onMouseDrag;
      viewport.onMouseLeaveCallback = onMouseLeave;
      viewport.onMouseWheelCallback = onMouseWheel;
      viewport.onMouseDownCallback = onMouseDown;
      viewport.onMouseUpCallback = onMouseUp;
      viewport.onKeyDownCallback = onKeyDown;
      viewport.onKeyUpCallback = onKeyUp;

      viewport.onMouseEnter(location);
      viewport.onMouseMove(motion);
      viewport.onMouseLeave();
      viewport.onMouseWheel(button);
      button.buttonIndex = MouseButton.Left;
      viewport.onMouseDown(button);

      const dragMotion = new InputEventMouseMotion();

      dragMotion.buttonMask = MouseButtonMask.Left;
      viewport.onMouseMove(dragMotion);
      viewport.onMouseUp(button);
      viewport.onKeyDown(key);
      viewport.onKeyUp(key);

      expect(onMouseEnter).to.have.been.called.with.exactly(location);
      expect(onMouseMove).to.have.been.called.with.exactly(motion);
      expect(onMouseDrag).to.have.been.called.with.exactly(dragMotion);
      expect(onMouseLeave).to.have.been.called.with.exactly();
      expect(onMouseWheel).to.have.been.called.with.exactly(button);
      expect(onMouseDown).to.have.been.called.with.exactly(button);
      expect(onMouseUp).to.have.been.called.with.exactly(button);
      expect(onKeyDown).to.have.been.called.with.exactly(key);
      expect(onKeyUp).to.have.been.called.with.exactly(key);

      viewport.dispose();
      viewport.onMouseEnter(location);
      viewport.onMouseMove(motion);
      viewport.onMouseLeave();
      viewport.onMouseWheel(button);
      viewport.onMouseDown(button);
      viewport.onMouseUp(button);
      viewport.onKeyDown(key);
      viewport.onKeyUp(key);
      viewport.onMouseMove(dragMotion);

      expect(onMouseEnter).to.have.been.called.exactly(1);
      expect(onMouseMove).to.have.been.called.exactly(1);
      expect(onMouseDrag).to.have.been.called.exactly(1);
      expect(onMouseLeave).to.have.been.called.exactly(1);
      expect(onMouseWheel).to.have.been.called.exactly(1);
      expect(onMouseDown).to.have.been.called.exactly(1);
      expect(onMouseUp).to.have.been.called.exactly(1);
      expect(onKeyDown).to.have.been.called.exactly(1);
      expect(onKeyUp).to.have.been.called.exactly(1);
    });

    it('在 Viewport 内维护输入快照和拖拽阈值状态', () => {
      const viewport = new GizmoViewport({} as Engine);
      const down = new InputEventMouseButton();

      viewport.onMouseEnter(new math.Vector2(3, 4));
      expect(viewport.isMouseInside()).to.equal(true);
      expect(viewport.getMousePosition()).to.deep.include({ x: 3, y: 4 });

      down.position.set(10, 20);
      down.globalPosition.set(110, 120);
      down.buttonIndex = MouseButton.Left;
      down.buttonMask = MouseButtonMask.Left;
      down.shiftPressed = true;
      viewport.onMouseDown(down);

      const drag = new InputEventMouseMotion();

      drag.position.set(16, 20);
      drag.globalPosition.set(116, 120);
      drag.buttonMask = MouseButtonMask.Left;
      drag.shiftPressed = true;
      viewport.onMouseMove(drag);

      expect(viewport.isMouseButtonPressed()).to.equal(true);
      expect(viewport.hasCrossedDragThreshold()).to.equal(true);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('position.x', 16);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('position.y', 20);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('globalPosition.x', 116);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('globalPosition.y', 120);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('buttonMask', MouseButtonMask.Left);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('pressed', true);
      expect(viewport.createMouseEventAtCurrentPosition()).to.have.deep.nested.property('shiftPressed', true);

      const up = new InputEventMouseButton();

      up.position.copyFrom(drag.position);
      up.globalPosition.copyFrom(drag.globalPosition);
      up.buttonIndex = MouseButton.Left;
      up.buttonMask = MouseButtonMask.None;
      viewport.onMouseUp(up);
      viewport.onMouseLeave();

      expect(viewport.isMouseButtonPressed()).to.equal(false);
      expect(viewport.hasCrossedDragThreshold()).to.equal(false);
      expect(viewport.isMouseInside()).to.equal(false);
    });

    it('使用 Effects alpha.5 归一化后的 buttonMask 路由并缓存 Move/Drag 状态', () => {
      const viewport = new GizmoViewport({} as Engine);
      const onMouseMove = chai.spy();
      const onMouseDrag = chai.spy();

      viewport.onMouseMoveCallback = onMouseMove;
      viewport.onMouseDragCallback = onMouseDrag;

      const down = new InputEventMouseButton();

      down.position.set(10, 20);
      down.buttonIndex = MouseButton.Left;
      down.buttonMask = MouseButtonMask.Left;
      viewport.onMouseDown(down);

      const drag = new InputEventMouseMotion();

      drag.position.set(16, 20);
      drag.buttonMask = MouseButtonMask.Left;
      viewport.onMouseMove(drag);

      const move = new InputEventMouseMotion();

      move.position.set(17, 20);
      move.buttonMask = MouseButtonMask.None;
      viewport.onMouseMove(move);

      expect(onMouseDrag).to.have.been.called.once;
      expect(onMouseDrag).to.have.been.called.with.exactly(drag);
      expect(onMouseMove).to.have.been.called.once;
      expect(onMouseMove).to.have.been.called.with.exactly(move);
      expect(viewport.isMouseButtonPressed()).to.equal(false);
      expect(viewport.createMouseEventAtCurrentPosition()).to.deep.include({
        buttonMask: MouseButtonMask.None,
        pressed: false,
      });

      const up = new InputEventMouseButton();

      up.position.copyFrom(move.position);
      up.buttonIndex = MouseButton.Left;
      up.buttonMask = MouseButtonMask.None;
      viewport.onMouseUp(up);

      expect(viewport.isMouseButtonPressed()).to.equal(false);
      expect(viewport.hasCrossedDragThreshold()).to.equal(false);
    });

    it('每帧先由 update 转发一次 onUpdate，再由 draw 只负责绘制', () => {
      const viewport = Object.create(GizmoViewport.prototype) as GizmoViewport;
      const order: string[] = [];

      viewport.onUpdateCallback = chai.spy(() => order.push('update'));
      viewport.drawCallBack = chai.spy(() => order.push('draw'));

      for (let frame = 0; frame < 2; frame++) {
        viewport.update(0);
        viewport.draw();
      }

      expect(order).to.deep.equal(['update', 'draw', 'update', 'draw']);
      expect(viewport.onUpdateCallback).to.have.been.called.exactly(2);
      expect(viewport.drawCallBack).to.have.been.called.exactly(2);
    });
  });
});
