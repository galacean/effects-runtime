import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import { InputEventMouseButton, MouseButton, MouseButtonMask, type Engine } from '@galacean/effects';

import { Matrix4, Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { viewportNavigationConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import { ViewportNavigationController } from '../../../../../../plugin-packages/editor-gizmo/src/2d/viewport';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';

const { expect } = chai;

describe('plugin-editor-gizmo/viewport-navigation-controller', () => {
  afterEach(restoreTestState);

type EngineFixture = {
  engine: Engine,
  getMatrix: () => Matrix4,
  setViewportMatrix: TestSpy,
};

function createEngine (): EngineFixture {
  let matrix = new Matrix4();
  const setViewportMatrix = chai.spy((next: Matrix4) => {
    matrix = next;
  });
  const container = document.createElement('div');

  Object.defineProperties(container, {
    offsetWidth: { value: 200 },
    offsetHeight: { value: 100 },
  });
  const camera = {
    getViewportMatrix: () => matrix,
    setViewportMatrix,
  };
  const engine = {
    canvas: { parentElement: container },
    sceneServer: { compositions: [{ camera }] },
  } as unknown as Engine;

  return { engine, getMatrix: () => matrix, setViewportMatrix };
}

function createOwner (
  engine: Engine,
  configs = new ConfigManager(),
): GizmoOwner {
  return {
    getEngine: () => engine,
    getConfigManager: () => configs,
  } as GizmoOwner;
}

function wheel (overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.position.set(100, 50);
  event.globalPosition.copyFrom(event.position);
  event.pressed = true;
  Object.assign(event, overrides);

  return event;
}

describe('ViewportNavigationController', () => {
  it('把 Effects alpha.5 归一化后的 wheel factor 恢复为视图像素平移量', () => {
    const { engine, getMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));
    const input = new InputEventMouseButton();

    input.buttonIndex = MouseButton.WheelDown;
    input.factor = 1;
    input.position.set(100, 50);

    expect(controller.handleWheel(input, false)).to.equal(true);
    expect(getMatrix().elements[13]).to.be.closeTo(2, 0.5 * 10 ** -(2));
  });

  it('Hand 与 wheel pan 共用 change 快照，并仅在相机变化时发出', () => {
    const { engine } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));
    const listener = chai.spy();

    controller.on('change', listener);

    expect(controller.panByViewDelta(
      new Vector2(20, -10),
      new Vector2(100, 50),
      'hand-pan',
    )).to.equal(true);
    expect((args => args.length === 1 && args[0]?.['source'] === 'hand-pan' && args[0]?.['scale'] === 1 && args[0]?.['translation']?.['x'] === 20 && args[0]?.['translation']?.['y'] === -10)(getSpyCalls(listener).at(-1)!)).to.equal(true);

    // Runtime emits horizontal and vertical wheel directions as two Control events.
    expect(controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelLeft, factor: 0.04 }), false)).to.equal(true);
    expect(controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelUp, factor: 0.06 }), false)).to.equal(true);
    const lastChange = getSpyCalls(listener).at(-1)?.[0];

    expect(lastChange.source).to.equal('wheel-pan');
    expect(lastChange.translation.x).to.be.closeTo(24, 0.5 * 10 ** -(2));
    expect(lastChange.translation.y).to.be.closeTo(-4, 0.5 * 10 ** -(2));

    expect(controller.panByViewDelta(
      new Vector2(),
      new Vector2(),
      'hand-pan',
    )).to.equal(false);
    expect(listener).to.have.been.called.exactly(3);
  });

  it('普通 wheel 按当前 scale 的比例缩放，而不是累加固定值', () => {
    const { engine, getMatrix } = createEngine();
    const configs = new ConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    const controller = new ViewportNavigationController(createOwner(engine, configs));

    controller.setScaleRange(0.1, 1.5);
    controller.zoomByFactor(0.5, new Vector2(100, 50), 'wheel-zoom');

    const input = wheel({ buttonIndex: MouseButton.WheelDown, factor: 1 });

    controller.handleWheel(input, false);

    expect(input.isAccepted()).to.equal(true);
    expect(getMatrix().elements[0]).to.be.closeTo(0.45, 0.5 * 10 ** -(2));
  });

  it('config 变化后下一个 wheel 事件立即采用新模式', () => {
    const { engine, getMatrix } = createEngine();
    const configs = new ConfigManager();
    const controller = new ViewportNavigationController(createOwner(engine, configs));
    const input = { buttonIndex: MouseButton.WheelDown, factor: 1 };

    controller.handleWheel(wheel(input), false);
    expect(getMatrix().elements[0]).to.be.closeTo(1, 0.5 * 10 ** -(2));

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    controller.handleWheel(wheel(input), false);
    expect(getMatrix().elements[0]).to.be.closeTo(0.9, 0.5 * 10 ** -(2));
  });

  it('Ctrl trackpad 使用相对缩放并保持光标锚点', () => {
    const { engine, getMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));

    controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelUp, factor: 0.5, position: new Vector2(150, 50), ctrlPressed: true }), false);

    expect(getMatrix().elements[0]).to.be.closeTo(1.1, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[12]).to.be.closeTo(-0.05, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[13]).to.be.closeTo(0, 0.5 * 10 ** -(2));
  });

  it('wheel pan 恢复逐事件立即应用，不做 120 截断或 capture 20/40 门禁', () => {
    const { engine, getMatrix, setViewportMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));

    controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelLeft, factor: 3 }), false);
    expect(getMatrix().elements[12]).to.be.closeTo(3, 0.5 * 10 ** -(2));

    const writesBeforeCapture = getSpyCalls(setViewportMatrix).length;

    expect(controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelLeft, factor: 0.1 }), true)).to.equal(true);
    expect(getSpyCalls(setViewportMatrix).length).to.equal(writesBeforeCapture + 1);
  });

  it('按住鼠标键时保持旧实现：接受 wheel 但不写相机', () => {
    const { engine, setViewportMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));
    const input = wheel({ buttonIndex: MouseButton.WheelLeft, factor: 0.1, buttonMask: MouseButtonMask.Left });

    expect(controller.handleWheel(input, true)).to.equal(false);
    expect(input.isAccepted()).to.equal(true);
    expect(setViewportMatrix).not.to.have.been.called();
  });

  it('到达 viewportRange 边界时仍消费 wheel，避免触发浏览器页面缩放', () => {
    const { engine, setViewportMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));

    controller.setScaleRange(1, 1);
    const input = wheel({ buttonIndex: MouseButton.WheelDown, factor: 1, ctrlPressed: true });

    expect(controller.handleWheel(input, false)).to.equal(false);
    expect(input.isAccepted()).to.equal(true);
    expect(setViewportMatrix).not.to.have.been.called();
  });

  it('连续 wheel 事件保持百分比缩放，不会数次后直接触底', () => {
    const { engine, getMatrix } = createEngine();
    const configs = new ConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    const controller = new ViewportNavigationController(createOwner(engine, configs));

    controller.setScaleRange(0.1, 10);

    for (let index = 0; index < 5; index++) {
      controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelDown, factor: 1 }), false);
    }

    expect(getMatrix().elements[0]).to.be.closeTo(0.9 ** 5, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[0]).to.be.greaterThan(0.1);
  });

  it('低缩放值下保留精度，不会因两位小数取整停滞', () => {
    const { engine, getMatrix } = createEngine();
    const configs = new ConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    const controller = new ViewportNavigationController(createOwner(engine, configs));

    controller.setScaleRange(0.01, 10);
    controller.zoomByFactor(0.03, new Vector2(100, 50), 'wheel-zoom');

    controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelDown, factor: 0.01 }), false);

    expect(getMatrix().elements[0]).to.be.closeTo(0.03 * 0.99, 1e-8);
  });

  it('scrollWheelZoom 显式配置不依赖 wheel factor 猜测设备类型', () => {
    const { engine, getMatrix } = createEngine();
    const configs = new ConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: true });
    const controller = new ViewportNavigationController(createOwner(engine, configs));

    controller.handleWheel(wheel({ buttonIndex: MouseButton.WheelDown, factor: 0.53 }), false);

    expect(getMatrix().elements[0]).to.be.closeTo(0.9, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[13]).to.be.closeTo(0, 0.5 * 10 ** -(2));
  });

  it('zoomStep 偏好钳制单次 wheel 的最大相对缩放比例', () => {
    // 默认 zoomStep=0.1：deltaY=-100 → factor=0.9。
    const engineDefault = createEngine();
    const configsDefault = new ConfigManager();

    configsDefault.set(viewportNavigationConfig, { scrollWheelZoom: true });
    const controllerDefault = new ViewportNavigationController(createOwner(engineDefault.engine, configsDefault));

    controllerDefault.setScaleRange(0.1, 1.5);
    controllerDefault.zoomByFactor(0.5, new Vector2(100, 50), 'wheel-zoom');
    controllerDefault.handleWheel(wheel({ buttonIndex: MouseButton.WheelDown, factor: 1 }), false);
    expect(engineDefault.getMatrix().elements[0]).to.be.closeTo(0.45, 0.5 * 10 ** -(2));

    // 注入 zoomStep=0.2：同一 deltaY=-100 → factor=0.8。
    const engineStepped = createEngine();
    const configsStepped = new ConfigManager();

    configsStepped.set(viewportNavigationConfig, { scrollWheelZoom: true, zoomStep: 0.2 });
    const controllerStepped = new ViewportNavigationController(createOwner(engineStepped.engine, configsStepped));

    controllerStepped.setScaleRange(0.1, 1.5);
    controllerStepped.zoomByFactor(0.5, new Vector2(100, 50), 'wheel-zoom');
    controllerStepped.handleWheel(wheel({ buttonIndex: MouseButton.WheelDown, factor: 1 }), false);
    expect(engineStepped.getMatrix().elements[0]).to.be.closeTo(0.4, 0.5 * 10 ** -(2));
  });

  it('视口范围同时约束缩放和平移，并支持恢复默认范围', () => {
    const { engine, getMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));
    const listener = chai.spy();

    controller.setViewportRange({
      minScale: 0.5,
      maxScale: 2,
      minTranslation: new Vector2(-10, -5),
      maxTranslation: new Vector2(10, 5),
    });
    controller.on('change', listener);

    expect(controller.zoomByFactor(0.1, new Vector2(100, 50), 'wheel-zoom')).to.equal(true);
    expect(getMatrix().elements[0]).to.be.closeTo(0.5, 0.5 * 10 ** -(2));
    expect(controller.panByViewDelta(new Vector2(100, 100), new Vector2(), 'hand-pan')).to.equal(true);

    const change = getSpyCalls(listener).at(-1)?.[0];

    expect(change.translation.x).to.be.closeTo(10, 0.5 * 10 ** -(2));
    expect(change.translation.y).to.be.closeTo(5, 0.5 * 10 ** -(2));

    controller.resetViewportRange();
    expect(controller.viewportRange.minScale).to.equal(0.01);
    expect(controller.viewportRange.maxScale).to.equal(20);
  });

  it('缩放时同步约束相机位移，并按当前 scale 更新内容平移边界', () => {
    const { engine, getMatrix } = createEngine();
    const controller = new ViewportNavigationController(createOwner(engine));
    const listener = chai.spy();

    controller.on('change', listener);
    controller.setViewportRange({
      minScale: 0.05,
      maxScale: 2,
      translationBounds: new Box2(new Vector2(-150, -100), new Vector2(150, 100)),
    });
    controller.panByViewDelta(new Vector2(1000, 1000), new Vector2(), 'hand-pan');
    expect(getSpyCalls(listener).at(-1)?.[0].translation.toArray()).to.deep.equal([50, 50]);

    controller.zoomByFactor(0.5, new Vector2(200, 100), 'pinch-zoom');
    // 缩小后内容不足一屏，锚点产生的额外位移应收敛；快照和真实相机一致。
    const change = getSpyCalls(listener).at(-1)?.[0];

    expect(change.translation.x).to.be.closeTo(25, 0.5 * 10 ** -(2));
    expect(change.translation.y).to.be.closeTo(0, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[12] * 100).to.be.closeTo(25, 0.5 * 10 ** -(2));
    expect(getMatrix().elements[13] * -50).to.be.closeTo(0, 0.5 * 10 ** -(2));

    controller.zoomByFactor(4, new Vector2(100, 50), 'pinch-zoom');
    controller.panByViewDelta(new Vector2(-1000, -1000), new Vector2(), 'wheel-pan');
    expect(getSpyCalls(listener).at(-1)?.[0].translation.toArray()).to.deep.equal([-200, -150]);
  });
});
});
