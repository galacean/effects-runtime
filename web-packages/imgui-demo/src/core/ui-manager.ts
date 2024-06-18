import type { EditorWindow } from '../panels/panel';
import { Editor } from '../panels/editor';
import { MenuItemNode, MenuNode } from '../widgets/menu-item';
import { ImGui } from '../imgui';
import { editorWindowStore, menuItemStore } from './decorators';

export class UIManager {
  private static panels: EditorWindow[] = [];
  private editor: Editor = new Editor();
  private menuNodes: MenuNode[] = [];

  constructor () {
    for (const path of Object.keys(menuItemStore)) {
      this.addMenuItem(path, menuItemStore[path]);
    }

    for (const key of Object.keys(editorWindowStore)) {
      UIManager.panels.push(new editorWindowStore[key]());
    }
  }

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    let res;

    for (const panel of UIManager.panels) {
      if (panel instanceof type) {
        res = panel;

        break;
      }
    }

    return res as T;
  }

  draw () {
    for (const panel of UIManager.panels) {
      panel.draw();
    }
    this.editor.draw();

    if (ImGui.BeginMainMenuBar()) {
      if (ImGui.BeginMenu('File')) {
        // ShowExampleMenuFile();
        ImGui.EndMenu();
      }
      if (ImGui.BeginMenu('Edit')) {
        if (ImGui.BeginMenu('Test')) {
          // ShowExampleMenuFile();
          ImGui.EndMenu();
        }
        // if (ImGui.MenuItem('Undo', 'CTRL+Z')) {}
        // if (ImGui.MenuItem('Redo', 'CTRL+Y', false, false)) {}  // Disabled item
        // ImGui.Separator();
        // if (ImGui.MenuItem('Cut', 'CTRL+X')) {}
        // if (ImGui.MenuItem('Copy', 'CTRL+C')) {}
        // if (ImGui.MenuItem('Paste', 'CTRL+V')) {}
        ImGui.EndMenu();
      }
      for (const menuNode of this.menuNodes) {
        menuNode.draw();
      }
      ImGui.EndMainMenuBar();
    }
  }

  addMenuItem (path: string, showFunction: () => void) {
    const nodePath = path.split('/');
    const rootNodeName = nodePath[0];

    nodePath.shift();

    let rootMenuNode: MenuNode | undefined;

    for (const menuNode of this.menuNodes) {
      if (menuNode.name === rootNodeName) {
        rootMenuNode = menuNode;
      }
    }

    if (!rootMenuNode) {
      if (nodePath.length === 0) {
        const rootMenuItemNode = new MenuItemNode(rootNodeName);

        rootMenuItemNode.onClick = showFunction;
        this.menuNodes.push(rootMenuItemNode);

        return;
      }
      rootMenuNode = new MenuNode(rootNodeName);
      this.menuNodes.push(rootMenuNode);
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
}