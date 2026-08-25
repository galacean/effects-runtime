import type { Engine } from '@galacean/effects';
import { Control, SizeFlags, math } from '@galacean/effects';
import {
  Button,
  AutowrapMode,
  CheckButton,
  ColorRect,
  Label,
  HorizontalAlignment,
  Panel,
  ProgressBar,
  ScrollContainer,
  ScrollMode,
  TextOverflow,
  VBoxContainer,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect, attachFullRect } from '../layout';
import { getTheme, withAlpha } from '../theme';
import { addKeyValueRow, addSectionTitle, createButton, createSegmentedControl } from '../widgets';
import { label } from './common';

export class ScrollPage extends Control {
  private readonly outer: ScrollContainer;
  private readonly horizontalValue: Label;
  private readonly verticalValue: Label;
  private readonly horizontalProgress: ProgressBar;
  private readonly verticalProgress: ProgressBar;

  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    const viewportPanel = new Panel(engine);
    const controls = new Panel(engine);

    attachAnchoredRect(viewportPanel, this, 0, 0, 0.69, 1, 0, 0, 8, 0);
    attachAnchoredRect(controls, this, 0.69, 0, 1, 1, 8, 0, 0, 0);
    addSectionTitle(engine, viewportPanel, 'ScrollContainer', 'Two axes, nested scrolling and focus following', 20, 18, 250);
    const modes = [ScrollMode.Auto, ScrollMode.ShowAlways, ScrollMode.ShowNever, ScrollMode.Reserve];
    const mode = createSegmentedControl(engine, ['Auto', 'Always', 'Never', 'Reserve'], Math.max(0, modes.indexOf(ctx.state.scroll.mode)), index => {
      ctx.state.scroll.mode = modes[index];
      this.outer.horizontalScrollMode = modes[index];
      this.outer.verticalScrollMode = modes[index];
    });

    mode.control.setRect({ position: new math.Vector2(20, 76), size: new math.Vector2(428, 32) });
    mode.control.parent = viewportPanel;
    this.outer = new ScrollContainer(engine);
    const surface = new Panel(engine);

    surface.setCustomMinimumSize(960, 680);
    surface.backgroundColor = getTheme().panelRaisedBg;
    attachFullRect(this.outer, viewportPanel, 20, 118, 20, 20);
    this.outer.deadzone = 6;
    this.outer.followFocus = true;
    this.outer.horizontalScrollMode = ctx.state.scroll.mode;
    this.outer.verticalScrollMode = ctx.state.scroll.mode;
    this.outer.addChild(surface);
    const rows = this.buildSurface(surface);

    addSectionTitle(engine, controls, 'Viewport state', 'Live values and navigation', 16, 18, 178);
    this.horizontalValue = addKeyValueRow(engine, controls, 'Horizontal', '0 px', 16, 78, 178);
    this.verticalValue = addKeyValueRow(engine, controls, 'Vertical', '0 px', 16, 110, 178);
    this.horizontalProgress = new ProgressBar(engine);
    this.verticalProgress = new ProgressBar(engine);
    this.horizontalProgress.showPercentage = false;
    this.verticalProgress.showPercentage = false;
    this.horizontalProgress.setRect({ position: new math.Vector2(16, 150), size: new math.Vector2(178, 8) });
    this.verticalProgress.setRect({ position: new math.Vector2(16, 166), size: new math.Vector2(178, 8) });
    this.horizontalProgress.parent = controls;
    this.verticalProgress.parent = controls;
    const status = label(engine, 'Idle', 16, 190, 178, 28, controls, {
      size: 11,
      color: getTheme().textSecondary,
    });

    this.outer.on('scrollStarted', () => {
      status.text = 'Scrolling';
      status.textColor = getTheme().accent;
    });
    this.outer.on('scrollEnded', () => {
      status.text = 'Idle';
      status.textColor = getTheme().textSecondary;
    });
    const origin = createButton(engine, 'Origin', () => {
      this.outer.hScroll = 0;
      this.outer.vScroll = 0;
    });
    const center = createButton(engine, 'Center', () => {
      this.outer.hScroll = this.getMaximum(this.outer.getHScrollBar()) / 2;
      this.outer.vScroll = this.getMaximum(this.outer.getVScrollBar()) / 2;
    });
    const maximum = createButton(engine, 'Maximum', () => {
      this.outer.hScroll = this.getMaximum(this.outer.getHScrollBar());
      this.outer.vScroll = this.getMaximum(this.outer.getVScrollBar());
    });

    origin.setRect({ position: new math.Vector2(16, 232), size: new math.Vector2(84, 34) });
    center.setRect({ position: new math.Vector2(110, 232), size: new math.Vector2(84, 34) });
    maximum.setRect({ position: new math.Vector2(16, 276), size: new math.Vector2(178, 34) });
    origin.parent = controls;
    center.parent = controls;
    maximum.parent = controls;
    const follow = new CheckButton(engine, 'Follow keyboard focus');
    const horizontalWheel = new CheckButton(engine, 'Wheel scrolls X axis');

