import { InputEventKey, InputEventMouseButton, MouseButton, MouseButtonMask, type InputEventMouse } from '@galacean/effects';
import { restoreTestState, getSpyCalls, resetSpy } from '../helpers/spies';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

import { CompositionComponent, Downloader, FrameComponent, InputEventMouseMotion, spec, TextComponent, type Composition, type Engine, type VFXItem } from '@galacean/effects';
import { GestureHandler } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gesture-handler';
import { Control, MouseFilter } from '@galacean/effects-plugin-gui';

import { GestureCursorType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/cursor';
import type { Gizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo';
import { BoxSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/box-selection-gizmo';
import { ChangeSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/change-selection-gizmo';
import { MoveSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/move-selection-gizmo';
import { ClickDragMultiplexGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/click-drag-multiplex-gizmo';
import { selectionPreviewConfig } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/builtin-configs';
import { ResizeSelectionGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/resize-selection-gizmo';
import { Matrix4, Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { GizmoTool } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-tool';
import { HandGizmoTool, ImageCutGizmoTool, MoveGizmoTool } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-tools';
import type { EditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes';
import { DefaultSelectionMode, EffectsEditMode, TextEditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes';
import type { GizmoViewport } from '../../../../../../plugin-packages/editor-gizmo/src/2d/viewport/gizmo-viewport';

const { expect } = chai;

describe('plugin-editor-gizmo/gesture-handler', () => {
  afterEach(restoreTestState);

  beforeEach(() => {
    // 固定光标资源，避免单元测试发送网络请求。
    chai.spy.on(Downloader.prototype, 'downloadText', (_url, onSuccess) => onSuccess(''));
  });

  class TestGizmoTool extends GizmoTool {
    create: () => Gizmo[] = () => [];

    override createGizmos (): Gizmo[] {
      return this.create();
    }
  }

  function createTestGizmoTool (
    owner: GestureHandler,
    createGizmos: () => Gizmo[],
  ): TestGizmoTool {
    const gizmoTool = new TestGizmoTool(owner);

    gizmoTool.create = createGizmos;

    return gizmoTool;
  }

  function inputViewport (handler: GestureHandler): GizmoViewport {
    return (handler as unknown as { gizmoViewport: GizmoViewport }).gizmoViewport;
  }

  function createHandler (): GestureHandler {
    const container = document.createElement('div');

    document.body.appendChild(container);
    const canvas = document.createElement('canvas');

    container.appendChild(canvas);
    // 复刻 Effects 单 Engine 结构：engine.canvas 为真 canvas（挂进 container），其 parentElement === container，
    // 即 GestureHandler.buildInteractionLayer 与 getContainerSize 所读的交互容器。本套用例不断言布局尺寸。
    const engine = {
      canvas,
      sceneServer: { compositions: [] },
    } as unknown as Engine;
    const handler = new GestureHandler(engine);

    // 生产路径由宿主 projection 在派发前交付完整图；测试夹具也遵守同一生命周期。
    activateMode(handler, []);
    // 当前是普通 Tool；工具链 / 选区 / cursor 用例在非 Hand 态下验证，
    // pan 用例按需切 HandGizmoTool 或 setPanKeyPressed。
    // 模拟指针已进入 Control（真实由 runtime EventSystem 触发 onMouseEnter）。
    // 单元测试绕过 DOM 直接调 onMouseMove/onMouseDown，需补此初始态以走通 hover hitTest。
    inputViewport(handler).onMouseEnter(new Vector2());

    return handler;
  }

  function createPreviewMedia (handler: GestureHandler, id: string, kind: 'video' | 'effects' = 'video', order?: string[]) {
    const play = chai.spy(() => { order?.push(`${id}:play`); });
    const pause = chai.spy(() => { order?.push(`${id}:pause`); });
    const videoComponent = { playVideo: play, pauseVideo: pause };
    const effectsComponent = { play, pause };
    const item = {
      type: kind === 'video' ? spec.ItemType.video : spec.ItemType.null,
      name: kind === 'video' ? id : '特效',
      getInstanceId: () => id,
      children: kind === 'effects' ? [{
        type: spec.ItemType.composition,
        getInstanceId: () => `${id}:composition`,
        children: [],
        getComponent: (component: unknown) => component === CompositionComponent ? effectsComponent : undefined,
      }] : [],
      getComponent: (component: unknown) => kind === 'video'
        ? component === VideoComponent ? videoComponent : undefined
        : component === FrameComponent ? {} : undefined,
    } as unknown as VFXItem;
    const compositions = handler.getEngine().sceneServer.compositions;

    if (compositions.length === 0) {
      compositions.push({ items: [] } as unknown as Composition);
    }
    compositions[0].items.push(item);

    return { play, pause };
  }

  function createMouseEvent (type: 'mousedown' | 'mousemove' | 'mouseup', buttons: number): MouseEvent {
    return new MouseEvent(type, {
      button: 0,
      buttons,
      clientX: 10,
      clientY: 20,
    });
  }

  function mouseButton (pressed: boolean, native = createMouseEvent(pressed ? 'mousedown' : 'mouseup', pressed ? 1 : 0)): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(native.offsetX, native.offsetY);
    event.globalPosition.set(native.clientX, native.clientY);
    event.buttonMask = native.buttons as MouseButtonMask;
    event.buttonIndex = native.button === 2 ? MouseButton.Right : native.button === 1 ? MouseButton.Middle : MouseButton.Left;
    event.pressed = pressed;
    event.doubleClick = native.detail > 1;
    event.ctrlPressed = native.ctrlKey;
    event.metaPressed = native.metaKey;
    event.shiftPressed = native.shiftKey;
    event.altPressed = native.altKey;

    return event;
  }

  function mouseMotion (native = createMouseEvent('mousemove', 0)): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(native.offsetX, native.offsetY);
    event.globalPosition.set(native.clientX, native.clientY);
    event.buttonMask = native.buttons as MouseButtonMask;
    event.pressed = native.buttons !== 0;
    event.ctrlPressed = native.ctrlKey;
    event.metaPressed = native.metaKey;
    event.shiftPressed = native.shiftKey;
    event.altPressed = native.altKey;

    return event;
  }

  function createKeyboardInput (code: string, pressed = true): InputEventKey {
    const event = new InputEventKey();

    event.keycode = code;
    event.physicalKeycode = code;
    event.pressed = pressed;

    return event;
  }

  function sendMouseDown (handler: GestureHandler, event: MouseEvent): void {
    inputViewport(handler).onMouseDown(mouseButton(true, event));
  }

  function sendMouseMove (handler: GestureHandler, event: MouseEvent): void {
    inputViewport(handler).onMouseMove(mouseMotion(event));
  }

  function sendMouseUp (handler: GestureHandler, event: MouseEvent): void {
    inputViewport(handler).onMouseUp(mouseButton(false, event));
  }

  function sendMouseLeave (handler: GestureHandler): void {
    inputViewport(handler).onMouseLeave();
  }

  function sendWheel (handler: GestureHandler, native: WheelEvent): void {
    const event = new InputEventMouseButton();

    event.position.set(native.offsetX, native.offsetY);
    event.globalPosition.set(native.clientX, native.clientY);
    event.ctrlPressed = native.ctrlKey;
    event.metaPressed = native.metaKey;
    event.shiftPressed = native.shiftKey;
    event.altPressed = native.altKey;
    event.buttonMask = native.buttons as MouseButtonMask;
    event.pressed = true;
    if (native.deltaX !== 0) {
      event.buttonIndex = native.deltaX < 0 ? MouseButton.WheelLeft : MouseButton.WheelRight;
      event.factor = Math.abs(native.deltaX) / 100;
    } else {
      event.buttonIndex = native.deltaY < 0 ? MouseButton.WheelUp : MouseButton.WheelDown;
      event.factor = Math.abs(native.deltaY) / 100;
    }
    inputViewport(handler).onMouseWheel(event);
  }

  function sendMouseDrag (handler: GestureHandler, event: MouseEvent): void {
    inputViewport(handler).onMouseMove(mouseMotion(event));
  }

  function controlCursor (handler: GestureHandler): string | undefined {
    return (handler as unknown as {
      gizmoViewport?: { defaultCursorShape: string },
    }).gizmoViewport?.defaultCursorShape;
  }

  describe('GestureHandler - Control tree ownership', () => {
    it('根控件持有 viewport，更新和绘制只派发一次，销毁交互树', () => {
      const handler = createHandler();
      const viewport = inputViewport(handler);

      expect(handler).to.be.instanceOf(Control);
      expect(viewport.parent).to.equal(handler);
      expect(handler.children).to.deep.equal([viewport]);
      expect(handler.mouseFilter).to.equal(MouseFilter.Pass);
      const update = chai.spy.on(handler.getGizmoManager(), 'onUpdate');

      chai.spy.on(handler.getFrameManager(), 'onUpdate', () => {});
      const draw = chai.spy.on(handler as any, 'drawGizmos', () => {});

      handler.update(0);
      handler.draw();
      viewport.draw();
      expect(update).to.have.been.called.once;
      expect(draw).to.have.been.called.once;
      expect(draw).to.have.been.called.with.exactly(viewport);
      const cleanup = chai.spy.on(handler.getGizmoManager(), 'dispose');

      handler.dispose();
      handler.dispose();
      expect(viewport.isDisposed).to.equal(true);
      expect(viewport.parent).to.equal(null);
      expect(cleanup).to.have.been.called.once;
    });

    it('原生控件与业务事件共用父类存储，支持显式解绑', () => {
      const handler = createHandler();
      const native = chai.spy();
      const business = chai.spy();

      handler.on('locationChanged', native);
      handler.on('keyDown', business);
      handler.setPosition(10, 20);
      const event = createKeyboardInput('KeyA');

      handler.emit('keyDown', event);
      expect(native).to.have.been.called.once;
      expect(business).to.have.been.called.once;
      expect(business).to.have.been.called.with.exactly(event);
      handler.off('locationChanged', native);
      handler.off('keyDown', business);
      handler.dispose();
      handler.emit('keyDown', event);
      expect(business).to.have.been.called.once;
    });
  });

  describe('GestureHandler - input routing', () => {
    it('键盘按 active Gizmo 顺序派发，并在首个 accept 后停止后续键盘候选', () => {
      const handler = createHandler();
      const first = chai.spy((event: InputEventKey) => event.accept());
      const second = chai.spy();
      const mouseMove = chai.spy();

      activateMode(handler, [
        makeStubGizmo('first', { onKeyDown: first, onMouseMove: mouseMove }),
        makeStubGizmo('second', { onKeyDown: second }),
      ]);

      inputViewport(handler).onKeyDown(createKeyboardInput('KeyA'));

      expect(first).to.have.been.called.once;
      expect(second).not.to.have.been.called();
      expect(mouseMove).to.have.been.called.once;
      handler.dispose();
    });

    it('未 accepted 的 KeyUp 结束后也统一执行当前位置鼠标轮次', () => {
      const handler = createHandler();
      const keyUp = chai.spy();
      const mouseMove = chai.spy();

      activateMode(handler, [
        makeStubGizmo('candidate', { onKeyUp: keyUp, onMouseMove: mouseMove }),
      ]);

      inputViewport(handler).onKeyUp(createKeyboardInput('KeyA', false));

      expect(keyUp).to.have.been.called.once;
      expect(mouseMove).to.have.been.called.once;
      handler.dispose();
    });

    it('Space 状态变化在外层触发当前位置轮次并更新 cursor', () => {
      const handler = createHandler();
      const downstream = chai.spy();

      activateMode(handler, [
        makeStubGizmo('downstream', { onKeyDown: downstream }),
      ]);

      const event = createKeyboardInput('Space');

      inputViewport(handler).onKeyDown(event);

      expect(event.isAccepted()).to.equal(true);
      expect(downstream).not.to.have.been.called();
      expect(controlCursor(handler)).to.equal('grab');
      inputViewport(handler).onKeyUp(createKeyboardInput('Space', false));
      expect(controlCursor(handler)).to.equal('default');
      handler.dispose();
    });

    it('selectionchange 本身不重派发鼠标事件，也不改写 Control cursor', () => {
      const handler = createHandler();
      const move = chai.spy(() => true);

      activateMode(handler, [
        makeStubGizmo('candidate', { onMouseMove: move }),
      ]);
      const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget');

      handler.setCursor({ type: GestureCursorType.POINTER, angle: 0 });

      handler.getSelection().setSelectedItems(['item-1']);

      expect(move).not.to.have.been.called();
      expect(resolveHover).not.to.have.been.called();
      expect(controlCursor(handler)).to.equal('pointer');
      handler.dispose();
    });

  });

  describe('GestureHandler - FrameManager ownership', () => {
    it('creates a fresh FrameManager and restores data through a snapshot', () => {
      const oldHandler = createHandler();

      oldHandler.getFrameManager().upsertFrame({ id: 'runtime:frame-1', children: ['runtime:child-1'] });
      const oldFrameManager = oldHandler.getFrameManager();
      const snapshot = oldHandler.getFrameManager().snapshot();

      oldHandler.dispose();

      const newHandler = createHandler();

      expect(newHandler.getFrameManager()).not.to.equal(oldFrameManager);
      expect(newHandler.getFrameManager().getFrames()).to.deep.equal([]);
      newHandler.getFrameManager().hydrate(snapshot);

      expect(newHandler.getFrameManager().getViewInfo('runtime:frame-1')).to.deep.include({
        id: 'runtime:frame-1',
        children: ['runtime:child-1'],
      });

      newHandler.dispose();
    });
  });

type StubGizmoOverrides = {
  dispose?: Gizmo['dispose'],
  onMouseDown?: (event: InputEventMouse) => unknown,
  onMouseMove?: (event: InputEventMouse) => unknown,
  onMouseUp?: (event: InputEventMouse) => unknown,
  onMouseLeave?: Gizmo['onMouseLeave'],
  onKeyDown?: Gizmo['onKeyDown'],
  onKeyUp?: Gizmo['onKeyUp'],
  onUpdate?: Gizmo['onUpdate'],
};

function makeStubGizmo (type: string, overrides: StubGizmoOverrides = {}): Gizmo {
  const adapt = (name: 'onMouseDown' | 'onMouseMove' | 'onMouseUp') => {
    const original = overrides[name];

    return (event: InputEventMouse) => {
      if (original?.(event) === true) {
        event.accept();
      }
    };
  };

  return {
    type,
    dispose () {},
    requiresDragThreshold: () => true,
    onMouseLeave () {},
    onKeyDown () {},
    onKeyUp () {},
    onUpdate () {},
    ...overrides,
    onMouseDown: adapt('onMouseDown'),
    onMouseMove: adapt('onMouseMove'),
    onMouseUp: adapt('onMouseUp'),
  } as unknown as Gizmo;
}

function activateMoveTool (handler: GestureHandler): void {
  activateMode(handler, [new ResizeSelectionGizmo(handler)]);
}

function activateMode (handler: GestureHandler, modeGizmos: Gizmo[]): void {
  const changeSelection = new ChangeSelectionGizmo(handler);
  const boxSelection = new BoxSelectionGizmo(handler);
  const moveSelection = new MoveSelectionGizmo(handler);
  const clickDragMultiplex = new ClickDragMultiplexGizmo(handler, {
    clickCandidates: [changeSelection],
    dragCandidates: [
      moveSelection,
      boxSelection,
    ],
  });

  // 生产契约：所有选择 gizmo（change/move/box）只由 multiplex 托管，不回传顶层；
  // multiplex 是唯一顶层选择外层（见 createSelectionInteractionGizmo）。
  const graph = [...modeGizmos, clickDragMultiplex];

  handler.setActiveTool(createTestGizmoTool(handler, () => graph));
}

function getMoveSelectionGizmo (handler: GestureHandler): MoveSelectionGizmo {
  const innerMultiplex = handler.getGizmoManager().get('click-drag-multiplex');
  const move = innerMultiplex?.dragCandidates()
    .find(gizmo => gizmo.type === 'move-selection') as MoveSelectionGizmo | undefined;

  if (!move) {
    throw new Error('[test] No MoveSelectionGizmo installed.');
  }

  return move;
}

function getBoxSelectionGizmo (handler: GestureHandler): BoxSelectionGizmo {
  const innerMultiplex = handler.getGizmoManager().get('click-drag-multiplex');

  if (!innerMultiplex) {
    throw new Error('[test] No ClickDragMultiplexGizmo installed.');
  }
  const box = innerMultiplex.dragCandidates().find(gizmo => gizmo.type === 'box-selection') as BoxSelectionGizmo | undefined;

  if (!box) {
    throw new Error('[test] No BoxSelectionGizmo installed.');
  }

  return box;
}

function registerStub (handler: GestureHandler, gizmo: Gizmo): void {
  activateMode(handler, [gizmo]);
}

describe('GestureHandler - GizmoTool runtime', () => {
  it('按宿主声明顺序提交完整图', () => {
    const handler = createHandler();
    const first = makeStubGizmo('first');
    const second = makeStubGizmo('second');

    handler.setActiveTool(createTestGizmoTool(handler, () => [first, second]));

    const activeGizmos = handler.getGizmoManager().activeGizmos;

    expect(activeGizmos.slice(0, 3).map(gizmo => gizmo.type)).to.deep.equal(['hand', 'icon', 'loading']);
    expect(activeGizmos.slice(3)).to.deep.equal([first, second]);
    expect(handler.isHandToolMode()).to.equal(false);
    handler.dispose();
  });

  it('setActiveTool 先更新工具，构图失败时保留旧图', () => {
    const handler = createHandler();
    const stable = makeStubGizmo('stable');

    handler.setActiveTool(createTestGizmoTool(handler, () => [stable]));

    expect(() => handler.setActiveTool(createTestGizmoTool(
      handler,
      () => {
        throw new Error('factory failed');
      },
    ))).to.throw('factory failed');

    expect(handler.getGizmoManager().activeGizmos.at(-1)).to.equal(stable);
    expect(handler.isHandToolMode()).to.equal(false);
    handler.dispose();
  });

  it('rebuildGizmos 替换图并由后续安全出口释放旧图', () => {
    const handler = createHandler();
    let current = makeStubGizmo('state-tool');
    const first = current;
    const dispose = chai.spy.on(first, 'dispose');

    handler.setActiveTool(createTestGizmoTool(handler, () => [current]));
    current = makeStubGizmo('state-tool');

    handler.rebuildGizmos();

    expect(dispose).not.to.have.been.called();
    expect(handler.getGizmoManager().activeGizmos.at(-1)).to.equal(current);
    handler.dispose();
    expect(dispose).to.have.been.called.once;
  });

});

describe('GestureHandler - GizmoTool EditMode runtime', () => {
  function createTextTarget (): VFXItem {
    return {
      type: spec.ItemType.text,
      isVisible: true,
      children: [],
      getInstanceId: () => 'text',
      getComponent: (component: unknown) => component === TextComponent ? {} : undefined,
    } as unknown as VFXItem;
  }

  function activateTool (
    handler: GestureHandler,
    createTool: () => GizmoTool,
    baseGizmos?: Gizmo[],
  ): void {
    const tool = createTool();

    if (baseGizmos) {
      tool.createGizmos = () => baseGizmos;
    }
    handler.setActiveTool(tool);
  }

  it('Move GizmoTool 通过 GizmoOwner 装配 EditMode graph', () => {
    const handler = createHandler();
    const mode = makeStubGizmo('mode');
    const editMode: EditMode = {
      id: 'custom-mode',
      canRemainActiveForTool: () => true,
      createGizmos: () => [mode],
    };

    handler.setActiveEditMode(editMode);
    activateTool(handler, () => new MoveGizmoTool(handler));

    expect(handler.getGizmoManager().activeGizmos.slice(3)).to.deep.equal([mode]);
    handler.dispose();
  });

  it('TextEditMode 在 Hand 工具下保留会话并在返回 Move 后重新投影', () => {
    const handler = createHandler();

    activateTool(handler, () => new MoveGizmoTool(handler));
    const target = createTextTarget();
    const mode = new TextEditMode(handler, target);

    handler.setActiveEditMode(mode);
    const firstText = handler.getGizmoManager().get('text');
    const textarea = firstText!.textAreaElement;

    expect(mode.editingItem).to.equal(target);
    const firstDispose = chai.spy.on(firstText!, 'dispose');

    activateTool(handler, () => new HandGizmoTool(handler), [makeStubGizmo('hand-base')]);

    expect(handler.isHandToolMode()).to.equal(true);
    expect(handler.getActiveEditMode()).to.equal(mode);
    expect(handler.getGizmoManager().get('text')).to.equal(undefined);
    expect(mode.editingItem).to.equal(target);
    expect(textarea.isConnected).to.equal(true);
    expect(firstDispose).to.have.been.called.once;

    activateTool(handler, () => new MoveGizmoTool(handler));

    expect(handler.isHandToolMode()).to.equal(false);
    expect(handler.getActiveEditMode()).to.equal(mode);
    expect(handler.getGizmoManager().get('text')).not.to.equal(undefined);
    expect(handler.getGizmoManager().get('text')).not.to.equal(firstText);
    expect(handler.getGizmoManager().get('text')!.textAreaElement).to.equal(textarea);
    handler.dispose();
    expect(textarea.isConnected).to.equal(false);
  });

  it('EffectsEditMode 放开当前特效子树并在退出后恢复容器选区', () => {
    const handler = createHandler();
    const effectsItem = {
      name: '特效',
      type: spec.ItemType.null,
      children: [],
      parent: undefined,
      parentId: '',
      getInstanceId: () => 'effects',
      getComponent: (component: unknown) => component === FrameComponent ? {} : undefined,
    } as unknown as VFXItem;

    handler.getEngine().sceneServer.compositions.push({
      items: [effectsItem],
    } as unknown as Composition);
    activateTool(handler, () => new MoveGizmoTool(handler));
    handler.getSelection().commitSelectedItems(['effects']);

    handler.setActiveEditMode(new EffectsEditMode(handler, 'effects', { allowTransform: false }));
    expect(handler.getActiveEditMode()).to.be.instanceOf(EffectsEditMode);
    expect(handler.getSelection().getEffectsEditItemId()).to.equal('effects');
    expect(handler.getGizmoManager().get('leave-effects-edit')).not.to.equal(undefined);
    expect(handler.getGizmoManager().get('corner-rotation')).to.equal(undefined);
    const resizeSelection = handler.getGizmoManager().get('resize-selection')!;

    resizeSelection.onUpdate();
    expect(resizeSelection.wireframe.interactive).to.equal(false);
    expect(resizeSelection.wireframe.cornerEnable).to.equal(false);
    const selectionInteraction = handler.getGizmoManager().get('click-drag-multiplex')!;

    expect(selectionInteraction.dragCandidates().map(gizmo => gizmo.type)).to.deep.equal(['box-selection']);

    handler.getSelection().commitSelectedItems(['effect-child']);
    handler.resetEditMode();

    expect(handler.getActiveEditMode()).to.be.instanceOf(DefaultSelectionMode);
    expect(handler.getSelection().getEffectsEditItemId()).to.equal(undefined);
    expect(handler.getSelection().getSelectedIds()).to.deep.equal(['effects']);
    handler.dispose();
  });

  it('不兼容 GizmoTool 退出 TextEditMode 并恢复默认 mode', () => {
    const handler = createHandler();

    activateTool(handler, () => new MoveGizmoTool(handler));
    handler.setActiveEditMode(new TextEditMode(handler, createTextTarget()));
    const textMode = handler.getActiveEditMode() as TextEditMode;
    const exit = chai.spy.on(textMode, 'onExit');

    activateTool(handler, () => new ImageCutGizmoTool(handler), [makeStubGizmo('cut')]);

    expect(exit).to.have.been.called.once;
    expect(handler.getActiveEditMode()).to.be.instanceOf(DefaultSelectionMode);
    expect(handler.getGizmoManager().get('cut')).not.to.equal(undefined);
    handler.dispose();
  });

  it('EditMode 生命周期顺序为 old exit -> graph rebuild -> new enter', () => {
    const handler = createHandler();
    const order: string[] = [];
    const first: EditMode = {
      id: 'first',
      canRemainActiveForTool: () => true,
      createGizmos: () => [],
      onExit: () => order.push('exit'),
    };
    const second: EditMode = {
      id: 'second',
      canRemainActiveForTool: () => true,
      createGizmos: () => {
        order.push('rebuild');

        return [];
      },
      onEnter: () => order.push('enter'),
    };

    activateTool(handler, () => new MoveGizmoTool(handler));
    handler.setActiveEditMode(first);
    order.length = 0;
    handler.setActiveEditMode(second);

    expect(order).to.deep.equal(['exit', 'rebuild', 'enter']);
    handler.dispose();
  });

  it('候选切换 EditMode 后仍以 captured owner 身份存活到 MouseUp', () => {
    const handler = createHandler();
    const replacement = makeStubGizmo('replacement');
    const switchingDispose = chai.spy();
    const switchingUp = chai.spy(() => true);
    const nextMode: EditMode = {
      id: 'next',
      canRemainActiveForTool: () => true,
      createGizmos: () => [replacement],
    };
    const switching = makeStubGizmo('switching', {
      dispose: switchingDispose,
      onMouseDown: () => {
        handler.setActiveEditMode(nextMode);

        return true;
      },
      onMouseUp: switchingUp,
    });

    activateTool(handler, () => new MoveGizmoTool(handler));
    handler.setActiveEditMode({
      id: 'initial',
      canRemainActiveForTool: () => true,
      createGizmos: () => [switching],
    });
    sendMouseDown(handler, createMouseEvent('mousedown', 1));

    expect(handler.getGizmoManager().get('replacement')).to.equal(replacement);
    expect(switchingDispose).not.to.have.been.called();

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    expect(switchingUp).to.have.been.called.once;
    expect(switchingDispose).to.have.been.called.once;
    handler.dispose();
  });
});

describe('GestureHandler - Gizmo handled gates viewport selection', () => {
  it('Gizmo 先处理按下，handled 时不再解析选择', () => {
    const handler = createHandler();

    // stub gizmo 在 Down handled → round 命中后不应进入尾置 selection multiplex。
    registerStub(handler, makeStubGizmo('grab', { onMouseDown: () => true, onMouseUp: () => true }));
    const hitSnapshot = chai.spy.on(handler.getSelection(), 'createHitSnapshot');
    const selectionDown = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseDown');
    const multiplex = handler.getGizmoManager().get('click-drag-multiplex')!;
    const multiplexUp = chai.spy.on(multiplex, 'onMouseUp');

    sendMouseDown(handler, createMouseEvent('mousedown', 1));

    expect(hitSnapshot).not.to.have.been.called();
    expect(selectionDown).not.to.have.been.called();
    // Records rejection diagnostics only — no canceled Up or other semantic delivery.
    expect(multiplexUp).not.to.have.been.called();

    sendMouseUp(handler, createMouseEvent('mouseup', 0));
    handler.dispose();
  });

  it('Gizmo 未处理时，Down 由 multiplex 接管；Drag(≥5px) 经 Phase B 补发建 move 会话', () => {
    const handler = createHandler();
    // mode gizmo Down 返 false → 尾置 multiplex 的 ChangeSelection 成 clickWinner（capture multiplex）。
    const pass = makeStubGizmo('pass', { onMouseDown: () => false });
    const resizeSelection = makeStubGizmo('resize-selection', {
      onMouseDown: () => false,
      onMouseMove: () => true,
      onMouseUp: () => true,
    });

    activateMode(handler, [pass, resizeSelection]);
    const moveSelection = getMoveSelectionGizmo(handler);
    const moveDown = chai.spy.on(moveSelection, 'onMouseDown', event => event.accept());
    const moveUp = chai.spy.on(moveSelection, 'onMouseUp', event => event.accept());
    const hitSnapshot = chai.spy.on(handler.getSelection(), 'createHitSnapshot');
    const selectionDown = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseDown');

    // Down：multiplex 只选 clickWinner（ChangeSelection），不 eager 上膛 drag 候选（move/box）。
    sendMouseDown(handler, createMouseEvent('mousedown', 1));
    expect(hitSnapshot).to.have.been.called.once;
    expect(moveDown).not.to.have.been.called();
    expect(selectionDown).not.to.have.been.called();
    expect((handler as unknown as { capturedGizmo?: Gizmo }).capturedGizmo?.type).to.equal('click-drag-multiplex');

    // Drag(≥5px)：multiplex.onMouseDrag Phase B 补发 mouseDown(downSnapshot) 给 move。
    sendMouseDrag(handler, new MouseEvent('mousemove', { button: 0, buttons: 1, clientX: 15, clientY: 20 }));
    expect(moveDown).to.have.been.called.once;

    sendMouseUp(handler, createMouseEvent('mouseup', 0));
    expect(moveUp).to.have.been.called.once;
    handler.dispose();
  });

  it('Gizmo handled 时阻断下游，terminal cached Move 仍遵守相同优先级', () => {
    const handler = createHandler();

    // Move 返 true → 不进 BoxSelectionGizmo.onMouseMove。
    registerStub(handler, makeStubGizmo('grab', { onMouseMove: () => true, onMouseUp: () => true }));
    const selectionMove = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseMove', () => {});
    const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));
    const selectionUp = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseUp');

    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(selectionMove).not.to.have.been.called();
    // Move handled：下游不解析 hover，dispatcher 本身也不补偿。
    expect(resolveHover).not.to.have.been.called();
    expect(handler.getSelection().preSelectedId).to.equal(undefined);

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    // orphan Up 不广播 onMouseUp；cached Move 仍被同一前置 Gizmo 阻断。
    expect(resolveHover).not.to.have.been.called();
    expect(handler.getSelection().preSelectedId).to.equal(undefined);
    expect(selectionUp).not.to.have.been.called();

    handler.dispose();
  });

  it('Drag 相位 Selector 成 dragWinner 接管 marquee；后续 Drag 仍先派发 click vector', () => {
    const handler = createHandler();

    registerStub(handler, makeStubGizmo('pass', {
      onMouseDown: () => false,
      onMouseMove: () => false,
      onMouseUp: () => false,
    }));
    chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseDown', event => event.accept());
    const selectionDrag = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseDrag', event => event.accept());
    const selectionUp = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseUp');
    const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));

    // Down：multiplex 选 ChangeSelection 为 clickWinner（capture）。
    sendMouseDown(handler, createMouseEvent('mousedown', 1));
    // 首个 Drag(≥5px)：Phase A(ChangeSelection.onMouseDrag 冻结 hover、不 accept) → Phase B(box 成 dragWinner)。
    sendMouseDrag(handler, new MouseEvent('mousemove', { button: 0, buttons: 1, clientX: 15, clientY: 20 }));
    expect(selectionDrag).to.have.been.called.once;

    // dragWinner 已定：后续 Drag 仍先派发 click vector（ChangeSelection.onMouseDrag 现为 no-op），
    // 不 accept 后再转 box.onMouseDrag。
    sendMouseDrag(handler, new MouseEvent('mousemove', { button: 0, buttons: 1, clientX: 16, clientY: 20 }));
    expect(selectionDrag).to.have.been.called.exactly(2);
    // Stage 3：拖拽期间 hover 冻结——ChangeSelection.onMouseDrag 不刷，resolveHover 不被调。
    sendMouseDrag(handler, new MouseEvent('mousemove', { button: 0, buttons: 1, clientX: 17, clientY: 20 }));
    expect(resolveHover).not.to.have.been.called();

    sendMouseUp(handler, createMouseEvent('mouseup', 0));
    expect(selectionUp).to.have.been.called.once;
    expect(getSpyCalls(selectionUp).some(args => args.length === 1 && args[0] instanceof InputEventMouseButton && !args[0].pressed)).to.equal(true);
    handler.dispose();
  });

  it('Gizmo 在 mousemove 内经 owner 提交 cursor，不 discard Selection 手势', () => {
    const handler = createHandler();

    // stub gizmo move 返 false但设置事件 cursor → 未 handled。
    // 注：box 现为 multiplex 内层，只在 multiplex 按下会话内收到 mousemove（非抓取态恒返 false），
    // 故空闲 mousemove 不会经 multiplex 转发到 box；此处仅断言未 handled 时 cursor override 仍生效。
    registerStub(handler, makeStubGizmo('cursor', {
      onMouseMove () {
        handler.setCursor({ type: GestureCursorType.POINTER, angle: 0 });

        return false;
      },
    }));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(controlCursor(handler)).to.equal('pointer');

    handler.dispose();
  });

  it('每轮先清元素预选，前置 Gizmo accept 后保持为空', () => {
    const handler = createHandler();
    let handleHovered = false;

    registerStub(handler, makeStubGizmo('ctrl', {
      onMouseMove () {
        handler.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });

        return handleHovered;
      },
    }));
    const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));
    const changes: (string | undefined)[] = [];

    handler.getSelection().on('preselectchange', event => changes.push(event.preSelectedId));

    // 未 handled（handleHovered=false）→ BoxSelectionGizmo.onMouseMove 返 false → hover 正常解析。
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('upper');

    resetSpy(resolveHover);
    handleHovered = true;
    // handled（handleHovered=true）阻断 ChangeSelection，本轮入口清空的 hover 不再被写回。
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(resolveHover).not.to.have.been.called();
    expect(handler.getSelection().preSelectedId).to.equal(undefined);
    expect(changes).to.deep.equal(['upper', undefined]);

    handler.dispose();
  });

  it('Down 清 observed hover 但保留行为绘制目标，Up 后缓存 Move 再写回', () => {
    const handler = createHandler();

    handler.getSelection().setSelectedIds(['upper']);
    chai.spy.on(handler.getSelection(), 'createHitSnapshot', () => ({
      point: new Vector2(10, 20),
      selectableIds: ['upper'],
      topmostId: 'upper',
      selectedScopeHitIds: ['upper'],
    }));
    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));
    const changes: (string | undefined)[] = [];

    handler.getSelection().on('preselectchange', event => changes.push(event.preSelectedId));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    sendMouseDown(handler, createMouseEvent('mousedown', 1));

    expect(handler.getSelection().preSelectedId).to.equal(undefined);
    expect(changes).to.deep.equal(['upper', undefined]);
    expect(handler.getSelection().hoverOverlayItemId).to.equal('upper');

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    expect(handler.getSelection().preSelectedId).to.equal('upper');
    expect(changes).to.deep.equal(['upper', undefined, 'upper']);

    handler.dispose();
  });

  it('连续 Move 会先提交空目标，再重新提交相同命中', () => {
    const handler = createHandler();

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));
    const changes: (string | undefined)[] = [];

    handler.getSelection().on('preselectchange', event => changes.push(event.preSelectedId));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(handler.getSelection().preSelectedId).to.equal('upper');
    expect(changes).to.deep.equal(['upper', undefined, 'upper']);
    handler.dispose();
  });

  it('group 双击下钻时第二次 Down 保留 group 绘制目标，Up 后切换为子元素', () => {
    const handler = createHandler();
    const selection = handler.getSelection();

    selection.setSelectedIds(['group']);
    chai.spy.on(selection, 'createHitSnapshot', () => ({
      point: new Vector2(10, 20),
      selectableIds: ['group'],
      topmostId: 'group',
      selectedScopeHitIds: ['group'],
      drillTargetId: 'child',
    }));
    chai.spy.on(selection, 'resolveHoverTarget', () => (
      selection.isItemSelected('group') ? 'group' : 'child'
    ));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    sendMouseDown(handler, createMouseEvent('mousedown', 1));
    sendMouseUp(handler, createMouseEvent('mouseup', 0));
    expect(selection.preSelectedId).to.equal('group');

    sendMouseDown(handler, new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 20,
      detail: 2,
    }));

    expect(selection.getSelectedIds()).to.deep.equal(['child']);
    expect(selection.preSelectedId).to.equal(undefined);
    expect(selection.hoverOverlayItemId).to.equal('group');

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    expect(selection.preSelectedId).to.equal('child');
    handler.dispose();
  });

  it('pan 态下 mousemove 跳过 Gizmo / Selection 工具链', () => {
    const handler = createHandler();
    const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('upper');

    resetSpy(resolveHover);
    inputViewport(handler).onKeyDown(createKeyboardInput('Space'));
    const selectionMove = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseMove', () => {});

    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    // HandGizmo 前置命中，后续 mode / selection 候选不再收到事件；
    // updateHover 在 pan 态 canResolve=false → 提交空预选。
    expect(selectionMove).not.to.have.been.called();
    expect(resolveHover).not.to.have.been.called();
    expect(handler.getSelection().preSelectedId).to.equal(undefined);

    handler.dispose();
  });

  it('前置 Gizmo 阻断 Move 时不重新提交 Tool UI hover', () => {
    const handler = createHandler();
    const resolveHover = chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('upper'));
    // stub gizmo：首轮放行让 hover 正常解析，次轮接受事件以阻断下游。
    let blocksMove = false;

    registerStub(handler, makeStubGizmo('drag', {
      onMouseMove () {
        return blocksMove;
      },
    }));
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('upper');

    resetSpy(resolveHover);
    blocksMove = true;
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    // observed 与 Tool UI hover 都在入口清空；ChangeSelection 未收到 Move，因此不会重新提交。
    expect(resolveHover).not.to.have.been.called();
    expect(handler.getSelection().preSelectedId).to.equal(undefined);
    expect(handler.getSelection().hoverOverlayItemId).to.equal(undefined);

    handler.dispose();
  });

  it('pan 态 mouseup 不进入 Gizmo / Selection 工具链', () => {
    const handler = createHandler();

    inputViewport(handler).onKeyDown(createKeyboardInput('Space'));
    const selectionUp = chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseUp', event => event.accept());

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    // orphan Up 不投递 onMouseUp；随后 cached Move 被 HandGizmo 前置阻断。
    expect(selectionUp).not.to.have.been.called();

    handler.dispose();
  });

  it('dispatcher 在 behavior 派发前写入 Control 通用默认 cursor', () => {
    const handler = createHandler();
    let cursorAtBehavior: string | undefined;

    registerStub(handler, makeStubGizmo('cursor-observer', {
      onMouseMove () {
        cursorAtBehavior = controlCursor(handler);

        return false;
      },
    }));
    const event = new InputEventMouseMotion();

    inputViewport(handler).onMouseMove(event);

    expect(cursorAtBehavior).to.equal('default');
    expect(controlCursor(handler)).to.equal('default');
    handler.dispose();
  });

  it('新鼠标轮次从默认 cursor 开始，不保留上一轮 override', () => {
    const handler = createHandler();
    let submitCursor = true;

    registerStub(handler, makeStubGizmo('cursor-owner', {
      onMouseMove () {
        if (submitCursor) {
          handler.setCursor({ type: GestureCursorType.POINTER, angle: 0 });
        }

        return false;
      },
    }));

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(controlCursor(handler)).to.equal('pointer');

    submitCursor = false;
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(controlCursor(handler)).to.equal('default');

    handler.dispose();
  });
});

