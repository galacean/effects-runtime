import { restoreTestState } from '../helpers/spies';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { SpriteTextEditGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/sprite-text-edit-gizmo';

const { expect } = chai;

describe('plugin-editor-gizmo/sprite-text-edit-gizmo', () => {
  afterEach(restoreTestState);

  describe('SpriteTextEditGizmo initialization', () => {
    it('uses the current item box when originBox is omitted on first entry', () => {
      const gizmo = new SpriteTextEditGizmo({
        getEngine: () => ({}),
      } as unknown as GizmoOwner);
      const originBox = new Box2(
        new Vector2(100, 200),
        new Vector2(300, 400),
      )

    ;(gizmo as unknown as {
        getItemOriginBox: (id: string) => Box2,
      }).getItemOriginBox = () => originBox;

      gizmo.initResult([{
        id: 'sprite',
        info: [{
          text: 'first entry',
          hasChanged: false,
          box: [[0, 0], [100, 0], [100, 100], [0, 100]],
        }],
      }]);

      expect(gizmo.result).to.have.lengthOf(1);
      expect(gizmo.result[0]).to.deep.include({
        id: 'sprite',
        text: 'first entry',
        hasChanged: false,
      });
      expect(gizmo.result[0].box.min).to.deep.equal(new Vector2(0, 0));
      expect(gizmo.result[0].box.max).to.deep.equal(new Vector2(0.5, 0.5));
    });
  });
});
