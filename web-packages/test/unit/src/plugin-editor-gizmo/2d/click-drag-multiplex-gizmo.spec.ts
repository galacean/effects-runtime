import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import type { Gizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

import { ClickDragMultiplexGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/click-drag-multiplex-gizmo';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math, type InputEventMouse } from '@galacean/effects';

const { expect } = chai;

describe('plugin-editor-gizmo/click-drag-multiplex-gizmo', () => {
  afterEach(restoreTestState);

  const owner = {} as GizmoOwner;

  function mouseButton (pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(10, 20);
    event.globalPosition.set(100, 200);
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
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

type SpyCandidate = Gizmo & {
  calls: string[],
  onUpdate: TestSpy,
  draw: TestSpy,
  onMouseDown: TestSpy,
  onMouseDrag: TestSpy,
  onMouseMove: TestSpy,
  onMouseUp: TestSpy,
  dispose: TestSpy,
};

function candidate (
  type: string,
  opts: { down?: boolean, drag?: boolean, move?: boolean, up?: boolean } = {},
): SpyCandidate {
  const calls: string[] = [];

  return {
    type,
    calls,
    onUpdate: chai.spy(() => {
      calls.push('onUpdate');
    }),
    draw: chai.spy(() => {
      calls.push('draw');
    }),
    onMouseDown: chai.spy((e: InputEventMouse) => {
      calls.push('down');
      if (opts.down ?? true) {
        e.accept();
      }
    }),
    // Phase A：click 候选在 drag 相位 decline（不 accept），让 Phase B 晋升 dragWinner
    onMouseDrag: chai.spy((e: InputEventMouse) => {
      calls.push('drag');
      if (opts.drag ?? false) {
        e.accept();
      }
    }),
    onMouseMove: chai.spy((e: InputEventMouse) => {
      calls.push('move');
      if (opts.move ?? true) {
        e.accept();
      }
    }),
    // 记录 canceled 标志（finishClickSideForDrag 置位瞬态），供断言 cancel 分支
    onMouseUp: chai.spy((e: InputEventMouse) => {
      calls.push(e.isCanceled() ? 'up:canceled' : 'up');
      if (opts.up ?? true) {
        e.accept();
      }
    }),
    dispose: chai.spy(),
  } as unknown as SpyCandidate;
}

describe('ClickDragMultiplexGizmo', () => {
  it('Down 只选 clickWinner 不碰 drag；首 Drag 经 Phase B 补发 mouseDown(downSnapshot) 晋升 dragWinner + finishClickSideForDrag', () => {
    const click = candidate('change-selection', { down: true, drag: false });
    const move = candidate('move-selection', { down: true, drag: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move],
    });
    const down = mouseButton(true);
    const dragEvent = mouseMotion({ globalPosition: new math.Vector2(104, 200) });
    const up = mouseButton(false);

    // Down：只 offer click 向量，不 eager 碰 drag 候选
    expect(accepted(down, () => multiplex.onMouseDown(down))).to.equal(true);
    expect(click.onMouseDown).to.have.been.called.with.exactly(down);
    expect(move.onMouseDown).not.to.have.been.called();

    // 首 Drag：Phase A（click decline）→ Phase B（补发 mouseDown(downSnapshot) 给 move，accept 成 dragWinner）
    //   → finishClickSideForDrag（向 click 发 canceled mouseUp）→ 转 move.mouseDrag
    expect(accepted(dragEvent, () => multiplex.onMouseDrag(dragEvent))).to.equal(true);
    expect(click.onMouseDrag).to.have.been.called.with.exactly(dragEvent);
    expect(move.onMouseDown).to.have.been.called.exactly(1);
    const downSnapshot = getSpyCalls(move.onMouseDown)[0][0] as InputEventMouseButton;

    expect(downSnapshot.pressed).to.equal(true);          // 补发的是 runtime Down 快照
    expect(downSnapshot).not.to.equal(down);              // 副本，非原事件
    expect(click.calls).to.include('up:canceled');     // finishClickSideForDrag 已 cancel click 侧
    expect(move.onMouseDrag).to.have.been.called.with.exactly(dragEvent);

    // mouseUp：路由给 dragWinner（move）
    expect(accepted(up, () => multiplex.onMouseUp(up))).to.equal(true);
    expect(move.onMouseUp).to.have.been.called.with.exactly(up);
    expect(click.onMouseUp).to.have.been.called.exactly(1); // 仅 finishClickSideForDrag 那次，未在 mouseUp 再调
  });

  it('没有 drag candidate 时由 click winner 完成 mouseup（非 canceled）', () => {
    const click = candidate('change-selection', { down: true, up: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [],
    });

    const down = mouseButton(true);

    expect(accepted(down, () => multiplex.onMouseDown(down))).to.equal(true);
    // 零位移纯点击：未触发 Drag → 无 dragWinner → mouseUp 路由 click winner（非 canceled）
    const up = mouseButton(false);

    expect(accepted(up, () => multiplex.onMouseUp(up))).to.equal(true);
    expect(click.onMouseUp).to.have.been.called.exactly(1);
    expect(click.calls).to.include('up');
    expect(click.calls).not.to.include('up:canceled');
  });

  it('Move 广播全部 candidates，并保留较早候选写入的 sticky accepted', () => {
    const first = candidate('first', { move: true });
    const second = candidate('second', { move: false });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [first, second],
      dragCandidates: [],
    });
    const moveEvent = mouseMotion();

    multiplex.onMouseMove(moveEvent);

    expect(first.onMouseMove).to.have.been.called.once;
    expect(second.onMouseMove).to.have.been.called.once;
    expect(moveEvent.isAccepted()).to.equal(true);
  });

  it('drag winner 解析时 synthetic canceled Up 不污染 live Drag 的 accepted', () => {
    const click = candidate('click', { down: true, drag: false, up: true });
    const drag = candidate('drag', { down: true, drag: false });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [drag],
    });

    multiplex.onMouseDown(mouseButton(true));
    const dragEvent = mouseMotion();

    multiplex.onMouseDrag(dragEvent);

    expect(click.calls).to.include('up:canceled');
    expect(drag.onMouseDrag).to.have.been.called.with.exactly(dragEvent);
    expect(dragEvent.isAccepted()).to.equal(false);
  });

  it('标准快捷键按下时 auxiliary 优先于 dragCandidates', () => {
    const click = candidate('change-selection', { down: true, drag: false });
    const move = candidate('move-selection', { down: true, drag: true });
    const box = candidate('box-selection', { down: true, drag: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      // box 仅作 auxiliary（不在 dragCandidates），对齐装配：auxiliary 与 dragCandidates 不同实例。
      dragCandidates: [move],
      auxiliaryBehavior: box,
    });

    multiplex.onMouseDown(mouseButton(true));

    const dragEvent = mouseMotion({ globalPosition: new math.Vector2(104, 200), ctrlPressed: true, metaPressed: true });

    expect(accepted(dragEvent, () => multiplex.onMouseDrag(dragEvent))).to.equal(true);
    // auxiliary(box) 被 Phase B 优先补发 mouseDown 并 accept → dragWinner=box，move 未被补发
    expect(box.onMouseDown).to.have.been.called.exactly(1);
    expect(move.onMouseDown).not.to.have.been.called();
    expect(box.onMouseDrag).to.have.been.called();
  });

  it('标准快捷键分支的 auxiliary 未接受时仍按顺序回退到 dragCandidates', () => {
    const order: string[] = [];
    const click = candidate('change-selection', { down: true, drag: false });
    const move = candidate('move-selection', { down: true, drag: true });
    const dragBox = candidate('drag-box-selection', { down: true, drag: true });
    const auxiliaryBox = candidate('auxiliary-box-selection', { down: false, drag: true });

    auxiliaryBox.onMouseDown = chai.spy(() => order.push('auxiliary-box'));
    move.onMouseDown = chai.spy((event: InputEventMouse) => {
      order.push('move');
      event.accept();
    });
    dragBox.onMouseDown = chai.spy((event: InputEventMouse) => {
      order.push('drag-box');
      event.accept();
    });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move, dragBox],
      auxiliaryBehavior: auxiliaryBox,
    });

    multiplex.onMouseDown(mouseButton(true));

    multiplex.onMouseDrag(mouseMotion({ ctrlPressed: true, metaPressed: true }));

    expect(order).to.deep.equal(['auxiliary-box', 'move']);
    expect(move.onMouseDrag).to.have.been.called.once;
    expect(dragBox.onMouseDown).not.to.have.been.called();
  });

  it('没有标准快捷键时跳过 auxiliary，按数组顺序解析 dragCandidates', () => {
    const order: string[] = [];
    const click = candidate('change-selection', { down: true, drag: false });
    const move = candidate('move-selection', { down: false, drag: true });
    const dragBox = candidate('drag-box-selection', { down: true, drag: true });
    const auxiliaryBox = candidate('auxiliary-box-selection', { down: true, drag: true });

    move.onMouseDown = chai.spy(() => order.push('move'));
    dragBox.onMouseDown = chai.spy((event: InputEventMouse) => {
      order.push('drag-box');
      event.accept();
    });
    auxiliaryBox.onMouseDown = chai.spy((event: InputEventMouse) => {
      order.push('auxiliary-box');
      event.accept();
    });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move, dragBox],
      auxiliaryBehavior: auxiliaryBox,
    });

    multiplex.onMouseDown(mouseButton(true));

    multiplex.onMouseDrag(mouseMotion());

    expect(order).to.deep.equal(['move', 'drag-box']);
    expect(auxiliaryBox.onMouseDown).not.to.have.been.called();
    expect(dragBox.onMouseDrag).to.have.been.called.once;
  });

  it('已有 dragWinner 的后续 Drag 仍先 offer 完整 click vector', () => {
    const click = candidate('change-selection', { down: true });

    let dragCount = 0;

    click.onMouseDrag = chai.spy((event: InputEventMouse) => {
      click.calls.push('drag');
      if (++dragCount === 2) {
        event.accept();
      }
    });
    const move = candidate('move-selection', { down: true, drag: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move],
    });

    multiplex.onMouseDown(mouseButton(true));

    const firstDrag = mouseMotion();
    const secondDrag = mouseMotion();

    expect(accepted(firstDrag, () => multiplex.onMouseDrag(firstDrag))).to.equal(true);
    expect(accepted(secondDrag, () => multiplex.onMouseDrag(secondDrag))).to.equal(true);

    expect(click.onMouseDrag).to.have.been.called.exactly(2);
    expect(move.onMouseDrag).to.have.been.called.exactly(1);
  });

  it('Down snapshot 在 click mouseDown 派发完成后复制', () => {
    const click = candidate('change-selection', { down: true, drag: false });

    click.onMouseDown = chai.spy((event: InputEventMouse) => {
      click.calls.push('down');
      event.canceled = true;
      event.accept();
    });
    const move = candidate('move-selection', { down: true, drag: true });
    let replayState: { accepted: boolean, canceled: boolean } | undefined;

    move.onMouseDown = chai.spy((event: InputEventMouseButton) => {
      replayState = {
        accepted: event.isAccepted(),
        canceled: event.isCanceled(),
      };
      event.accept();
    });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move],
    });

    multiplex.onMouseDown(mouseButton(true));
    const liveDrag = mouseMotion();

    multiplex.onMouseDrag(liveDrag);

    const snapshot = getSpyCalls(move.onMouseDown)[0][0] as InputEventMouseButton;

    expect(snapshot.pressed).to.equal(true);
    expect(replayState).to.deep.equal({
      accepted: false,
      canceled: true,
    });
  });

  it('click 侧取消派发抛错时不额外包装恢复流程', () => {
    const click = candidate('change-selection', { down: true, drag: false });
    let canceledRelease: InputEventMouseButton | undefined;

    click.onMouseUp = chai.spy((event: InputEventMouseButton) => {
      canceledRelease = event;
      throw new Error('cancel failed');
    });
    const move = candidate('move-selection', { down: true, drag: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move],
    });

    multiplex.onMouseDown(mouseButton(true));
    const dragEvent = mouseMotion();

    expect(() => multiplex.onMouseDrag(dragEvent)).to.throw('cancel failed');
    expect(canceledRelease?.isCanceled()).to.equal(true);
    expect(dragEvent.isCanceled()).to.equal(false);
    expect(dragEvent.isAccepted()).to.equal(false);
  });

  it('click mouseUp 首个接受者胜出后拒绝尾部候选', () => {
    const first = candidate('first', { down: false, up: true });
    const second = candidate('second', { down: true, up: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [first, second],
      dragCandidates: [],
    });

    multiplex.onMouseDown(mouseButton(true));

    const up = mouseButton(false);

    expect(accepted(up, () => multiplex.onMouseUp(up))).to.equal(true);
    expect(first.onMouseUp).to.have.been.called.once;
    expect(second.onMouseUp).not.to.have.been.called();
  });

  it('clickWinner 仅在 Down 有 winner 时覆盖，Move 保留，Up 回调前清除', () => {
    const first = candidate('first', { down: true, move: false, up: true });
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [first],
      dragCandidates: [],
    });
    const clickWinner = (): Gizmo | undefined => (
      multiplex as unknown as { clickWinner: Gizmo | undefined }
    ).clickWinner;

    multiplex.onMouseDown(mouseButton(true));
    expect(clickWinner()).to.equal(first);

    multiplex.onMouseMove(mouseMotion());
    expect(clickWinner()).to.equal(first);

    first.onMouseDown = chai.spy(() => {
      first.calls.push('down');
    });
    multiplex.onMouseDown(mouseButton(true));
    expect(clickWinner()).to.equal(first);

    let winnerSeenDuringUp: Gizmo | undefined;

    first.onMouseUp = chai.spy((event: InputEventMouse) => {
      winnerSeenDuringUp = clickWinner();
      event.accept();
    });
    multiplex.onMouseUp(mouseButton(false));
    expect(winnerSeenDuringUp).to.equal(undefined);
    expect(clickWinner()).to.equal(undefined);
  });

  it('按原生顺序 draw click→drag→auxiliary，onUpdate 跳过 auxiliary', () => {
    const order: string[] = [];
    const click = candidate('click');
    const drag = candidate('drag');
    const auxiliary = candidate('auxiliary');

    click.draw = chai.spy(() => order.push('click'));
    drag.draw = chai.spy(() => order.push('drag'));
    auxiliary.draw = chai.spy(() => order.push('auxiliary'));
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [drag],
      auxiliaryBehavior: auxiliary,
    });

    multiplex.draw({} as never);
    multiplex.onUpdate();

    expect(order).to.deep.equal(['click', 'drag', 'auxiliary']);
    expect(click.onUpdate).to.have.been.called.once;
    expect(drag.onUpdate).to.have.been.called.once;
    expect(auxiliary.onUpdate).not.to.have.been.called();
  });

  it('内部竞争结束不向落败的嵌套 Multiplex 补发 canceled mouseUp', () => {
    const winner = candidate('winner');
    const ordinary = candidate('ordinary');
    const losingMultiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [],
      dragCandidates: [],
    });
    const losingUp = chai.spy.on(losingMultiplex, 'onMouseUp');
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [winner, losingMultiplex, ordinary],
      dragCandidates: [],
    });

    multiplex.onMouseDown(mouseButton(true));

    expect(losingUp).not.to.have.been.called();
    expect(ordinary.onMouseUp).not.to.have.been.called();
  });

  it('dispose 清理自己的全部内部候选各一次（含 auxiliary）', () => {
    const click = candidate('change-selection');
    const move = candidate('move-selection');
    const box = candidate('box-selection');
    const multiplex = new ClickDragMultiplexGizmo(owner, {
      clickCandidates: [click],
      dragCandidates: [move],
      auxiliaryBehavior: box,
    });

    multiplex.dispose();

    expect(click.dispose).to.have.been.called.once;
    expect(move.dispose).to.have.been.called.once;
    expect(box.dispose).to.have.been.called.once;
  });
});
});