describe('GestureHandler - hover underlay', () => {
  it('update 先刷新 Frame，再 fan-out active Gizmo', () => {
    const handler = createHandler();
    const order: string[] = [];

    chai.spy.on(handler.getFrameManager(), 'updateViewBoxes', () => {
      order.push('frames');
    });
    chai.spy.on(handler.getGizmoManager(), 'onUpdate', () => {
      order.push('gizmos');
    });

    handler.update(0);

    expect(order).to.deep.equal(['frames', 'gizmos']);
    handler.dispose();
  });

  it('绘制顺序固定为 hover → active gizmos → snapping，不隐式帧同步', () => {
    const handler = createHandler();

    activateMode(handler, [
      makeStubGizmo('corner-rotation'),
      makeStubGizmo('resize-selection'),
    ]);
    const order: string[] = [];
    const internals = handler as unknown as {
      drawGizmos (control: object): void,
      drawHoverOverlay (control: object): void,
      drawGizmo (gizmo: Gizmo, control: object): void,
      drawSnappingVisualizations (control: object): void,
    };
    const updateViewBoxes = chai.spy.on(handler.getFrameManager(), 'updateViewBoxes');
    const updateGizmos = chai.spy.on(handler.getGizmoManager(), 'onUpdate');

    chai.spy.on(internals, 'drawHoverOverlay', () => order.push('hover'));
    chai.spy.on(internals, 'drawGizmo', gizmo => order.push(gizmo.type));
    chai.spy.on(internals, 'drawSnappingVisualizations', () => order.push('snapping'));

    internals.drawGizmos({});

    expect(order[0]).to.equal('hover');
    expect(order.indexOf('hover')).to.be.lessThan(order.indexOf('corner-rotation'));
    expect(order.indexOf('hover')).to.be.lessThan(order.indexOf('resize-selection'));
    expect(order[order.length - 1]).to.equal('snapping');
    expect(updateViewBoxes).not.to.have.been.called();
    expect(updateGizmos).not.to.have.been.called();
    handler.dispose();
  });

  it('Move → Hand 不合成指针事件，hover 由下一次真实输入清除或恢复', () => {
    const handler = createHandler();
    const media = createPreviewMedia(handler, 'hover-item');

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('hover-item'));

    activateMoveTool(handler);
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');

    handler.setActiveTool(new HandGizmoTool(handler));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal(undefined);
    expect(media.pause).to.have.been.called.once;

    activateMoveTool(handler);
    expect(handler.getSelection().preSelectedId).to.equal(undefined);

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');
    handler.dispose();
  });

  it('空选择图与选择图切换后，由下一次真实输入刷新 hover', () => {
    const handler = createHandler();

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('hover-item'));
    activateMode(handler, []);
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');

    handler.setActiveTool(createTestGizmoTool(handler, () => []));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal(undefined);

    activateMode(handler, []);
    expect(handler.getSelection().preSelectedId).to.equal(undefined);

    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');

    handler.setActiveTool(createTestGizmoTool(handler, () => []));
    expect(handler.getSelection().preSelectedId).to.equal('hover-item');
    handler.dispose();
  });

});

