import { CompositionComponent, type Composition } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { BaseNode } from './base-node';
import { ImNodeFlow } from './node-flow';
import type { InPin, OutPin } from './pin';
import { GalaceanEffects } from '../../ge';

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

    // const node = this.imNodeFlow.addNode(PlayableNode, new ImVec2(500, 100));
    // const node2 = this.imNodeFlow.addNode(PlayableNode, new ImVec2(200, 150));
    // const node3 = this.imNodeFlow.addNode(PlayableNode, new ImVec2(500, 250));

    // node.setTitle('TestNode');

    // node.addOUT('Test');
    // const pinIn = node.addIN('Test In', '', ()=>true);
    // const pinOut = node2.addOUT('Test Out');

    // node3.addIN('Test In', '', ()=>true).createLink(pinOut);

    // pinIn.createLink(pinOut);
  }

  graph: any;

  protected override onGUI (): void {

    const currentCompsition = GalaceanEffects.player.getCompositions()[0];

    if (!currentCompsition) {
      return;
    }

    //@ts-expect-error
    const currentGraph = currentCompsition.rootItem.getComponent(CompositionComponent).graph;

    if (this.graph !== currentGraph) {
      this.graph = currentGraph;
      this.imNodeFlow.getNodes().clear();
      this.imNodeFlow.getLinks().length = 0;

      const windowSize = ImGui.GetWindowSize();
      const rootNodePosition = new ImVec2(windowSize.x - 50, windowSize.y / 2);
      const rootNode = this.imNodeFlow.addNode(PlayableNode, rootNodePosition);

      //@ts-expect-error
      const timelinePlayable = currentCompsition.rootItem.getComponent(CompositionComponent).timelinePlayable;

      rootNode.playable = timelinePlayable;

      this.generateGraphNode(rootNode);
    }

    this.imNodeFlow.update();
  }

  generateGraphNode (node: PlayableNode) {
    const childNodePos = new ImVec2(node.getPos().x - 300, node.getPos().y - 100 * node.playable.getInputCount() / 2);

    for (const playable of node.playable.getInputs()) {
      const childNode = this.imNodeFlow.addNode(PlayableNode, childNodePos);

      childNode.playable = playable;
      childNodePos.y += 100;

      node.pinIn.createLink(childNode.pinOut);

      this.generateGraphNode(childNode);
    }
  }
}

class PlayableNode extends BaseNode {

  pinIn: InPin<number>;
  pinOut: OutPin<number>;

  valB = 0;

  playable: any;

  constructor (inf: ImNodeFlow) {
    super(inf);
    this.setTitle('Playable');
    this.pinIn = this.addIN('In', 0, ()=>true);
    this.pinOut = this.addOUT('Out');
    this.pinOut.behaviour(()=>{
      return this.valB;
    });
  }

  override draw (): void {
    this.setTitle(this.playable.constructor.name);
    ImGui.SetNextItemWidth(80);
    if (this.pinIn.isConnected()) {
      this.valB = this.pinIn.val();
    }

    ImGui.InputFloat('', (_ = this.playable.getTime())=>{
      this.playable.setTime(_);

      return this.playable.getTime();
    });
    // ImGui.InputInt('##ValB', (_ = this.pinOut.m_links.length) => this.pinOut.m_links.length);
  }
}