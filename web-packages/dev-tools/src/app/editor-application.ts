import { texturePreviewCache } from '../features/assets/preview/texture-preview-cache';
import { materialPreviews } from '../features/assets/preview/material-preview';
import { projectWorkspace } from '../features/projects/project-workspace';
import { sceneWorkspace } from '../features/scene/scene-workspace';
import { SceneViewportPanel } from '../features/scene/viewport/scene-viewport-panel';
import { editorLayout } from '../framework/layout/editor-layout';
import { editorWindowRegistry, menuRegistrationStore } from '../framework/registry/editor-registry';
import { EditorSelection } from '../framework/selection/editor-selection';
import { setGetWindowProvider, type EditorWindow } from '../framework/windows/editor-window';
import { ImGui } from '../platform/imgui/index';
import { MenuItemNode, MenuNode } from '../ui/menus/menu-tree';
import { editorMainMenuBar } from '../ui/widgets/editor-menu';
import { editorTooltips } from '../ui/widgets/editor-tooltip';
import { EditorMenus } from './menus/editor-menus';

export class EditorApplication {
  private windows: EditorWindow[] = [];

  private menuNodes: MenuNode[] = [];
  private lastTime = 0;
  private readonly menus = new EditorMenus();

  initialize () {
    this.menus.initialize();
    editorTooltips.initialize();
    sceneWorkspace.flushEdits = () => { this.windows.forEach(window => window.flushEdits()); };
    sceneWorkspace.onRestored = () => { this.windows.forEach(window => window.onUndoRedo()); };
    EditorSelection.setChangeHandler(apply => sceneWorkspace.changeSelection(apply));

    for (const path of Object.keys(menuRegistrationStore)) {
      const entry = menuRegistrationStore[path];

      this.addMenuItem(path, entry.action, entry.priority, entry.shortcut);
    }
    this.addMenuItem('Window/Layout/Default Editor Layout', () => {
      sceneWorkspace.flushEdits(); editorLayout.requestDefault(); this.getWindow(SceneViewportPanel).frameAll();
    }, 990, '');
    this.addMenuItem('Window/Layout/Save Layout', () => editorLayout.requestSave(), 1000, '');

    this.sortMenuTree();

    for (const editorWindowClass of editorWindowRegistry) {
      this.windows.push(new editorWindowClass());
    }
    editorLayout.onError = error => sceneWorkspace.report(new Error('Unable to save the editor layout: ' + (error instanceof Error ? error.message : String(error))));
    for (const window of this.windows) {
      editorLayout.registerWindow(window.layoutId, () => window.isOpened(), opened => {
        if (opened) { window.open(); } else { window.close(); }
      });
    }
    editorLayout.initialize();

    setGetWindowProvider(<T extends EditorWindow>(type: new () => T): T => {
      return this.getWindow(type);
    });

    EditorSelection.addSelectionListener(() => {
      for (const w of this.windows) {
        w.onSelectionChange();
      }
    });
  }

  shutdown (): void {
    texturePreviewCache.clear();
    editorTooltips.shutdown();
    editorLayout.shutdown();
    this.menus.shutdown();
    EditorSelection.setChangeHandler();
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

  tick (time: number) {
    texturePreviewCache.beginFrame();
    materialPreviews.beginFrame();
    editorTooltips.beginFrame();
    const dt = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0;

    this.lastTime = time;

    for (const w of this.windows) {
      w.update(dt);
    }

    this.drawMainMenuBar();

    ImGui.BeginDisabled(sceneWorkspace.changingDocument);
    for (const w of this.windows) { w.draw(); }
    ImGui.EndDisabled();
    this.menus.shortcuts();
    if (!sceneWorkspace.changingDocument && !ImGui.IsMouseDown(ImGui.MouseButton.Left) && !ImGui.IsAnyItemActive()) { sceneWorkspace.current?.commit(); }
    this.menus.drawDialogs();
    editorTooltips.draw();
    texturePreviewCache.prune();
  }

  private drawMainMenuBar () {
    editorMainMenuBar(() => {
      this.menus.drawFileMenu();
      this.menus.drawEditMenu();
      for (const menuNode of this.menuNodes) {
        menuNode.draw(true);
      }
      const projectName = projectWorkspace.current?.name;

      if (projectName) {
        const width = ImGui.CalcTextSize(projectName).x;

        if (ImGui.GetContentRegionAvail().x > width + 40) {
          ImGui.SetCursorPosX(ImGui.GetWindowWidth() - width - 18); ImGui.TextDisabled(projectName);
        }
      }
    });
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
