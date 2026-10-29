import { beginEditorMenu, endEditorMenu, editorMenuItem } from './editor-menu';

export class MenuNode {
  name: string = '';
  priority = 0;
  private children: MenuNode[] = [];

  constructor (name: string, priority = 0) {
    this.name = name;
    this.priority = priority;
  }

  draw (menuBar = false) {
    if (beginEditorMenu(this.name, true, menuBar)) {
      for (const child of this.children) {
        child.draw();
      }
      endEditorMenu();
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
    if (editorMenuItem(this.name, this.shortcut)) {
      this.onClick();
    }
  }

  override sortChildren () {
    // leaf node, no children
  }
}
