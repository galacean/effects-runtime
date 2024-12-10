import type { Composition } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { BaseNode } from './base-node';
import { ImNodeFlow } from './node-flow';
import type { InPin, OutPin } from './pin';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

@editorWindow()
export class NodeGraph extends EditorWindow {
  currentComposition: Composition;
  imNode = new ImNodeFlow();

  @menuItem('Window/NodeGraph')
  static showWindow () {
    EditorWindow.getWindow(NodeGraph).open();
  }

  constructor () {
    super();
    this.title = 'NodeGraph';
    this.open();

    const node = this.imNode.addNode(TestNode, new ImVec2(500, 100));
    const node2 = this.imNode.addNode(TestNode, new ImVec2(200, 150));
    const node3 = this.imNode.addNode(TestNode, new ImVec2(500, 250));

    // node.setTitle('TestNode');

    // node.addOUT('Test');
    // const pinIn = node.addIN('Test In', '', ()=>true);
    // const pinOut = node2.addOUT('Test Out');

    // node3.addIN('Test In', '', ()=>true).createLink(pinOut);

    // pinIn.createLink(pinOut);
  }

  protected override onGUI (): void {

    this.imNode.update();
  }
}

class TestNode extends BaseNode {

  pinIn: InPin<number>;
  pinOut: OutPin<number>;

  valB = 0;

  constructor (inf: ImNodeFlow) {
    super(inf);
    this.setTitle('TestNode');
    this.pinIn = this.addIN('Test In', 0, ()=>true);
    this.addOUT('Test Out').behaviour(()=>{
      return this.valB;
    });
  }

  override draw (): void {
    ImGui.SetNextItemWidth(100);
    if (this.pinIn.isConnected()) {
      this.valB = this.pinIn.val();
    }
    ImGui.DragFloat('##ValB', (_ = this.valB) => this.valB = _);
  }
}