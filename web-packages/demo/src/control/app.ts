import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import type { Button } from '@galacean/effects-plugin-gui';
import {
  ButtonGroup,
  ColorRect,
  HorizontalAlignment,
  Label,
  Panel,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from './context';
import { attachAnchoredRect, attachFullRect } from './layout';
import { ButtonsPage } from './pages/buttons';
import { InputPage } from './pages/input';
import { InspectorPage } from './pages/inspector';
import { LayoutPage } from './pages/layout';
import { OverviewPage } from './pages/overview';
import { ScrollPage } from './pages/scroll';
import { SelectionPage } from './pages/selection';
import { SlidersPage } from './pages/sliders';
import { TextPage } from './pages/text';
import { ThemingPage } from './pages/theming';
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
  { id: 'buttons', title: 'Buttons 按钮', shortTitle: 'Buttons', subtitle: 'Button states, groups, icons, sizing and action modes.', group: 'Foundation' },
  { id: 'selection', title: 'Selection 选择', shortTitle: 'Selection', subtitle: 'CheckBox, radio groups and CheckButton switches.', group: 'Foundation' },
  { id: 'sliders', title: 'Sliders 滑杆', shortTitle: 'Sliders', subtitle: 'Shared ranges, progress feedback, fill modes and RGB values.', group: 'Foundation' },
  { id: 'display', title: 'Display 展示', shortTitle: 'Display', subtitle: 'Label layout, overflow, textures and NinePatchRect sizing.', group: 'Foundation' },
  { id: 'layout', title: 'Containers 布局', shortTitle: 'Containers', subtitle: 'Box, grid, margin and aspect-ratio container behavior.', group: 'Layout & input' },
  { id: 'scroll', title: 'Scroll 滚动', shortTitle: 'Scroll', subtitle: 'ScrollContainer modes, focus following and nested scrolling.', group: 'Layout & input' },
  { id: 'input', title: 'Input 输入', shortTitle: 'Input', subtitle: 'Mouse filters, bubbling, focus, drag-and-drop and cursors.', group: 'Layout & input' },
  { id: 'config', title: 'Theme 主题', shortTitle: 'Theme', subtitle: 'Light and dark themes, accents and live tree-scoped updates.', group: 'Appearance' },
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
      ['buttons', new ButtonsPage(engine, ctx)],
      ['selection', new SelectionPage(engine, ctx)],
      ['sliders', new SlidersPage(engine, ctx)],
      ['display', new TextPage(engine, ctx)],
      ['layout', new LayoutPage(engine, ctx)],
      ['scroll', new ScrollPage(engine, ctx)],
      ['input', new InputPage(engine, ctx)],
      ['config', new ThemingPage(engine, ctx)],
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
    this.engine.windowRoot.guiReleaseFocus();
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
      overview: 82,
      inspector: 120,
      buttons: 188,
      selection: 228,
      sliders: 268,
      display: 308,
      layout: 376,
      scroll: 416,
      input: 456,
      config: 526,
    };

    this.createHeaderLabel(this.engine, sidebar, 'FOUNDATION', 20, 162, 180, 18, 9, theme.textTertiary, 650);
    this.createHeaderLabel(this.engine, sidebar, 'LAYOUT & INPUT', 20, 350, 180, 18, 9, theme.textTertiary, 650);
    this.createHeaderLabel(this.engine, sidebar, 'APPEARANCE', 20, 500, 180, 18, 9, theme.textTertiary, 650);
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
