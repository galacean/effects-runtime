import type { DockWorkspace } from '../../ui/controls/dock-workspace';
import { DEFAULT_WINDOWS, defaultEditorLayout } from '../../app/layout/default-layout';
import type { DockSnapshot } from './dock-model';
import { validDockSnapshot } from './dock-model';
import { legacyWindowId, readLegacyLayout } from './legacy-layout';

interface LayoutData { version: 2, dock: DockSnapshot, windows: Record<string, boolean> }
const STORAGE_KEY = 'effects-editor.layout.v2';

class EditorLayout {
  onError: (error: unknown) => void = console.error;
  private workspace?: DockWorkspace;
  private pending?: number;
  private restoreWindow?: (id: string, opened: boolean) => void;

  load (): LayoutData {
    const fallback: LayoutData = { version: 2, dock: defaultEditorLayout(), windows: { ...DEFAULT_WINDOWS } };

    try {
      const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
      const old = JSON.parse(window.localStorage.getItem('effects-editor.layout.v1') ?? 'null');
      const flags = data?.windows ?? old?.windows;

      if (flags && typeof flags === 'object') {
        for (const [id, opened] of Object.entries(flags)) { if (typeof opened === 'boolean') { fallback.windows[data?.windows ? id : legacyWindowId(id)] = opened; } }
      }
      if (data?.version === 2 && validDockSnapshot(data.dock)) { fallback.dock = data.dock; } else if (typeof old?.ini === 'string') { fallback.dock = readLegacyLayout(old.ini) ?? fallback.dock; }
    } catch (error) { console.warn('Unable to read editor layout.', error); }

    return fallback;
  }
  initialize (workspace: DockWorkspace, restoreWindow: (id: string, opened: boolean) => void): void {
    this.workspace = workspace; this.restoreWindow = restoreWindow;
    workspace.layoutChanged = () => this.requestSave();
    window.addEventListener('pagehide', this.save);
  }
  requestSave (): void {
    window.clearTimeout(this.pending);
    this.pending = window.setTimeout(this.save, 250);
  }
  requestDefault (): void {
    if (!this.workspace) { return; }
    this.workspace.model.snapshot = defaultEditorLayout();
    for (const id of this.workspace.panels.keys()) { this.restoreWindow?.(id, DEFAULT_WINDOWS[id] ?? false); }
    this.workspace.rebuild(); this.requestSave();
  }
  private readonly save = (): void => {
    if (!this.workspace) { return; }
    window.clearTimeout(this.pending);
    const data: LayoutData = { version: 2, dock: this.workspace.model.snapshot,
      windows: Object.fromEntries([...this.workspace.panels].map(([id, panel]) => [id, panel.opened])) };

    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) { this.onError(error); }
  };
  shutdown (): void { this.save(); window.removeEventListener('pagehide', this.save); this.workspace = undefined; }
}

export const editorLayout = new EditorLayout();
