import {
  Player,
  math,
} from '@galacean/effects';
import type { Graphics } from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import {
  Button,
  ButtonGroup,
  Checkbox,
  Control,
  HBoxContainer,
  HScrollBar,
  HSlider,
  Label,
  PatchStretchMode,
  ProgressBar,
  StyleBoxEmpty,
  StyleBoxFlat,
  StyleBoxTexture,
  Theme,
  GUIWindowComponent,
} from '@galacean/effects-plugin-gui';
import type { StyleBox } from '@galacean/effects-plugin-gui';

const { expect } = chai;

function createPlayer (): Player {
  return new Player({
    canvas: document.createElement('canvas'),
    pixelRatio: 1,
    manualRender: true,
    interactive: true,
  });
}

function color (red: number): math.Color {
  return new math.Color(red, 0, 0, 1);
}

describe('plugin-gui/GUI Theme and StyleBox', () => {
  let player: Player;

  beforeEach(() => {
    player = createPlayer();
  });

  afterEach(() => {
    player.dispose();
  });

  it('resolves override, near Theme, ancestor Theme, type inheritance and native fallback in order', () => {
    const root = new Control(player.engine);
    const branch = new Control(player.engine);
    const button = new Button(player.engine, 'Theme');
    const rootTheme = new Theme();
    const branchTheme = new Theme();

    branch.parent = root;
    button.parent = branch;
    root.theme = rootTheme;
    branch.theme = branchTheme;
    rootTheme.setColor('Control', 'custom', color(0.1));
    rootTheme.setColor('Button', 'fontColor', color(0.2));
    branchTheme.setColor('Button', 'fontColor', color(0.3));

    expect(button.getThemeColor('fontColor').r).equals(0.3);
    expect(button.getThemeColor('custom').r).equals(0.1);
    expect(button.hasThemeStyleBox('normal')).equals(true);
    button.setThemeColorOverride('fontColor', color(0.4));
    expect(button.getThemeColor('fontColor').r).equals(0.4);
    button.removeThemeColorOverride('fontColor');
    expect(button.getThemeColor('fontColor').r).equals(0.3);

    branch.setThemeColorOverride('custom', color(0.9));
    expect(button.getThemeColor('custom').r).equals(0.1);
    expect(button.hasThemeColor('missing')).equals(false);
    expect(button.getThemeColor('missing').a).equals(0);
    expect(button.hasThemeColorOverride('fontColor')).equals(false);
  });

  it('supports multi-level variations, explicit type queries and rejects bad variation graphs', () => {
    const button = new Button(player.engine);
    const theme = new Theme();
    const root = player.engine.root.getComponent(GUIWindowComponent).windowRoot;

    theme.setTypeVariation('DangerButton', 'Button');
    theme.setTypeVariation('ProminentDangerButton', 'DangerButton');
    theme.setColor('Button', 'fontColor', color(0.2));
    theme.setColor('BaseButton', 'fontColor', color(0.15));
    theme.setColor('DangerButton', 'fontColor', color(0.5));
    button.theme = theme;
    button.themeTypeVariation = 'ProminentDangerButton';
    button.parent = root;
    expect(button.getThemeColor('fontColor').r).equals(0.5);

    button.setThemeColorOverride('fontColor', color(0.8));
    expect(button.getThemeColor('fontColor').r).equals(0.8);
    expect(button.getThemeColor('fontColor', 'Button').r).equals(0.8);
    expect(button.getThemeColor('fontColor', 'BaseButton').r).equals(0.15);
    expect(() => theme.setTypeVariation('Unknown', 'Missing')).throws();
    expect(() => theme.setTypeVariation('Button', 'Control')).throws();
    expect(() => theme.setTypeVariation('DangerButton', 'ProminentDangerButton')).throws();
    expect(() => theme.clearTypeVariation('DangerButton')).throws();

    let layoutChanges = 0;

    button.on('minimumSizeChanged', () => layoutChanges++);
    theme.setFontSize('ProminentDangerButton', 'fontSize', 26);
    root.update(0);
    expect(layoutChanges).equals(1);
  });

  it('coalesces batch changes, skips layout invalidation for colors and forwards StyleBox mutations', () => {
    const label = new Label(player.engine, 'live');
    const theme = new Theme();
    const style = new StyleBoxFlat();
    let themeChanges = 0;
    let layoutChanges = 0;
    let lastAffectsLayout = false;
    const root = player.engine.root.getComponent(GUIWindowComponent).windowRoot;

    label.theme = theme;
    label.parent = root;
    label.on('themeChanged', (_control, affectsLayout) => {
      themeChanges++;
      lastAffectsLayout = affectsLayout;
    });
    label.on('minimumSizeChanged', () => layoutChanges++);
    theme.batch(() => {
      theme.setColor('Label', 'fontColor', color(0.1));
      theme.setColor('Label', 'fontColor', color(0.2));
    });
    expect(themeChanges).equals(1);
    expect(layoutChanges).equals(0);
    expect(lastAffectsLayout).equals(false);

    theme.setFontSize('Label', 'fontSize', 22);
    expect(label.getThemeFontSize('fontSize')).equals(22);
    root.update(0);
    expect(layoutChanges).equals(1);
    expect(lastAffectsLayout).equals(true);

    theme.setStyleBox('Label', 'testBox', style);
    const changesBeforeMutation = themeChanges;

    style.setContentMargins(1, 2, 3, 4);
    expect(themeChanges).equals(changesBeforeMutation + 1);
    expect(label.getThemeStyleBox('testBox').getMinimumSize().toArray()).deep.equals([4, 6]);
  });

  it('draws rounded borders as a ring without covering a transparent center', () => {
    const style = new StyleBoxFlat();
    const borderColor = new math.Color(0.8, 0.2, 0.1, 1);
    const triangles: unknown[][] = [];
    const graphics = player.engine.graphics;
    const originalTriangle = graphics.fillTriangle;

    style.setBackgroundColor(new math.Color(0.1, 0.2, 0.3, 0));
    style.setBorderColor(borderColor);
    style.setBorderWidths(3, 3, 3, 3);
    style.setCornerRadii(7, 7, 7, 7);
    graphics.fillTriangle = ((...args: unknown[]) => triangles.push(args)) as Graphics['fillTriangle'];
    try {
      style.draw(graphics, { x: 0, y: 0, width: 20, height: 20 });
    } finally {
      graphics.fillTriangle = originalTriangle;
    }
    const borderTriangles = triangles.filter(args => {
      const triangleColor = args[6] as math.Color;

      return triangleColor.equals(borderColor);
    });

    expect(borderTriangles.length).greaterThan(0);
    expect(borderTriangles.every(args => !triangleContainsPoint(
      10, 10,
      args[0] as number, args[1] as number,
      args[2] as number, args[3] as number,
      args[4] as number, args[5] as number,
    ))).equals(true);
  });

  it('invalidates inherited caches across reparent and detaches listeners on dispose', () => {
    const left = new Control(player.engine);
    const right = new Control(player.engine);
    const label = new Label(player.engine);
    const leftTheme = new Theme();
    const rightTheme = new Theme();
    let changes = 0;

    leftTheme.setColor('Label', 'fontColor', color(0.25));
    rightTheme.setColor('Label', 'fontColor', color(0.75));
    left.theme = leftTheme;
    right.theme = rightTheme;
    label.parent = left;
    expect(label.getThemeColor('fontColor').r).equals(0.25);
    label.parent = right;
    expect(label.getThemeColor('fontColor').r).equals(0.75);
    label.on('themeChanged', () => changes++);
    label.theme = rightTheme;
    label.dispose();
    const before = changes;

    rightTheme.setColor('Label', 'fontColor', color(0.9));
    expect(changes).equals(before);
  });

  it('assigns Theme owners without notifying outside the tree and notifies on every tree entry', () => {
    const root = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    const theme = new Theme();
    const left = new Control(player.engine);
    const right = new Control(player.engine);
    const branch = new Control(player.engine);
    const label = new Label(player.engine, 'stable');
    let changes = 0;

    root.theme = theme;
    left.parent = root;
    right.parent = root;
    label.parent = branch;
    label.on('themeChanged', () => changes++);
    expect(label.hasThemeOwnerNode()).equals(false);
    branch.parent = left;
    expect(branch.getThemeOwnerNode()).equals(root);
    expect(label.getThemeOwnerNode()).equals(root);
    expect(changes).equals(1);
    branch.parent = right;
    expect(changes).equals(2);
  });

  it('keeps explicit Theme owner boundaries while inherited owner chains change', () => {
    const root = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    const outerTheme = new Theme();
    const innerTheme = new Theme();
    const branch = new Control(player.engine);
    const nested = new Control(player.engine);
    const label = new Label(player.engine);
    let changes = 0;

    outerTheme.setColor('Label', 'outer', color(0.2));
    innerTheme.setColor('Label', 'inner', color(0.7));
    root.theme = outerTheme;
    nested.theme = innerTheme;
    label.parent = nested;
    label.on('themeChanged', () => changes++);
    nested.parent = branch;
    expect(branch.hasThemeOwnerNode()).equals(false);
    expect(nested.getThemeOwnerNode()).equals(nested);
    expect(label.getThemeOwnerNode()).equals(nested);
    expect(changes).equals(0);
    branch.parent = root;
    expect(branch.getThemeOwnerNode()).equals(root);
    expect(nested.getThemeOwnerNode()).equals(nested);
    expect(label.getThemeOwnerNode()).equals(nested);
    expect(changes).equals(1);
    expect(label.getThemeColor('inner').r).equals(0.7);
    expect(label.getThemeColor('outer').r).equals(0.2);
    nested.theme = null;
    expect(nested.getThemeOwnerNode()).equals(root);
    expect(label.getThemeOwnerNode()).equals(root);
  });

  it('defers and coalesces measurement changes across a nested themed layout', () => {
    const root = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    const theme = new Theme();
    const outer = new HBoxContainer(player.engine);
    const inner = new HBoxContainer(player.engine);
    const first = new Label(player.engine, 'First');
    const second = new Label(player.engine, 'Second');
    let outerChanges = 0;
    let innerChanges = 0;

    root.theme = theme;
    outer.parent = root;
    inner.parent = outer;
    first.parent = inner;
    second.parent = inner;
    root.update(0);
    outer.getCombinedMinimumSize();
    inner.getCombinedMinimumSize();
    outer.on('minimumSizeChanged', () => outerChanges++);
    inner.on('minimumSizeChanged', () => innerChanges++);
    theme.setFontSize('Label', 'fontSize', 24);
    expect(outerChanges).equals(0);
    expect(innerChanges).equals(0);
    root.update(0);
    expect(outerChanges).equals(1);
    expect(innerChanges).equals(1);
  });

  it('keeps root Themes isolated between Players', () => {
    const other = createPlayer();

    try {
      const firstTheme = new Theme();
      const secondTheme = new Theme();
      const first = new Label(player.engine);
      const second = new Label(other.engine);

      firstTheme.setColor('Label', 'fontColor', color(0.2));
      secondTheme.setColor('Label', 'fontColor', color(0.8));
      player.engine.root.getComponent(GUIWindowComponent).windowRoot.theme = firstTheme;
      other.engine.root.getComponent(GUIWindowComponent).windowRoot.theme = secondTheme;
      first.parent = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
      second.parent = other.engine.root.getComponent(GUIWindowComponent).windowRoot;
      expect(first.getThemeColor('fontColor').r).equals(0.2);
      expect(second.getThemeColor('fontColor').r).equals(0.8);
      firstTheme.setColor('Label', 'fontColor', color(0.4));
      expect(first.getThemeColor('fontColor').r).equals(0.4);
      expect(second.getThemeColor('fontColor').r).equals(0.8);
    } finally {
      other.dispose();
    }
  });

  it('loads Theme and overrides data and draws Flat and Texture StyleBoxes', () => {
    const texturePath = { id: player.engine.whiteTexture.getInstanceId() };
    const theme = Theme.fromData(player.engine, {
      types: {
        Label: {
          colors: { fontColor: { r: 0.3, g: 0.4, b: 0.5, a: 1 } },
          fontSizes: { fontSize: 18 },
          styleBoxes: {
            test: {
              type: 'flat',
              backgroundColor: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
              borderColor: { r: 0.8, g: 0.7, b: 0.6, a: 1 },
              borderWidths: { left: 1, top: 2, right: 3, bottom: 4 },
              cornerRadii: { left: 9, top: 8, right: 7, bottom: 6 },
              contentMargins: { left: 5, top: 6, right: 7, bottom: 8 },
            },
          },
        },
        Button: {
          icons: { icon: texturePath },
          styleBoxes: {
            textured: {
              type: 'texture',
              texture: texturePath,
              sourceRect: { position: [2, 3], size: [4, 5] },
              patchMargins: { left: 1, top: 2, right: 3, bottom: 4 },
              contentMargins: { left: 5, top: 6, right: 7, bottom: 8 },
              horizontalAxisStretchMode: PatchStretchMode.Tile,
              verticalAxisStretchMode: PatchStretchMode.TileFit,
              drawCenter: false,
              tint: { r: 0.2, g: 0.3, b: 0.4, a: 0.5 },
            },
          },
        },
      },
    });
    const label = new Label(player.engine);

    label.theme = theme;
    label.fromData({
      themeTypeVariation: '',
      themeOverrides: {
        fontSizes: { fontSize: 20 },
        icons: { testIcon: texturePath },
        styleBoxes: { testTexture: { type: 'texture', texture: texturePath } },
      },
    });
    expect(label.getThemeFontSize('fontSize')).equals(20);
    expect(label.getThemeColor('fontColor').toArray()).deep.equals([0.3, 0.4, 0.5, 1]);
    expect(label.getThemeStyleBox('test').getMinimumSize().toArray()).deep.equals([12, 14]);
    expect(label.getThemeIcon('testIcon')).equals(player.engine.whiteTexture);
    expect((label.getThemeStyleBox('testTexture') as StyleBoxTexture).texture)
      .equals(player.engine.whiteTexture);
    expect(theme.getIcon('Button', 'icon')).equals(player.engine.whiteTexture);
    const dataTextureStyle = theme.getStyleBox('Button', 'textured') as StyleBoxTexture;

    expect(dataTextureStyle.texture).equals(player.engine.whiteTexture);
    expect(dataTextureStyle.getSourceRect()).deep.equals({ x: 2, y: 3, width: 4, height: 5 });
    expect(dataTextureStyle.getPatchMargins()).deep.equals({ left: 1, top: 2, right: 3, bottom: 4 });
    expect(dataTextureStyle.getMinimumSize().toArray()).deep.equals([12, 14]);
    expect(dataTextureStyle.horizontalAxisStretchMode).equals(PatchStretchMode.Tile);
    expect(dataTextureStyle.verticalAxisStretchMode).equals(PatchStretchMode.TileFit);
    expect(dataTextureStyle.drawCenter).equals(false);
    expect(dataTextureStyle.getTint().toArray()).deep.equals([0.2, 0.3, 0.4, 0.5]);

    const flat = label.getThemeStyleBox('test');

    expect((flat as StyleBoxFlat).getCornerRadii()).deep.equals({ left: 9, top: 8, right: 7, bottom: 6 });
    const fillCalls: unknown[][] = [];
    const triangleCalls: unknown[][] = [];
    const graphics = player.engine.graphics;
    const originalFill = graphics.fillRectangle;
    const originalTriangle = graphics.fillTriangle;

    graphics.fillRectangle = ((...args: unknown[]) => fillCalls.push(args)) as Graphics['fillRectangle'];
    graphics.fillTriangle = ((...args: unknown[]) => triangleCalls.push(args)) as Graphics['fillTriangle'];
    try {
      flat.draw(graphics, { x: 0, y: 0, width: 30, height: 20 });
    } finally {
      graphics.fillRectangle = originalFill;
      graphics.fillTriangle = originalTriangle;
    }
    expect(fillCalls).to.have.length(0);
    expect(triangleCalls.length).greaterThan(0);

    const texture = { width: 40, height: 20 } as never;
    const textureStyle = new StyleBoxTexture();
    const ninePatchCalls: unknown[][] = [];
    const originalNinePatch = graphics.drawNinePatch;

    textureStyle.texture = texture;
    textureStyle.setPatchMargins(1, 2, 3, 4);
    graphics.drawNinePatch = ((...args: unknown[]) => ninePatchCalls.push(args)) as Graphics['drawNinePatch'];
    try {
      textureStyle.draw(graphics, { x: 2, y: 3, width: 50, height: 25 });
    } finally {
      graphics.drawNinePatch = originalNinePatch;
    }
    expect(ninePatchCalls).to.have.length(1);
    expect((ninePatchCalls[0][5] as { marginLeft: number }).marginLeft).equals(1);
  });

  it('keeps native StyleBoxes read-only and remeasures containers after inherited constants change', () => {
    const button = new Button(player.engine);
    const root = new Control(player.engine);
    const box = new HBoxContainer(player.engine);
    const first = new Control(player.engine);
    const second = new Control(player.engine);
    const theme = new Theme();

    expect(button.getThemeStyleBox('normal').isReadOnly).equals(true);
    expect(() => button.getThemeStyleBox('normal').setContentMargins(1, 1, 1, 1)).throws();
    root.theme = theme;
    box.parent = root;
    first.setCustomMinimumSize(10, 8);
    second.setCustomMinimumSize(10, 8);
    box.addChild(first);
    box.addChild(second);
    root.parent = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    expect(box.getCombinedMinimumSize().x).equals(20);
    theme.setConstant('HBoxContainer', 'separation', 7);
    expect(box.getCombinedMinimumSize().x).equals(27);
  });

  it('selects Button state StyleBoxes and draws focus before content', () => {
    const button = new Button(player.engine, 'state');
    const theme = new Theme();
    const styles = new Map<string, StyleBox>();

    for (const name of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled', 'focus']) {
      const style = new StyleBoxEmpty();

      styles.set(name, style);
      theme.setStyleBox('Button', name, style);
    }
    button.theme = theme;
    button.parent = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    const draws: StyleBox[] = [];

    button.drawStyleBox = ((style: StyleBox) => draws.push(style)) as typeof button.drawStyleBox;
    button.draw();
    expect(draws[0]).equals(styles.get('normal'));
    button.onMouseEnter();
    draws.length = 0;
    button.draw();
    expect(draws[0]).equals(styles.get('hover'));
    button.setPressedNoSignal(true);
    draws.length = 0;
    button.draw();
    expect(draws[0]).equals(styles.get('hoverPressed'));
    button.onMouseLeave();
    draws.length = 0;
    button.draw();
    expect(draws[0]).equals(styles.get('pressed'));
    button.disabled = true;
    draws.length = 0;
    button.draw();
    expect(draws[0]).equals(styles.get('disabled'));
    button.disabled = false;
    button.setPressedNoSignal(false);
    button.focus();
    draws.length = 0;
    const order: Array<StyleBox | string> = [];

    button.drawStyleBox = ((style: StyleBox) => order.push(style)) as typeof button.drawStyleBox;
    button.drawText = (() => order.push('content')) as typeof button.drawText;
    button.draw();
    expect(order).deep.equals([styles.get('normal'), styles.get('focus'), 'content']);

    button.releaseFocus();
    button.flat = true;
    button.onMouseEnter();
    order.length = 0;
    button.draw();
    expect(order).deep.equals(['content']);
  });

  it('selects themed Checkbox, Slider, ProgressBar and ScrollBar items', () => {
    const theme = new Theme();
    const checkedIcon = { width: 12, height: 12 } as Texture;
    const check = new Checkbox(player.engine);
    const slider = new HSlider(player.engine);
    const progress = new ProgressBar(player.engine);
    const scroll = new HScrollBar(player.engine);
    const decrementIcon = { width: 10, height: 20 } as Texture;
    const decrementHighlightIcon = { width: 11, height: 20 } as Texture;
    const styles = new Map<string, StyleBox>();

    theme.setIcon('Checkbox', 'checked', checkedIcon);
    theme.setIcon('ScrollBar', 'decrement', decrementIcon);
    theme.setIcon('ScrollBar', 'decrementHighlight', decrementHighlightIcon);
    for (const [type, names] of [
      ['Slider', ['track', 'fill', 'fillHighlight', 'grabber', 'grabberHighlight']],
      ['ProgressBar', ['background', 'fill']],
      ['ScrollBar', ['scroll', 'grabber']],
    ] as const) {
      for (const name of names) {
        const style = new StyleBoxEmpty();

        styles.set(`${type}.${name}`, style);
        theme.setStyleBox(type, name, style);
      }
    }

    check.theme = theme;
    check.setPressedNoSignal(true);
    let drawnIcon: Texture | null = null;

    check.drawStyleBox = (() => undefined) as typeof check.drawStyleBox;
    check.drawTexture = ((_x, _y, _width, _height, icon) => {drawnIcon = icon;}) as typeof check.drawTexture;
    check.draw();
    expect(drawnIcon).equals(checkedIcon);

    slider.theme = theme;
    slider.parent = player.engine.root.getComponent(GUIWindowComponent).windowRoot;
    slider.setSize(100, 20);
    const sliderDraws: StyleBox[] = [];

    slider.drawStyleBox = ((style: StyleBox) => sliderDraws.push(style)) as typeof slider.drawStyleBox;
    slider.draw();
    expect(sliderDraws).contains(styles.get('Slider.grabber'));
    slider.onMouseEnter();
    sliderDraws.length = 0;
    slider.draw();
    expect(sliderDraws).contains(styles.get('Slider.fillHighlight'));
    expect(sliderDraws).contains(styles.get('Slider.grabberHighlight'));
    slider.onMouseLeave();
    slider.focus();
    sliderDraws.length = 0;
    slider.draw();
    expect(sliderDraws).contains(styles.get('Slider.fillHighlight'));
    expect(sliderDraws).contains(styles.get('Slider.grabberHighlight'));
    expect(sliderDraws).to.have.length(3);

    progress.theme = theme;
    progress.showPercentage = false;
    progress.value = 50;
    progress.setSize(100, 20);
    const progressDraws: StyleBox[] = [];

    progress.drawStyleBox = ((style: StyleBox) => progressDraws.push(style)) as typeof progress.drawStyleBox;
    progress.draw();
    expect(progressDraws).deep.equals([
      styles.get('ProgressBar.background'), styles.get('ProgressBar.fill'),
    ]);

    scroll.theme = theme;
    scroll.setSize(100, 20);
    const scrollDraws: StyleBox[] = [];
    let scrollIcon: Texture | null = null;

    scroll.drawStyleBox = ((style: StyleBox) => scrollDraws.push(style)) as typeof scroll.drawStyleBox;
    scroll.drawTexture = ((_x, _y, _width, _height, icon) => {scrollIcon = icon;}) as typeof scroll.drawTexture;
    scroll.draw();
    expect(scrollDraws).contains(styles.get('ScrollBar.scroll'));
    expect(scrollDraws).contains(styles.get('ScrollBar.grabber'));
    expect(scrollIcon).equals(decrementIcon);
    scroll.onMouseEnter(new math.Vector2(1, 10));
    scrollDraws.length = 0;
    scroll.draw();
    expect(scrollIcon).equals(decrementHighlightIcon);

    const radioIcon = { width: 16, height: 16 } as Texture;
    const group = new ButtonGroup();

    theme.setIcon('Checkbox', 'radioChecked', radioIcon);
    check.buttonGroup = group;
    check.setPressedNoSignal(true);
    check.draw();
    expect(drawnIcon).equals(radioIcon);
    expect(check.getThemeStyleBox('normal')).instanceOf(StyleBoxEmpty);
  });
});

function triangleContainsPoint (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  const first = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const second = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const third = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNegative = first < 0 || second < 0 || third < 0;
  const hasPositive = first > 0 || second > 0 || third > 0;

  return !hasNegative || !hasPositive;
}
