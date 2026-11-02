import type * as NodeGraph from '../../../../ui/graph-editor/index';
import { AnimationGraphNode } from './flow-editor-node';

export abstract class DataSlotEditorNode extends AnimationGraphNode {
  m_defaultResourceID: string;

  constructor () {
    super();
    this.Rename(this.GetDefaultSlotName());
  }

  override IsRenameable (): boolean {
    return true;
  }

  override RequiresUniqueName (): boolean {
    return true;
  }

  protected GetDefaultSlotName (): string {
    return 'Slot';
  }

}
