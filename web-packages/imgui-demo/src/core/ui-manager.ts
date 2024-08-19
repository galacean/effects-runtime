import { type EditorWindow } from '../panels/editor-window';
import { MenuItemNode, MenuNode } from '../widgets/menu-item';
import { ImGui } from '../imgui';
import { editorStore, editorWindowStore, menuItemStore, objectInspectorStore } from './decorators';
import type { ObjectInspector } from '../object-inspectors/object-inspectors';
import type { Editor } from '../custom-editors/editor';

export class UIManager {
  // Custom component inspector GUI
  static customEditors = new Map<Function, Editor>();

  // Custom object inspector GUI
  static objectInpectors = new Map<Function, ObjectInspector>();

  // Custom window GUI
  private static editorWindows: EditorWindow[] = [];

  // Top menu nodes
  private menuNodes: MenuNode[] = [];

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

    for (const key of objectInspectorStore.keys()) {
      const objectInpectorClass = objectInspectorStore.get(key);

      if (!objectInpectorClass) {
        continue;
      }
      UIManager.objectInpectors.set(key, new objectInpectorClass());
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
    // this.editor.draw();

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

export const uiManager = new UIManager();