import type { Editor } from '../custom-editors/editor';
import { ImGui } from '../imgui';
import { type EditorWindow, setGetWindowProvider } from '../panels/editor-window';
import { MenuItemNode, MenuNode } from '../widgets/menu-item';
import { editorStore, editorWindowStore, menuItemStore } from './decorators';
import { Selection } from './selection';
import { sceneWorkspace } from './scene-document/scene-workspace';
import { SceneFiles } from '../panels/scene/scene-files';
import { editorLayout } from './editor-layout';

export class EditorApplication {
  private windows: EditorWindow[] = [];
  private editors = new Map<Function, Editor>();
  private menuNodes: MenuNode[] = [];
  private lastTime = 0;
  private readonly sceneFiles = new SceneFiles();

  initialize () {
    this.sceneFiles.initialize();
    sceneWorkspace.flushEdits = () => { this.windows.forEach(window => window.flushEdits()); };
    sceneWorkspace.onRestored = () => { this.windows.forEach(window => window.onUndoRedo()); };
    Selection.setChangeHandler(apply => sceneWorkspace.changeSelection(apply));

    for (const path of Object.keys(menuItemStore)) {
      const entry = menuItemStore[path];

      this.addMenuItem(path, entry.action, entry.priority, entry.shortcut);
    }

    this.sortMenuTree();

    for (const editorWindowClass of editorWindowStore) {
      this.windows.push(new editorWindowClass());
    }
    editorLayout.onError = error => sceneWorkspace.report(new Error('Unable to save the editor layout: ' + (error instanceof Error ? error.message : String(error))));
    for (const window of this.windows) {
      editorLayout.registerWindow(window.layoutId, () => window.isOpened(), opened => {
        if (opened) { window.open(); } else { window.close(); }
      });
    }
    editorLayout.initialize();

    for (const key of editorStore.keys()) {
      const customEditorClass = editorStore.get(key);

      if (!customEditorClass) {
        continue;
      }
      this.editors.set(key, new customEditorClass());
    }

    setGetWindowProvider(<T extends EditorWindow>(type: new () => T): T => {
      return this.getWindow(type);
    });

    Selection.addSelectionListener(() => {
      for (const w of this.windows) {
        w.onSelectionChange();
      }
    });
  }

  shutdown (): void {
    editorLayout.shutdown();
    this.sceneFiles.shutdown();
    Selection.setChangeHandler();
    sceneWorkspace.current?.dispose();
  }

  getWindow<T extends EditorWindow> (type: new () => T): T {
    for (const w of this.windows) {
      if (w instanceof type) {
        return w;
      }
    }

    return undefined as unknown as T;
  }

  getEditor (componentType: Function): Editor | undefined {
    return this.editors.get(componentType);
  }

  tick (time: number) {
    const dt = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0;

    this.lastTime = time;

    for (const w of this.windows) {
      w.update(dt);
    }

    this.drawMainMenuBar();

    for (const w of this.windows) {
      w.draw();
    }
    this.sceneFiles.shortcuts();
    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left) && !ImGui.IsAnyItemActive()) { sceneWorkspace.current?.commit(); }
    this.sceneFiles.drawDialogs();
  }

  private drawMainMenuBar () {
    if (ImGui.BeginMainMenuBar()) {
      this.sceneFiles.drawFileMenu();
      this.sceneFiles.drawEditMenu();
      for (const menuNode of this.menuNodes) {
        menuNode.draw();
      }
      ImGui.EndMainMenuBar();
    }
  }

  private sortMenuTree () {
    this.menuNodes.sort((a, b) => a.priority - b.priority);
    for (const node of this.menuNodes) {
      node.sortChildren();
    }
  }

  private addMenuItem (path: string, action: () => void, priority: number, shortcut: string) {
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
        const rootMenuItemNode = new MenuItemNode(rootNodeName, priority);

        rootMenuItemNode.onClick = action;
        rootMenuItemNode.shortcut = shortcut;
        this.menuNodes.push(rootMenuItemNode);

        return;
      }
      rootMenuNode = new MenuNode(rootNodeName, priority);
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
        nextMenuNode = new MenuNode(nodeName, priority);
        currentMenuNode.addMenuNode(nextMenuNode);
      }

      currentMenuNode = nextMenuNode;
    }

    const menuItemName = nodePath.shift();

    if (!menuItemName) {
      return;
    }

    const newMenuItem = new MenuItemNode(menuItemName, priority);

    newMenuItem.onClick = action;
    newMenuItem.shortcut = shortcut;
    currentMenuNode.addMenuNode(newMenuItem);
  }
}

export const editorApp = new EditorApplication();
