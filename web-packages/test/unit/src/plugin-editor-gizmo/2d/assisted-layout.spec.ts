import { restoreTestState } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

import { FrameComponent, spec, type Engine, type VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { AssistedLayout } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/frame-assisted-layout';
import { FrameLayoutMode, type FrameInfo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/types';
import type { FrameManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/frame-manager';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxTransformFromBox } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';

const { expect } = chai;

describe('plugin-editor-gizmo/assisted-layout', () => {
  afterEach(restoreTestState);

type TestItem = VFXItem;

function box (minX: number, minY: number, maxX: number, maxY: number): Box2 {
  return new Box2(new Vector2(minX, minY), new Vector2(maxX, maxY));
}

function item (
  id: string,
  options: {
    kind?: 'frame' | 'effects' | 'group',
    itemBox?: Box2,
    children?: TestItem[],
  } = {},
): TestItem {
  const value = {
    getInstanceId: () => id,
    type: options.kind ? spec.ItemType.null : spec.ItemType.sprite,
    name: options.kind === 'frame' ? '画板' : options.kind === 'effects' ? '特效' : id,
    getComponent: (component: unknown) => component === FrameComponent && (options.kind === 'frame' || options.kind === 'effects') ? {} : undefined,
    children: options.children ?? [],
    isVisible: true,
  } as unknown as TestItem;

  setItemViewTransform(value, getBoxTransformFromBox(options.itemBox ?? new Box2()));

  return value;
}

function frame (
  id: string,
  frameBox: Box2,
  children: string[] = [],
  layoutMode = FrameLayoutMode.FREE,
  layoutInfos: FrameInfo['layoutInfos'] = {},
): FrameInfo {
  return { id, box: frameBox, children, layoutMode, layoutInfos };
}

function setup (frameInfos: FrameInfo[], items: TestItem[]): GizmoOwner {
  const engine = {
    canvas: { parentElement: { offsetWidth: TEST_VIEW_SIZE.x, offsetHeight: TEST_VIEW_SIZE.y } },
    sceneServer: { compositions: [{ items }] },
  } as unknown as Engine;
  const frames = {
    updateViewBoxes: chai.spy(),
    getViewInfos: () => frameInfos,
    getViewInfo: (id: string) => frameInfos.find(info => info.id === id),
    getParentFrame: (id: string) => frameInfos.find(info => info.children.includes(id)),
    findFrameAt: (pointer: Vector2) => frameInfos.find(info => info.box.containsPoint(pointer)),
  } as unknown as FrameManager;

  return {
    getEngine: () => engine,
    getFrameManager: () => frames,
  } as unknown as GizmoOwner;
}

describe('AssistedLayout', () => {
  it('records an independent original frame for every selected item', () => {
    const one = item('one');
    const two = item('two');
    const owner = setup([
      frame('frame-a', box(0, 0, 100, 100), ['one']),
      frame('frame-b', box(120, 0, 220, 100), ['two']),
    ], [one, two]);
    const assisted = new AssistedLayout(owner);
    const updateViewBoxes = owner.getFrameManager().updateViewBoxes;

    assisted.begin([one, two]);

    expect(assisted.resolveReparent(new Vector2(400, 400))).to.deep.equal([
      { type: 'moveOut', itemIds: ['one'], originalFrameId: 'frame-a' },
      { type: 'moveOut', itemIds: ['two'], originalFrameId: 'frame-b' },
    ]);
    expect(updateViewBoxes).to.have.been.called.once;
  });

  it('moves eligible items into a FREE frame and skips Frame/Effects items', () => {
    const normal = item('normal');
    const frameItem = item('nested-frame', { kind: 'frame' });
    const effectsItem = item('effects', { kind: 'effects' });
    const target = frame('target', box(0, 0, 100, 100));
    const assisted = new AssistedLayout(setup([target], [normal, frameItem, effectsItem]));

    assisted.begin([normal, frameItem, effectsItem]);

    expect(assisted.resolveReparent(new Vector2(50, 50))).to.deep.equal([
      { type: 'moveIn', itemIds: ['normal'], targetFrameId: 'target' },
    ]);
    expect(assisted.resolveReparent(new Vector2(50, 50))).to.deep.equal([]);
  });

  it('does not move another selected item into a selected frame while dragging them together', () => {
    const normal = item('normal');
    const selectedFrameItem = item('selected-frame', { kind: 'frame' });
    const selectedFrame = frame('selected-frame', box(0, 0, 100, 100));
    const assisted = new AssistedLayout(setup([selectedFrame], [normal, selectedFrameItem]));

    assisted.begin([selectedFrameItem, normal]);

    expect(assisted.resolveReparent(new Vector2(50, 50))).to.deep.equal([]);
  });

  it('defers partial group-child detach until finish', () => {
    const inside = item('inside', { itemBox: box(20, 20, 40, 40) });
    const outside = item('outside', { itemBox: box(150, 20, 170, 40) });
    const group = item('group', { kind: 'group', children: [inside, outside] });
    const target = frame('target', box(0, 0, 100, 100));
    const assisted = new AssistedLayout(setup([target], [group, inside, outside]));

    assisted.begin([group]);

    expect(assisted.resolveReparent(new Vector2(50, 50))).to.deep.equal([
      {
        type: 'moveIn',
        itemIds: ['group', 'inside', 'outside'],
        targetFrameId: 'target',
      },
    ]);
    expect(assisted.finish().placementChanges).to.deep.equal([
      {
        type: 'detachGroupChildren',
        groupId: 'group',
        itemIds: ['outside'],
        originalFrameId: 'target',
      },
    ]);
  });

  it('produces the final AUTO layout change after placement is applied', () => {
    const dragged = item('dragged');
    const autoFrame = frame(
      'auto',
      box(0, 0, 100, 100),
      ['dragged'],
      FrameLayoutMode.AUTO,
      { dragged: { row: 2, column: 1 } },
    );
    const assisted = new AssistedLayout(setup([autoFrame], [dragged]));

    assisted.begin([dragged]);
    assisted.updateAutoLayout(new Vector2(50, 50));

    expect(assisted.finish().autoLayoutChange).to.deep.equal({
      frameId: 'auto',
      draggedItemId: 'dragged',
      fromRow: 2,
      fromColumn: 1,
      toRow: 0,
      toColumn: 0,
    });
  });

  it('cancel clears pending placement and AUTO layout state', () => {
    const dragged = item('dragged');
    const autoFrame = frame('auto', box(0, 0, 100, 100), ['dragged'], FrameLayoutMode.AUTO);
    const assisted = new AssistedLayout(setup([autoFrame], [dragged]));

    assisted.begin([dragged]);
    assisted.updateAutoLayout(new Vector2(50, 50));
    assisted.cancel();

    expect(assisted.finish()).to.deep.equal({ placementChanges: [], autoLayoutChange: undefined });
  });
});
});
