import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import {
  AutowrapMode,
  Control,
  HorizontalAlignment,
  Label,
  MouseFilter,
  Panel,
  ScrollContainer,
  ScrollMode,
  SizeFlags,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect, attachFullRect } from '../layout';
import type { ThemeTokens } from '../theme';
import { getTheme, mix, setFlatStyleOverride, setFontOverrides, withAlpha } from '../theme';
import { createButton } from '../widgets';
import { label } from './common';

const PAGE_HEIGHT = 2072;

export class OverviewPage extends Control {
  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    this.clipContents = true;
    const theme = getTheme();
    const scroll = new ScrollContainer(engine);
    const content = new Control(engine);

    attachFullRect(scroll, this);
    scroll.horizontalScrollMode = ScrollMode.Disabled;
    scroll.verticalScrollMode = ScrollMode.Auto;
    scroll.verticalCustomStep = 52;
    content.setCustomMinimumSize(0, PAGE_HEIGHT);
    content.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    content.parent = scroll;

    this.buildHero(content, theme, ctx);
    this.buildPurpose(content, theme);
    this.buildExplore(content, theme, ctx);
    this.buildJourney(content, theme);
    this.buildCoverage(content, theme);
    this.buildCallout(content, theme, ctx);
  }

  private buildHero (content: Control, theme: ThemeTokens, ctx: AppContext): void {
    const hero = this.createSection(content, 8, 340, theme);
    const backdrop = new PulseBackdrop(this.engine, theme);

    hero.clipContents = true;
    attachFullRect(backdrop, hero);
    this.addStretchLabel(
      hero,
      'EFFECTS RUNTIME  /  GUI CONTROL GALLERY',
      32,
      25,
      32,
      20,
      9,
      theme.accent,
      720,
      0.72,
    );
    const title = this.addStretchLabel(
      hero,
      'Build, inspect and understand\nthe runtime GUI',
      32,
      52,
      32,
      82,
      30,
      theme.textPrimary,
      720,
      0.78,
    );

    title.setThemeConstantOverride('lineSpacing', 4);
    title.verticalAlignment = VerticalAlignment.Top;
    const introduction = this.addStretchLabel(
      hero,
      'A hands-on map of the reusable Control layer. See what exists, tune properties live, and test how layout, input, scrolling and appearance behave on the canvas.',
      32,
      142,
      32,
      57,
      11,
      theme.textSecondary,
      450,
      0.74,
    );

    introduction.autowrapMode = AutowrapMode.WordSmart;
    introduction.verticalAlignment = VerticalAlignment.Top;
    this.addPill(hero, 'CANVAS NATIVE', 32, 208, 112, theme.accent, theme);
    this.addPill(hero, 'LIVE PROPERTIES', 152, 208, 122, theme.cyan, theme);
    this.addPill(hero, 'RUNTIME INPUT', 282, 208, 112, theme.violet, theme);

    const inspector = createButton(this.engine, 'Open live Inspector', () => ctx.navigate('inspector'), 'primary');
    const browse = createButton(this.engine, 'Browse focused demos', () => ctx.navigate('buttons'));

    inspector.setRect({ position: new math.Vector2(32, 258), size: new math.Vector2(154, 42) });
    browse.setRect({ position: new math.Vector2(196, 258), size: new math.Vector2(166, 42) });
    inspector.parent = hero;
    browse.parent = hero;
    const hint = this.addStretchLabel(
      hero,
      'Scroll to follow the tour',
      32,
      310,
      32,
      18,
      9,
      theme.textTertiary,
      560,
    );

    hint.textOverflow = TextOverflow.Ellipsis;
  }

  private buildPurpose (content: Control, theme: ThemeTokens): void {
    const section = this.createSection(content, 372, 286, theme);

    this.addSectionHeading(
      section,
      'Why this gallery exists',
      'The gallery is both a learning surface and a visual regression workspace: each page isolates one runtime concern so behavior is easy to understand, compare and verify.',
      theme,
    );
    this.addMetric(section, 0, 20, '+', 'CONTROL TYPES', 'Concrete controls available to inspect.', theme.accent, theme);
    this.addMetric(section, 1, 9, '', 'FOCUSED PATHS', 'Purpose-built pages for common workflows.', theme.cyan, theme);
    this.addMetric(section, 2, 1, '×', 'LIVE FEEDBACK', 'Every supported property updates immediately.', theme.violet, theme);
    this.addMetric(section, 3, 100, '%', 'CONTROL RENDERED', 'The demo surface and Inspector share one GUI tree.', theme.success, theme);
  }

  private buildExplore (content: Control, theme: ThemeTokens, ctx: AppContext): void {
    const section = this.createSection(content, 682, 408, theme);

    this.addSectionHeading(
      section,
      'Choose an exploration path',
      'Start with the question you are trying to answer. These three routes connect the individual examples into a coherent runtime story.',
      theme,
    );
    this.addFeatureCard(
      section,
      0,
      '01  INSPECT',
      'Tune one Control in isolation',
      'Select any concrete type and edit the properties that define its layout, state and appearance.',
      ['Property hints', 'Immediate preview', 'Grouped type catalog'],
      'Open Inspector',
      theme.accent,
      () => ctx.navigate('inspector'),
      theme,
    );
    this.addFeatureCard(
      section,
      1,
      '02  COMPOSE',
      'See controls working together',
      'Move from buttons and ranges to containers, sizing flags and scrollable content.',
      ['Focused examples', 'Shared state', 'Layout behavior'],
      'Explore layout',
      theme.cyan,
      () => ctx.navigate('layout'),
      theme,
    );
    this.addFeatureCard(
      section,
      2,
      '03  VERIFY',
      'Exercise runtime behavior',
      'Test pointer routing, keyboard focus, scrolling and appearance changes in a live scene.',
      ['Input routing', 'Theme snapshots', 'Native scrolling'],
      'Test input',
      theme.violet,
      () => ctx.navigate('input'),
      theme,
    );
  }

  private buildJourney (content: Control, theme: ThemeTokens): void {
    const section = this.createSection(content, 1114, 320, theme);
    const track = new JourneyTrack(this.engine, theme);

    this.addSectionHeading(
      section,
      'A four-step reading path',
      'The demo is designed to move from recognition to confident use. Follow this sequence on your first visit, then jump directly to any page later.',
      theme,
    );
    attachAnchoredRect(track, section, 0, 0, 1, 0, 46, 108, 46, -166);
    this.addJourneyStep(section, 0, 'Discover', 'Scan the available runtime surface.', theme);
    this.addJourneyStep(section, 1, 'Inspect', 'Change properties and compare states.', theme);
    this.addJourneyStep(section, 2, 'Compose', 'Combine layout, ranges and scrolling.', theme);
    this.addJourneyStep(section, 3, 'Validate', 'Exercise input and visual themes.', theme);
  }

  private buildCoverage (content: Control, theme: ThemeTokens): void {
    const section = this.createSection(content, 1458, 348, theme);

    this.addSectionHeading(
      section,
      'What is covered right now',
      'This overview reflects the current reusable runtime layer. Each row points to a capability you can exercise in the gallery today.',
      theme,
    );
    this.addCoverageRow(
      section, 98, 'DISPLAY',
      'Label · TextureRect · NinePatchRect · ColorRect · Panel',
      'Text, texture and surface rendering', theme.accent, theme,
    );
    this.addCoverageRow(
      section, 154, 'INTERACTION',
      'Button · CheckBox · CheckButton · focus · pointer routing',
      'Selection and input state', theme.rose, theme,
    );
    this.addCoverageRow(
      section, 210, 'RANGE',
      'Slider · ProgressBar · ScrollBar · shared Range values',
      'Continuous data and feedback', theme.cyan, theme,
    );
    this.addCoverageRow(
      section, 266, 'LAYOUT',
      'Box · Grid · Margin · Center · AspectRatio · ScrollContainer',
      'Sizing, arrangement and clipping', theme.violet, theme,
    );
  }

  private buildCallout (content: Control, theme: ThemeTokens, ctx: AppContext): void {
    const section = this.createSection(content, 1830, 218, theme);
    const backdrop = new CalloutBackdrop(this.engine, theme);

    section.clipContents = true;
    attachFullRect(backdrop, section);
    this.addStretchLabel(section, 'READY WHEN YOU ARE', 32, 24, 32, 18, 9, theme.accent, 720, 0.7);
    this.addStretchLabel(
      section,
      'Turn the overview into evidence.',
      32,
      52,
      32,
      42,
      24,
      theme.textPrimary,
      700,
      0.72,
    );
    const copy = this.addStretchLabel(
      section,
      'Open a Control, change a property, then move through the focused pages to see the same concepts working in context.',
      32,
      100,
      32,
      42,
      11,
      theme.textSecondary,
      450,
      0.7,
    );

    copy.autowrapMode = AutowrapMode.WordSmart;
    copy.verticalAlignment = VerticalAlignment.Top;
    const primary = createButton(this.engine, 'Start with Inspector', () => ctx.navigate('inspector'), 'primary');
    const secondary = createButton(this.engine, 'Open appearance', () => ctx.navigate('config'));

    primary.setRect({ position: new math.Vector2(32, 158), size: new math.Vector2(150, 40) });
    secondary.setRect({ position: new math.Vector2(192, 158), size: new math.Vector2(146, 40) });
    primary.parent = section;
    secondary.parent = section;
  }

  private createSection (parent: Control, y: number, height: number, theme: ThemeTokens): Panel {
    const section = new Panel(this.engine);

    setFlatStyleOverride(section, 'panel', { background: theme.panelBg, border: theme.borderSubtle });
    section.parent = parent;
    section.setAnchorMin(0, 0);
    section.setAnchorMax(1, 0);
    section.setOffsetMin(8, y);
    section.setOffsetMax(-16, y + height);

    return section;
  }

  private addSectionHeading (
    parent: Control,
    title: string,
    description: string,
    theme: ThemeTokens,
  ): void {
    this.addStretchLabel(parent, title, 24, 17, 24, 31, 18, theme.textPrimary, 690);
    const copy = this.addStretchLabel(parent, description, 24, 51, 24, 40, 10, theme.textSecondary, 450);

    copy.autowrapMode = AutowrapMode.WordSmart;
    copy.verticalAlignment = VerticalAlignment.Top;
  }

  private addPill (
    parent: Control,
    text: string,
    x: number,
    y: number,
    width: number,
    color: math.Color,
    theme: ThemeTokens,
  ): void {
    const pill = new Panel(this.engine);

    setFlatStyleOverride(pill, 'panel', {
      background: mix(theme.panelBg, color, 0.11), border: withAlpha(color, 0.42),
    });
    pill.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, 26) });
    pill.parent = parent;
    const pillLabel = label(this.engine, text, 0, 0, width, 26, pill, {
      size: 8,
      color,
      weight: 700,
      horizontal: HorizontalAlignment.Center,
      vertical: VerticalAlignment.Center,
    });

    pillLabel.textOverflow = TextOverflow.Ellipsis;
  }

  private addMetric (
    parent: Control,
    index: number,
    value: number,
    suffix: string,
    caption: string,
    detail: string,
    color: math.Color,
    theme: ThemeTokens,
  ): void {
    const card = new Panel(this.engine);
    const left = index === 0 ? 24 : 8;
    const right = index === 3 ? 24 : 8;

    setFlatStyleOverride(card, 'panel', {
      background: mix(theme.panelBg, theme.panelRaisedBg, 0.66), border: theme.borderSubtle,
    });
    attachAnchoredRect(card, parent, index * 0.25, 0, (index + 1) * 0.25, 1, left, 112, right, 22);
    const metric = new AnimatedMetricLabel(this.engine, value, suffix);

    setFontOverrides(metric, { size: 22, weight: 720, color });
    metric.verticalAlignment = VerticalAlignment.Center;
    metric.setRect({ position: new math.Vector2(14, 9), size: new math.Vector2(90, 34) });
    metric.parent = card;
    const captionLabel = this.addStretchLabel(card, caption, 14, 43, 14, 18, 8, theme.textPrimary, 720);

    captionLabel.textOverflow = TextOverflow.Ellipsis;
    const detailLabel = this.addStretchLabel(card, detail, 14, 64, 14, 35, 9, theme.textSecondary, 450);

    detailLabel.autowrapMode = AutowrapMode.WordSmart;
    detailLabel.verticalAlignment = VerticalAlignment.Top;
  }

  private addFeatureCard (
    parent: Control,
    index: number,
    eyebrow: string,
    title: string,
    description: string,
    bullets: string[],
    action: string,
    color: math.Color,
    pressed: () => void,
    theme: ThemeTokens,
  ): void {
    const card = new HoverCard(this.engine, theme, color);
    const left = index === 0 ? 24 : 8;
    const right = index === 2 ? 24 : 8;

    attachAnchoredRect(card, parent, index / 3, 0, (index + 1) / 3, 1, left, 108, right, 22);
    this.addStretchLabel(card, eyebrow, 18, 15, 18, 18, 8, color, 720);
    const titleLabel = this.addStretchLabel(card, title, 18, 39, 18, 48, 14, theme.textPrimary, 680);

    titleLabel.autowrapMode = AutowrapMode.WordSmart;
    titleLabel.verticalAlignment = VerticalAlignment.Top;
    const body = this.addStretchLabel(card, description, 18, 90, 18, 58, 9, theme.textSecondary, 450);

    body.autowrapMode = AutowrapMode.WordSmart;
    body.verticalAlignment = VerticalAlignment.Top;
    bullets.forEach((bullet, bulletIndex) => {
      const bulletLabel = this.addStretchLabel(
        card, `•  ${bullet}`, 18, 153 + bulletIndex * 20, 18, 18, 9, theme.textSecondary, 520,
      );

      bulletLabel.textOverflow = TextOverflow.Ellipsis;
    });
    const button = createButton(this.engine, action, pressed, 'ghost');

    button.parent = card;
    button.setAnchorMin(0, 1);
    button.setAnchorMax(1, 1);
    button.setOffsetMin(14, -48);
    button.setOffsetMax(-14, -12);
    button.setThemeColorOverride('fontColor', color);
  }

  private addJourneyStep (
    parent: Control,
    index: number,
    title: string,
    description: string,
    theme: ThemeTokens,
  ): void {
    const left = index === 0 ? 24 : 8;
    const right = index === 3 ? 24 : 8;
    const step = new Control(this.engine);

    attachAnchoredRect(step, parent, index * 0.25, 0, (index + 1) * 0.25, 1, left, 183, right, 20);
    const indexLabel = label(this.engine, `0${index + 1}`, 0, 0, 36, 20, step, {
      size: 8,
      color: theme.accent,
      weight: 720,
    });

    indexLabel.textOverflow = TextOverflow.Ellipsis;
    this.addStretchLabel(step, title, 0, 20, 0, 24, 12, theme.textPrimary, 670);
    const detail = this.addStretchLabel(step, description, 0, 45, 0, 40, 9, theme.textSecondary, 450);

    detail.autowrapMode = AutowrapMode.WordSmart;
    detail.verticalAlignment = VerticalAlignment.Top;
  }

  private addCoverageRow (
    parent: Control,
    y: number,
    title: string,
    controls: string,
    purpose: string,
    color: math.Color,
    theme: ThemeTokens,
  ): void {
    const row = new Panel(this.engine);

    setFlatStyleOverride(row, 'panel', {
      background: mix(theme.panelBg, theme.panelRaisedBg, 0.58), border: theme.borderSubtle,
    });
    row.parent = parent;
    row.setAnchorMin(0, 0);
    row.setAnchorMax(1, 0);
    row.setOffsetMin(24, y);
    row.setOffsetMax(-24, y + 46);
    const accent = new CoverageAccent(this.engine, color);

    accent.setRect({ position: new math.Vector2(0, 0), size: new math.Vector2(5, 46) });
    accent.parent = row;
    label(this.engine, title, 18, 0, 92, 46, row, { size: 8, color, weight: 720 });
    const controlsLabel = this.addStretchLabel(row, controls, 112, 0, 212, 46, 9, theme.textPrimary, 560);

    controlsLabel.textOverflow = TextOverflow.Ellipsis;
    const purposeLabel = this.addStretchLabel(row, purpose, 0, 0, 18, 46, 9, theme.textSecondary, 450, 1);

    purposeLabel.setAnchorMin(1, 0);
    purposeLabel.setAnchorMax(1, 0);
    purposeLabel.setOffsetMin(-204, 0);
    purposeLabel.setOffsetMax(-18, 46);
    purposeLabel.horizontalAlignment = HorizontalAlignment.Right;
    purposeLabel.textOverflow = TextOverflow.Ellipsis;
  }

  private addStretchLabel (
    parent: Control,
    text: string,
    left: number,
    top: number,
    right: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
    anchorRight = 1,
  ): Label {
    const control = new Label(this.engine, text);

    setFontOverrides(control, { size, weight, color });
    control.textOverflow = TextOverflow.Clip;
    control.verticalAlignment = VerticalAlignment.Center;
    control.parent = parent;
    control.setAnchorMin(0, 0);
    control.setAnchorMax(anchorRight, 0);
    control.setOffsetMin(left, top);
    control.setOffsetMax(-right, top + height);

    return control;
  }
}

