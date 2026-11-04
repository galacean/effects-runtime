import type { Engine, GraphInstance } from '@galacean/effects';
import { ControlParameterBoolNodeData, ControlParameterTriggerNodeData } from '@galacean/effects';
import { PropertySheet } from '../../../ui/property-editor/property-sheet';

export class AnimationGraphParametersPanel extends PropertySheet {
  private graphInstance?: GraphInstance | null;
  constructor (engine: Engine) { super(engine, { change: (_name, _owner, action) => action(), finish: () => {} }); this.setGraphInstance(null); }
  setGraphInstance (graph: GraphInstance | null): void {
    if (graph === this.graphInstance) { return; }
    this.graphInstance = graph; this.clear();
    const group = this.section('parameters', 'Parameters');

    if (!graph || !graph.getNumControlParameters()) {
      group.readOnly('Parameters', () => 'No parameters found');

      return;
    }
    for (let index = 0; index < graph.getNumControlParameters(); index++) {
      const name = graph.getControlParameterID(index), data = graph.getNodeDebugInstance(index).getNodeData();

      if (data instanceof ControlParameterTriggerNodeData) { group.button(name, 'Fire', () => graph.setTrigger(name)); } else if (data instanceof ControlParameterBoolNodeData) { group.boolean(name, { read: () => graph.isInitialized() ? graph.getRuntimeNodeDebugValue<boolean>(index) : false, write: value => graph.setBool(name, value) }); } else { group.number(name, { read: () => graph.isInitialized() ? graph.getRuntimeNodeDebugValue<number>(index) : 0, write: value => graph.setFloat(name, value) }, { step: .01, precision: 3 }); }
    }
    this.refresh();
  }
}
