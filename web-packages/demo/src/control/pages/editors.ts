import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { Popup } from '@galacean/effects-plugin-gui';
import {
  ColorPicker,
  ColorPickerButton,
  Control,
  HBoxContainer,
  HorizontalAlignment,
  HSeparator,
  Label,
  LineEdit,
  MenuButton,
  OptionButton,
  Panel,
  PanelContainer,
  PopupMenu,
  PopupPanel,
  SizeFlags,
  TextEdit,
  TextOverflow,
  VerticalAlignment,
  VSeparator,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect, attachFullRect } from '../layout';
import { getTheme, setFlatStyleOverride, setFontOverrides } from '../theme';
import { createButton } from '../widgets';
import { label } from './common';

export class EditorsPage extends Control {
  private readonly popupPanel: PopupPanel;
  private readonly popupMenu: PopupMenu;
  private readonly ownedPopups: Popup[] = [];
  private readonly closeHiddenPopups = () => {
    if (!this.visible) {
      for (const popup of this.ownedPopups) {popup.hidePopup();}
    }
  };

  constructor (engine: Engine, _ctx: AppContext) {
    super(engine);
    const theme = getTheme();
    const inputPanel = new Panel(engine);
    const menuPanel = new Panel(engine);
    const colorPanel = new Panel(engine);

    attachAnchoredRect(inputPanel, this, 0, 0, 0.47, 0.52, 0, 0, 8, 8);
    attachAnchoredRect(menuPanel, this, 0, 0.52, 0.47, 1, 0, 8, 8, 0);
    attachAnchoredRect(colorPanel, this, 0.47, 0, 1, 1, 8, 0, 0, 0);
    this.addSectionTitle(inputPanel, 'Text editing', 'Canvas-rendered fields with caret, selection, clipboard and IME input.');
    this.addSectionTitle(menuPanel, 'Menus and popup layers', 'Transient controls close outside, avoid window edges and restore focus.');
    this.addSectionTitle(colorPanel, 'Color and layout decoration', 'A live picker beside content-aware panels and separators.');

    const name = new LineEdit(engine, 'Effects Runtime');

    name.placeholderText = 'Project name';
    attachAnchoredRect(name, inputPanel, 0, 0, 0.62, 0, 20, 78, 6, -116);
    const secret = new LineEdit(engine, 'runtime-gui');

    secret.secret = true;
    secret.placeholderText = 'Access token';
    attachAnchoredRect(secret, inputPanel, 0.62, 0, 1, 0, 6, 78, 20, -116);
    const notes = new TextEdit(engine, 'LineEdit supports precise single-line input.\nTextEdit adds multiline caret movement and scrolling.');

    notes.placeholderText = 'Write release notes…';
    attachAnchoredRect(notes, inputPanel, 0, 0, 1, 0, 20, 130, 20, -242);
    const inputStatus = label(engine, 'Drag across text to select it, then type to replace the selection.', 20, 248, 402, 22, inputPanel, {
      size: 10,
      color: theme.textTertiary,
      overflow: TextOverflow.Ellipsis,
    });

    name.on('textChanged', value => { inputStatus.text = `LineEdit changed · ${value.length} characters`; });
    notes.on('textChanged', value => { inputStatus.text = `TextEdit changed · ${value.split('\n').length} lines`; });

    const menuButton = new MenuButton(engine, 'Actions');

    menuButton.popupMenu.addItem('Duplicate', 'duplicate');
    menuButton.popupMenu.addItem('Rename', 'rename');
    menuButton.popupMenu.addSeparator();
    menuButton.popupMenu.addItem('Archive', 'archive');
    menuButton.popupMenu.setItemDisabled(3, true);
    attachAnchoredRect(menuButton, menuPanel, 0, 0, 0.29, 0, 20, 82, 4, -120);
    this.ownedPopups.push(menuButton.popupMenu);

    const optionButton = new OptionButton(engine);

    optionButton.addItem('Draft', 'draft');
    optionButton.addItem('In review', 'review');
    optionButton.addItem('Published', 'published');
    optionButton.select(1, false);
    attachAnchoredRect(optionButton, menuPanel, 0.29, 0, 0.64, 0, 4, 82, 4, -120);
    this.ownedPopups.push(optionButton.popupMenu);

    this.popupMenu = new PopupMenu(engine);
    this.ownedPopups.push(this.popupMenu);
    this.popupMenu.addItem('Checked item', 'checked');
    this.popupMenu.setItemChecked(0, true);
    this.popupMenu.addItem('Regular item', 'regular');
    this.popupMenu.addItem('Unavailable item', 'disabled');
    this.popupMenu.setItemDisabled(2, true);
    const openMenu = createButton(engine, 'Open PopupMenu', () => this.openPopupMenu(openMenu));

    attachAnchoredRect(openMenu, menuPanel, 0.64, 0, 1, 0, 4, 82, 20, -120);

    this.popupPanel = new PopupPanel(engine);
    this.ownedPopups.push(this.popupPanel);
    const popupContent = new PanelContainer(engine);
    const popupLabel = new Label(engine, 'PopupPanel content\nClick outside or press Esc to close');

    popupContent.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    popupContent.parent = this.popupPanel;
    popupLabel.horizontalAlignment = HorizontalAlignment.Center;
    popupLabel.verticalAlignment = VerticalAlignment.Center;
    popupLabel.parent = popupContent;
    const openPanel = createButton(engine, 'Open PopupPanel', () => this.openPopupPanel(openPanel), 'primary');

    openPanel.setRect({ position: new math.Vector2(20, 138), size: new math.Vector2(160, 40) });
    openPanel.parent = menuPanel;
    const menuStatus = label(engine, 'Choose an option or open a standalone popup.', 194, 138, 248, 40, menuPanel, {
      size: 10,
      color: theme.textSecondary,
      vertical: VerticalAlignment.Center,
    });

    optionButton.onOption('itemSelected', id => { menuStatus.text = `Option selected · ${String(id)}`; });
    menuButton.popupMenu.on('idPressed', id => { menuStatus.text = `Menu action · ${String(id)}`; });
    this.popupMenu.on('idPressed', id => { menuStatus.text = `PopupMenu item · ${String(id)}`; });

    const picker = new ColorPicker(engine);

    picker.color = theme.accent;
    attachAnchoredRect(picker, colorPanel, 0, 0, 0.60, 1, 20, 76, 12, 18);
    const detail = new Control(engine);

    attachAnchoredRect(detail, colorPanel, 0.60, 0, 1, 1, 8, 76, 20, 18);
    const pickerButton = new ColorPickerButton(engine);

    pickerButton.text = 'Accent color';
    pickerButton.color = theme.accent;
    pickerButton.setRect({ position: new math.Vector2(0, 0), size: new math.Vector2(166, 40) });
    pickerButton.parent = detail;
    this.ownedPopups.push(pickerButton.popupPanel);
    const colorValue = label(engine, 'RGBA color changes stream live.', 0, 48, 166, 38, detail, {
      size: 10,
      color: theme.textSecondary,
    });

    picker.on('colorChanged', value => {
      pickerButton.color = value;
      colorValue.text = this.formatColor(value);
    });
    pickerButton.on('colorChanged', value => {
      picker.color = value;
      colorValue.text = this.formatColor(value);
    });

    const separator = new HSeparator(engine);

    separator.setRect({ position: new math.Vector2(0, 100), size: new math.Vector2(166, 16) });
    separator.parent = detail;
    const contentPanel = new PanelContainer(engine);
    const panelLabel = new Label(engine, 'PanelContainer\nuses StyleBox margins');

    contentPanel.setRect({ position: new math.Vector2(0, 128), size: new math.Vector2(166, 98) });
    contentPanel.parent = detail;
    panelLabel.horizontalAlignment = HorizontalAlignment.Center;
    panelLabel.verticalAlignment = VerticalAlignment.Center;
    panelLabel.parent = contentPanel;
    const split = new HBoxContainer(engine);
    const left = new Label(engine, 'Left');
    const verticalSeparator = new VSeparator(engine);
    const right = new Label(engine, 'Right');

    split.setThemeConstantOverride('separation', 8);
    split.setRect({ position: new math.Vector2(0, 244), size: new math.Vector2(166, 62) });
    split.parent = detail;
    left.horizontalAlignment = HorizontalAlignment.Center;
    right.horizontalAlignment = HorizontalAlignment.Center;
    left.verticalAlignment = VerticalAlignment.Center;
    right.verticalAlignment = VerticalAlignment.Center;
    left.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    right.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    verticalSeparator.setSizeFlags(SizeFlags.Fill, SizeFlags.ExpandFill);
    left.parent = split;
    verticalSeparator.parent = split;
    right.parent = split;
    this.on('visibilityChanged', this.closeHiddenPopups);
  }

