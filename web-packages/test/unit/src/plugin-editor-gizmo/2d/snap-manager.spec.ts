import { restoreTestState } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

import { FrameComponent, spec, type VFXItem } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxTransformFromBox } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/snap-manager';
import { ConfigManager, selectionSnapConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

const { expect } = chai;

describe('plugin-editor-gizmo/snap-manager', () => {
  afterEach(restoreTestState);

type SnapTestItem = VFXItem & { testBox: Box2 };

function createOwner (configs: ConfigManager): GizmoOwner {
  return {
    getConfigManager: () => configs,
  } as GizmoOwner;
}

function createSnapManager (distance = 6): SnapManager {
  const configs = new ConfigManager();

  configs.set(selectionSnapConfig, { distance });

  return new SnapManager(createOwner(configs));
}

function createItem (
  id: string,
  options: {
    parent?: VFXItem,
    frame?: boolean,
    effects?: boolean,
    x?: number,
  } = {},
): SnapTestItem {
  const isFrame = options.frame ?? false;
  const isEffects = options.effects ?? false;
  const x = options.x ?? 0;
  const item = {
    type: isFrame || isEffects ? spec.ItemType.null : spec.ItemType.sprite,
    name: isFrame ? '画板' : isEffects ? '特效' : id,
    isVisible: true,
    parent: options.parent,
    children: [],
    getInstanceId: () => id,
    getComponent: (component: unknown) => component === FrameComponent && (isFrame || isEffects) ? {} : undefined,
    testBox: new Box2(new Vector2(x, 0), new Vector2(x + 10, 10)),
  } as unknown as SnapTestItem;

  setItemViewTransform(item, () => getBoxTransformFromBox(item.testBox));
  options.parent?.children?.push(item);

  return item;
}

function getTargetCenterXs (snapping: SnapManager): number[] {
  return snapping.getSnapTargetBoxes().map(box => box.getCenter().x);
}

describe('SnapManager', () => {

  it('preparePoint 计算双轴结果并支持单轴关闭', () => {
    const snapping = createSnapManager();

    snapping.preparePoint(new Vector2(), new Vector2(), [new Vector2(3, 4)]);
    expect(snapping.result.x).to.equal(-3);
    expect(snapping.result.y).to.equal(-4);

    snapping.reset();
    snapping.preparePoint(new Vector2(), new Vector2(), [new Vector2(2, 2)], true, false);
    expect(snapping.result.x).to.equal(-2);
    expect(snapping.result.y).to.equal(undefined);
  });

  it('每轴选择最近候选，并在阈值边界内吸附', () => {
    const snapping = createSnapManager(5);
    const moving = new Box2(new Vector2(0, 0), new Vector2(10, 10));
    const farther = new Box2(new Vector2(15, 30), new Vector2(25, 40));
    const nearer = new Box2(new Vector2(13, 20), new Vector2(23, 30));

    snapping.prepareBox(new Vector2(), moving, [farther, nearer], true, false);

    expect(snapping.result.x).to.equal(-3);
  });

  it('根作用域不缓存画板内部元素', () => {
    const snapping = createSnapManager();
    const selected = createItem('selected', { x: 0 });
    const rootPeer = createItem('root-peer', { x: 20 });
    const frame = createItem('frame', { frame: true, x: 40 });
    const frameChild = createItem('frame-child', { parent: frame, x: 60 });

    snapping.cacheSnapTargetsForSelection(
      [selected, rootPeer, frame, frameChild],
      [selected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([25, 45]);
  });

  it('画板内选区只缓存同一画板内部元素', () => {
    const snapping = createSnapManager();
    const rootPeer = createItem('root-peer', { x: 0 });
    const frame = createItem('frame', { frame: true, x: 20 });
    const selected = createItem('selected', { parent: frame, x: 40 });
    const framePeer = createItem('frame-peer', { parent: frame, x: 60 });
    const otherFrame = createItem('other-frame', { frame: true, x: 80 });
    const otherFrameChild = createItem('other-frame-child', { parent: otherFrame, x: 100 });

    snapping.cacheSnapTargetsForSelection(
      [rootPeer, frame, selected, framePeer, otherFrame, otherFrameChild],
      [selected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([65]);
  });

  it('根作用域不缓存特效容器内部元素', () => {
    const snapping = createSnapManager();
    const selected = createItem('selected', { x: 0 });
    const rootPeer = createItem('root-peer', { x: 20 });
    const effects = createItem('effects', { effects: true, x: 40 });
    const composition = createItem('composition', { parent: effects, x: 60 });
    const effectsChild = createItem('effects-child', { parent: composition, x: 80 });

    snapping.cacheSnapTargetsForSelection(
      [selected, rootPeer, effects, composition, effectsChild],
      [selected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([25, 45]);
  });

  it('特效容器内选区只缓存同一作用域内的元素', () => {
    const snapping = createSnapManager();
    const rootPeer = createItem('root-peer', { x: 0 });
    const effects = createItem('effects', { effects: true, x: 20 });
    const composition = createItem('composition', { parent: effects, x: 40 });
    const selected = createItem('selected', { parent: composition, x: 60 });
    const effectsPeer = createItem('effects-peer', { parent: composition, x: 80 });

    snapping.cacheSnapTargetsForSelection(
      [rootPeer, effects, composition, selected, effectsPeer],
      [selected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([85]);
  });

  it('嵌套画板内选区使用最近的画板作用域', () => {
    const snapping = createSnapManager();
    const outerFrame = createItem('outer-frame', { frame: true, x: 0 });
    const outerPeer = createItem('outer-peer', { parent: outerFrame, x: 20 });
    const innerFrame = createItem('inner-frame', { frame: true, parent: outerFrame, x: 40 });
    const selected = createItem('selected', { parent: innerFrame, x: 60 });
    const innerPeer = createItem('inner-peer', { parent: innerFrame, x: 80 });

    snapping.cacheSnapTargetsForSelection(
      [outerFrame, outerPeer, innerFrame, selected, innerPeer],
      [selected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([85]);
  });

  it('跨画板多选回到共同根作用域且排除所选祖先', () => {
    const snapping = createSnapManager();
    const rootPeer = createItem('root-peer', { x: 0 });
    const firstFrame = createItem('first-frame', { frame: true, x: 20 });
    const firstSelected = createItem('first-selected', { parent: firstFrame, x: 40 });
    const secondFrame = createItem('second-frame', { frame: true, x: 60 });
    const secondSelected = createItem('second-selected', { parent: secondFrame, x: 80 });

    snapping.cacheSnapTargetsForSelection(
      [rootPeer, firstFrame, firstSelected, secondFrame, secondSelected],
      [firstSelected, secondSelected],
      TEST_VIEW_SIZE.clone(),
    );

    expect(getTargetCenterXs(snapping)).to.deep.equal([5]);
  });

  it('精确重合时合并同轴命中，并让辅助线贯穿两个完整包围盒', () => {
    const snapping = createSnapManager();
    const moving = new Box2(new Vector2(20, 0), new Vector2(30, 10));
    const target = new Box2(new Vector2(0, 0), new Vector2(10, 10));

    snapping.prepareBox(new Vector2(), moving, [target], false, true);

    expect(snapping.result.y).to.equal(0);
    expect(snapping.result.yPoints?.length).to.equal(3);
    expect(snapping.getSnappingVisualizations().some(line =>
      line.start.x === 0 && line.end.x === 30 && line.start.y === 0 && line.end.y === 0,
    )).to.equal(true);
  });

  it('点吸附会把同一轴上的多个目标合并成连续辅助线并标记锚点', () => {
    const snapping = createSnapManager();

    snapping.preparePoint(
      new Vector2(),
      new Vector2(10, 10),
      [new Vector2(10, 0), new Vector2(10, 20)],
      true,
      false,
    );

    expect(snapping.result.x).to.equal(0);
    expect(snapping.result.xPoints?.[0]?.targets).to.have.lengthOf(2);
    const lines = snapping.getSnappingVisualizations();

    expect(lines).to.have.lengthOf(7);
    expect(lines.some(value => (value?.['start']?.['x'] === 10 && value?.['start']?.['y'] === 0 && value?.['end']?.['x'] === 10 && value?.['end']?.['y'] === 20))).to.equal(true);
    expect(lines.some(value => (value?.['start']?.['x'] === 8 && value?.['start']?.['y'] === -2 && value?.['end']?.['x'] === 12 && value?.['end']?.['y'] === 2))).to.equal(true);
    expect(lines.some(value => (value?.['start']?.['x'] === 8 && value?.['start']?.['y'] === 2 && value?.['end']?.['x'] === 12 && value?.['end']?.['y'] === -2))).to.equal(true);
    expect(lines.some(value => (value?.['start']?.['x'] === 8 && value?.['start']?.['y'] === 18 && value?.['end']?.['x'] === 12 && value?.['end']?.['y'] === 22))).to.equal(true);
  });

  it('包围盒对齐线使用边段端点画小叉，共享端点去重', () => {
    const snapping = createSnapManager();
    const moving = new Box2(new Vector2(20, 0), new Vector2(30, 10));
    const target = new Box2(new Vector2(0, 0), new Vector2(20, 10));

    snapping.prepareBox(new Vector2(), moving, [target], false, true);

    const topLineGeometry = snapping.getSnappingVisualizations().filter(line =>
      Math.max(line.start.y, line.end.y) <= 2 && Math.min(line.start.y, line.end.y) >= -2,
    );

    expect(topLineGeometry.some(value => (value?.['start']?.['x'] === 0 && value?.['start']?.['y'] === 0 && value?.['end']?.['x'] === 30 && value?.['end']?.['y'] === 0))).to.equal(true);
    for (const x of [0, 20, 30]) {
      expect(topLineGeometry.some(value => (value?.['start']?.['x'] === x - 2 && value?.['start']?.['y'] === -2 && value?.['end']?.['x'] === x + 2 && value?.['end']?.['y'] === 2))).to.equal(true);
      expect(topLineGeometry.some(value => (value?.['start']?.['x'] === x - 2 && value?.['start']?.['y'] === 2 && value?.['end']?.['x'] === x + 2 && value?.['end']?.['y'] === -2))).to.equal(true);
    }
  });

  it('复制已有水平 gap，只生成水平间距线', () => {
    const snapping = createSnapManager();
    const moving = new Box2(new Vector2(39, 0), new Vector2(49, 10));
    const first = new Box2(new Vector2(0, 0), new Vector2(10, 10));
    const second = new Box2(new Vector2(20, 0), new Vector2(30, 10));

    snapping.prepareBox(new Vector2(), moving, [first, second], true, false);

    expect(snapping.result.x).to.equal(-1);
    const lines = snapping.getSnappingVisualizations();

    expect(lines).to.have.lengthOf(2);
    expect(lines.every(line => line.start.y === line.end.y)).to.equal(true);
    expect(lines.some(line => line.start.x === 10 && line.end.x === 20)).to.equal(true);
    expect(lines.some(line => line.start.x === 30 && line.end.x === 40)).to.equal(true);

    const snappedMoving = new Box2(new Vector2(40, 0), new Vector2(50, 10));

    snapping.prepareBox(new Vector2(0, 2), snappedMoving, [first, second], true, false);

    const movedLines = snapping.getSnappingVisualizations();

    expect(movedLines).to.have.lengthOf(2);
    expect(movedLines.every(line => line.start.y === 5 && line.end.y === 5)).to.equal(true);
  });

  it('复制已有垂直 gap，只生成垂直间距线', () => {
    const snapping = createSnapManager();
    const moving = new Box2(new Vector2(0, 39), new Vector2(10, 49));
    const first = new Box2(new Vector2(0, 0), new Vector2(10, 10));
    const second = new Box2(new Vector2(0, 20), new Vector2(10, 30));

    snapping.prepareBox(new Vector2(), moving, [first, second], false, true);

    expect(snapping.result.y).to.equal(-1);
    const lines = snapping.getSnappingVisualizations();

    expect(lines).to.have.lengthOf(2);
    expect(lines.every(line => line.start.x === line.end.x)).to.equal(true);
    expect(lines.some(line => line.start.y === 10 && line.end.y === 20)).to.equal(true);
    expect(lines.some(line => line.start.y === 30 && line.end.y === 40)).to.equal(true);

    const snappedMoving = new Box2(new Vector2(0, 40), new Vector2(10, 50));

    snapping.prepareBox(new Vector2(2, 0), snappedMoving, [first, second], false, true);

    const movedLines = snapping.getSnappingVisualizations();

    expect(movedLines).to.have.lengthOf(2);
    expect(movedLines.every(line => line.start.x === 5 && line.end.x === 5)).to.equal(true);
  });

  it('在两个目标之间吸附为相等间距', () => {
    const snapping = createSnapManager();
    const moving = new Box2(new Vector2(19, 0), new Vector2(29, 10));
    const first = new Box2(new Vector2(0, 0), new Vector2(10, 10));
    const second = new Box2(new Vector2(40, 0), new Vector2(50, 10));

    snapping.prepareBox(new Vector2(), moving, [first, second], true, false);

    expect(snapping.result.x).to.equal(-1);
    const lines = snapping.getSnappingVisualizations();

    expect(lines.some(line => line.start.x === 10 && line.end.x === 20)).to.equal(true);
    expect(lines.some(line => line.start.x === 30 && line.end.x === 40)).to.equal(true);
  });

  it('空包围盒会清掉上一帧结果但保留目标缓存', () => {
    const snapping = createSnapManager();
    const target = new Box2(new Vector2(0, 0), new Vector2(10, 10));

    snapping.cacheSnapTargetBoxes([target]);
    snapping.preparePoint(new Vector2(), new Vector2(), [new Vector2(1, 1)]);

    snapping.prepareBox(new Vector2(), new Box2());

    expect(snapping.result).to.deep.equal({});
    expect(snapping.getSnappingVisualizations()).to.deep.equal([]);
    expect(snapping.getSnapTargetBoxes()).to.have.lengthOf(1);
  });

  it('生成 visualizations，reset 清空结果和展示状态', () => {
    const snapping = createSnapManager();

    snapping.preparePoint(new Vector2(), new Vector2(10, 10), [new Vector2(10, 20)]);

    expect(snapping.getSnappingVisualizations().length).to.be.greaterThan(0);

    snapping.reset();
    expect(snapping.result).to.deep.equal({});
    expect(snapping.getSnappingVisualizations()).to.deep.equal([]);
  });
});
});
