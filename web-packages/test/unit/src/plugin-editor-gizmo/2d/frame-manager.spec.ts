import { restoreTestState } from '../helpers/spies';
import type { Engine } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { FrameLayoutMode, FrameManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

const { expect } = chai;

describe('plugin-editor-gizmo/frame-manager', () => {
  afterEach(restoreTestState);

  function box (width: number, height: number): Box2 {
    return new Box2(new Vector2(), new Vector2(width, height));
  }

  describe('FrameManager', () => {

    it('stores and snapshots VFXItem instance IDs without host ID translation', () => {
      const frames = new FrameManager({} as unknown as Engine);

      frames.upsertFrame({
        id: 'runtime:frame-1',
        layoutMode: FrameLayoutMode.AUTO,
        children: ['runtime:child-1'],
        layoutInfos: { 'runtime:child-1': { row: 1, column: 2 } },
      });

      const snapshot = frames.snapshot();

      expect(snapshot).to.have.lengthOf(1);
      expect(snapshot[0].id).to.equal('runtime:frame-1');
      expect(snapshot[0].children).to.deep.equal(['runtime:child-1']);
      expect(snapshot[0].layoutInfos['runtime:child-1']).to.include({ row: 1, column: 2 });
      expect(frames.getViewInfo('runtime:frame-1')).to.deep.include({
        id: 'runtime:frame-1',
        children: ['runtime:child-1'],
      });
      expect(frames.getParentFrame('runtime:child-1')?.id).to.equal('runtime:frame-1');
    });

    it('computes reorder metadata without mutating the current record', () => {
      const frames = new FrameManager({} as unknown as Engine);

      frames.upsertFrame({
        id: 'frame',
        children: ['a', 'b', 'c'],
        layoutInfos: {
          a: { row: 0, column: 0 },
          b: { row: 0, column: 1 },
          c: { row: 1, column: 0 },
        },
      });

      const next = frames.computeLayoutInfosAfterReorder('frame', 'a', 0, 0, 1, 0);

      expect(next).to.deep.equal({
        a: { row: 1, column: 0, position: undefined },
        b: { row: 0, column: 0, position: undefined },
        c: { row: 1, column: 1, position: undefined },
      });
      expect(frames.getFrame('frame')?.layoutInfos.a).to.include({ row: 0, column: 0 });
    });

    it('owns automatic-layout calculation and reads layout constraints from the record', () => {
      const frames = new FrameManager({} as unknown as Engine);

      frames.upsertFrame({ id: 'frame', children: ['a', 'b'] });

      const result = frames.computeAutoLayout('frame', [
        { id: 'a', box: box(20, 10) },
        { id: 'b', box: box(20, 10) },
      ], { padding: 10, gap: 5 });

      expect(result).to.deep.equal({
        items: [
          { id: 'a', position: [20, 15], row: 0, column: 0 },
          { id: 'b', position: [45, 15], row: 0, column: 1 },
        ],
        size: [65, 30],
      });
    });
  });
});
