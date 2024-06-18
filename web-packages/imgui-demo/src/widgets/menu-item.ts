import { ImGui } from '../imgui';

export const menuNodeStore: MenuNode[] = [];

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

export function addMenuItem (path: string, showFunction: () => void) {
  const nodePath = path.split('/');
  const rootNodeName = nodePath[0];

  nodePath.shift();

  let rootMenuNode: MenuNode | undefined;

  for (const menuNode of menuNodeStore) {
    if (menuNode.name === rootNodeName) {
      rootMenuNode = menuNode;
    }
  }

  if (!rootMenuNode) {
    if (nodePath.length === 0) {
      const rootMenuItemNode = new MenuItemNode(rootNodeName);

      rootMenuItemNode.onClick = showFunction;
      menuNodeStore.push(rootMenuItemNode);

      return;
    }
    rootMenuNode = new MenuNode(rootNodeName);
    menuNodeStore.push(rootMenuNode);
  }

  let currentMenuNode = rootMenuNode;

  while (nodePath.length > 1) {
    const nodeName = nodePath.shift();

    if (!nodeName) {
      return;
    }

    let nextMenuNode = currentMenuNode.findMenuNode(nodeName);

    if (!nextMenuNode) {
      nextMenuNode = new MenuNode(nodeName);
      currentMenuNode.addMenuNode(nextMenuNode);
    }

    currentMenuNode = nextMenuNode;
  }

  const menuItemName = nodePath.shift();

  if (!menuItemName) {
    return;
  }

  const newMenuItem = new MenuItemNode(menuItemName);

  newMenuItem.onClick = showFunction;
  currentMenuNode.addMenuNode(newMenuItem);
}