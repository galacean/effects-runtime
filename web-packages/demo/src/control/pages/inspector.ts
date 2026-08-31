import type { Engine, Texture } from '@galacean/effects';
import { math } from '@galacean/effects';
import type {
  Range } from '@galacean/effects-plugin-gui';
import {
  AspectRatioContainer,
  Button,
  CenterContainer,
  Checkbox,
  CheckButton,
  ColorPicker,
  ColorPickerButton,
  ColorRect,
  Control,
  GridContainer,
  HBoxContainer,
  HSeparator,
  HScrollBar,
  HSlider,
  HorizontalAlignment,
  Label,
  LineEdit,
  MarginContainer,
  MenuButton,
  NinePatchRect,
  OptionButton,
  Panel,
  PanelContainer,
  PopupMenu,
  PopupPanel,
  ProgressBar,
  ScrollContainer,
  SizeFlags,
  Side,
  TextOverflow,
  TextEdit,
  TextureRect,
  TextureStretchMode,
  VBoxContainer,
  VScrollBar,
  VSlider,
  VerticalAlignment,
  VSeparator,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { ControlCatalog } from '../inspector/catalog';
import { ControlInspectorPanel } from '../inspector/panel';
import { INSPECTOR_CONTROL_OPTIONS, createInspectorProperties } from '../inspector/schema';
import { attachAnchoredRect, attachFullRect } from '../layout';
import type { InspectorControlType } from '../state';
import { getTheme, setFlatStyleOverride, withAlpha } from '../theme';
import { createButton } from '../widgets';
import { createDemoTexture, label } from './common';

export class InspectorPage extends Control {
  private readonly texture = createDemoTexture(this.engine);
  private readonly targetLayer: Control;
  private readonly className: Label;
  private readonly classDescription: Label;
  private readonly catalog: ControlCatalog;
  private readonly inspector: ControlInspectorPanel;
  private readonly stage: Panel;
  private target: Control | null = null;
  private readonly resizeInspector = () => this.updateInspectorWidth();

  constructor (engine: Engine, private readonly ctx: AppContext) {
    super(engine);
    this.clipContents = true;
    const theme = getTheme();
    const stage = new Panel(engine);
    const viewport = new Panel(engine);
    const grid = new PreviewGrid(engine);

    attachAnchoredRect(stage, this, 0, 0, 1, 1, 196, 0, 352, 0);
    this.stage = stage;
    setFlatStyleOverride(stage, 'panel', { background: theme.panelBg, border: theme.borderSubtle });
    stage.clipContents = true;
    this.className = label(engine, '', 22, 18, 280, 28, stage, {
      size: 16,
      color: theme.textPrimary,
      weight: 680,
    });
    this.className.setAnchorMax(1, 0);
    this.className.setOffsetMax(-22, 46);
    this.classDescription = label(engine, '', 22, 48, 300, 38, stage, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Clip,
    });
    this.classDescription.setAnchorMax(1, 0);
    this.classDescription.setOffsetMax(-22, 86);
    label(engine, 'LIVE PREVIEW', 22, 92, 180, 18, stage, {
      size: 9,
      color: theme.textTertiary,
      weight: 700,
    });
    attachAnchoredRect(viewport, stage, 0, 0, 1, 1, 22, 118, 22, 52);
    setFlatStyleOverride(viewport, 'panel', {
      background: theme.panelRaisedBg, border: theme.borderSubtle,
    });
    viewport.clipContents = true;
    attachFullRect(grid, viewport, 1, 1, 1, 1);
    grid.lineColor = withAlpha(theme.borderStrong, 0.35);
    this.targetLayer = new Control(engine);
    attachFullRect(this.targetLayer, viewport, 18, 18, 18, 18);
    const footer = label(engine, 'Property names and hints · changes apply live.', 22, -42, 310, 28, stage, {
      size: 9,
      color: theme.textTertiary,
    });

    footer.setAnchorMin(0, 1);
    footer.setAnchorMax(1, 1);
    footer.setOffsetMin(22, -42);
    footer.setOffsetMax(-22, -14);

    this.catalog = new ControlCatalog(
      engine,
      ctx.state.inspector.controlType,
      theme,
      type => this.selectControl(type),
    );
    attachAnchoredRect(this.catalog, this, 0, 0, 0, 1, 0, 0, -184, 0);
    this.inspector = new ControlInspectorPanel(
      engine,
      ctx.state.inspector.controlType,
      theme,
      () => this.selectControl(ctx.state.inspector.controlType, true),
    );
    attachAnchoredRect(this.inspector, this, 1, 0, 1, 1, -340, 0, 0, 0);
    this.on('sizeChanged', this.resizeInspector);
    this.updateInspectorWidth();
    this.selectControl(ctx.state.inspector.controlType);
  }

  override onDestroy (): void {
    this.off('sizeChanged', this.resizeInspector);
    this.texture.dispose();
  }

  private updateInspectorWidth (): void {
    const width = this.width >= 1200 ? 420 : this.width <= 850 ? 320 : 340;

    this.inspector.setOffsetMin(-width, 0);
    this.stage.setOffsetMax(-(width + 12), 0);
  }

  private selectControl (type: InspectorControlType, force = false): void {
    if (!force && this.target && type === this.ctx.state.inspector.controlType) {
      return;
    }
    this.ctx.state.inspector.controlType = type;
    this.catalog.setSelected(type);
    this.target?.dispose();
    this.target = createPreviewControl(this.engine, type, this.texture);
    attachPreviewControl(this.target, this.targetLayer, type);
    const option = INSPECTOR_CONTROL_OPTIONS.find(control => control.type === type);

    this.className.text = option?.title ?? type;
    this.classDescription.text = option?.description ?? '';
    this.inspector.setTarget(type, this.target, createInspectorProperties(type, this.texture));

    if (this.target instanceof HSlider || this.target instanceof VSlider
      || this.target instanceof ProgressBar || this.target instanceof HScrollBar || this.target instanceof VScrollBar) {
      (this.target as Range).on('valueChanged', () => this.inspector.refresh());
    }
    if (this.target instanceof LineEdit || this.target instanceof TextEdit) {
      this.target.on('textChanged', () => this.inspector.refresh());
    }
    if (this.target instanceof ColorPicker) {
      this.target.on('colorChanged', () => this.inspector.refresh());
    }
    if (this.target instanceof ColorPickerButton) {
      this.target.on('colorChanged', () => this.inspector.refresh());
    }
    if (this.target instanceof OptionButton) {
      this.target.onOption('itemSelected', () => this.inspector.refresh());
    }
  }
}

