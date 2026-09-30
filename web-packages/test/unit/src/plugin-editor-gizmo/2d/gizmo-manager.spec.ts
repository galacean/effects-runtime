import { restoreTestState } from '../helpers/spies';
import { GizmoManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import type { Gizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

const { expect } = chai;

describe('plugin-editor-gizmo/gizmo-manager', () => {
  afterEach(restoreTestState);

  function stubGizmo (
    type: string,
    options: {
      dispose?: () => void,
      onUpdate?: () => void,
    } = {},
  ): Gizmo {
    return {
      type,
      dispose: options.dispose ?? (() => {}),
      onUpdate: options.onUpdate ?? (() => {}),
      onMouseDown: () => false,
      onMouseMove: () => false,
      onMouseUp: () => false,
      onMouseLeave () {},
      onKeyDown () {},
      onKeyUp () {},
      applyOverride () {},
      getConfig () {
        return undefined;
      },
    } as unknown as Gizmo;
  }

  describe('GizmoManager - State instance graph', () => {
    it('onUpdate 按 activeGizmos 顺序且每个只转发一次', () => {
      const manager = new GizmoManager();
      const order: string[] = [];
      const first = stubGizmo('first', { onUpdate: chai.spy(() => order.push('first')) });
      const second = stubGizmo('second', { onUpdate: chai.spy(() => order.push('second')) });

      manager.activeGizmos = [first, second];

      manager.onUpdate();

      expect(order).to.deep.equal(['first', 'second']);
      expect(first.onUpdate).to.have.been.called.once;
      expect(second.onUpdate).to.have.been.called.once;
    });

    it('整体入表后可查询兄弟 Gizmo', () => {
      const manager = new GizmoManager();
      const resizeSelection = stubGizmo('resize-selection');
      const move = stubGizmo('move-selection');

      manager.activeGizmos = [resizeSelection, move];

      expect(manager.get('move-selection')).to.equal(move);
      expect(manager.activeGizmos).to.deep.equal([resizeSelection, move]);
    });

    it('mode 替换不销毁旧图，实例销毁留给 GestureHandler', () => {
      const manager = new GizmoManager();
      const firstDispose = chai.spy();
      const first = stubGizmo('resize-selection', { dispose: firstDispose });
      const second = stubGizmo('resize-selection');

      manager.activeGizmos = [first];
      manager.activeGizmos = [second];

      expect(firstDispose).not.to.have.been.called();
      expect(manager.get('resize-selection')).to.equal(second);
      expect(manager.get('resize-selection')).not.to.equal(first);
    });

    it('dispose 销毁最终 active 实例', () => {
      const manager = new GizmoManager();
      const gizmoDispose = chai.spy();
      const gizmo = stubGizmo('first', { dispose: gizmoDispose });

      manager.activeGizmos = [gizmo];

      manager.dispose();

      expect(manager.activeGizmos).to.deep.equal([]);
      expect(gizmoDispose).to.have.been.called.once;
    });
  });
});