class PulseBackdrop extends Control {
  private readonly gridColor: math.Color;
  private readonly orbitColor: math.Color;
  private readonly glowColor: math.Color;
  private readonly dotColor: math.Color;

  constructor (engine: Engine, theme: ThemeTokens) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    this.gridColor = withAlpha(theme.borderStrong, 0.16);
    this.orbitColor = withAlpha(theme.accent, 0.38);
    this.glowColor = withAlpha(theme.accent, 0.10);
    this.dotColor = withAlpha(theme.textOnAccent, 0.9);
  }

  override draw (): void {
    const time = performance.now() * 0.001;
    const centerX = this.width * 0.84;
    const centerY = this.height * 0.44;
    const pulse = 1 + Math.sin(time * 1.8) * 0.05;

    for (let x = Math.floor(this.width * 0.58); x < this.width; x += 28) {
      this.drawLine(x, 0, x, this.height, this.gridColor, 1);
    }
    for (let y = 4; y < this.height; y += 28) {
      this.drawLine(this.width * 0.58, y, this.width, y, this.gridColor, 1);
    }
    this.fillCircle(centerX, centerY, 86 * pulse, this.glowColor);
    this.drawCircle(centerX, centerY, 62, this.orbitColor, 1);
    this.drawCircle(centerX, centerY, 92, this.gridColor, 1);
    this.fillCircle(
      centerX + Math.cos(time * 0.9) * 62,
      centerY + Math.sin(time * 0.9) * 62,
      5,
      this.dotColor,
    );
    this.drawRect(centerX - 44, centerY - 31, 88, 62, this.orbitColor, 1);
    this.drawRect(centerX - 30, centerY - 17, 60, 34, this.gridColor, 1);
    this.fillRect(centerX - 18, centerY - 3, 36, 6, this.orbitColor);
  }
}