class PreviewGrid extends Control {
  lineColor = new math.Color(0, 0, 0, 0.12);

  override draw (): void {
    const step = 24;
    const right = Math.max(0, this.width - 1);
    const bottom = Math.max(0, this.height - 1);
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;

    for (let offset = step; centerX - offset > 0 || centerX + offset < right; offset += step) {
      const left = centerX - offset;
      const rightLine = centerX + offset;

      if (left > 0) {
        this.drawLine(left, 0, left, bottom, this.lineColor, 1);
      }
      if (rightLine < right) {
        this.drawLine(rightLine, 0, rightLine, bottom, this.lineColor, 1);
      }
    }
    for (let offset = step; centerY - offset > 0 || centerY + offset < bottom; offset += step) {
      const top = centerY - offset;
      const bottomLine = centerY + offset;

      if (top > 0) {
        this.drawLine(0, top, right, top, this.lineColor, 1);
      }
      if (bottomLine < bottom) {
        this.drawLine(0, bottomLine, right, bottomLine, this.lineColor, 1);
      }
    }
    this.drawLine(centerX, 0, centerX, bottom, this.lineColor, 1);
    this.drawLine(0, centerY, right, centerY, this.lineColor, 1);
  }
}

function createPreviewControl (engine: Engine, type: InspectorControlType, texture: Texture): Control {
  switch (type) {
    case 'Button': {
      const control = createButton(engine, 'Confirm', undefined, 'primary');

      control.icon = texture;
      control.expandIcon = true;

      return control;
    }
    case 'Checkbox': {
      const control = new Checkbox(engine, 'Enable feature');

      control.setPressedNoSignal(true);

      return control;
    }
    case 'CheckButton': {
      const control = new CheckButton(engine, 'Live updates');

      control.setPressedNoSignal(true);

      return control;
    }
    case 'MenuButton': {
      const control = new MenuButton(engine, 'Actions');

      control.popupMenu.addItem('Duplicate', 'duplicate');
      control.popupMenu.addItem('Rename', 'rename');
      control.popupMenu.addSeparator();
      control.popupMenu.addItem('Archive', 'archive');
      control.popupMenu.setItemDisabled(3, true);

      return control;
    }
    case 'OptionButton': {
      const control = new OptionButton(engine);

      control.addItem('Draft', 'draft');
      control.addItem('In Review', 'review');
      control.addItem('Published', 'published');
      control.select(1, false);

      return control;
    }
    case 'ColorPickerButton': {
      const control = new ColorPickerButton(engine);

      control.text = 'Accent color';
      control.color = getTheme().accent;

      return control;
    }
    case 'LineEdit': {
      const control = new LineEdit(engine, 'Editable text');

      control.placeholderText = 'Type here…';

      return control;
    }
    case 'TextEdit': {
      const control = new TextEdit(engine, 'Multiline text editor\nDrag to select · scroll for more');

      control.placeholderText = 'Write something…';

      return control;
    }
    case 'ColorPicker': {
      const control = new ColorPicker(engine);

      control.color = getTheme().accent;

      return control;
    }
    case 'PopupPanel': {
      const control = new PopupPanel(engine);
      const content = new Label(engine, 'PopupPanel\ntransient content surface');

      control.visible = true;
      content.horizontalAlignment = HorizontalAlignment.Center;
      content.verticalAlignment = VerticalAlignment.Center;
      content.parent = control;

      return control;
    }
    case 'PopupMenu': {
      const control = new PopupMenu(engine);

      control.addItem('Checked item', 'checked');
      control.setItemChecked(0, true);
      control.addItem('Regular item', 'regular');
      control.addSeparator('Section');
      control.addItem('Disabled item', 'disabled');
      control.setItemDisabled(3, true);
      control.visible = true;

      return control;
    }
    case 'Label': {
      const control = new Label(engine, 'Control inspector\nLive properties · 中文预览');

      control.horizontalAlignment = HorizontalAlignment.Center;
      control.verticalAlignment = VerticalAlignment.Center;

      return control;
    }
    case 'TextureRect': {
      const control = new TextureRect(engine, texture);

      control.stretchMode = TextureStretchMode.KeepAspectCentered;

      return control;
    }
    case 'NinePatchRect': {
      const control = new NinePatchRect(engine, texture);

      control.setPatchMargin(Side.Left, 12);
      control.setPatchMargin(Side.Top, 12);
      control.setPatchMargin(Side.Right, 12);
      control.setPatchMargin(Side.Bottom, 12);

      return control;
    }
    case 'ColorRect': {
      const control = new ColorRect(engine);

      control.color = getTheme().accent;

      return control;
    }
    case 'Panel':
      return new Panel(engine);
    case 'PanelContainer': {
      const control = new PanelContainer(engine);
      const content = new Label(engine, 'Content fitted inside\nStyleBox margins');

      content.horizontalAlignment = HorizontalAlignment.Center;
      content.verticalAlignment = VerticalAlignment.Center;
      content.parent = control;

      return control;
    }
    case 'HSeparator':
      return new HSeparator(engine);
    case 'VSeparator':
      return new VSeparator(engine);
    case 'HSlider': {
      const control = new HSlider(engine);

      control.value = 64;

      return control;
    }
    case 'VSlider': {
      const control = new VSlider(engine);

      control.value = 64;

      return control;
    }
    case 'ProgressBar': {
      const control = new ProgressBar(engine);

      control.value = 64;

      return control;
    }
    case 'HScrollBar': {
      const control = new HScrollBar(engine);

      control.page = 24;
      control.value = 38;

      return control;
    }
    case 'VScrollBar': {
      const control = new VScrollBar(engine);

      control.page = 24;
      control.value = 38;

      return control;
    }
    case 'HBoxContainer': {
      const control = new HBoxContainer(engine);

      control.setThemeConstantOverride('separation', 8);
      addContainerButtons(control, 3);

      return control;
    }
    case 'VBoxContainer': {
      const control = new VBoxContainer(engine);

      control.setThemeConstantOverride('separation', 8);
      addContainerButtons(control, 3);

      return control;
    }
    case 'GridContainer': {
      const control = new GridContainer(engine);

      control.columns = 3;
      control.setThemeConstantOverride('horizontalSeparation', 8);
      control.setThemeConstantOverride('verticalSeparation', 8);
      addContainerButtons(control, 6);

      return control;
    }
    case 'MarginContainer': {
      const control = new MarginContainer(engine);
      const child = new Panel(engine);
      const childLabel = new Label(engine, 'Content');

      control.setThemeConstantOverride('marginLeft', 24);
      control.setThemeConstantOverride('marginTop', 18);
      control.setThemeConstantOverride('marginRight', 24);
      control.setThemeConstantOverride('marginBottom', 18);
      setFlatStyleOverride(child, 'panel', { background: getTheme().accentSoft });
      child.parent = control;
      childLabel.horizontalAlignment = HorizontalAlignment.Center;
      childLabel.verticalAlignment = VerticalAlignment.Center;
      attachFullRect(childLabel, child);

      return control;
    }
    case 'CenterContainer': {
      const control = new CenterContainer(engine);
      const child = createButton(engine, 'Centered', undefined, 'primary');

      child.setCustomMinimumSize(112, 42);
      child.setSizeFlags(SizeFlags.ShrinkCenter, SizeFlags.ShrinkCenter);
      child.parent = control;

      return control;
    }
    case 'AspectRatioContainer': {
      const control = new AspectRatioContainer(engine);
      const child = new ColorRect(engine);
      const childLabel = new Label(engine, '16 : 9');

      control.ratio = 16 / 9;
      child.color = getTheme().accentSoft;
      child.parent = control;
      childLabel.horizontalAlignment = HorizontalAlignment.Center;
      childLabel.verticalAlignment = VerticalAlignment.Center;
      attachFullRect(childLabel, child);

      return control;
    }
    case 'ScrollContainer': {
      const control = new ScrollContainer(engine);
      const surface = new Panel(engine);

      surface.setCustomMinimumSize(420, 300);
      setFlatStyleOverride(surface, 'panel', { background: getTheme().panelRaisedBg });
      surface.parent = control;
      for (let index = 0; index < 6; index++) {
        const button = createButton(engine, `Item ${index + 1}`);
        const column = index % 2;
        const row = Math.floor(index / 2);

        button.setRect({
          position: new math.Vector2(28 + column * 184, 28 + row * 78),
          size: new math.Vector2(156, 48),
        });
        button.parent = surface;
      }

      return control;
    }
  }
}

