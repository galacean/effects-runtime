import * as ImGui from 'maoan-imgui-js';

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

  loadIni (fallback: string): string {
    let legacy = fallback;

    try {
      legacy = window.localStorage.getItem('imgui.ini') || fallback;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : undefined;

      if (data?.version === 1 && typeof data.ini === 'string' && data.windows && typeof data.windows === 'object') {
        this.data = { version: 1, ini: data.ini, windows: Object.fromEntries(Object.entries(data.windows)
          .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) };
      } else {
        this.data.ini = legacy;
      }
    } catch (error) {
      console.warn('Failed to read editor layout; using the default layout.', error);
      this.data.ini = legacy;
    }

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
