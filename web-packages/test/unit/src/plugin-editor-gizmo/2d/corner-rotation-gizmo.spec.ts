import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, type InputEventMouse, type Engine, type VFXItem } from '@galacean/effects';
import { Box2, Circle } from '@galacean/effects-math/es/extension/index';
import { getBoxTransform, Euler, Matrix4, Quaternion, Vector2, Vector3, getBoxCorners, setBoxFromPoints } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import {
  CornerRotationGizmo,
  GestureCursorType,
  ConfigManager,
  LoadingManager,
  ResizeSelectionGizmo,
  TransformType,
  type GizmoOwner,
} from '../../../../../../plugin-packages/editor-gizmo/src/2d';

const { expect } = chai;

describe('plugin-editor-gizmo/corner-rotation-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (point: Vector2, pressed: boolean, buttonMask: MouseButtonMask, shiftPressed = false): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(point.x, point.y);
    event.globalPosition.set(point.x, point.y);
    event.buttonMask = buttonMask;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;
    event.shiftPressed = shiftPressed;

    return event;
  }

  function mouseMotion (point: Vector2, buttonMask: MouseButtonMask, shiftPressed = false): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(point.x, point.y);
    event.globalPosition.set(point.x, point.y);
    event.buttonMask = buttonMask;
    event.shiftPressed = shiftPressed;
    event.pressed = event.buttonMask !== MouseButtonMask.None;

    return event;
  }

  function accepted (event: InputEventMouse, dispatch: () => void): boolean {
    event.clearAccepted();
    dispatch();

    return event.isAccepted();
  }

  function createTransform (worldMatrix: Matrix4) {
    return {
      updateLocalMatrix: () => {},
      getWorldMatrix: () => worldMatrix,
      assignWorldTRS: (position?: Vector3, quaternion?: Quaternion, scale?: Vector3) => {
        worldMatrix.decompose(position ?? new Vector3(), quaternion ?? new Quaternion(), scale ?? new Vector3());
      },
    };
  }

  function createContext (rotationDegrees = 0, selectionItems?: VFXItem[]) {
    const rotate = chai.spy();
    const itemWorldMatrix = new Matrix4().compose(
      new Vector3(),
      new Quaternion().setFromEuler(new Euler(0, 0, rotationDegrees)),
      new Vector3(1, 1, 1),
    );
    const item = {
      rotate,
      getInstanceId: () => 'selected',
      transform: createTransform(itemWorldMatrix),
    } as unknown as VFXItem;
    const clearHover = chai.spy();
    const commitHoverTarget = chai.spy();
    const selection = {
      getSelectedPlayerItems: () => selectionItems ?? [item],
      clearHover,
      commitHoverTarget,
    };
    let mousePosition = new Vector2();
    let transformKind: 'idle' | 'move' | 'resize' = 'idle';
    const configs = new ConfigManager();
    const loadingManager = new LoadingManager();
    const engine = {
      canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
      sceneServer: { compositions: [] },
    } as unknown as Engine;
    const actionStart: TestSpy = chai.spy();
    const actionUpdate: TestSpy = chai.spy();
    const actionCommit: TestSpy = chai.spy();
    const emit: GizmoOwner['emit'] = (event, data) => {
      if (event === 'actionstart') {
        actionStart(data);
      }
      if (event === 'actionupdate') {
        actionUpdate(data);
      }
      if (event === 'actioncommit') {
        actionCommit(data);
      }
    };
    const owner = {
      emit,
      setCursor: chai.spy(),
      getSelection: () => selection,
      getLoadingManager: () => loadingManager,
      getMousePosition: () => mousePosition,
      getSelectionTransformKind: () => transformKind,
      setSelectionTransformKind: (kind: typeof transformKind) => {
        transformKind = kind;
      },
      getConfigManager: () => configs,
      getEngine: () => engine,
    } as unknown as GizmoOwner;
    const resizeSelection = new ResizeSelectionGizmo(owner);

    chai.spy.on(resizeSelection, 'refreshWireframeBySelectedItems', () => {});

    const center = new Vector2(150, 150);
    const baseBox = new Box2().setFromCenterAndSize(center, new Vector2(100, 100));
    const baseCorners = getBoxCorners(baseBox);
    const corners = rotationDegrees === 0
      ? baseCorners
      : baseCorners.map(corner => (
        corner.clone().rotateAround(center, rotationDegrees * Math.PI / 180)
      ));
    const box = setBoxFromPoints(new Box2(), corners);

    resizeSelection.wireframe.box.copyFrom(box);
    resizeSelection.wireframe.transform = getBoxTransform(corners);
    resizeSelection.wireframe.totalBox.copyFrom(box).expandByScalar(16);
    resizeSelection.wireframe.scaleCorners = corners.map(corner => (
      new Circle(corner, resizeSelection.config.scaleCircleSize)
    ));
    resizeSelection.wireframe.interactive = true;
    resizeSelection.wireframe.anchor.copyFrom(box.getCenter());

    const gizmo = new CornerRotationGizmo(owner, resizeSelection);
    const corner = corners[0];
    const xAxis = new Vector2().subtractVectors(corners[1], corners[0]).normalize();
    const yAxis = new Vector2().subtractVectors(corners[3], corners[0]).normalize();
    const centerDirection = new Vector2().subtractVectors(corner, box.getCenter());
    const outwardX = xAxis.multiply(centerDirection.dot(xAxis) >= 0 ? 1 : -1);
    const outwardY = yAxis.multiply(centerDirection.dot(yAxis) >= 0 ? 1 : -1);
    const pointAt = (distance: number) => corner.clone()
      .add(outwardX.clone().multiply(distance))
      .add(outwardY.clone().multiply(distance));

    return {
      gizmo,
      resizeSelection,
      rotate,
      actionStart,
      actionUpdate,
      actionCommit,
      clearHover,
      commitHoverTarget,
      loadingManager,
      setMousePosition: (point: Vector2) => {
        mousePosition = point;
      },
      getTransformKind: () => transformKind,
      pointAt,
      anchor: resizeSelection.wireframe.anchor,
    };
  }

  describe('CornerRotationGizmo', () => {
    it('loading 元素不响应角旋转', () => {
      const context = createContext();

      context.loadingManager.add('selected');
      const start = context.pointAt(10);

      context.setMousePosition(start);
      const down = mouseButton(start, true, MouseButtonMask.Left);

      expect(accepted(down, () => context.gizmo.onMouseDown(down))).to.equal(false);
      expect(context.rotate).not.to.have.been.called();
      expect(context.actionStart).not.to.have.been.called();
    });

    it('按固定 Box2 四角顺序建立选框局部坐标轴', () => {
      const context = createContext(30);
      const axes = (context.gizmo as unknown as {
        boxLocalAxes: () => { xAxis: Vector2, yAxis: Vector2 },
      }).boxLocalAxes();
      const angle = 30 * Math.PI / 180;

      expect(axes.xAxis.x).to.be.closeTo(Math.cos(angle), 0.5 * 10 ** -(2));
      expect(axes.xAxis.y).to.be.closeTo(Math.sin(angle), 0.5 * 10 ** -(2));
      expect(axes.yAxis.x).to.be.closeTo(-Math.sin(angle), 0.5 * 10 ** -(2));
      expect(axes.yAxis.y).to.be.closeTo(Math.cos(angle), 0.5 * 10 ** -(2));
    });

    it('先于 ResizeSelection 派发，但把重叠的缩放角点明确让出', () => {
      const context = createContext();

      const overlap = context.pointAt(6);

      context.setMousePosition(overlap);
      const overlapMove = mouseMotion(overlap, MouseButtonMask.None);

      expect(accepted(overlapMove, () => context.gizmo.onMouseMove(overlapMove))).to.equal(false);
      expect(context.gizmo.cursorResult.type).to.equal(GestureCursorType.NORMAL);

      const rotationOnly = context.pointAt(10);

      context.setMousePosition(rotationOnly);
      const rotationMove = mouseMotion(rotationOnly, MouseButtonMask.None);

      expect(accepted(rotationMove, () => context.gizmo.onMouseMove(rotationMove))).to.equal(true);
      expect(context.gizmo.cursorResult.type).to.equal(GestureCursorType.ROTATION);
      expect(context.clearHover).not.to.have.been.called();
    });

    it('独立持有旋转 capture，并发出 ROTATION 命令事务事件', () => {
      const context = createContext();
      const start = context.pointAt(10);

      context.setMousePosition(start);
      const down = mouseButton(start, true, MouseButtonMask.Left);

      expect(accepted(down, () => context.gizmo.onMouseDown(down))).to.equal(true);
      expect(context.getTransformKind()).to.equal('idle');
      expect(getSpyCalls(context.actionStart).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.ROTATION)).to.equal(true);

      const next = start.clone().add(new Vector2(20, -10));
      const drag = mouseMotion(next, MouseButtonMask.Left);

      expect(accepted(drag, () => context.gizmo.onMouseDrag(drag))).to.equal(true);
      expect(context.getTransformKind()).to.equal('resize');
      expect(context.rotate).to.have.been.called.once;
      expect(getSpyCalls(context.rotate)[0][2]).not.to.equal(0);
      expect(getSpyCalls(context.actionUpdate).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.ROTATION)).to.equal(true);
      context.setMousePosition(next);
      const up = mouseButton(next, false, MouseButtonMask.None);

      expect(accepted(up, () => context.gizmo.onMouseUp(up))).to.equal(true);
      expect(context.getTransformKind()).to.equal('idle');
      expect(getSpyCalls(context.actionCommit).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.ROTATION)).to.equal(true);
      expect(context.commitHoverTarget).not.to.have.been.called();
    });

    it('直接冻结 Selection 已归一化的权威选区并交给命令事务', () => {
      const groupRotate = chai.spy();
      const group = {
        rotate: groupRotate,
        getInstanceId: () => 'group',
        parent: undefined,
        transform: createTransform(new Matrix4()),
      } as unknown as VFXItem;
      const context = createContext(0, [group]);
      const start = context.pointAt(10);

      context.setMousePosition(start);

      context.gizmo.onMouseDown(mouseButton(start, true, MouseButtonMask.Left));
      context.gizmo.onMouseDrag(mouseMotion(start.clone().add(new Vector2(20, -10)), MouseButtonMask.Left));

      expect(groupRotate).to.have.been.called.once;
      expect(getSpyCalls(context.actionStart).some(args => args.length === 1 && args[0]?.['transformType'] === TransformType.ROTATION && args[0]?.['itemIds']?.length === 1 && args[0]?.['itemIds']?.[0] === 'group')).to.equal(true);
    });

    it('按住 Shift 时累计原始拖拽角，并以 15° 为步长吸附', () => {
      const context = createContext();
      const start = context.pointAt(10);

      context.setMousePosition(start);
      const down = mouseButton(start, true, MouseButtonMask.Left, true);

      context.gizmo.onMouseDown(down);

      const fourDegrees = start.clone().rotateAround(context.anchor, 4 * Math.PI / 180);
      const firstDrag = mouseMotion(fourDegrees, MouseButtonMask.Left, true);

      context.gizmo.onMouseDrag(firstDrag);
      expect(context.rotate).not.to.have.been.called();

      const eightDegrees = start.clone().rotateAround(context.anchor, 8 * Math.PI / 180);
      const secondDrag = mouseMotion(eightDegrees, MouseButtonMask.Left, true);

      context.gizmo.onMouseDrag(secondDrag);
      expect(context.rotate).to.have.been.called.once;
      expect(getSpyCalls(context.rotate)[0][2]).to.equal(15);
      expect(context.gizmo.rotationAngle).to.equal(15);
    });

    it('节点使用自身世界矩阵旋转作为 15° 吸附基准，不受派生 AABB 选框影响', () => {
      const rotate = chai.spy();
      const itemWorldMatrix = new Matrix4().compose(
        new Vector3(),
        new Quaternion().setFromEuler(new Euler(0, 0, 8)),
        new Vector3(1, 1, 1),
      );
      const group = {
        rotate,
        getInstanceId: () => 'group',
        parent: undefined,
        transform: createTransform(itemWorldMatrix),
      } as unknown as VFXItem;
      // 派生选框保持 0°；节点自身世界矩阵已经旋转 8°。
      const context = createContext(0, [group]);
      const start = context.pointAt(10);

      context.setMousePosition(start);
      context.gizmo.onMouseDown(mouseButton(start, true, MouseButtonMask.Left, true));

      const fourDegrees = start.clone().rotateAround(context.anchor, 4 * Math.PI / 180);

      context.gizmo.onMouseDrag(mouseMotion(fourDegrees, MouseButtonMask.Left, true));

      // 最终方向应从 8° 吸到 15°，本次只需再应用 7°，而不是按 AABB 从 0° 计算。
      expect(rotate).to.have.been.called.once;
      expect(getSpyCalls(rotate)[0][2]).to.equal(7);
      expect(context.gizmo.rotationAngle).to.equal(7);
    });

    it('当前位置 Drag 重放会在鼠标静止时切换 Shift 吸附，并在松开后恢复原始拖拽角', () => {
      const context = createContext(8);
      const start = context.pointAt(10);

      context.setMousePosition(start);
      context.gizmo.onMouseDown(mouseButton(start, true, MouseButtonMask.Left));

      const fourDegrees = start.clone().rotateAround(context.anchor, 4 * Math.PI / 180);

      context.gizmo.onMouseDrag(mouseMotion(fourDegrees, MouseButtonMask.Left));
      expect(getSpyCalls(context.rotate)[0][2]).to.be.closeTo(4, 0.5 * 10 ** -(3));

      const shiftDownReplay = mouseMotion(fourDegrees, MouseButtonMask.Left, true);

      expect(accepted(
        shiftDownReplay,
        () => context.gizmo.onMouseDrag(shiftDownReplay),
      )).to.equal(true);
      expect(getSpyCalls(context.rotate)[1][2]).to.be.closeTo(3, 0.5 * 10 ** -(3));
      expect(context.gizmo.rotationAngle).to.be.closeTo(7, 0.5 * 10 ** -(3));

      const shiftUpReplay = mouseMotion(fourDegrees, MouseButtonMask.Left);

      expect(accepted(
        shiftUpReplay,
        () => context.gizmo.onMouseDrag(shiftUpReplay),
      )).to.equal(true);
      expect(getSpyCalls(context.rotate)[2][2]).to.be.closeTo(-3, 0.5 * 10 ** -(3));
      expect(context.gizmo.rotationAngle).to.be.closeTo(4, 0.5 * 10 ** -(3));
    });
  });
});