function attachPreviewControl (control: Control, parent: Control, type: InspectorControlType): void {
  const vertical = type === 'VSlider' || type === 'VScrollBar';
  const compact = type === 'Button' || type === 'Checkbox' || type === 'CheckButton'
    || type === 'MenuButton' || type === 'OptionButton' || type === 'ColorPickerButton' || type === 'LineEdit'
    || type === 'HSlider' || type === 'ProgressBar' || type === 'HScrollBar';
  let width = vertical ? 44 : compact ? 236 : 280;
  let height = vertical ? 236 : compact ? type === 'Button' ? 64 : type === 'ProgressBar' ? 34 : 42 : 210;

  if (type === 'ColorPicker') {
    width = 280;
    height = 350;
  } else if (type === 'TextEdit') {
    width = 320;
    height = 180;
  } else if (type === 'PopupMenu') {
    width = 240;
    height = 154;
  } else if (type === 'PopupPanel' || type === 'PanelContainer') {
    width = 280;
    height = 160;
  } else if (type === 'HSeparator') {
    width = 280;
    height = 32;
  } else if (type === 'VSeparator') {
    width = 32;
    height = 236;
  }

  control.parent = parent;
  control.setAnchorMin(0.5, 0.5);
  control.setAnchorMax(0.5, 0.5);
  control.setOffsetMin(-width * 0.5, -height * 0.5);
  control.setOffsetMax(width * 0.5, height * 0.5);
}

function addContainerButtons (container: HBoxContainer | VBoxContainer | GridContainer, count: number): void {
  for (let index = 0; index < count; index++) {
    const button = createButton(container.engine, `Item ${index + 1}`, undefined, index === 0 ? 'primary' : 'default');

    button.setCustomMinimumSize(54, 42);
    button.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    button.parent = container;
  }
}
