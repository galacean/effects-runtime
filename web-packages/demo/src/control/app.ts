import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { Button } from '@galacean/effects-plugin-gui';
import {
  ButtonGroup,
  ColorRect,
  Control,
  HorizontalAlignment,
  Label,
  Panel,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from './context';
import { attachAnchoredRect, attachFullRect } from './layout';
import { ActionsPage } from './pages/actions';
import { ContainersPage } from './pages/containers';
import { ContentPage } from './pages/content';
import { EventsPage } from './pages/events';
import { InspectorPage } from './pages/inspector';
import { OverviewPage } from './pages/overview';
import { OverlaysPage } from './pages/overlays';
import { RangesPage } from './pages/ranges';
import { ScrollingPage } from './pages/scrolling';
import { SelectionPage } from './pages/selection';
import { TextColorPage } from './pages/text-color';
import { ThemePage } from './pages/theme';
import type { PageID } from './state';
import { getTheme, setFlatStyleOverride, setFontOverrides } from './theme';
import { createButton } from './widgets';

type PageDefinition = {
  id: PageID,
  title: string,
  shortTitle: string,
  subtitle: string,
  group: string,
};

const PAGE_DEFINITIONS: PageDefinition[] = [
  { id: 'overview', title: 'Overview 总览', shortTitle: 'Overview', subtitle: 'Understand the demo, its coverage and the fastest way to explore it.', group: 'Getting started' },
  { id: 'inspector', title: 'Inspector 属性面板', shortTitle: 'Inspector', subtitle: 'Edit current Control properties with consistent names, options and ranges.', group: 'Getting started' },
  { id: 'actions', title: 'Actions 操作', shortTitle: 'Actions', subtitle: 'Button states, groups, icons, sizing and action modes.', group: 'Controls' },
  { id: 'selection', title: 'Selection 选择', shortTitle: 'Selection', subtitle: 'Checkbox, radio groups and CheckButton switches.', group: 'Controls' },
  { id: 'text-color', title: 'Text & Color 文本与颜色', shortTitle: 'Text & Color', subtitle: 'Single-line, multiline and color value editing.', group: 'Controls' },
  { id: 'ranges', title: 'Ranges 范围与进度', shortTitle: 'Ranges', subtitle: 'Shared ranges, progress feedback, fill modes and RGB values.', group: 'Controls' },
  { id: 'content', title: 'Content 内容展示', shortTitle: 'Content', subtitle: 'Text, textures, scalable surfaces and visual separators.', group: 'Controls' },
  { id: 'overlays', title: 'Menus & Overlays 菜单与弹层', shortTitle: 'Overlays', subtitle: 'Menus, option lists, popup panels and transient color editors.', group: 'Controls' },
  { id: 'containers', title: 'Containers 容器布局', shortTitle: 'Containers', subtitle: 'Box, grid, margin and aspect-ratio container behavior.', group: 'Layout' },
  { id: 'scrolling', title: 'Scrolling 滚动容器', shortTitle: 'Scrolling', subtitle: 'ScrollContainer modes, focus following and nested scrolling.', group: 'Layout' },
  { id: 'events', title: 'Input Events 交互事件', shortTitle: 'Events', subtitle: 'Mouse filters, bubbling, focus, drag-and-drop and cursors.', group: 'Interaction' },
  { id: 'theme', title: 'Theme 主题', shortTitle: 'Theme', subtitle: 'Light and dark themes, accents and live tree-scoped updates.', group: 'Styling' },
];

export class ControlApp extends Control {
  private readonly headerTitle: Label;
  private readonly headerSubtitle: Label;
  private readonly headerGroup: Label;
  private readonly navButtons = new Map<PageID, Button>();
  private readonly pages = new Map<PageID, Control>();

  constructor (engine: Engine, private readonly ctx: AppContext) {
    super(engine);
    const theme = getTheme();
    const background = new ColorRect(engine);
    const sidebar = new Panel(engine);
    const header = new Panel(engine);

    background.color = theme.appBg;
    attachFullRect(background, this);
    setFlatStyleOverride(sidebar, 'panel', { background: theme.sidebarBg, borderWidth: 0 });
    attachAnchoredRect(sidebar, this, 0, 0, 0, 1, 0, 0, -220, 0);
    setFlatStyleOverride(header, 'panel', { background: theme.appBg, borderWidth: 0 });
    attachAnchoredRect(header, this, 0, 0, 1, 0, 220, 0, 0, -88);
    const sidebarDivider = new ColorRect(engine);
    const headerDivider = new ColorRect(engine);

    sidebarDivider.color = theme.borderSubtle;
    attachAnchoredRect(sidebarDivider, sidebar, 1, 0, 1, 1, -1, 0, 0, 0);
    headerDivider.color = theme.borderSubtle;
    attachAnchoredRect(headerDivider, header, 0, 1, 1, 1, 0, -1, 0, 0);
    this.buildBrand(sidebar);
    this.buildNavigation(sidebar);
    this.headerGroup = this.createHeaderLabel(engine, header, '', 24, 8, 420, 18, 10, theme.textTertiary, 600);
    this.headerTitle = this.createHeaderLabel(engine, header, '', 24, 25, 450, 30, 22, theme.textPrimary, 680);
    this.headerSubtitle = this.createHeaderLabel(engine, header, '', 24, 58, 520, 20, 11, theme.textSecondary, 450);
    const themeButton = createButton(engine, ctx.state.theme === 'light' ? 'Dark mode' : 'Light mode', () => {
      ctx.state.theme = ctx.state.theme === 'light' ? 'dark' : 'light';
      ctx.requestRebuild();
    });

    attachAnchoredRect(themeButton, header, 1, 0, 1, 0, -116, 24, 24, -60);
    const pages: Array<[PageID, Control]> = [
      ['overview', new OverviewPage(engine, ctx)],
      ['inspector', new InspectorPage(engine, ctx)],
      ['actions', new ActionsPage(engine, ctx)],
      ['selection', new SelectionPage(engine, ctx)],
      ['text-color', new TextColorPage(engine, ctx)],
      ['ranges', new RangesPage(engine, ctx)],
      ['content', new ContentPage(engine, ctx)],
      ['overlays', new OverlaysPage(engine, ctx)],
      ['containers', new ContainersPage(engine, ctx)],
      ['scrolling', new ScrollingPage(engine, ctx)],
      ['events', new EventsPage(engine, ctx)],
      ['theme', new ThemePage(engine, ctx)],
    ];

    for (const [id, page] of pages) {
      attachFullRect(page, this, 244, 112, 24, 24);
      this.pages.set(id, page);
    }
    this.selectPage(ctx.state.activePage);
  }

  selectPage (id: PageID): void {
    const definition = PAGE_DEFINITIONS.find(page => page.id === id) ?? PAGE_DEFINITIONS[0];

    this.ctx.state.activePage = definition.id;
    const url = new URL(location.href);

    url.searchParams.set('page', definition.id);
    history.replaceState(null, '', url);
    this.headerGroup.text = definition.group.toUpperCase();
    this.headerTitle.text = definition.title;
    this.headerSubtitle.text = definition.subtitle;
    for (const [buttonID, button] of this.navButtons) {
      button.setPressedNoSignal(buttonID === definition.id);
    }
    for (const [pageID, page] of this.pages) {
      const active = pageID === definition.id;

      page.visible = active;
      page.enabled = active;
    }
  }

  private buildBrand (sidebar: Panel): void {
    const theme = getTheme();
    const mark = new ColorRect(this.engine);

    mark.color = theme.accent;
    mark.setRect({ position: new math.Vector2(20, 20), size: new math.Vector2(32, 32) });
    mark.parent = sidebar;
    const initial = this.createHeaderLabel(this.engine, sidebar, 'C', 20, 20, 32, 32, 15, theme.textOnAccent, 700);

    initial.horizontalAlignment = HorizontalAlignment.Center;
    this.createHeaderLabel(this.engine, sidebar, 'Control Gallery', 64, 18, 140, 22, 14, theme.textPrimary, 680);
    this.createHeaderLabel(this.engine, sidebar, 'GUI plugin showcase', 64, 40, 140, 18, 10, theme.textSecondary, 450);
  }

  private buildNavigation (sidebar: Panel): void {
    const theme = getTheme();
    const group = new ButtonGroup();
    const positions: Record<PageID, number> = {
      overview: 76,
      inspector: 112,
      actions: 178,
      selection: 214,
      'text-color': 250,
      ranges: 286,
      content: 322,
      overlays: 358,
      containers: 430,
      scrolling: 466,
      events: 538,
      theme: 610,
    };

    this.createHeaderLabel(this.engine, sidebar, 'CONTROLS', 20, 152, 180, 18, 9, theme.textTertiary, 650);
    this.createHeaderLabel(this.engine, sidebar, 'LAYOUT', 20, 404, 180, 18, 9, theme.textTertiary, 650);
    this.createHeaderLabel(this.engine, sidebar, 'INTERACTION', 20, 512, 180, 18, 9, theme.textTertiary, 650);
    this.createHeaderLabel(this.engine, sidebar, 'STYLING', 20, 584, 180, 18, 9, theme.textTertiary, 650);
    for (const definition of PAGE_DEFINITIONS) {
      const button = createButton(this.engine, definition.shortTitle, undefined, 'ghost');

      button.toggleMode = true;
      button.buttonGroup = group;
      button.textAlignment = HorizontalAlignment.Left;
      setFontOverrides(button, { size: 12, weight: 550, color: theme.textSecondary });
      for (const state of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
        setFlatStyleOverride(button, state, {
          background: state === 'pressed' || state === 'hoverPressed' ? theme.accentSoft : undefined,
          horizontalMargin: 12,
        });
      }
      button.setRect({ position: new math.Vector2(12, positions[definition.id]), size: new math.Vector2(196, 34) });
      button.parent = sidebar;
      button.on('toggled', pressed => {
        if (pressed) {
          this.selectPage(definition.id);
        }
      });
      this.navButtons.set(definition.id, button);
    }
  }

  private createHeaderLabel (
    engine: Engine,
    parent: Control,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    const label = new Label(engine, text);

    setFontOverrides(label, { size, weight, color });
    label.textOverflow = TextOverflow.Ellipsis;
    label.verticalAlignment = VerticalAlignment.Center;
    label.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    label.parent = parent;

    return label;
  }
}
