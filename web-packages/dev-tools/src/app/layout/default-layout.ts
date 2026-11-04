import type { DockSnapshot } from '../../framework/layout/dock-model';
import { editorMetrics } from '../../ui/theme/control-theme';

export const DEFAULT_WINDOWS: Record<string, boolean> = {
  Composition: false, Hierarchy: true, Scene: true, Inspector: true, 'Content Browser': true, Sequencer: true,
  'Runtime Assets': false, 'Animation Clip': false, AnimationGraph: false, 'Asset Editor': false,
};

export function defaultEditorLayout (width = window.innerWidth, height = window.innerHeight): DockSnapshot {
  const w = Math.max(640, width), h = Math.max(400, height - editorMetrics.menuHeight);
  const details = Math.min(440, Math.max(280, w * .28));
  const bottom = Math.min(360, Math.max(280, h * .36), h * .5);
  const hierarchy = Math.max(200, Math.min(360, h * .4));

  return { root: { kind: 'split', id: 'workspace', vertical: false, ratio: (w - details - 2) / (w - 2),
    first: { kind: 'split', id: 'main', vertical: true, ratio: (h - bottom - 2) / (h - 2),
      first: { kind: 'tabs', id: 'scene', tabs: ['Scene'], active: 'Scene' },
      second: { kind: 'tabs', id: 'assets', tabs: ['Content Browser', 'Sequencer', 'Composition'], active: 'Sequencer' } },
    second: { kind: 'split', id: 'details', vertical: true, ratio: hierarchy / (h - 2),
      first: { kind: 'tabs', id: 'hierarchy', tabs: ['Hierarchy'], active: 'Hierarchy' },
      second: { kind: 'tabs', id: 'inspector', tabs: ['Inspector'], active: 'Inspector' } } }, floating: [] };
}
