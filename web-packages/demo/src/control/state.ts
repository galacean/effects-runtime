import type { AccentName, ThemeName } from './theme';

export type PageID = 'overview' | 'inspector' | 'buttons' | 'selection' | 'sliders' | 'display' | 'layout' | 'scroll' | 'input' | 'config';
export type LayoutKind = 'vbox' | 'hbox' | 'grid';
export type InspectorControlType =
  | 'Button' | 'Checkbox' | 'CheckButton'
  | 'Label' | 'TextureRect' | 'NinePatchRect' | 'ColorRect' | 'Panel'
  | 'HSlider' | 'VSlider' | 'ProgressBar' | 'HScrollBar' | 'VScrollBar'
  | 'HBoxContainer' | 'VBoxContainer' | 'GridContainer' | 'MarginContainer'
  | 'CenterContainer' | 'AspectRatioContainer' | 'ScrollContainer';

export type DemoState = {
  theme: ThemeName,
  accent: AccentName,
  customAccent: [number, number, number] | null,
  activePage: PageID,
  inspector: {
    controlType: InspectorControlType,
  },
  sliders: {
    linked: number,
    rgb: [number, number, number],
    step: number,
  },
  selection: {
    multi: boolean[],
    plan: number,
    switches: boolean[],
  },
  text: {
    stretchMode: number,
    autowrap: boolean,
    wrapWidth: number,
  },
  layout: {
    kind: LayoutKind,
    separation: number,
    columns: number,
    itemCount: number,
    alignment: number,
    reverse: boolean,
    selectedItem: number,
  },
  scroll: {
    mode: number,
  },
};

const THEME_KEY = 'control-demo-modern-theme';
const ACCENT_KEY = 'control-demo-modern-accent';
const PAGE_IDS: PageID[] = ['overview', 'inspector', 'buttons', 'selection', 'sliders', 'display', 'layout', 'scroll', 'input', 'config'];

export function createDemoState (): DemoState {
  return {
    theme: readTheme(),
    accent: readAccent(),
    customAccent: null,
    activePage: readPage(),
    inspector: { controlType: 'Button' },
    sliders: { linked: 64, rgb: [37, 99, 235], step: 35 },
    selection: { multi: [true, false, true], plan: 1, switches: [true, false, true] },
    text: { stretchMode: 5, autowrap: true, wrapWidth: 280 },
    layout: { kind: 'grid', separation: 12, columns: 3, itemCount: 6, alignment: 0, reverse: false, selectedItem: 0 },
    scroll: { mode: 1 },
  };
}

function readPage (): PageID {
  const value = new URLSearchParams(location.search).get('page');

  return PAGE_IDS.includes(value as PageID) ? value as PageID : 'overview';
}

export function persistAppearance (state: DemoState): void {
  try {
    localStorage.setItem(THEME_KEY, state.theme);
    localStorage.setItem(ACCENT_KEY, state.accent);
    const url = new URL(location.href);

    url.searchParams.set('theme', state.theme);
    history.replaceState(null, '', url);
  } catch {
    // Storage can be unavailable in privacy-restricted embeds.
  }
}

function readTheme (): ThemeName {
  try {
    const requested = new URLSearchParams(location.search).get('theme');

    if (requested === 'light' || requested === 'dark') {
      return requested;
    }

    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function readAccent (): AccentName {
  try {
    const value = localStorage.getItem(ACCENT_KEY);

    return value === 'indigo' || value === 'emerald' || value === 'amber' || value === 'rose'
      ? value
      : 'blue';
  } catch {
    return 'blue';
  }
}
