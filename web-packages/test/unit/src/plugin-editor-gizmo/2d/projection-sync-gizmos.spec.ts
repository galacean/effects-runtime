import { restoreTestState } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

import type { Engine, VFXItem } from '@galacean/effects';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { MaskGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/mask-gizmo';
import { ImageCutGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/image-cut-gizmo';
import { ImageExpandGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/image-expand-gizmo';
import { ImageInteractionType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/image-interaction';
import { GestureCursorType, type GestureCursorResult } from '../../../../../../plugin-packages/editor-gizmo/src/2d/cursor';

import { Box2 } from '@galacean/effects-math/es/extension/index';
import type { Matrix3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { Vector2, getBoxTransform, getBoxTransformFromBox, getBoxCorners, getTransformedBoxCorners, setBoxFromPoints, transformBoxPoint } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/projection-sync-gizmos', () => {
  afterEach(restoreTestState);

type TestItem = VFXItem & { testViewBox: Box2, testViewTransform?: Matrix3 };

function box (minX: number, minY: number, maxX: number, maxY: number): Box2 {
  return new Box2(new Vector2(minX, minY), new Vector2(maxX, maxY));
}

function boxCoordinates (value: Box2 | undefined): number[][] | undefined {
  return value && [value.min.toArray(), value.max.toArray()];
}

function setup () {
  const selectedItem = {
    testViewBox: box(10, 20, 110, 220),
  } as TestItem;

  setItemViewTransform(selectedItem, () => selectedItem.testViewTransform ?? getBoxTransformFromBox(selectedItem.testViewBox));
  const parentElement = {
    offsetWidth: TEST_VIEW_SIZE.x,
    offsetHeight: TEST_VIEW_SIZE.y,
  } as HTMLElement;
  const engine = {
    canvas: { parentElement },
  } as unknown as Engine;
  const configs = new ConfigManager();
  const emit = chai.spy();
  const owner = {
    emit,
    setCursor: chai.spy(),
    getEngine: () => engine,
    getMousePosition: () => new Vector2(10, 20),
    getConfigManager: () => configs,
    getSelection: () => ({ getSelectedPlayerItems: () => [selectedItem] }),
  } as unknown as GizmoOwner;

  return { emit, owner, selectedItem };
}

function mouseButton (x: number, y: number, pressed = true, buttonMask = MouseButtonMask.Left): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.position.set(x, y);
  event.globalPosition.set(x, y);
  event.buttonMask = buttonMask;
  event.buttonIndex = MouseButton.Left;
  event.pressed = pressed;

  return event;
}

function mouseMotion (x: number, y: number, buttonMask = MouseButtonMask.Left): InputEventMouseMotion {
  const event = new InputEventMouseMotion();

  event.position.set(x, y);
  event.globalPosition.set(x, y);
  event.buttonMask = buttonMask;

  event.pressed = event.buttonMask !== MouseButtonMask.None;

  return event;
}

function mouseDown (x = 10, y = 20): InputEventMouseButton {
  return mouseButton(x, y, true, MouseButtonMask.Left);
}

type ImageCursorGizmo = {
  cursorResult: GestureCursorResult,
  refreshInteractionType(point: Vector2, inputPosition: Vector2): void,
};

describe('projection-backed gizmos before first update', () => {
  it('ImageCut 的同步 API 只访问业务状态，需要投影的 API 仅计算一次', () => {
    const { owner } = setup();
    const gizmo = new ImageCutGizmo(owner);
    const normalizeBox = box(0.1, 0.2, 0.8, 0.9);
    const getSelectionGeometry = chai.spy.on(gizmo as unknown as { getSelectionGeometry (): unknown }, 'getSelectionGeometry');

    expect(boxCoordinates(gizmo.setCutBox(normalizeBox))).to.deep.equal(boxCoordinates(normalizeBox));
    expect(boxCoordinates(gizmo.getCutBox())).to.deep.equal(boxCoordinates(normalizeBox));
    expect(getSelectionGeometry).not.to.have.been.called();
    const info = gizmo.getCutInfo();

    expect(boxCoordinates(info?.cutBox)).to.deep.equal(boxCoordinates(normalizeBox));
    expect(boxCoordinates(info?.itemBox)).to.deep.equal(boxCoordinates(box(10, 20, 110, 220)));
    expect(getSelectionGeometry).to.have.been.called.once;
  });

  it('ImageExpand 的同步 API 只访问业务状态，需要投影的 API 仅计算一次', () => {
    const { owner } = setup();
    const gizmo = new ImageExpandGizmo(owner);
    const normalizeBox = box(-0.1, -0.2, 1.2, 1.3);
    const getSelectionGeometry = chai.spy.on(gizmo as unknown as { getSelectionGeometry (): unknown }, 'getSelectionGeometry');

    expect(boxCoordinates(gizmo.setExpandBox(normalizeBox))).to.deep.equal(boxCoordinates(normalizeBox));
    expect(boxCoordinates(gizmo.getExpandBox())).to.deep.equal(boxCoordinates(normalizeBox));
    expect(getSelectionGeometry).not.to.have.been.called();
    const info = gizmo.getExpandInfo();

    expect(boxCoordinates(info?.expandBox)).to.deep.equal(boxCoordinates(normalizeBox));
    expect(boxCoordinates(info?.itemBox)).to.deep.equal(boxCoordinates(box(10, 20, 110, 220)));
    expect(getSelectionGeometry).to.have.been.called.once;
  });

  ([
    ['ImageCut', ImageCutGizmo],
    ['ImageExpand', ImageExpandGizmo],
  ] as const).forEach(caseData => {
    const [_name, GizmoClass] = caseData;

    it(`${caseData[0]} 首次 update 前可用实时投影命中输入`, () => {
      const { emit, owner, selectedItem } = setup();
      const gizmo = new GizmoClass(owner);

      selectedItem.testViewBox = box(30, 40, 130, 240);
      const event = mouseDown(30, 40);

      gizmo.onMouseDown(event);

      expect(event.isAccepted()).to.equal(true);
      expect(emit).to.have.been.called.with.exactly('actionstart', { source: gizmo });
    });
  });

  ([
    ['ImageCut', ImageCutGizmo],
    ['ImageExpand', ImageExpandGizmo],
  ] as const).forEach(caseData => {
    const [_name, GizmoClass] = caseData;

    it(`${caseData[0]} 按固定四角顺序设置四角和四边 cursor 方向`, () => {
      const { owner } = setup();
      const gizmo = new GizmoClass(owner);
      const cursorGizmo = gizmo as unknown as ImageCursorGizmo;
      const projectedBox = box(10, 20, 110, 220);

      const cornerAngles = [270, 0, 90, 180];
      const corners = getBoxCorners(projectedBox);

      corners.forEach((corner, index) => {
        cursorGizmo.refreshInteractionType(corner, corner);
        expect(gizmo.interactionParam.type).to.equal(ImageInteractionType.SCALE);
        expect(gizmo.cursorResult).to.deep.equal({ type: GestureCursorType.SCALE, angle: cornerAngles[index] });
      });

      const edgeAngles = [315, 45, 135, 225];

      corners.forEach((corner, index) => {
        const midpoint = corner.clone().add(corners[(index + 1) % 4]).multiply(0.5);

        cursorGizmo.refreshInteractionType(midpoint, midpoint);
        expect(gizmo.interactionParam.type).to.equal(ImageInteractionType.DIRECTION_SCALE);
        expect(gizmo.cursorResult).to.deep.equal({ type: GestureCursorType.SCALE, angle: edgeAngles[index] });
      });
    });
  });

  it('ImageCut 的四条边沿各自法向缩进', () => {
    const edgeCases = [
      { edge: 0, delta: new Vector2(0, 20), expected: [0, 0.1, 1, 1] },
      { edge: 1, delta: new Vector2(-10, 0), expected: [0, 0, 0.9, 1] },
      { edge: 2, delta: new Vector2(0, -20), expected: [0, 0, 1, 0.9] },
      { edge: 3, delta: new Vector2(10, 0), expected: [0.1, 0, 1, 1] },
    ];

    edgeCases.forEach(({ edge, delta, expected }) => {
      const { owner } = setup();
      const gizmo = new ImageCutGizmo(owner);
      const projectedBox = box(10, 20, 110, 220);
      const corners = getBoxCorners(projectedBox);
      const start = corners[edge].clone().add(corners[(edge + 1) % 4]).multiply(0.5);

      gizmo.onMouseDown(mouseDown(start.x, start.y));
      const end = start.clone().add(delta);

      gizmo.onMouseDrag(mouseMotion(end.x, end.y, MouseButtonMask.Left));

      expect(gizmo.interactionParam.type).to.equal(ImageInteractionType.DIRECTION_SCALE);
      [
        gizmo.result.normalizeCutBox.min.x,
        gizmo.result.normalizeCutBox.min.y,
        gizmo.result.normalizeCutBox.max.x,
        gizmo.result.normalizeCutBox.max.y,
      ].forEach((actual, index) => {
        expect(actual).to.be.closeTo(expected[index], 0.005);
      });
    });
  });

  it('ImageExpand 的四条边沿各自法向扩展', () => {
    const edgeCases = [
      { edge: 0, delta: new Vector2(0, -20), expected: [0, -0.1, 1, 1] },
      { edge: 1, delta: new Vector2(10, 0), expected: [0, 0, 1.1, 1] },
      { edge: 2, delta: new Vector2(0, 20), expected: [0, 0, 1, 1.1] },
      { edge: 3, delta: new Vector2(-10, 0), expected: [-0.1, 0, 1, 1] },
    ];

    edgeCases.forEach(({ edge, delta, expected }) => {
      const { owner } = setup();
      const gizmo = new ImageExpandGizmo(owner);
      const projectedBox = box(10, 20, 110, 220);
      const corners = getBoxCorners(projectedBox);
      const start = corners[edge].clone().add(corners[(edge + 1) % 4]).multiply(0.5);

      gizmo.onMouseDown(mouseDown(start.x, start.y));
      const end = start.clone().add(delta);

      gizmo.onMouseDrag(mouseMotion(end.x, end.y, MouseButtonMask.Left));

      expect(gizmo.interactionParam.type).to.equal(ImageInteractionType.DIRECTION_SCALE);
      [
        gizmo.result.normalizeExpandBox.min.x,
        gizmo.result.normalizeExpandBox.min.y,
        gizmo.result.normalizeExpandBox.max.x,
        gizmo.result.normalizeExpandBox.max.y,
      ].forEach((actual, index) => {
        expect(actual).to.be.closeTo(expected[index], 0.005);
      });
    });
  });

  ([
    ['ImageCut', ImageCutGizmo, new Vector2(0.1, 0.2), [0.1, 0.2, 1, 1]],
    ['ImageExpand', ImageExpandGizmo, new Vector2(-0.1, -0.2), [-0.1, -0.2, 1, 1]],
  ] as const).forEach(caseData => {
    const [_name, GizmoClass, target, expected] = caseData;

    it(`${caseData[0]} 在旋转投影下先把指针映射回归一化 Box2`, () => {
      const { owner, selectedItem } = setup();
      const points = [
        new Vector2(80, 20),
        new Vector2(180, 80),
        new Vector2(80, 280),
        new Vector2(-20, 220),
      ];
      const transform = getBoxTransform(points)!;

      selectedItem.testViewTransform = transform;
      selectedItem.testViewBox = setBoxFromPoints(new Box2(), points);
      const gizmo = new GizmoClass(owner);
      const targetPoint = transformBoxPoint(transform, target);

      gizmo.onMouseDown(mouseDown(points[0].x, points[0].y));
      gizmo.onMouseDrag(mouseMotion(targetPoint.x, targetPoint.y, MouseButtonMask.Left));

      const result = gizmo instanceof ImageCutGizmo
        ? gizmo.result.normalizeCutBox
        : gizmo.result.normalizeExpandBox;

      [result.min.x, result.min.y, result.max.x, result.max.y].forEach((actual, index) => {
        expect(actual).to.be.closeTo(expected[index], 0.005);
      });
    });
  });

  it('Mask 首次 update 前可开始输入，渲染快照与业务笔画分离', () => {
    const { emit, owner, selectedItem } = setup();
    const gizmo = new MaskGizmo(owner);

    expect(gizmo.result).to.deep.equal({ lines: [] });
    selectedItem.testViewBox = box(30, 40, 130, 240);
    const event = mouseDown(30, 40);

    gizmo.onMouseDown(event);

    expect(event.isAccepted()).to.equal(true);
    expect(gizmo.result.lines).to.have.lengthOf(1);
    expect(emit).to.have.been.called.with.exactly('actionstart', { source: gizmo });
    gizmo.onUpdate();
    const renderTransform = (gizmo as unknown as { renderTransform?: Matrix3 }).renderTransform;

    expect(renderTransform ? getTransformedBoxCorners(renderTransform) : undefined).to.deep.equal(getBoxCorners(box(30, 40, 130, 240)));
    expect(gizmo.result).to.deep.equal({
      lines: [{ type: 'paint', brushSize: gizmo.config.brushSize, points: [] }],
    });
  });

  it('Mask.getMask 只做一次实时投影', () => {
    chai.spy.on(HTMLCanvasElement.prototype, 'getContext', () => (null));
    const { owner } = setup();
    const gizmo = new MaskGizmo(owner);
    const getSelectionTransform = chai.spy.on(gizmo as unknown as { getSelectionTransform (): unknown }, 'getSelectionTransform');

    expect(gizmo.getMask()).to.equal(null);
    expect(getSelectionTransform).to.have.been.called.once;
  });
});
});
