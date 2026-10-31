import type { Engine } from '@galacean/effects';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { HorizontalAlignment, PanelContainer, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { texturePreviewCache } from '../features/assets/preview/texture-preview-cache';
import { materialPreviews } from '../features/assets/preview/material-preview';
import { setFocusedAssetSave } from '../features/assets/editors/asset-editor-registry';
import { AssetEditorManager } from '../features/assets/editors/asset-editor-manager';
import { projectWorkspace } from '../features/projects/project-workspace';
import { sceneWorkspace } from '../features/scene/scene-workspace';
import { SceneViewportPanel } from '../features/scene/viewport/scene-viewport-panel';
import { editorLayout } from '../framework/layout/editor-layout';
import { DockModel } from '../framework/layout/dock-model';
import { editorWindowRegistry, menuRegistrationStore } from '../framework/registry/editor-registry';
import { EditorSelection } from '../framework/selection/editor-selection';
import { setGetWindowProvider, type EditorWindow } from '../framework/windows/editor-window';
import { DockWorkspace } from '../ui/controls/dock-workspace';
import { append, column, expand, label } from '../ui/controls/layout';
import { EditorMenuBar, EditorMenuButton } from '../ui/controls/menu';
import { editorBox, editorColors, editorMetrics } from '../ui/theme/control-theme';
import { MenuItemNode, MenuNode } from '../ui/menus/menu-tree';
import { EditorMenus } from './menus/editor-menus';

export class EditorApplication {
  private windows: EditorWindow[] = [];
  private menuNodes: MenuNode[] = [];
  private lastTime = 0;
  private readonly menus = new EditorMenus();
  private dock!: DockWorkspace;
  private projectName!: Label;
  private unsubscribeSelection?: () => void;
  private assetEditors?: AssetEditorManager;

  initialize (engine: Engine, surface: Control): void {
    const root = append(surface, column(engine));

    root.setAnchorMax(1, 1); root.setOffsetMax(0, 0);
    const menuPanel = append(root, new PanelContainer(engine)), menuStyle = editorBox(editorColors.title);

    menuStyle.setContentMargins(0, 0, 8, 0); menuPanel.setThemeStyleBoxOverride('panel', menuStyle);
    const bar = append(menuPanel, new EditorMenuBar(engine));

    bar.setCustomMinimumSize(0, editorMetrics.menuHeight);
    const state = editorLayout.load();

    this.dock = append(root, expand(new DockWorkspace(engine, new DockModel(state.dock))));
    this.menus.initialize(engine, root);
    this.menus.closeActivePanel = () => this.dock.closeActivePanel();
    sceneWorkspace.flushEdits = () => this.windows.forEach(window => window.flushEdits());
    sceneWorkspace.onRestored = () => this.windows.forEach(window => window.onUndoRedo());
    EditorSelection.setChangeHandler(apply => sceneWorkspace.changeSelection(apply));
    setGetWindowProvider(<T extends EditorWindow>(type: new () => T): T => this.getWindow(type));

    for (const path of Object.keys(menuRegistrationStore)) {
      const entry = menuRegistrationStore[path];

      this.addMenuItem(path, entry.action, entry.priority, entry.shortcut);
    }
    this.addMenuItem('Window/Layout/Default Editor Layout', () => { sceneWorkspace.flushEdits(); editorLayout.requestDefault(); this.getWindow(SceneViewportPanel).frameAll(); }, 990, '');
    this.addMenuItem('Window/Layout/Save Layout', () => editorLayout.requestSave(), 1000, '');
    this.sortMenuTree();
    const file = append(bar, new EditorMenuButton(engine, 'File')), edit = append(bar, new EditorMenuButton(engine, 'Edit'));

    file.menuBar = edit.menuBar = true;
    file.actions = () => this.menus.fileActions(); edit.actions = () => this.menus.editActions();
    for (const node of this.menuNodes) {
      const button = append(bar, new EditorMenuButton(engine, node.name));

      button.menuBar = true;
      button.actions = () => {
        const action = node.action();

        const actions = Array.isArray(action.children) ? action.children : [action];

        return node.name === 'Window' ? actions.flatMap(entry => entry.label === 'Layout' && Array.isArray(entry.children) ? [{ label: 'Layout', heading: true }, ...entry.children] : [entry]) : actions;
      };
    }
    this.projectName = append(bar, expand(label(engine, ''), true, false));
    this.projectName.horizontalAlignment = HorizontalAlignment.Right;
    this.projectName.verticalAlignment = VerticalAlignment.Center;
    this.projectName.textOverflow = TextOverflow.Ellipsis;
    for (const type of editorWindowRegistry) { this.windows.push(new type()); }
    for (const window of this.windows) {
      const opened = state.windows[window.layoutId] ?? window.isOpened();

      if (opened) { window.open(); } else { window.close(); }
      window.mount(engine, this.dock);
    }
    this.assetEditors = new AssetEditorManager((window, alongside) => {
      this.windows.push(window); window.mount(engine, this.dock);
      const active = this.dock.activePanelId;
      const target = active && this.dock.panels.get(active)?.dockingRole === 'document' ? active : alongside;
      const group = target && this.dock.model.groupFor(target);

      if (group && !this.dock.model.groupFor(window.layoutId)) { this.dock.model.dock(window.layoutId, group.id, 'center'); }
    });
    this.dock.rebuild();
    editorLayout.onError = error => sceneWorkspace.report(error);
    editorLayout.initialize(this.dock, (id, opened) => {
      const panel = this.windows.find(panel => panel.layoutId === id);

      if (opened) { panel?.open(); } else { panel?.close(); }
    });
    const selectionChanged = () => this.windows.forEach(window => window.onSelectionChange());

    EditorSelection.addSelectionListener(selectionChanged);
    this.unsubscribeSelection = () => EditorSelection.removeSelectionListener(selectionChanged);
  }
  shutdown (): void {
    this.windows.forEach(window => window.dispose()); this.assetEditors?.dispose(); this.unsubscribeSelection?.();
    texturePreviewCache.clear(); editorLayout.shutdown(); this.menus.shutdown(); EditorSelection.setChangeHandler(); sceneWorkspace.current?.dispose();
  }
  getWindow<T extends EditorWindow> (type: new () => T): T {
    const window = this.windows.find(window => window instanceof type);

    if (!window) { throw new Error('Editor panel is not registered: ' + type.name); }

    return window as T;
  }
  tick (time: number): number {
    texturePreviewCache.beginFrame(); materialPreviews.beginFrame(); setFocusedAssetSave();
    const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;

    this.lastTime = time;
    for (const window of this.windows) { window.update(dt); }
    const closed = this.assetEditors?.collectClosed() ?? [];

    for (const window of closed) { this.dock.unregister(window.layoutId); window.dispose(); }
    if (closed.length) { this.windows = this.windows.filter(window => !closed.includes(window)); }
    this.dock.enabled = !sceneWorkspace.changingDocument;
    this.projectName.text = projectWorkspace.current?.name ?? '';
    this.menus.update(); sceneWorkspace.current?.commit(); texturePreviewCache.prune();

    return dt;
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
