import { ImGui } from '../imgui';

export class MenuNode {
  name: string = '';
  private children: MenuNode[] = [];

  constructor (name: string) {
    this.name = name;
  }

  draw () {
    if (ImGui.BeginMenu(this.name)) {
      for (const child of this.children) {
        child.draw();
      }
      ImGui.EndMenu();
    }
  }

  findMenuNode (name: string) {
    for (const child of this.children) {
      if (child.name === name) {
        return child;
      }
    }
  }

  addMenuNode (menuNode: MenuNode) {
    if (this.findMenuNode(menuNode.name)) {
      console.error('MenuNode ' + menuNode.name + ' is already added');
    }
    this.children.push(menuNode);
  }
}

export class MenuItemNode extends MenuNode {
  onClick: () => void;

  override draw (): void {
    if (ImGui.MenuItem(this.name)) {this.onClick();}
    // if (ImGui.MenuItem('Undo', 'CTRL+Z')) {}
    // if (ImGui.MenuItem('Redo', 'CTRL+Y', false, false)) {}  // Disabled item
    // ImGui.Separator();
    // if (ImGui.MenuItem('Cut', 'CTRL+X')) {}
    // if (ImGui.MenuItem('Copy', 'CTRL+C')) {}
    // if (ImGui.MenuItem('Paste', 'CTRL+V')) {}
    // ImGui.EndMenu();
  }
}