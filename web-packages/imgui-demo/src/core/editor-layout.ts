import * as ImGui from 'maoan-imgui-js';
import { DEFAULT_WINDOWS, defaultEditorLayout } from './default-layout';

interface LayoutData { version: 1, ini: string, windows: Record<string, boolean> }
interface WindowState { read: () => boolean, restore: (opened: boolean) => void }

const STORAGE_KEY = 'effects-editor.layout.v1';

/** ImGui owns window placement; the application owns whether a window is submitted at all. */
class EditorLayout {
  onError: (error: unknown) => void = error => console.error('Failed to save editor layout:', error);
  private data: LayoutData = { version: 1, ini: '', windows: {} };
  private readonly windows = new Map<string, WindowState>();
  private ready = false;
  private requested = false;
  private failed = false;
  private defaultRequested = false;

  loadIni (fallback: string): string {
    let legacy = fallback;

    try {
      const legacyStored = window.localStorage.getItem('imgui.ini');

      legacy = legacyStored || fallback;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : undefined;

      if (data?.version === 1 && typeof data.ini === 'string' && data.windows && typeof data.windows === 'object') {
        this.data = { version: 1, ini: data.ini, windows: Object.fromEntries(Object.entries(data.windows)
          .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) };
      } else {
        this.data.ini = legacy; this.defaultRequested = !legacyStored;
      }
    } catch (error) {
      console.warn('Failed to read editor layout; using the default layout.', error);
      this.data.ini = legacy;
      this.defaultRequested = true;
    }

    if (this.data.ini.includes('[Window][Project]') || 'Project' in this.data.windows) {
      this.data.ini = this.data.ini.replace('[Window][Content Browser]', '[Window][Runtime Assets]').replace('[Window][Project]', '[Window][Content Browser]');
      const windows = this.data.windows;

      if (typeof windows['Content Browser'] === 'boolean') { windows['Runtime Assets'] = windows['Content Browser']; }
      windows['Content Browser'] = windows.Project ?? true;
      delete windows.Project;
    }

    if ('Outliner' in this.data.windows) { this.data.windows.Hierarchy = this.data.windows.Outliner; delete this.data.windows.Outliner; }
    this.data.ini = this.data.ini.replaceAll('[Window][Outliner]', '[Window][Hierarchy]')
      .replace(/\[Window\]\[Preview\][\s\S]*?(?=\[|$)/g, '');
    delete this.data.windows.Preview;

    this.data.windows = { ...DEFAULT_WINDOWS, ...this.data.windows };

    return this.data.ini;
  }

  registerWindow (id: string, read: () => boolean, restore: (opened: boolean) => void): void {
    this.windows.set(id, { read, restore });
    const opened = this.data.windows[id];

    if (typeof opened === 'boolean') { restore(opened); }
  }

  initialize (): void {
    window.addEventListener('pagehide', this.saveOnExit);
    window.addEventListener('beforeunload', this.saveOnExit);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  requestSave (): void { this.requested = true; this.failed = false; }

  requestDefault (): void { this.defaultRequested = true; }

  beforeFrame (): void {
    if (!this.defaultRequested) { return; }
    this.defaultRequested = false;
    const io = ImGui.GetIO();
    const fontSize = this.ready ? ImGui.GetFontSize() : 20;
    const ini = defaultEditorLayout(io.DisplaySize.x, io.DisplaySize.y, fontSize + ImGui.GetStyle().FramePadding.y * 2);

    for (const [id, state] of this.windows) { state.restore(DEFAULT_WINDOWS[id] ?? false); }
    this.data = { version: 1, ini, windows: { ...DEFAULT_WINDOWS } };
    ImGui.LoadIniSettingsFromMemory(ini); this.requestSave();
  }

  endFrame (): void {
    this.ready = true;
    if (this.failed) { return; }
    const changed = Array.from(this.windows).some(([id, state]) => this.data.windows[id] !== state.read());

    if (this.requested || changed || ImGui.GetIO().WantSaveIniSettings) { this.save(); }
  }

  shutdown (): void {
    this.save();
    window.removeEventListener('pagehide', this.saveOnExit);
    window.removeEventListener('beforeunload', this.saveOnExit);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.ready = false;
    this.windows.clear();
  }

  private readonly saveOnExit = (): void => { this.save(); };
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') { this.save(); }
  };

  private save (): void {
    if (!this.ready) { return; }
    try {
      const windows = { ...this.data.windows, ...Object.fromEntries(Array.from(this.windows, ([id, state]) => [id, state.read()])) };
      const data: LayoutData = { version: 1, ini: ImGui.SaveIniSettingsToMemory(), windows };

      // Store open flags and native docking data as one snapshot.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.data = data; this.requested = false; this.failed = false;
      ImGui.GetIO().WantSaveIniSettings = false;
    } catch (error) { this.failed = true; this.onError(error); }
  }
}

export const editorLayout = new EditorLayout();