describe('GestureHandler - media hover preview', () => {
  it('进入、切换和取消 hover 时依次播放新目标并暂停旧目标', () => {
    const handler = createHandler();
    const order: string[] = [];
    const video = createPreviewMedia(handler, 'video-1', 'video', order);
    const effects = createPreviewMedia(handler, 'effects-1', 'effects', order);
    let hoverTarget = 'video-1';

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => hoverTarget);
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(video.play).to.have.been.called.once;
    expect(video.pause).not.to.have.been.called();
    expect(effects.play).not.to.have.been.called();

    hoverTarget = 'effects-1';
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(video.pause).to.have.been.called.once;
    expect(effects.play).to.have.been.called.once;
    expect(order).to.deep.equal(['video-1:play', 'video-1:pause', 'effects-1:play']);

    sendMouseLeave(handler);

    expect(effects.pause).to.have.been.called.once;
    handler.dispose();
  });

  it('videoPreSelectedPlay=false 时不启动新预览', () => {
    const handler = createHandler();
    const video = createPreviewMedia(handler, 'video-1');
    const effects = createPreviewMedia(handler, 'effects-1', 'effects');

    handler.getGizmoManager().configs.set(selectionPreviewConfig, {
      videoPreSelectedPlay: false,
    });
    let hoverTarget = 'video-1';

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => hoverTarget);
    sendMouseMove(handler, createMouseEvent('mousemove', 0));
    hoverTarget = 'effects-1';
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    expect(video.play).not.to.have.been.called();
    expect(effects.play).not.to.have.been.called();
    handler.dispose();
  });

  it('销毁时暂停仍处于 hover 的媒体预览', () => {
    const handler = createHandler();
    const video = createPreviewMedia(handler, 'video-1');

    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => ('video-1'));
    sendMouseMove(handler, createMouseEvent('mousemove', 0));

    handler.dispose();

    expect(video.play).to.have.been.called.once;
    expect(video.pause).to.have.been.called.once;
  });
});