    follow.setPressedNoSignal(true);
    follow.setRect({ position: new math.Vector2(16, 330), size: new math.Vector2(178, 36) });
    follow.parent = controls;
    follow.on('toggled', pressed => {
      this.outer.followFocus = pressed;
    });
    horizontalWheel.setRect({ position: new math.Vector2(16, 376), size: new math.Vector2(178, 36) });
    horizontalWheel.parent = controls;
    horizontalWheel.on('toggled', pressed => {
      this.outer.scrollHorizontalByDefault = pressed;
    });
    const focusLast = createButton(engine, 'Focus last list item', () => rows[rows.length - 1].grabFocus(), 'primary');

    focusLast.setRect({ position: new math.Vector2(16, 420), size: new math.Vector2(178, 38) });
    focusLast.parent = controls;
    label(engine, '6 px deadzone · inertia', 16, 464, 178, 30, controls, {
      size: 10,
      color: getTheme().textSecondary,
    });
  }

  override update (deltaTime: number): void {
    const horizontalMaximum = this.getMaximum(this.outer.getHScrollBar());
    const verticalMaximum = this.getMaximum(this.outer.getVScrollBar());

    this.horizontalValue.text = `${this.outer.hScroll.toFixed(0)} px`;
    this.verticalValue.text = `${this.outer.vScroll.toFixed(0)} px`;
    this.horizontalProgress.value = horizontalMaximum > 0 ? this.outer.hScroll / horizontalMaximum * 100 : 0;
    this.verticalProgress.value = verticalMaximum > 0 ? this.outer.vScroll / verticalMaximum * 100 : 0;
    super.update(deltaTime);
  }

  private buildSurface (surface: Panel): Button[] {
    const theme = getTheme();
    const listTitle = new Label(this.engine, 'Focusable list');
    const list = new VBoxContainer(this.engine);
    const rows: Button[] = [];

    listTitle.fontSize = 13;
    listTitle.fontWeight = 650;
    listTitle.textColor = theme.textPrimary;
    listTitle.setRect({ position: new math.Vector2(24, 20), size: new math.Vector2(340, 26) });
    listTitle.parent = surface;
    list.setRect({ position: new math.Vector2(24, 54), size: new math.Vector2(360, 580) });
    list.separation = 8;
    list.parent = surface;
    for (let index = 0; index < 10; index++) {
      const row = new Button(this.engine, `List item ${index + 1}`);

      row.textAlignment = HorizontalAlignment.Left;
      row.horizontalPadding = 14;
      row.setCustomMinimumSize(360, 46);
      row.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
      list.addChild(row);
      rows.push(row);
    }

    const nestedTitle = new Label(this.engine, 'Nested ScrollContainer');
    const nested = new ScrollContainer(this.engine);
    const nestedSurface = new Panel(this.engine);

    nestedTitle.fontSize = 13;
    nestedTitle.fontWeight = 650;
    nestedTitle.textColor = theme.textPrimary;
    nestedTitle.setRect({ position: new math.Vector2(430, 20), size: new math.Vector2(300, 26) });
    nestedTitle.parent = surface;
    nested.setRect({ position: new math.Vector2(430, 54), size: new math.Vector2(330, 230) });
    nested.parent = surface;
    nestedSurface.setCustomMinimumSize(540, 390);
    nestedSurface.backgroundColor = withAlpha(theme.accent, 0.06);
    nested.addChild(nestedSurface);
    for (let index = 0; index < 6; index++) {
      const block = new ColorRect(this.engine);

      block.color = index % 2 === 0 ? theme.accentSoft : withAlpha(theme.success, 0.12);
      block.setRect({ position: new math.Vector2(24 + index * 78, 40 + index * 42), size: new math.Vector2(64, 120) });
      block.parent = nestedSurface;
    }

    const clipTitle = new Label(this.engine, 'Rotated clipping panel');
    const clip = new Panel(this.engine);
    const oversized = new ColorRect(this.engine);

    clipTitle.fontSize = 13;
    clipTitle.fontWeight = 650;
    clipTitle.textColor = theme.textPrimary;
    clipTitle.setRect({ position: new math.Vector2(430, 330), size: new math.Vector2(300, 26) });
    clipTitle.parent = surface;
    clip.setRect({ position: new math.Vector2(450, 372), size: new math.Vector2(260, 170) });
    clip.setRotation(8);
    clip.clipContents = true;
    clip.parent = surface;
    oversized.color = withAlpha(theme.accent, 0.28);
    oversized.setRect({ position: new math.Vector2(-40, 46), size: new math.Vector2(340, 74) });
    oversized.parent = clip;
    const focusNote = new Label(this.engine, 'Use the side-panel button to move focus and let ScrollContainer reveal the last item.');

    focusNote.fontSize = 11;
    focusNote.textColor = theme.textSecondary;
    focusNote.autowrapMode = AutowrapMode.WordSmart;
    focusNote.textOverflow = TextOverflow.Clip;
    focusNote.setRect({ position: new math.Vector2(790, 64), size: new math.Vector2(140, 120) });
    focusNote.parent = surface;

    return rows;
  }

  private getMaximum (range: import('@galacean/effects-plugin-gui').Range): number {
    return Math.max(range.minValue, range.maxValue - range.page);
  }
}
