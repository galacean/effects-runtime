import {
  InputEventKey,
  InputEventMouseButton,
  MouseButton,
  Player,
  math,
} from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import {
  AutowrapMode,
  AxisStretchMode,
  BaseButton,
  Button,
  ButtonGroup,
  CheckBox,
  CheckButton,
  HSlider,
  HorizontalAlignment,
  Label,
  NinePatchRect,
  ProgressBar,
  ProgressFillMode,
  Side,
  TextOverflow,
  TextureExpandMode,
  TextureRect,
  TextureStretchMode,
  Theme,
  VSlider,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';

const { expect } = chai;

describe('plugin-gui/GUI basic controls', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    });
  });

  afterEach(() => {
    player.dispose();
  });

  it('updates existing controls from a tree Theme and protects stored colors', () => {
    const theme = new Theme();
    const first = new Label(player.engine, 'first');
    const source = new math.Color(0.2, 0.3, 0.4, 0.5);

    first.theme = theme;
    theme.setFontSize('Label', 'fontSize', 19);
    theme.setColor('Label', 'fontColor', source);
    expect(first.getThemeFontSize('fontSize')).equals(19);
    expect(first.getThemeColor('fontColor')).not.equals(source);
    source.r = 0.9;
    expect(first.getThemeColor('fontColor').r).equals(0.2);
    theme.setFontSize('Label', 'fontSize', 24);
    theme.setColor('Label', 'fontColor', new math.Color(0.9, 0.3, 0.4, 0.5));
    expect(first.getThemeFontSize('fontSize')).equals(24);
    expect(first.getThemeColor('fontColor').r).equals(0.9);
  });

  it('measures and lays out multiline Unicode text with wrapping and ellipsis', () => {
    const label = new Label(player.engine, '中文 😀 emoji and a very long word');
    const measurements = label.measureText('A😀中', label.getThemeFontSize('fontSize'));
    const draws: string[] = [];

    expect(measurements.advances).to.have.length(3);
    label.setSize(55, 120);
    label.autowrapMode = AutowrapMode.WordSmart;
    label.horizontalAlignment = HorizontalAlignment.Center;
    label.verticalAlignment = VerticalAlignment.Center;
    label.drawText = ((x: number, y: number, text: string) => draws.push(text)) as typeof label.drawText;
    label.draw();
    expect(draws.length).greaterThan(1);
    expect(label.getMinimumSize().x).lessThan(label.getDesiredSize().x);

    draws.length = 0;
    label.autowrapMode = AutowrapMode.Off;
    label.textOverflow = TextOverflow.Ellipsis;
    label.draw();
    expect(draws[0]).matches(/…$/);
  });

  it('supports every texture expand and stretch mode with UV flipping', () => {
    const texture = { width: 20, height: 10 } as Texture;
    const rect = new TextureRect(player.engine, texture);
    const calls: unknown[][] = [];

    rect.setSize(80, 50);
    rect.drawTexture = ((...args: unknown[]) => calls.push(args)) as typeof rect.drawTexture;
    for (const mode of [
      TextureExpandMode.KeepSize,
      TextureExpandMode.IgnoreSize,
      TextureExpandMode.FitWidth,
      TextureExpandMode.FitWidthProportional,
      TextureExpandMode.FitHeight,
      TextureExpandMode.FitHeightProportional,
    ]) {
      rect.expandMode = mode;
      expect(rect.getMinimumSize().x).at.least(0);
      expect(rect.getMinimumSize().y).at.least(0);
    }
    for (const mode of [
      TextureStretchMode.Scale,
      TextureStretchMode.Tile,
      TextureStretchMode.Keep,
      TextureStretchMode.KeepCentered,
      TextureStretchMode.KeepAspect,
      TextureStretchMode.KeepAspectCentered,
      TextureStretchMode.KeepAspectCovered,
    ]) {
      calls.length = 0;
      rect.stretchMode = mode;
      rect.draw();
      expect(calls.length).greaterThan(0);
    }

    rect.flipH = true;
    rect.flipV = true;
    rect.stretchMode = TextureStretchMode.Scale;
    calls.length = 0;
    rect.draw();
    const region = calls[0][5] as { u0: number, v0: number, u1: number, v1: number };

    expect(region.u0).greaterThan(region.u1);
    expect(region.v0).greaterThan(region.v1);
  });

  it('draws nine-patch regions with margins, axis modes and texture signals', () => {
    const firstTexture = { width: 30, height: 24 } as Texture;
    const secondTexture = { width: 40, height: 32 } as Texture;
    const rect = new NinePatchRect(player.engine, firstTexture);
    const calls: unknown[][] = [];
    const textures: Array<Texture | null> = [];

    rect.setSize(100, 70);
    rect.setRegionRect(2, 3, 24, 18);
    rect.setPatchMargin(Side.Left, 4);
    rect.setPatchMargin(Side.Top, 5);
    rect.setPatchMargin(Side.Right, 6);
    rect.setPatchMargin(Side.Bottom, 7);
    rect.on('textureChanged', texture => textures.push(texture));
    rect.drawNinePatch = ((...args: unknown[]) => calls.push(args)) as typeof rect.drawNinePatch;

    for (const horizontal of [AxisStretchMode.Stretch, AxisStretchMode.Tile, AxisStretchMode.TileFit]) {
      for (const vertical of [AxisStretchMode.Stretch, AxisStretchMode.Tile, AxisStretchMode.TileFit]) {
        rect.horizontalAxisStretchMode = horizontal;
        rect.verticalAxisStretchMode = vertical;
        calls.length = 0;
        rect.draw();
        expect(calls).length(1);
        const options = calls[0][5] as {
          sourceX: number,
          sourceY: number,
          sourceWidth: number,
          sourceHeight: number,
          horizontalMode: AxisStretchMode,
          verticalMode: AxisStretchMode,
        };

        expect(options).includes({
          sourceX: 2,
          sourceY: 3,
          sourceWidth: 24,
          sourceHeight: 18,
          horizontalMode: horizontal,
          verticalMode: vertical,
        });
      }
    }
    expect(rect.getMinimumSize()).deep.equals(new math.Vector2(10, 12));
    rect.texture = secondTexture;
    expect(textures).deep.equals([secondTexture]);
  });

  it('keeps button event order across mouse, keyboard and canceled presses', () => {
    const button = new BaseButton(player.engine);
    const events: string[] = [];

    button.setSize(100, 30);
    button.toggleMode = true;
    button.on('buttonDown', () => events.push('down'));
    button.on('buttonUp', () => events.push('up'));
    button.on('toggled', value => events.push(`toggle:${value}`));
    button.on('pressed', () => events.push('pressed'));
    button.onMouseDown(mouseButton(10, 10, MouseButton.Left));
    button.onMouseUp(mouseButton(10, 10, MouseButton.Left));
    expect(events).deep.equals(['down', 'up', 'toggle:true', 'pressed']);

    events.length = 0;
    const keyDown = new InputEventKey();
    const keyUp = new InputEventKey();

    keyDown.keycode = 'Space';
    keyUp.keycode = 'Space';
    button.onKeyDown(keyDown);
    button.onKeyUp(keyUp);
    expect(events).deep.equals(['down', 'up', 'toggle:false', 'pressed']);

    events.length = 0;
    button.onMouseDown(mouseButton(10, 10, MouseButton.Left));
    button.onScrollBegin();
    expect(events).deep.equals(['down', 'up']);
    expect(button.isPressing()).equals(false);
  });

  it('enforces button groups and supplies both check appearances', () => {
    const group = new ButtonGroup();
    const first = new CheckBox(player.engine, 'First');
    const second = new CheckBox(player.engine, 'Second');
    const checkButton = new CheckButton(player.engine, 'Enabled');
    const groupEvents: BaseButton[] = [];

    first.buttonGroup = group;
    second.buttonGroup = group;
    group.on('pressed', button => groupEvents.push(button));
    first.buttonPressed = true;
    second.buttonPressed = true;
    expect(first.buttonPressed).equals(false);
    expect(second.buttonPressed).equals(true);
    expect(group.getPressedButton()).equals(second);
    expect(group.getButtons()).deep.equals([first, second]);
    expect(groupEvents).deep.equals([]);

    first.setSize(100, 30);
    first.onMouseDown(mouseButton(10, 10, MouseButton.Left));
    first.onMouseUp(mouseButton(10, 10, MouseButton.Left));
    expect(groupEvents).deep.equals([first]);

    group.allowUnpress = true;
    first.onMouseDown(mouseButton(10, 10, MouseButton.Left));
    first.onMouseUp(mouseButton(10, 10, MouseButton.Left));
    expect(group.getPressedButton()).equals(null);

    first.buttonGroup = null;
    first.buttonPressed = true;
    expect(first.buttonPressed).equals(true);
    expect(group.getButtons()).deep.equals([second]);
    expect(checkButton.toggleMode).equals(true);
    expect(new Button(player.engine, 'Text').getMinimumSize().x).greaterThan(0);
  });

  it('supports slider clicking, dragging, wheel, keys and both directions', () => {
    const horizontal = new HSlider(player.engine);
    const vertical = new VSlider(player.engine);
    const dragEvents: Array<string | boolean> = [];

    horizontal.setSize(100, 16);
    horizontal.step = 1;
    horizontal.on('dragStarted', () => dragEvents.push('start'));
    horizontal.on('dragEnded', changed => dragEvents.push(changed));
    horizontal.onMouseDown(mouseButton(80, 8, MouseButton.Left));
    horizontal.onMouseUp(mouseButton(80, 8, MouseButton.Left));
    expect(horizontal.value).greaterThan(75);
    expect(dragEvents).deep.equals(['start', true]);

    const wheel = mouseButton(20, 8, MouseButton.WheelUp);
    const previous = horizontal.value;

    horizontal.onMouseWheel(wheel);
    expect(horizontal.value).equals(previous + 1);
    expect(wheel.isAccepted()).equals(true);

    vertical.setSize(16, 100);
    const key = new InputEventKey();

    key.keycode = 'ArrowUp';
    vertical.onKeyDown(key);
    expect(vertical.value).equals(1);
    expect(key.isAccepted()).equals(true);
  });

  it('draws progress in all four directions and formats an integer percentage', () => {
    const progress = new ProgressBar(player.engine);
    const rectangles: number[][] = [];
    const labels: string[] = [];

    progress.setSize(100, 20);
    progress.value = 25;
    progress.drawStyleBox = ((_style, x, y, width, height) => {
      rectangles.push([x, y, width, height]);
    }) as typeof progress.drawStyleBox;
    progress.drawText = ((x: number, y: number, text: string) => labels.push(text)) as typeof progress.drawText;
    for (const mode of [
      ProgressFillMode.BeginToEnd,
      ProgressFillMode.EndToBegin,
      ProgressFillMode.TopToBottom,
      ProgressFillMode.BottomToTop,
    ]) {
      rectangles.length = 0;
      progress.fillMode = mode;
      progress.draw();
      expect(rectangles).to.have.length(2);
    }
    expect(labels).deep.equals(['25%', '25%', '25%', '25%']);
    expect(progress.step).equals(0.01);
  });
});

function mouseButton (x: number, y: number, button: MouseButton): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.position.set(x, y);
  event.buttonIndex = button;
  event.pressed = true;

  return event;
}
