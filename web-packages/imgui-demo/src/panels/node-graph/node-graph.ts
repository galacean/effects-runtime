import { CompositionComponent, VFXItem, type Composition } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { BaseNode } from './base-node';
import { ImNodeFlow } from './node-flow';
import type { InPin, OutPin } from './pin';
import { Selection } from '../../core/selection';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

@editorWindow()
export class NodeGraph extends EditorWindow {
  currentComposition: Composition;
  imNodeFlow = new ImNodeFlow();

  @menuItem('Window/NodeGraph')
  static showWindow () {
    EditorWindow.getWindow(NodeGraph).open();
  }

  constructor () {
    super();
    this.title = 'NodeGraph';
    this.open();
    this.setWindowFlags(ImGui.WindowFlags.NoScrollWithMouse | ImGui.WindowFlags.NoScrollbar);
  }

  graph: any;

  protected override onGUI (): void {
    if (!(Selection.activeObject instanceof VFXItem)) {
      return;
    }

    const compositionComponent = Selection.activeObject.getComponent(CompositionComponent);

    if (!compositionComponent) {
      return;
    }
    //@ts-expect-error
    const currentGraph = compositionComponent.graph;

    if (this.graph !== currentGraph) {
      this.graph = currentGraph;
      this.imNodeFlow.getNodes().clear();
      this.imNodeFlow.getLinks().length = 0;

      const windowSize = ImGui.GetWindowSize();
      const rootNodePosition = new ImVec2(windowSize.x - 400, 200);

      for (const output of (this.graph).playableOutputs) {
        const playable = output.sourcePlayable;
        const rootNode = this.imNodeFlow.addNode(PlayableNode, rootNodePosition, playable, playable.clipPlayables.length);

        rootNode.playable = playable;

        this.generateGraphNode(rootNode);
        rootNodePosition.y += 100;
      }
    }

    this.imNodeFlow.update();
  }

  generateGraphNode (node: PlayableNode) {
    const playable = node.playable;

    if (playable.clipPlayables) {
      const childNodePos = new ImVec2(node.getPos().x - 300, node.getPos().y - 100 * playable.clipPlayables.length / 2);

      for (let i = 0;i < playable.clipPlayables.length;i++) {
        const clipPlayable = playable.getClipPlayable(i);
        const childNode = this.imNodeFlow.addNode(PlayableNode, childNodePos, clipPlayable);

        childNode.playable = clipPlayable;
        childNodePos.y += 100;

        node.pinIns[i].createLink(childNode.pinOut);

        this.generateGraphNode(childNode);
      }
    }
  }
}

class PlayableNode extends BaseNode {

  pinIns: InPin<number>[] = [];
  pinOut: OutPin<number>;

  valB = 0;

  playable: any;

  constructor (inf: ImNodeFlow, playable: any, inputCount: number) {
    super(inf);
    this.setTitle('Playable');
    for (let i = 0;i < inputCount;i++) {
      this.pinIns.push(this.addIN('In' + i, 0, ()=>true));
    }
    this.pinOut = this.addOUT('Out');
    this.pinOut.behaviour(()=>{
      return this.valB;
    });
  }

  override draw (): void {
    this.setTitle(this.playable.constructor.name);
    ImGui.SetNextItemWidth(100 * this.getHandler()!.getGrid().scale());
    // if (this.pinIns[0].isConnected()) {
    //   this.valB = this.pinIns[0].val();
    // }
    ImGui.ProgressBar(this.playable.getTime() / this.playable.getDuration(), new ImGui.Vec2(0.0, 0.0));
    // ImGui.InputFloat('', (_ = this.playable.getTime())=>{
    //   this.playable.setTime(_);

    //   return this.playable.getTime();
    // });
    // ImGui.SetNextItemWidth(80);
    // ImGui.InputInt('##ValB', (_ = this.pinOut.m_links.length) => this.pinOut.m_links.length);
  }
}