  override onDestroy (): void {
    this.off('visibilityChanged', this.closeHiddenPopups);
    this.popupMenu.dispose();
    this.popupPanel.dispose();
  }

  private addSectionTitle (parent: Panel, title: string, description: string): void {
    const theme = getTheme();

    setFlatStyleOverride(parent, 'panel', { background: theme.panelBg, border: theme.borderSubtle });
    const heading = label(this.engine, title, 20, 16, 420, 26, parent, {
      size: 15,
      color: theme.textPrimary,
      weight: 680,
    });
    const copy = label(this.engine, description, 20, 43, 420, 24, parent, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Ellipsis,
    });

    heading.setAnchorMax(1, 0);
    heading.setOffsetMax(-20, 42);
    copy.setAnchorMax(1, 0);
    copy.setOffsetMax(-20, 67);
  }

  private openPopupMenu (source: Control): void {
    const transform = source.getGlobalTransform2D().elements;

    this.popupMenu.setSize(190, this.popupMenu.getBoundDesiredSize().y);
    this.popupMenu.popup(new math.Vector2(transform[6], transform[7] + source.height), source);
  }

  private openPopupPanel (source: Control): void {
    const transform = source.getGlobalTransform2D().elements;

    this.popupPanel.setSize(260, 132);
    this.popupPanel.popup(new math.Vector2(transform[6], transform[7] + source.height), source);
  }

  private formatColor (value: math.Color): string {
    return `RGBA ${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)}, ${value.a.toFixed(2)}`;
  }
}