class CalloutBackdrop extends Control {
  private readonly lineColor: math.Color;
  private readonly glowColor: math.Color;

  constructor (engine: Engine, theme: ThemeTokens) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    this.lineColor = withAlpha(theme.accent, 0.22);
    this.glowColor = withAlpha(theme.violet, 0.10);
  }

  override draw (): void {
    const time = performance.now() * 0.001;
    const x = this.width * 0.84 + Math.sin(time * 0.7) * 12;
    const y = this.height * 0.46;

    this.fillCircle(x, y, 106 + Math.sin(time * 1.4) * 8, this.glowColor);
    for (let radius = 32; radius <= 92; radius += 20) {
      this.drawCircle(x, y, radius, this.lineColor, 1);
    }
  }
}

class JourneyTrack extends Control {
  private readonly lineColor: math.Color;
  private readonly nodeColor: math.Color;
  private readonly pulseColor: math.Color;

  constructor (engine: Engine, theme: ThemeTokens) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    this.lineColor = theme.borderStrong;
    this.nodeColor = theme.panelBg;
    this.pulseColor = theme.accent;
  }

  override draw (): void {
    const y = this.height * 0.5;
    const start = this.width * 0.125;
    const end = this.width * 0.875;
    const progress = (performance.now() * 0.00008) % 1;

    this.drawLine(start, y, end, y, this.lineColor, 1);
    for (let index = 0; index < 4; index++) {
      const x = this.width * (0.125 + index * 0.25);

      this.fillCircle(x, y, 8, this.nodeColor);
      this.drawCircle(x, y, 8, this.pulseColor, 2);
      this.fillCircle(x, y, 3, this.pulseColor);
    }
    this.fillCircle(start + (end - start) * progress, y, 4, this.pulseColor);
  }
}

