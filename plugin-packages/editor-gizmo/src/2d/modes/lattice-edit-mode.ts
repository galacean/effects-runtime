import type { VFXItem } from '@galacean/effects';
import { CrystalLatticeGizmo } from '../gizmos/crystal-lattice-gizmo';
import { SelectionContentEditMode } from './selection-content-edit-mode';

/** 编辑选中元素的 FFD 控制点，管理晶格拖拽的提交与取消。 */
export class LatticeEditMode extends SelectionContentEditMode {
  readonly id = 'lattice-edit';
  readonly edit = { type: 'lattice' } as const;

  protected override createContentGizmo (item: VFXItem, onDispose: () => void): CrystalLatticeGizmo {
    return new CrystalLatticeGizmo(this.owner, item, this.exit, onDispose);
  }
}
