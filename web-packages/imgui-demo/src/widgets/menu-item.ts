import { ImGui } from '../imgui';

export class MenuNode {
  name: string = '';
  priority = 0;
  private children: MenuNode[] = [];

  constructor (name: string, priority = 0) {
    this.name = name;
    this.priority = priority;
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

  sortChildren () {
    this.children.sort((a, b) => a.priority - b.priority);
    for (const child of this.children) {
      child.sortChildren();
    }
  }
}

export class MenuItemNode extends MenuNode {
  onClick: () => void;
  shortcut = '';

  override draw (): void {
    if (ImGui.MenuItem(this.name, this.shortcut)) {
      this.onClick();
    }
  }

  override sortChildren () {
    // leaf node, no children
  }
}
