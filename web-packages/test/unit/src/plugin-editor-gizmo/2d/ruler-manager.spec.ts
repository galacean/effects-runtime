import { RulerManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/ruler-manager';

const { expect } = chai;

describe('plugin-editor-gizmo/ruler-manager', () => {
  it('隔离快照并在 Gizmo 重建间保持数据', () => {
    const manager = new RulerManager();
    const guides = { horizontal: [20], vertical: [40] };

    manager.setGuides(guides);
    guides.horizontal[0] = 80;

    expect(manager.snapshot()).to.deep.equal({ horizontal: [20], vertical: [40] });
    manager.hydrate({ horizontal: [60], vertical: [] });
    expect(manager.guides).to.deep.equal({ horizontal: [60], vertical: [] });
  });
});
