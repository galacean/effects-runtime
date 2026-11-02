import type { MenuAction } from '../controls/menu';

export class MenuNode {
  name: string = '';
  priority = 0;
  private children: MenuNode[] = [];

  constructor (name: string, priority = 0) {
    this.name = name;
    this.priority = priority;
  }

  action (): MenuAction { return { label: this.name, children: this.children.map(child => child.action()) }; }

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

  override action (): MenuAction { return { label: this.name, shortcut: this.shortcut, action: this.onClick }; }

  override sortChildren () {
    // leaf node, no children
  }
}
