import type { Editor } from '../custom-editors/editor';
import { ImGui } from '../imgui';
import { type EditorWindow } from '../panels/editor-window';
import { MenuItemNode, MenuNode } from '../widgets/menu-item';
import { editorStore, editorWindowStore, menuItemStore } from './decorators';

export class UIManager {
  // Custom component inspector GUI
  static customEditors = new Map<Function, Editor>();

  // Custom window GUI
  private static editorWindows: EditorWindow[] = [];

  // Top menu nodes
  private menuNodes: MenuNode[] = [];

  private showCanvas = false;

  constructor () {
  }

  createWindows () {
    for (const path of Object.keys(menuItemStore)) {
      this.addMenuItem(path, menuItemStore[path]);
    }

    for (const editorWindowClass of editorWindowStore) {
      UIManager.editorWindows.push(new editorWindowClass());
    }

    for (const key of editorStore.keys()) {
      const customEditorClass = editorStore.get(key);

      if (!customEditorClass) {
        continue;
      }
      UIManager.customEditors.set(key, new customEditorClass());
    }
  }

  static getWindow<T extends EditorWindow> (type: new () => T): T {
    let res;

    for (const panel of UIManager.editorWindows) {
      if (panel instanceof type) {
        res = panel;

        break;
      }
    }

    return res as T;
  }

  draw () {
    for (const panel of UIManager.editorWindows) {
      panel.draw();
    }

    const geContainer = document.getElementById('J-container');

    if (geContainer) {
      if (this.showCanvas) {
        geContainer.style.zIndex = '999';
      } else {
        geContainer.style.zIndex = '0';
      }
    }

    if (ImGui.BeginMainMenuBar()) {
      if (ImGui.BeginMenu('File')) {
        if (ImGui.MenuItem('Save Layout', '')) {
          if (typeof(window) !== 'undefined') {
            window.localStorage.setItem('imgui.ini', ImGui.SaveIniSettingsToMemory());
          }
        }
        // ShowExampleMenuFile();
        ImGui.EndMenu();
      }
      if (ImGui.BeginMenu('Edit')) {
        if (ImGui.MenuItem('Show Canvas', '', (_ = this.showCanvas)=>this.showCanvas = _)) {
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

export const uiManager = new UIManager();