describe('GestureHandler - mouse lifecycle and captured owner', () => {
  function makeStub (type: string, overrides: Record<string, unknown>): Gizmo {
    const adapt = (name: 'onMouseDown' | 'onMouseMove' | 'onMouseDrag' | 'onMouseUp') => {
      const original = overrides[name] as ((event: InputEventMouse) => unknown) | undefined;

      return (event: InputEventMouse) => {
        if (original?.(event) === true) {
          event.accept();
        }
      };
    };

    return {
      type,
      dispose () {},
      requiresDragThreshold: () => true,
      onMouseLeave () {},
      onKeyDown () {},
      onKeyUp () {},
      onUpdate () {},
      ...overrides,
      onMouseDown: adapt('onMouseDown'),
      onMouseMove: adapt('onMouseMove'),
      onMouseDrag: adapt('onMouseDrag'),
      onMouseUp: adapt('onMouseUp'),
    } as unknown as Gizmo;
  }

  /** 安装 State 本轮创建的 stub 图（stub 参与 active dispatch，无选区过滤）。 */
  function activateStubs (handler: GestureHandler, stubs: Gizmo[]): void {
    activateMode(handler, stubs);
    // 当前用例只统计装配完成后的目标 round。
  }

  /** 静音 HandGizmo（返 false 不接管）并固定 hover 命中。 */
  function silenceViewport (handler: GestureHandler): void {
    const hand = handler.getGizmoManager().get('hand')!;

    chai.spy.on(hand, 'onMouseDown', () => {});
    chai.spy.on(hand, 'onMouseMove', () => {});
    chai.spy.on(hand, 'onMouseUp', () => {});
    chai.spy.on(handler.getSelection(), 'resolveHoverTarget', () => (undefined));
  }

  /** 经 runtime Control callback 进入 GestureHandler。 */
  function dispatchMouse (handler: GestureHandler, event: InputEventMouseButton | InputEventMouseMotion): boolean {
    const viewport = inputViewport(handler);

    if (event instanceof InputEventMouseMotion) {
      viewport.onMouseMove(event);
    } else if (event.pressed) {
      viewport.onMouseDown(event);
    } else {
      viewport.onMouseUp(event);
    }

    return event.isAccepted();
  }

  /** handler.capturedGizmo 为 private slot。 */
  function capturedGizmo (handler: GestureHandler): Gizmo | undefined {
    return (handler as unknown as { capturedGizmo?: Gizmo }).capturedGizmo;
  }

  /** 直接设置 capture，用于验证公共 Gizmo 的 mode 生命周期策略。 */
  function setCapturedGizmo (handler: GestureHandler, gizmo: Gizmo): void {
    (handler as unknown as { capturedGizmo?: Gizmo }).capturedGizmo = gizmo;
  }

  /** 当前 viewport 候选：公共前置 Gizmo + State/EditMode 声明序。 */
  function viewportGizmoList (handler: GestureHandler): readonly Gizmo[] {
    return handler.getGizmoManager().activeGizmos;
  }

  function ensureTestViewport (handler: GestureHandler): void {
    const engine = handler.getEngine();

    if (engine.sceneServer.compositions.length > 0) {
      return;
    }

    Object.defineProperties(engine.canvas.parentElement, {
      offsetWidth: { value: 200, configurable: true },
      offsetHeight: { value: 100, configurable: true },
    });
    let matrix = new Matrix4();

    engine.sceneServer.compositions.push({
      items: [],
      camera: {
        getViewportMatrix: () => matrix,
        setViewportMatrix: (next: Matrix4) => {
          matrix = next;
        },
      },
    } as unknown as Composition);
  }

  function applyViewportChange (handler: GestureHandler): void {
    ensureTestViewport(handler);
    handler.getViewportNavigation().panByViewDelta(
      new Vector2(1, 0),
      new Vector2(),
      'wheel-pan',
    );
  }

  it('Move：首个 handled 后停止向后派发', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const winnerMove = chai.spy(() => true);
    const skippedMove = chai.spy(() => true);

    activateStubs(handler, [
      makeStub('winner', { onMouseMove: winnerMove }),
      makeStub('skipped', { onMouseMove: skippedMove }),
    ]);

    expect(dispatchMouse(handler, mouseMotion())).to.equal(true);
    expect(winnerMove).to.have.been.called.once;
    expect(skippedMove).not.to.have.been.called();
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('terminal Up runs a fresh cached Move and discards its winner', () => {
    const handler = createHandler();
    const cachedMoves: { event: InputEventMouse, acceptedAtEntry: boolean }[] = [];
    const owner = makeStub('owner', {
      onMouseDown: () => true,
      onMouseUp: () => true,
      onMouseMove: (event: InputEventMouse) => {
        cachedMoves.push({ event, acceptedAtEntry: event.isAccepted() });

        return true;
      },
    });

    activateStubs(handler, [owner]);

    sendMouseDown(handler, createMouseEvent('mousedown', 1));
    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    expect(cachedMoves).to.have.lengthOf(1);
    expect(cachedMoves[0].event).to.be.instanceOf(InputEventMouseMotion);
    expect(cachedMoves[0].acceptedAtEntry).to.equal(false);
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('successful wheel navigation replays Move without capture and Drag only to a captured owner', () => {
    const handler = createHandler();

    ensureTestViewport(handler);
    const hoverMove = chai.spy(() => true);
    const ownerDrag = chai.spy(() => true);
    const otherDrag = chai.spy(() => true);
    const hover = makeStub('hover', { onMouseMove: hoverMove, onMouseDrag: otherDrag });
    const owner = makeStub('owner', { onMouseDrag: ownerDrag });

    activateStubs(handler, [hover, owner]);

    sendWheel(handler, new WheelEvent('wheel', { deltaX: 1 }));
    expect(hoverMove).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);

    setCapturedGizmo(handler, owner);
    sendWheel(handler, new WheelEvent('wheel', { deltaX: 1 }));
    expect(ownerDrag).to.have.been.called.once;
    expect(otherDrag).not.to.have.been.called();
    expect(capturedGizmo(handler)).to.equal(owner);
    handler.dispose();
  });

  it('low-level viewport mutation does not independently run a cached round', () => {
    const handler = createHandler();
    const move = chai.spy();
    const candidate = makeStub('candidate', {
      onMouseMove: move,
    });

    activateStubs(handler, [candidate]);

    applyViewportChange(handler);
    expect(move).not.to.have.been.called();
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('Hand pan uses the current Drag round without synthesizing another Drag', () => {
    const handler = createHandler();

    ensureTestViewport(handler);
    const panByViewDelta = chai.spy.on(handler.getViewportNavigation(), 'panByViewDelta');

    sendMouseDown(handler, new MouseEvent('mousedown', {
      button: 1,
      buttons: 4,
      clientX: 10,
      clientY: 20,
    }));
    expect(capturedGizmo(handler)?.type).to.equal('hand');

    sendMouseDrag(handler, new MouseEvent('mousemove', {
      button: 1,
      buttons: 4,
      clientX: 15,
      clientY: 20,
    }));

    expect(panByViewDelta).to.have.been.called.once;
    expect(getSpyCalls(panByViewDelta)[0][0]).to.deep.include({ x: 5, y: 0 });
    expect(capturedGizmo(handler)?.type).to.equal('hand');
    handler.dispose();
  });

  it('wheel cached Move is suppressed outside the interaction layer when there is no capture', () => {
    const handler = createHandler();
    const move = chai.spy(() => true);

    activateStubs(handler, [makeStub('candidate', { onMouseMove: move })]);
    sendMouseLeave(handler);
    resetSpy(move);

    ensureTestViewport(handler);
    sendWheel(handler, new WheelEvent('wheel', { deltaX: 1 }));
    expect(move).not.to.have.been.called();
    handler.dispose();
  });

  it('uncaptured：先 prepare 全部候选，再按顺序 offer 到首个 handled', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const order: string[] = [];

    activateStubs(handler, [
      makeStub('first', {
        prepareForDispatch: () => order.push('prepare:first'),
        onMouseDown: () => {
          order.push('offer:first');

          return true;
        },
      }),
      makeStub('second', {
        prepareForDispatch: () => order.push('prepare:second'),
        onMouseDown: () => {
          order.push('offer:second');

          return true;
        },
      }),
    ]);

    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(order).to.deep.equal(['prepare:first', 'prepare:second', 'offer:first']);
    handler.dispose();
  });

  it('Down：首个 handled 后停止派发并建立 capture', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const firstDown = chai.spy(() => true);
    const secondDown = chai.spy(() => true);

    activateStubs(handler, [
      makeStub('first', { onMouseDown: firstDown }),
      makeStub('second', { onMouseDown: secondDown }),
    ]);

    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(firstDown).to.have.been.called.once;
    expect(secondDown).not.to.have.been.called();
    expect(capturedGizmo(handler)?.type).to.equal('first');
    handler.dispose();
  });

  it('前一个 Gizmo 未处理时继续派发给后一个', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const firstDown = chai.spy(() => false);
    const secondDown = chai.spy(() => true);

    activateStubs(handler, [
      makeStub('first', { onMouseDown: firstDown }),
      makeStub('second', { onMouseDown: secondDown }),
    ]);

    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(firstDown).to.have.been.called.once;
    expect(secondDown).to.have.been.called.once;
    expect(capturedGizmo(handler)?.type).to.equal('second');
    handler.dispose();
  });

  it('captured owner：selection 变化后 Drag/Up 仍直送 owner', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const ownerDown = chai.spy(() => true);
    const ownerDrag = chai.spy(() => true);
    const ownerUp = chai.spy(() => true);
    const otherDrag = chai.spy(() => true);

    activateStubs(handler, [
      makeStub('owner', { onMouseDown: ownerDown, onMouseDrag: ownerDrag, onMouseUp: ownerUp }),
      makeStub('other', { onMouseDrag: otherDrag }),
    ]);

    // Down：owner handled → 成为 captured owner
    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(capturedGizmo(handler)?.type).to.equal('owner');

    // 选区数据变化不介入鼠标派发或 capture；Down 后的 Drag/Up 仍直送 owner。
    handler.getSelection().setSelectedItems(['item-1']);
    const drag = mouseMotion(new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 15,
      clientY: 20,
    }));

    expect(dispatchMouse(handler, drag)).to.equal(true);
    expect(ownerDrag).to.have.been.called.once;
    expect(capturedGizmo(handler)?.type).to.equal('owner');

    // Up：直送 owner 并释放 capture
    expect(dispatchMouse(handler, mouseButton(false))).to.equal(true);
    expect(ownerUp).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);
    // other.onMouseDrag 始终未被 fan-out（capture 直送 owner）
    expect(otherDrag).not.to.have.been.called();
    handler.dispose();
  });

  it('releases persistent capture before Up while preserving the owner session state', () => {
    const handler = createHandler();

    silenceViewport(handler);
    let captureObservedByUp: Gizmo | undefined;
    let transformKindObservedByUp: string | undefined;
    let snapObservedByUp: unknown;
    const owner = makeStub('owner', {
      onMouseDown: () => true,
      onMouseUp: () => {
        captureObservedByUp = capturedGizmo(handler);
        transformKindObservedByUp = handler.getSelectionTransformKind();
        snapObservedByUp = handler.getSnapManager().result;

        return true;
      },
    });

    activateStubs(handler, [owner]);

    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(capturedGizmo(handler)).to.equal(owner);
    handler.setSelectionTransformKind('move');
    handler.getSnapManager().result = { x: 4, y: 5 };
    expect(dispatchMouse(handler, mouseButton(false))).to.equal(true);
    expect(captureObservedByUp).to.equal(undefined);
    expect(transformKindObservedByUp).to.equal('move');
    expect(snapObservedByUp).to.deep.equal({ x: 4, y: 5 });
    handler.dispose();
  });

  it('silently releases only stale capture before a new Down arbitrates', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const staleDown = chai.spy(() => true);
    const nextDown = chai.spy(() => true);
    const stale = makeStub('stale', { onMouseDown: staleDown });
    let stateSeenByNext: unknown;
    const next = makeStub('next', {
      onMouseDown: (event: InputEventMouse) => {
        nextDown();
        stateSeenByNext = {
          capture: capturedGizmo(handler),
          transformKind: handler.getSelectionTransformKind(),
          snap: handler.getSnapManager().result,
          cursor: controlCursor(handler),
        };
        event.accept();
      },
    });

    activateStubs(handler, [next]);
    setCapturedGizmo(handler, stale);
    handler.setSelectionTransformKind('move');
    handler.getSnapManager().result = { x: 4, y: 5 };

    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(staleDown).not.to.have.been.called();
    expect(nextDown).to.have.been.called.once;
    expect(stateSeenByNext).to.deep.equal({
      capture: undefined,
      transformKind: 'move',
      snap: { x: 4, y: 5 },
      cursor: 'default',
    });
    expect(capturedGizmo(handler)).to.equal(next);
    handler.dispose();
  });

  it('captured owner 在 5px 阈值前收不到 Drag，达到阈值的当轮立即派发', () => {
    const handler = createHandler();
    const drag = chai.spy(() => true);
    const owner = makeStub('owner', {
      onMouseDown: () => true,
      onMouseDrag: drag,
      onMouseUp: () => true,
    });

    activateStubs(handler, [owner]);
    silenceViewport(handler);

    sendMouseDown(handler, new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 20,
    }));
    const selectionClear = chai.spy.on(handler.getSelection(), 'clearHover');

    handler.setCursor({ type: GestureCursorType.POINTER, angle: 0 });

    sendMouseDrag(handler, new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 12,
      clientY: 23,
    }));
    expect(drag).not.to.have.been.called();
    expect(selectionClear).not.to.have.been.called();
    expect(controlCursor(handler)).to.equal('pointer');
    expect(capturedGizmo(handler)).to.equal(owner);

    sendMouseDrag(handler, new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 13,
      clientY: 24,
    }));
    expect(drag).to.have.been.called.once;
    expect(selectionClear).to.have.been.called.once;
    expect(controlCursor(handler)).to.equal('default');
    expect(capturedGizmo(handler)).to.equal(owner);
    handler.dispose();
  });

  it('阈值内 Up 仍交给保存的 owner 并释放 capture', () => {
    const handler = createHandler();
    const drag = chai.spy(() => true);
    const up = chai.spy(() => true);
    const owner = makeStub('owner', {
      onMouseDown: () => true,
      onMouseDrag: drag,
      onMouseUp: up,
    });

    activateStubs(handler, [owner]);
    silenceViewport(handler);

    sendMouseDown(handler, new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 20,
    }));
    sendMouseDrag(handler, new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 11,
      clientY: 20,
    }));
    sendMouseUp(handler, new MouseEvent('mouseup', {
      button: 0,
      buttons: 0,
      clientX: 11,
      clientY: 20,
    }));

    expect(drag).not.to.have.been.called();
    expect(up).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('requiresDragThreshold=false 的 captured owner 可在阈值前接收 Drag', () => {
    const handler = createHandler();
    const drag = chai.spy(() => true);
    const owner = makeStub('owner', {
      requiresDragThreshold: () => false,
      onMouseDown: () => true,
      onMouseDrag: drag,
    });

    activateStubs(handler, [owner]);
    silenceViewport(handler);

    sendMouseDown(handler, new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 20,
    }));
    sendMouseDrag(handler, new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 11,
      clientY: 20,
    }));

    expect(drag).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(owner);
    handler.dispose();
  });

  it('without capture, pressed Move/Drag and primary Up do not arbitrate', () => {
    const handler = createHandler();
    const prepare = chai.spy();
    const move = chai.spy();
    const drag = chai.spy();
    const up = chai.spy();

    activateStubs(handler, [
      makeStub('candidate', {
        prepareForDispatch: prepare,
        onMouseMove: move,
        onMouseDrag: drag,
        onMouseUp: up,
      }),
    ]);
    const selectionClear = chai.spy.on(handler.getSelection(), 'clearHover');

    handler.setCursor({ type: GestureCursorType.POINTER, angle: 0 });
    const pressedMove = mouseMotion(new MouseEvent('mousemove', {
      buttons: 1,
      clientX: 11,
      clientY: 20,
    }));

    expect(pressedMove).to.be.instanceOf(InputEventMouseMotion);
    expect(pressedMove.buttonMask).to.equal(MouseButtonMask.Left);
    expect(dispatchMouse(handler, pressedMove)).to.equal(false);
    expect(controlCursor(handler)).to.equal('pointer');

    const dragEvent = mouseMotion(new MouseEvent('mousemove', {
      buttons: 1,
      clientX: 20,
      clientY: 20,
    }));

    expect(dragEvent).to.be.instanceOf(InputEventMouseMotion);
    expect(dragEvent.buttonMask).to.equal(MouseButtonMask.Left);
    expect(dispatchMouse(handler, dragEvent)).to.equal(false);
    expect(selectionClear).not.to.have.been.called();
    expect(controlCursor(handler)).to.equal('pointer');

    const upEvent = mouseButton(false, createMouseEvent('mouseup', 0));

    expect(dispatchMouse(handler, upEvent)).to.equal(false);
    expect(up).not.to.have.been.called();
    // The terminal cached round is a fresh Move, not an orphan onMouseUp.
    expect(move).to.have.been.called.once;
    expect(drag).not.to.have.been.called();
    expect(prepare).to.have.been.called.once;
    expect(selectionClear).to.have.been.called.once;
    expect(controlCursor(handler)).to.equal('default');
    handler.dispose();
  });

  it('admitted mouse round clears primary hover before prepare and offer', () => {
    const handler = createHandler();
    const order: string[] = [];
    const candidate = makeStub('candidate', {
      prepareForDispatch: () => order.push('prepare'),
      onMouseMove: () => {
        order.push('offer');

        return true;
      },
    });

    activateStubs(handler, [candidate]);
    chai.spy.on(handler.getSelection(), 'clearHover', () => {
      order.push('clear');
    });

    expect(dispatchMouse(handler, mouseMotion())).to.equal(true);
    expect(order).to.deep.equal(['clear', 'prepare', 'offer']);
    handler.dispose();
  });

  it('top-level arbitration never clears accepted between candidates', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const first = chai.spy();
    const second = chai.spy(() => true);

    activateStubs(handler, [
      makeStub('first', { onMouseMove: first }),
      makeStub('second', { onMouseMove: second }),
    ]);
    const event = mouseMotion();
    const clearAccepted = chai.spy.on(event, 'clearAccepted');

    expect(dispatchMouse(handler, event)).to.equal(true);
    expect(first).to.have.been.called.once;
    expect(second).to.have.been.called.once;
    expect(clearAccepted).not.to.have.been.called();
    handler.dispose();
  });

  it('MouseLeave arbitrates all candidates without capture, but only the saved owner with capture', () => {
    const handler = createHandler();
    const firstLeave = chai.spy();
    const secondLeave = chai.spy();
    const ownerLeave = chai.spy();
    const selectionClear = chai.spy.on(handler.getSelection(), 'clearHover');
    const first = makeStub('first', { onMouseLeave: firstLeave });
    const second = makeStub('second', { onMouseLeave: secondLeave });
    const owner = makeStub('owner', { onMouseLeave: ownerLeave });

    activateStubs(handler, [first, second, owner]);

    sendMouseLeave(handler);
    expect(firstLeave).to.have.been.called.once;
    expect(secondLeave).to.have.been.called.once;
    expect(ownerLeave).to.have.been.called.once;
    expect(selectionClear).to.have.been.called.once;

    setCapturedGizmo(handler, owner);
    sendMouseLeave(handler);
    expect(firstLeave).to.have.been.called.once;
    expect(secondLeave).to.have.been.called.once;
    expect(ownerLeave).to.have.been.called.exactly(2);
    expect(selectionClear).to.have.been.called.exactly(2);
    expect(capturedGizmo(handler)).to.equal(owner);
    handler.dispose();
  });

  it('mode 切换保留旧 captured owner，MouseUp 收尾后再销毁退役图', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const winnerDispose = chai.spy();
    const loserDispose = chai.spy();
    const winnerDrag = chai.spy((event: InputEventMouse) => event.accept());
    const winnerUp = chai.spy((event: InputEventMouse) => event.accept());
    const winner = makeStub('winner', {
      onMouseDown: () => true,
      onMouseDrag: winnerDrag,
      onMouseUp: winnerUp,
      dispose: winnerDispose,
    });
    const loser = makeStub('loser', { dispose: loserDispose });

    activateStubs(handler, [winner, loser]);

    sendMouseDown(handler, createMouseEvent('mousedown', 1));
    expect(capturedGizmo(handler)).to.equal(winner);
    handler.setSelectionTransformKind('move');
    handler.getSnapManager().result = { x: 4, y: 5 };
    const resetSnap = chai.spy.on(handler.getSnapManager(), 'reset');

    activateMode(handler, []);

    expect(winnerDispose).not.to.have.been.called();
    expect(loserDispose).not.to.have.been.called();
    expect(winnerDrag).not.to.have.been.called();
    expect(capturedGizmo(handler)).to.equal(winner);
    expect(handler.getSelectionTransformKind()).to.equal('move');
    expect(resetSnap).not.to.have.been.called();
    expect(handler.getSnapManager().result).to.deep.equal({ x: 4, y: 5 });

    sendMouseUp(handler, createMouseEvent('mouseup', 0));

    expect(winnerUp).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);
    expect(winnerDispose).to.have.been.called.once;
    expect(loserDispose).to.have.been.called.once;
    handler.dispose();
  });

  it('captured Multiplex 跨 mode 切换保留内部 winner，MouseUp 后销毁整张旧图', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const outsideDispose = chai.spy();
    const outside = makeStub('outside', { onMouseDown: () => false, dispose: outsideDispose });
    const resizeSelection = makeStub('resize-selection', { onMouseDown: () => false });

    activateMode(handler, [outside, resizeSelection]);
    const moveSelection = getMoveSelectionGizmo(handler);

    chai.spy.on(moveSelection, 'onMouseDown', event => {
      handler.emit('actionstart', { source: moveSelection });
      event.accept();
    });
    chai.spy.on(moveSelection, 'onMouseDrag', event => event.accept());
    const moveDispose = chai.spy.on(moveSelection, 'dispose');

    chai.spy.on(getBoxSelectionGizmo(handler), 'onMouseDown', () => {});

    const downEvent = mouseButton(true, new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 20,
    }));

    expect(dispatchMouse(handler, downEvent)).to.equal(true);
    expect(capturedGizmo(handler)?.type).to.equal('click-drag-multiplex');

    // Drag 相位经 multiplex Phase B 补发 mouseDown(downSnapshot) 给 move → 建 _activeTransform 会话。
    const dragEvent = mouseMotion(new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 15,
      clientY: 20,
    }));

    expect(dispatchMouse(handler, dragEvent)).to.equal(true);

    const capturedMultiplex = capturedGizmo(handler);
    const multiplexUp = chai.spy.on(capturedMultiplex!, 'onMouseUp');

    activateMode(handler, []);

    expect(capturedGizmo(handler)).to.equal(capturedMultiplex);
    expect(moveDispose).not.to.have.been.called();
    expect(outsideDispose).not.to.have.been.called();

    inputViewport(handler).onMouseUp(mouseButton(false));

    expect(multiplexUp).to.have.been.called.once;
    expect(moveDispose).to.have.been.called.once;
    expect(outsideDispose).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('HandGizmo capture 跨 mode 切换保留，MouseUp 后销毁旧实例', () => {
    const handler = createHandler();
    const hand = viewportGizmoList(handler)[0];
    const dispose = chai.spy.on(hand, 'dispose');

    setCapturedGizmo(handler, hand);

    activateMode(handler, []);

    expect(dispose).not.to.have.been.called();
    expect(capturedGizmo(handler)).to.equal(hand);

    inputViewport(handler).onMouseUp(mouseButton(false));

    expect(dispose).to.have.been.called.once;
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });

  it('invoke 隔离抛错：上报 gizmo-actionstart 后返回 false、不向上抛', () => {
    const handler = createHandler();

    silenceViewport(handler);
    const report = chai.spy();

    handler.setErrorMonitor({ report });
    const throwing = makeStub('throwing', {
      onMouseDown () {
        throw new Error('boom');
      },
    });

    activateStubs(handler, [throwing]);

    // gizmo 抛错被 invoke 内 try/catch 兜住；后续内建 selection 候选仍可接受本次 Down。
    expect(() => dispatchMouse(handler, mouseButton(true))).not.to.throw();
    expect(dispatchMouse(handler, mouseButton(true))).to.equal(true);
    expect(getSpyCalls(report).some(args => args.length === 3 && args[0] instanceof Error && args[1] === 'gizmo-actionstart' && args[2]?.gizmoType === 'throwing' && Object.keys(args[2]).length === 1)).to.equal(true);
    handler.dispose();
  });

  it('onKeyDown 隔离抛错：上报 gizmo-key 且不向上抛', () => {
    const handler = createHandler();
    const report = chai.spy();

    handler.setErrorMonitor({ report });
    const throwing = makeStub('throwing', {
      // dispatch(KeyDown) 读 code；'KeyA' 避开 space 平移与 escape 退出分支。
      onKeyDown () {
        throw new Error('boom');
      },
    });
    const captured = makeStub('captured', {});

    activateStubs(handler, [throwing, captured]);
    setCapturedGizmo(handler, captured);
    const keyEvent = (): InputEventKey => createKeyboardInput('KeyA');

    // 抛错被 onKeyDown fan-out 内 try/catch 兜住，经 handleGizmoError 上报 gizmo-key、不向上抛。
    expect(() => inputViewport(handler).onKeyDown(keyEvent())).not.to.throw();
    expect(getSpyCalls(report).some(args => args.length === 3 && args[0] instanceof Error && args[1] === 'gizmo-key' && args[2]?.gizmoType === 'throwing' && Object.keys(args[2]).length === 1)).to.equal(true);
    expect(capturedGizmo(handler)).to.equal(undefined);
    handler.dispose();
  });
});
});
