import { objectInspector } from '../core/decorators';
import { AnimationClipGraphNode } from '../panels/node-graph/animation-graph-nodes/animation-graph-node';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { ObjectInspector } from './object-inspectors';

@objectInspector(AnimationClipGraphNode)
export class AnimationClipGraphNodeInspector extends ObjectInspector {
  override onGUI (): void {
    const activeObject = this.activeObject as AnimationClipGraphNode;

    if (activeObject instanceof AnimationClipGraphNode) {
      EditorGUILayout.TextField('Resource ID', activeObject, 'resourceID');
    }
  }
}