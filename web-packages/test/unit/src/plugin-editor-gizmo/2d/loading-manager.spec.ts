import { restoreTestState, getSpyCalls } from '../helpers/spies';
import type { Texture } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { LoadingManager, LoadingTextTipType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/loading-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/loading-manager', () => {
  afterEach(restoreTestState);

  describe('LoadingManager', () => {
    it('stores loading state independently of a Gizmo instance', () => {
      const manager = new LoadingManager();
      const change = chai.spy();
      const removeSelectedItems = chai.spy();

      manager.on('change', change);
      manager.on('removeselecteditems', removeSelectedItems);

      const loadingBox = new Box2(new Vector2(1, 2), new Vector2(3, 4));
      const position = new Vector2(12, 8);

      manager.add('item-a', {
        type: LoadingTextTipType.TEXT,
        text: 'Loading',
        position,
        loadingBox,
        clearSelected: true,
      });
      position.x = 99;
      loadingBox.min.x = 99;

      expect(manager.ids).to.deep.equal(['item-a']);
      expect(manager.get('item-a')).to.have.deep.nested.property('text', 'Loading');
      expect(manager.get('item-a')).to.have.deep.nested.property('position.x', 12);
      expect(manager.get('item-a')).to.have.deep.nested.property('position.y', 8);
      expect(manager.get('item-a')?.position).to.be.instanceOf(Vector2);
      expect(manager.get('item-a')?.position).not.to.equal(position);
      expect(manager.get('item-a')?.loadingBox).not.to.equal(loadingBox);
      expect(manager.get('item-a')?.loadingBox).to.deep.equal(new Box2(new Vector2(1, 2), new Vector2(3, 4)));
      expect(getSpyCalls(change).at(-1)).to.deep.equal([{
        ids: ['item-a'],
        addedIds: ['item-a'],
        removedIds: [],
        updatedIds: [],
      }]);
      expect(removeSelectedItems).to.have.been.called.with.exactly(['item-a']);

      const nextPosition = new Vector2(4, 6);

      manager.update('item-a', { type: LoadingTextTipType.TEXT, text: 'Almost done', position: nextPosition });
      nextPosition.y = 99;
      expect(manager.get('item-a')).to.have.property('text', 'Almost done');
      expect(manager.get('item-a')?.position).to.deep.equal({ x: 4, y: 6 });
      expect(manager.get('item-a')?.position).to.be.instanceOf(Vector2);

      manager.update('item-a', { type: LoadingTextTipType.TEXT, text: 'Almost done', position: undefined });
      expect(manager.get('item-a')?.position).to.deep.equal({ x: 4, y: 6 });

      manager.delete('item-a');
      expect(manager.ids).to.deep.equal([]);
      expect(getSpyCalls(change).at(-1)).to.deep.equal([{
        ids: [],
        addedIds: [],
        removedIds: ['item-a'],
        updatedIds: [],
      }]);
    });

    it('ignores duplicate add and missing delete', () => {
      const manager = new LoadingManager();
      const change = chai.spy();

      manager.on('change', change);

      manager.add('item-a');
      manager.add('item-a');
      manager.delete('missing');

      expect(change).to.have.been.called.once;
    });

    it('switches text to texture, advances frames and returns to text with the loading area preserved', () => {
      const manager = new LoadingManager();
      const dispose = chai.spy();
      const first = { dispose } as unknown as Texture;
      const next = { dispose } as unknown as Texture;
      const loadingBox = new Box2(new Vector2(10, 20), new Vector2(42, 52));

      manager.add('item-a', { type: LoadingTextTipType.TEXT, text: 'Loading', loadingBox });
      manager.update('item-a', { type: LoadingTextTipType.TEXTURE, texture: first });
      expect(manager.get('item-a')).to.have.property('texture', first);
      expect(manager.get('item-a')).not.to.have.property('text');
      manager.update('item-a', { type: LoadingTextTipType.TEXTURE, texture: next });
      expect(manager.get('item-a')).to.have.property('texture', next);
      expect(manager.get('item-a')?.loadingBox).to.deep.equal(loadingBox);
      manager.update('item-a', { type: LoadingTextTipType.TEXT, text: 'Almost done' });
      expect(manager.get('item-a')).to.have.property('text', 'Almost done');
      expect(manager.get('item-a')).not.to.have.property('texture');
      manager.delete('item-a');
      expect(manager.ids).to.deep.equal([]);
      expect(dispose).not.to.have.been.called();
    });

  });
});