class HoverCard extends Panel {
  private readonly restingColor: math.Color;
  private readonly hoveredColor: math.Color;
  private readonly accentColor: math.Color;
  private readonly currentColor: math.Color;
  private readonly outlineColor: math.Color;
  private hovered = false;
  private hoverAmount = 0;
  private lastFrame = performance.now();

  constructor (engine: Engine, theme: ThemeTokens, accent: math.Color) {
    super(engine);
    this.restingColor = mix(theme.panelBg, theme.panelRaisedBg, 0.54);
    this.hoveredColor = mix(theme.panelBg, accent, 0.10);
    this.accentColor = accent;
    this.currentColor = this.restingColor.clone();
    this.outlineColor = theme.borderSubtle.clone();
  }

  override draw (): void {
    const now = performance.now();
    const delta = Math.min(1, (now - this.lastFrame) / 150);
    const target = this.hovered ? 1 : 0;

    this.lastFrame = now;
    this.hoverAmount += (target - this.hoverAmount) * delta;
    this.currentColor.set(
      this.restingColor.r + (this.hoveredColor.r - this.restingColor.r) * this.hoverAmount,
      this.restingColor.g + (this.hoveredColor.g - this.restingColor.g) * this.hoverAmount,
      this.restingColor.b + (this.hoveredColor.b - this.restingColor.b) * this.hoverAmount,
      1,
    );
    this.fillRect(0, 0, this.width, this.height, this.currentColor);
    this.drawRect(0, 0, this.width, this.height, this.outlineColor, 1);
    this.fillRect(0, 0, 4 + 4 * this.hoverAmount, this.height, this.accentColor);
    this.fillRect(4, 0, (this.width - 4) * this.hoverAmount, 2, this.accentColor);
  }

  override onMouseEnter (): void {
    this.hovered = true;
  }

  override onMouseLeave (): void {
    this.hovered = false;
  }
}

class AnimatedMetricLabel extends Label {
  private readonly startedAt = performance.now();
  private lastValue = -1;

  constructor (engine: Engine, private readonly targetValue: number, private readonly suffix: string) {
    super(engine);
  }

  override draw (): void {
    const elapsed = performance.now() - this.startedAt;
    const progress = Math.min(1, elapsed / 760);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(this.targetValue * eased);

    if (value !== this.lastValue) {
      this.lastValue = value;
      this.text = `${value}${this.suffix}`;
    }
    super.draw();
  }
}

class CoverageAccent extends Control {
  constructor (engine: Engine, private readonly color: math.Color) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, this.color);
  }
}
