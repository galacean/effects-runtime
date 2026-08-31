import { Player, VFXItem, effectsClass, getClass, math } from '@galacean/effects';
import type { Engine, spec } from '@galacean/effects';
import {
  AspectRatioContainer,
  AspectRatioStretchMode,
  BaseButton,
  Button,
  CenterContainer,
  Checkbox,
  CheckButton,
  ColorPicker,
  ColorPickerButton,
  ColorRect,
  Container,
  Control,
  GridContainer,
  HBoxContainer,
  HScrollBar,
  HSeparator,
  HSlider,
  HorizontalAlignment,
  Label,
  LayoutAlignment,
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
  ProgressFillMode,
  Range,
  ScrollContainer,
  ScrollMode,
  Side,
  TextureExpandMode,
  TextureRect,
  TextureStretchMode,
  TextEdit,
  VBoxContainer,
  VScrollBar,
  VSeparator,
  VSlider,
  UIControl,
} from '@galacean/effects-plugin-gui';
import type { StyleBoxFlat } from '@galacean/effects-plugin-gui';

const { expect } = chai;

type DeserializationCase = {
  type: string,
  data: Record<string, unknown>,
  verify: (control: Control) => void,
};

describe('plugin-gui/GUI Control deserialization', () => {
  let player: Player;
  let serial = 0;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    });
  });

  afterEach(() => player.dispose());

  it('registers every concrete class by an explicit unqualified name', () => {
    const registrations: Array<[string, Function]> = [
      ['Control', Control],
      ['Container', Container],
      ['HBoxContainer', HBoxContainer],
      ['VBoxContainer', VBoxContainer],
      ['GridContainer', GridContainer],
      ['PanelContainer', PanelContainer],
      ['MarginContainer', MarginContainer],
      ['CenterContainer', CenterContainer],
      ['AspectRatioContainer', AspectRatioContainer],
      ['ScrollContainer', ScrollContainer],
      ['HScrollBar', HScrollBar],
      ['VScrollBar', VScrollBar],
      ['HSeparator', HSeparator],
      ['VSeparator', VSeparator],
      ['Label', Label],
      ['LineEdit', LineEdit],
      ['TextEdit', TextEdit],
      ['PopupPanel', PopupPanel],
      ['PopupMenu', PopupMenu],
      ['MenuButton', MenuButton],
      ['OptionButton', OptionButton],
      ['ColorPicker', ColorPicker],
      ['ColorPickerButton', ColorPickerButton],
      ['TextureRect', TextureRect],
      ['NinePatchRect', NinePatchRect],
      ['ColorRect', ColorRect],
      ['Panel', Panel],
      ['ProgressBar', ProgressBar],
      ['Button', Button],
      ['Checkbox', Checkbox],
      ['CheckButton', CheckButton],
      ['HSlider', HSlider],
      ['VSlider', VSlider],
    ];

    for (const [name, Constructor] of registrations) {
      expect(getClass(name), name).equals(Constructor);
      const result = deserializeControl(player.engine, name, {}, serial++);

      expect(result.control, name).instanceOf(Constructor);
    }
    expect(getClass('BaseButton')).equals(undefined);
    expect(getClass('Range')).equals(undefined);
    expect(getClass('BoxContainer')).equals(undefined);
    expect(getClass('Slider')).equals(undefined);
    expect(getClass('ScrollBar')).equals(undefined);
  });

  it('restores common and concrete properties for every registered type', () => {
    const texture = player.engine.whiteTexture;
    const texturePath = { id: texture.getInstanceId() };
    const common = {
      anchorMin: [0, 0],
      anchorMax: [0, 0],
      offsetMin: [20, 21],
      offsetMax: [140, 57],
      pivot: [0.25, 0.75],
      scale: [1.5, 0.5],
      shear: [3, 4],
      rotation: 15,
      customMinimumSize: [12, 13],
      customMaximumSize: [300, 301],
      horizontalSizeFlags: 3,
      verticalSizeFlags: 5,
      stretchRatio: 2,
      horizontalGrowDirection: 0,
      verticalGrowDirection: 2,
      mouseFilter: 1,
      mouseBehaviorRecursive: 2,
      mouseForcePassScrollEvents: false,
      focusMode: 2,
      focusBehaviorRecursive: 2,
      defaultCursorShape: 'crosshair',
      clipContents: true,
    };
    const cases: DeserializationCase[] = [
      {
        type: 'Control', data: common,
        verify: control => {
          expect([control.x, control.y, control.width, control.height]).deep.equals([20, 21, 120, 36]);
          expect(control.pivot).deep.equals(new math.Vector2(0.25, 0.75));
          expect(control.scale).deep.equals(new math.Vector2(1.5, 0.5));
          expect(control.clipContents).equals(true);
          expect(control.stretchRatio).equals(2);
        },
      },
      {
        type: 'Container', data: { stretchRatio: 3 },
        verify: control => expect(control.stretchRatio).equals(3),
      },
      {
        type: 'HBoxContainer',
        data: {
          alignment: LayoutAlignment.End,
          reverse: true,
          themeOverrides: { constants: { separation: 6 } },
        },
        verify: control => {
          const box = control as HBoxContainer;

          expect([box.alignment, box.getThemeConstant('separation'), box.reverse])
            .deep.equals([LayoutAlignment.End, 6, true]);
        },
      },
      {
        type: 'VBoxContainer',
        data: {
          alignment: LayoutAlignment.Center,
          themeOverrides: { constants: { separation: 7 } },
        },
        verify: control => {
          const box = control as VBoxContainer;

          expect([box.alignment, box.getThemeConstant('separation')]).deep.equals([LayoutAlignment.Center, 7]);
        },
      },
      {
        type: 'GridContainer',
        data: {
          columns: 3,
          themeOverrides: { constants: { horizontalSeparation: 4, verticalSeparation: 5 } },
        },
        verify: control => {
          const grid = control as GridContainer;

          expect([
            grid.columns,
            grid.getThemeConstant('horizontalSeparation'),
            grid.getThemeConstant('verticalSeparation'),
          ]).deep.equals([3, 4, 5]);
        },
      },
      {
        type: 'PanelContainer',
        data: {
          themeOverrides: {
            styleBoxes: {
              panel: {
                type: 'flat',
                contentMargins: { left: 3, top: 4, right: 5, bottom: 6 },
              },
            },
          },
        },
        verify: control => {
          expect(control.getThemeStyleBox('panel').getContentMargins())
            .deep.equals({ left: 3, top: 4, right: 5, bottom: 6 });
        },
      },
      {
        type: 'MarginContainer',
        data: {
          themeOverrides: {
            constants: { marginLeft: 1, marginTop: 2, marginRight: 3, marginBottom: 4 },
          },
        },
        verify: control => {
          const margin = control as MarginContainer;

          expect([
            margin.getThemeConstant('marginLeft'),
            margin.getThemeConstant('marginTop'),
            margin.getThemeConstant('marginRight'),
            margin.getThemeConstant('marginBottom'),
          ])
            .deep.equals([1, 2, 3, 4]);
        },
      },
      {
        type: 'CenterContainer', data: { useTopLeft: true },
        verify: control => expect((control as CenterContainer).useTopLeft).equals(true),
      },
      {
        type: 'AspectRatioContainer',
        data: {
          ratio: 1.5,
          stretchMode: AspectRatioStretchMode.Cover,
          horizontalAlignment: LayoutAlignment.End,
          verticalAlignment: LayoutAlignment.Begin,
        },
        verify: control => {
          const aspect = control as AspectRatioContainer;

          expect([aspect.ratio, aspect.stretchMode, aspect.horizontalAlignment, aspect.verticalAlignment])
            .deep.equals([1.5, AspectRatioStretchMode.Cover, LayoutAlignment.End, LayoutAlignment.Begin]);
        },
      },
      {
        type: 'ScrollContainer',
        data: {
          hScroll: 11,
          vScroll: 12,
          horizontalScrollMode: ScrollMode.ShowAlways,
          verticalScrollMode: ScrollMode.Reserve,
          horizontalCustomStep: 2,
          verticalCustomStep: 3,
          scrollHorizontalByDefault: true,
          deadzone: 8,
          followFocus: true,
        },
        verify: control => {
          const scroll = control as ScrollContainer;

          expect([scroll.hScroll, scroll.vScroll]).deep.equals([11, 12]);
          expect([scroll.horizontalScrollMode, scroll.verticalScrollMode])
            .deep.equals([ScrollMode.ShowAlways, ScrollMode.Reserve]);
          expect([scroll.horizontalCustomStep, scroll.verticalCustomStep, scroll.deadzone])
            .deep.equals([2, 3, 8]);
          expect(scroll.followFocus).equals(true);
        },
      },
      scrollBarCase('HScrollBar'),
      scrollBarCase('VScrollBar'),
      {
        type: 'HSeparator', data: { customMinimumSize: [30, 2] },
        verify: control => expect(control.getCombinedMinimumSize()).deep.equals(new math.Vector2(30, 2)),
      },
      {
        type: 'VSeparator', data: { customMinimumSize: [2, 30] },
        verify: control => expect(control.getCombinedMinimumSize()).deep.equals(new math.Vector2(2, 30)),
      },
      {
        type: 'Label',
        data: {
          text: 'Hello',
          horizontalAlignment: 2,
          themeOverrides: {
            fonts: { font: { family: 'serif' } },
            fontSizes: { fontSize: 20 },
            colors: { fontColor: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 } },
          },
        },
        verify: control => {
          const label = control as Label;

          expect([
            label.text,
            label.getThemeFont('font').family,
            label.getThemeFontSize('fontSize'),
            label.horizontalAlignment,
          ])
            .deep.equals(['Hello', 'serif', 20, HorizontalAlignment.Right]);
          expect(label.getThemeColor('fontColor').toArray()).deep.equals([0.1, 0.2, 0.3, 0.4]);
        },
      },
      {
        type: 'LineEdit',
        data: {
          text: 'secret',
          placeholderText: 'Password',
          editable: false,
          maxLength: 24,
          secret: true,
          secretCharacter: '*',
          alignment: HorizontalAlignment.Center,
        },
        verify: control => {
          const edit = control as LineEdit;

          expect([
            edit.text,
            edit.placeholderText,
            edit.editable,
            edit.maxLength,
            edit.secret,
            edit.secretCharacter,
            edit.alignment,
          ]).deep.equals(['secret', 'Password', false, 24, true, '*', HorizontalAlignment.Center]);
        },
      },
      {
        type: 'TextEdit',
        data: { text: 'first\nsecond', placeholderText: 'Notes', editable: false, maxLength: 80 },
        verify: control => {
          const edit = control as TextEdit;

          expect([edit.text, edit.placeholderText, edit.editable, edit.maxLength])
            .deep.equals(['first\nsecond', 'Notes', false, 80]);
        },
      },
      {
        type: 'PopupPanel', data: { customMinimumSize: [120, 80] },
        verify: control => expect(control.getCombinedMinimumSize()).deep.equals(new math.Vector2(120, 80)),
      },
      {
        type: 'PopupMenu',
        data: {
          items: [
            { id: 'open', text: 'Open', checked: true },
            { id: 'separator', text: '', separator: true },
            { id: 'disabled', text: 'Disabled', disabled: true },
          ],
        },
        verify: control => {
          const menu = control as PopupMenu;

          expect(menu.getItemCount()).equals(3);
          expect(menu.getItem(0)).includes({ id: 'open', text: 'Open', checked: true });
          expect(menu.getItem(1)?.separator).equals(true);
          expect(menu.getItem(2)?.disabled).equals(true);
        },
      },
      {
        type: 'MenuButton',
        data: { text: 'Actions', items: [{ id: 3, text: 'Duplicate' }] },
        verify: control => {
          const menu = control as MenuButton;

          expect(menu.text).equals('Actions');
          expect(menu.popupMenu.getItem(0)).includes({ id: 3, text: 'Duplicate' });
        },
      },
      {
        type: 'OptionButton',
        data: {
          items: [{ id: 'small', text: 'Small' }, { id: 'large', text: 'Large' }],
          selected: 1,
        },
        verify: control => {
          const option = control as OptionButton;

          expect([option.selected, option.text]).deep.equals([1, 'Large']);
        },
      },
      {
        type: 'ColorPicker',
        data: { color: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 }, editAlpha: false },
        verify: control => {
          const picker = control as ColorPicker;

          expect(picker.color.toArray()).deep.equals([0.1, 0.2, 0.3, 0.4]);
          expect(picker.editAlpha).equals(false);
        },
      },
      {
        type: 'ColorPickerButton',
        data: { color: { r: 0.8, g: 0.7, b: 0.6, a: 0.5 }, editAlpha: false },
        verify: control => {
          const picker = control as ColorPickerButton;

          expect(picker.color.toArray()).deep.equals([0.8, 0.7, 0.6, 0.5]);
          expect(picker.editAlpha).equals(false);
        },
      },
      {
        type: 'TextureRect',
        data: {
          texture: texturePath,
          expandMode: TextureExpandMode.IgnoreSize,
          stretchMode: TextureStretchMode.KeepAspect,
          flipH: true,
          flipV: true,
          tint: { r: 0.2, g: 0.3, b: 0.4, a: 0.5 },
        },
        verify: control => {
          const rect = control as TextureRect;

          expect(rect.texture).equals(texture);
          expect([rect.expandMode, rect.stretchMode, rect.flipH, rect.flipV])
            .deep.equals([TextureExpandMode.IgnoreSize, TextureStretchMode.KeepAspect, true, true]);
          expect(rect.tint.toArray()).deep.equals([0.2, 0.3, 0.4, 0.5]);
        },
      },
      {
        type: 'NinePatchRect',
        data: {
          texture: texturePath,
          regionRect: { position: [1, 2], size: [30, 40] },
          patchMarginLeft: 3,
          patchMarginTop: 4,
          patchMarginRight: 5,
          patchMarginBottom: 6,
          drawCenter: false,
          tint: { r: 0.3, g: 0.4, b: 0.5, a: 0.6 },
        },
        verify: control => {
          const rect = control as NinePatchRect;

          expect(rect.texture).equals(texture);
          expect(rect.regionRect).deep.equals({ position: new math.Vector2(1, 2), size: new math.Vector2(30, 40) });
          expect([Side.Left, Side.Top, Side.Right, Side.Bottom].map(side => rect.getPatchMargin(side)))
            .deep.equals([3, 4, 5, 6]);
          expect(rect.drawCenter).equals(false);
        },
      },
      {
        type: 'ColorRect', data: { color: { r: 0.4, g: 0.5, b: 0.6, a: 0.7 } },
        verify: control => expect((control as ColorRect).color.toArray()).deep.equals([0.4, 0.5, 0.6, 0.7]),
      },
      {
        type: 'Panel',
        data: {
          themeOverrides: {
            styleBoxes: {
              panel: {
                type: 'flat',
                backgroundColor: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
                borderColor: { r: 0.9, g: 0.8, b: 0.7, a: 1 },
                borderWidths: { left: 4, top: 4, right: 4, bottom: 4 },
              },
            },
          },
        },
        verify: control => {
          const panel = control as Panel;

          const style = panel.getThemeStyleBox('panel') as StyleBoxFlat;

          expect(style.getBackgroundColor().toArray()).deep.equals([0.1, 0.2, 0.3, 1]);
          expect(style.getBorderWidths().left).equals(4);
        },
      },
      {
        type: 'ProgressBar',
        data: {
          minValue: 10,
          maxValue: 210,
          step: 2,
          value: 80,
          showPercentage: false,
          fillMode: ProgressFillMode.BottomToTop,
          themeOverrides: {
            styleBoxes: {
              fill: { type: 'flat', backgroundColor: { r: 0.1, g: 0.7, b: 0.2, a: 1 } },
            },
          },
        },
        verify: control => {
          const progress = control as ProgressBar;

          expect([progress.minValue, progress.maxValue, progress.step, progress.value])
            .deep.equals([10, 210, 2, 80]);
          expect([progress.showPercentage, progress.fillMode])
            .deep.equals([false, ProgressFillMode.BottomToTop]);
          expect((progress.getThemeStyleBox('fill') as StyleBoxFlat).getBackgroundColor().toArray())
            .deep.equals([0.1, 0.7, 0.2, 1]);
        },
      },
      buttonCase('Button', texturePath, texture),
      {
        ...buttonCase('Checkbox', texturePath, texture),
        data: {
          ...buttonCase('Checkbox', texturePath, texture).data,
          themeOverrides: {
            colors: { markColor: { r: 0.8, g: 0.2, b: 0.1, a: 1 } },
          },
        },
        verify: control => expect(control.getThemeColor('markColor').toArray()).deep.equals([0.8, 0.2, 0.1, 1]),
      },
      {
        ...buttonCase('CheckButton', texturePath, texture),
        data: {
          ...buttonCase('CheckButton', texturePath, texture).data,
          themeOverrides: {
            colors: { switchColor: { r: 0.2, g: 0.8, b: 0.1, a: 1 } },
          },
        },
        verify: control => expect(control.getThemeColor('switchColor').toArray()).deep.equals([0.2, 0.8, 0.1, 1]),
      },
      sliderCase('HSlider'),
      sliderCase('VSlider'),
    ];

    for (const testCase of cases) {
      const result = deserializeControl(player.engine, testCase.type, testCase.data, serial++);

      testCase.verify(result.control);
    }
  });

  it('keeps constructor defaults for omitted fields', () => {
    const label = deserializeControl(player.engine, 'Label', { text: 'Only text' }, serial++).control as Label;
    const button = deserializeControl(player.engine, 'Button', {}, serial++).control as Button;

    expect(label.text).equals('Only text');
    expect(label.getThemeFontSize('fontSize')).greaterThan(0);
    expect(button.text).equals('');
    expect(button.disabled).equals(false);
    expect(button.getThemeStyleBox('normal')).not.equals(undefined);
  });

  it('uses silent setters while loading Button and Range state', () => {
    const button = new Button(player.engine);
    const range = new Range(player.engine);
    const events: string[] = [];

    button.on('toggled', () => events.push('toggled'));
    range.on('changed', () => events.push('changed'));
    range.on('valueChanged', () => events.push('valueChanged'));
    button.fromData({ toggleMode: true, buttonPressed: true });
    range.fromData({ minValue: 10, maxValue: 50, step: 2, value: 24 });

    expect(button.buttonPressed).equals(true);
    expect(range.value).equals(24);
    expect(events).deep.equals([]);
  });

  it('loads UIControl through AssetLoader and applies JSON after the initial Item location', () => {
    const item = new VFXItem(player.engine);
    const itemId = `gui-item-${serial++}`;
    const componentId = `gui-component-${serial++}`;

    item.setInstanceId(itemId);
    item.transform.setPosition(77, 88, 9);
    const data = createUIControlData(componentId, itemId, 'Button', {
      offsetMin: [20, 21],
      offsetMax: [140, 57],
      text: 'Confirm',
    });

    player.engine.addEffectsObjectData(data);
    const component = player.engine.findObject<UIControl>({ id: componentId });
    const button = component.control as Button;

    expect(component.item).equals(item);
    expect(button.text).equals('Confirm');
    expect([button.x, button.y, button.width, button.height]).deep.equals([20, 21, 120, 36]);
    expect([item.transform.position.x, item.transform.position.y, item.transform.position.z])
      .deep.equals([20, 21, 9]);

    item.transform.setPosition(90, 91, 9);
    expect([button.x, button.y]).deep.equals([90, 91]);
    component.onParentChanged();
    expect([button.x, button.y]).deep.equals([90, 91]);
  });

  it('keeps nested parents, order, ScrollContainer internals and disposal intact', () => {
    const parentItem = new VFXItem(player.engine);
    const parent = parentItem.addComponent(UIControl);

    parent.fromData(createUIControlData(`parent-${serial++}`, parentItem.getInstanceId(), 'HBoxContainer', {}));

    const firstItem = new VFXItem(player.engine);
    const first = firstItem.addComponent(UIControl);
    const secondItem = new VFXItem(player.engine);
    const second = secondItem.addComponent(UIControl);

    first.fromData(createUIControlData(`first-${serial++}`, firstItem.getInstanceId(), 'Button', { text: 'First' }));
    second.fromData(createUIControlData(`second-${serial++}`, secondItem.getInstanceId(), 'ScrollContainer', {}));
    firstItem.setParent(parentItem);
    secondItem.setParent(parentItem);

    expect(first.control?.parent).equals(parent.control);
    expect(second.control?.parent).equals(parent.control);
    expect((parent.control as Container).children).deep.equals([first.control, second.control]);
    firstItem.orderInParent = 1;
    expect((parent.control as Container).children).deep.equals([second.control, first.control]);

    const scroll = second.control as ScrollContainer;
    const horizontal = scroll.getHScrollBar();
    const vertical = scroll.getVScrollBar();

    expect(scroll.children.slice(0, 2)).deep.equals([horizontal, vertical]);
    second.dispose();
    expect(scroll.isDisposed).equals(true);
    expect(horizontal.isDisposed).equals(true);
    expect(vertical.isDisposed).equals(true);
  });

  it('keeps the existing duplicate effectsClass warning and last-registration behavior', () => {
    class First {}
    class Second {}
    const name = `DuplicateControlTest-${serial++}`;

    effectsClass(name)(First);
    effectsClass(name)(Second);
    expect(getClass(name)).equals(Second);
  });

  function scrollBarCase (type: 'HScrollBar' | 'VScrollBar'): DeserializationCase {
    return {
      type,
      data: {
        minValue: 5,
        maxValue: 205,
        step: 2,
        page: 20,
        value: 25,
        customStep: 3,
        themeOverrides: {
          styleBoxes: {
            grabber: { type: 'flat', backgroundColor: { r: 0.2, g: 0.3, b: 0.4, a: 1 } },
          },
        },
      },
      verify: control => {
        const bar = control as HScrollBar | VScrollBar;

        expect([bar.minValue, bar.maxValue, bar.step, bar.page, bar.value, bar.customStep])
          .deep.equals([5, 205, 2, 20, 25, 3]);
        expect((bar.getThemeStyleBox('grabber') as StyleBoxFlat).getBackgroundColor().toArray())
          .deep.equals([0.2, 0.3, 0.4, 1]);
      },
    };
  }

  function buttonCase (
    type: 'Button' | 'Checkbox' | 'CheckButton',
    texturePath: { id: string },
    texture: Engine['whiteTexture'],
  ): DeserializationCase {
    return {
      type,
      data: {
        text: 'Confirm',
        icon: texturePath,
        disabled: true,
        toggleMode: true,
        buttonPressed: true,
        flat: true,
        themeOverrides: {
          styleBoxes: {
            normal: {
              type: 'flat',
              backgroundColor: { r: 0.22, g: 0.25, b: 0.31, a: 1 },
              contentMargins: { left: 12, top: 4, right: 12, bottom: 4 },
            },
          },
        },
      },
      verify: control => {
        const button = control as Button;

        expect([button.text, button.disabled, button.toggleMode, button.buttonPressed, button.flat])
          .deep.equals(['Confirm', true, true, true, true]);
        expect(button.icon).equals(texture);
        const style = button.getThemeStyleBox('normal') as StyleBoxFlat;

        expect(style.getContentMargins().left).equals(12);
        expect(style.getBackgroundColor().toArray()).deep.equals([0.22, 0.25, 0.31, 1]);
      },
    };
  }

  function sliderCase (type: 'HSlider' | 'VSlider'): DeserializationCase {
    return {
      type,
      data: {
        minValue: -10,
        maxValue: 10,
        step: 0.5,
        value: 2.5,
        editable: false,
        scrollable: false,
        themeOverrides: {
          styleBoxes: {
            fill: { type: 'flat', backgroundColor: { r: 0.7, g: 0.2, b: 0.1, a: 1 } },
          },
        },
      },
      verify: control => {
        const slider = control as HSlider | VSlider;

        expect([slider.minValue, slider.maxValue, slider.step, slider.value])
          .deep.equals([-10, 10, 0.5, 2.5]);
        expect([slider.editable, slider.scrollable]).deep.equals([false, false]);
        expect((slider.getThemeStyleBox('fill') as StyleBoxFlat).getBackgroundColor().toArray())
          .deep.equals([0.7, 0.2, 0.1, 1]);
      },
    };
  }
});

function deserializeControl (
  engine: Engine,
  type: string,
  data: Record<string, unknown>,
  serial: number,
): { item: VFXItem, component: UIControl, control: Control } {
  const item = new VFXItem(engine);
  const component = item.addComponent(UIControl);

  component.fromData(createUIControlData(`component-${serial}`, item.getInstanceId(), type, data));
  if (!component.control) {
    throw new Error(`Control ${type} was not created.`);
  }

  return { item, component, control: component.control };
}

function createUIControlData (
  id: string,
  itemId: string,
  type: string,
  data: Record<string, unknown>,
): spec.UIControlData {
  return {
    id,
    dataType: 'UIControl' as spec.UIControlData['dataType'],
    item: { id: itemId },
    control: type,
    data,
  } as spec.UIControlData;
}
