import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { Popup } from '@galacean/effects-plugin-gui';
import {
  ColorPickerButton,
  Control,
  HorizontalAlignment,
  Label,
  MenuButton,
  OptionButton,
  Panel,
  PanelContainer,
  PopupMenu,
  PopupPanel,
  SizeFlags,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme, setFlatStyleOverride } from '../theme';
import { createButton } from '../widgets';
import { label } from './common';

export class OverlaysPage extends Control {
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
    const menusPanel = new Panel(engine);
    const overlaysPanel = new Panel(engine);

    attachAnchoredRect(menusPanel, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(overlaysPanel, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.addSectionTitle(menusPanel, 'Menus and option lists', 'Command menus and single-choice lists share the transient menu layer.');
    this.addSectionTitle(overlaysPanel, 'Popup surfaces', 'Transient content closes outside, avoids window edges and restores focus.');

    const menuButton = new MenuButton(engine, 'Actions');

    menuButton.popupMenu.addItem('Duplicate', 'duplicate');
    menuButton.popupMenu.addItem('Rename', 'rename');
    menuButton.popupMenu.addSeparator();
    menuButton.popupMenu.addItem('Archive', 'archive');
    menuButton.popupMenu.setItemDisabled(3, true);
    menuButton.setRect({ position: new math.Vector2(20, 88), size: new math.Vector2(164, 40) });
    menuButton.parent = menusPanel;
    this.ownedPopups.push(menuButton.popupMenu);

    const optionButton = new OptionButton(engine);

    optionButton.addItem('Draft', 'draft');
    optionButton.addItem('In review', 'review');
    optionButton.addItem('Published', 'published');
    optionButton.select(1, false);
    optionButton.setRect({ position: new math.Vector2(198, 88), size: new math.Vector2(164, 40) });
    optionButton.parent = menusPanel;
    this.ownedPopups.push(optionButton.popupMenu);

    this.popupMenu = new PopupMenu(engine);
    this.ownedPopups.push(this.popupMenu);
    this.popupMenu.addItem('Checked item', 'checked');
    this.popupMenu.setItemChecked(0, true);
    this.popupMenu.addItem('Regular item', 'regular');
    this.popupMenu.addSeparator('Section');
    this.popupMenu.addItem('Unavailable item', 'disabled');
    this.popupMenu.setItemDisabled(3, true);
    const openMenu = createButton(engine, 'Open standalone menu', () => this.openPopupMenu(openMenu), 'primary');

    openMenu.setRect({ position: new math.Vector2(20, 164), size: new math.Vector2(342, 42) });
    openMenu.parent = menusPanel;
    const menuStatus = label(engine, 'Choose an option or trigger a command.', 20, 226, 342, 32, menusPanel, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Ellipsis,
    });

    optionButton.onOption('itemSelected', id => { menuStatus.text = `Option selected · ${String(id)}`; });
    menuButton.popupMenu.on('idPressed', id => { menuStatus.text = `Menu action · ${String(id)}`; });
    this.popupMenu.on('idPressed', id => { menuStatus.text = `Standalone item · ${String(id)}`; });

    const pickerButton = new ColorPickerButton(engine);

    pickerButton.text = 'Open color editor';
    pickerButton.color = theme.accent;
    pickerButton.setRect({ position: new math.Vector2(20, 88), size: new math.Vector2(342, 42) });
    pickerButton.parent = overlaysPanel;
    this.ownedPopups.push(pickerButton.popupPanel);
    const colorValue = label(engine, 'The editor is hosted in a popup surface.', 20, 138, 342, 32, overlaysPanel, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Ellipsis,
    });

    pickerButton.on('colorChanged', value => {
      colorValue.text = `RGBA ${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)}, ${value.a.toFixed(2)}`;
    });

    this.popupPanel = new PopupPanel(engine);
    this.ownedPopups.push(this.popupPanel);
    const popupContent = new PanelContainer(engine);
    const popupLabel = new Label(engine, 'PopupPanel content\nClick outside or press Esc to close');

    popupContent.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    popupContent.parent = this.popupPanel;
    popupLabel.horizontalAlignment = HorizontalAlignment.Center;
    popupLabel.verticalAlignment = VerticalAlignment.Center;
    popupLabel.parent = popupContent;
    const openPanel = createButton(engine, 'Open content panel', () => this.openPopupPanel(openPanel));

    openPanel.setRect({ position: new math.Vector2(20, 204), size: new math.Vector2(342, 42) });
    openPanel.parent = overlaysPanel;
    label(engine, 'Both popup types use the root overlay layer, so they are not clipped by their source panel.', 20, 270, 342, 64, overlaysPanel, {
      size: 10,
      color: theme.textSecondary,
    });
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

    this.popupMenu.setSize(210, this.popupMenu.getBoundDesiredSize().y);
    this.popupMenu.popup(new math.Vector2(transform[6], transform[7] + source.height), source);
  }

  private openPopupPanel (source: Control): void {
    const transform = source.getGlobalTransform2D().elements;

    this.popupPanel.setSize(280, 140);
    this.popupPanel.popup(new math.Vector2(transform[6], transform[7] + source.height), source);
  }
}
