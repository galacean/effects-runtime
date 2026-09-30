import { restoreTestState, type TestSpy } from '../helpers/spies';
import { InputEventMouseButton, MouseButton, MouseButtonMask, spec, TextComponent, type Engine, type VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { FrameManager, ConfigManager, SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

import { Box2 } from '@galacean/effects-math/es/extension/index';
import { getBoxTransformFromBox, Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection/selection';
import { TextGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/text-gizmo';
import { TextEditSession } from '../../../../../../plugin-packages/editor-gizmo/src/2d/text/text-edit-session';
import { TextCaretMapper } from '../../../../../../plugin-packages/editor-gizmo/src/2d/text/text-caret-mapper';

const { expect } = chai;

describe('plugin-editor-gizmo/text-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(20, 20);
    event.globalPosition.set(20, 20);
    event.buttonMask = MouseButtonMask.Left;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;

    Object.assign(event, overrides);

    return event;
  }

  function createGizmo (viewScale = 1): {
    gizmo: TextGizmo,
    session: TextEditSession,
    owner: GizmoOwner,
    textComponent: {
      setText: TestSpy,
      setTextHeight: TestSpy,
      setTextWidth: TestSpy,
      getLineCount: TestSpy,
      textLayout: {
        lineHeight: number,
        letterSpace: number,
        textAlign: spec.TextAlignment,
        height: number,
        keepWordIntact: boolean,
      },
    },
    resetEditMode: TestSpy,
    rebuildGizmos: TestSpy,
    emit: TestSpy,
    setSelectedItems: (items: VFXItem[]) => void,
    setItemVisible: (visible: boolean) => void,
  } {
    const textComponent = {
      text: 'before',
      textLayout: {
        lineHeight: 20,
        letterSpace: 0,
        textAlign: spec.TextAlignment.left,
        height: 20,
        keepWordIntact: true,
      },
      textStyle: {
        fontSize: 16,
        textWeight: 400,
        fontFamily: 'sans-serif',
      },
      setText: chai.spy(),
      setTextHeight: chai.spy(),
      setTextWidth: chai.spy(),
      getLineCount: chai.spy(() => 1),
    };
    let itemVisible = true;
    const item = {
      type: spec.ItemType.text,
      get isVisible () {
        return itemVisible;
      },
      transform: { rotation: { z: 0 }, scale: { x: 10, y: 10, z: 1 } },
      getInstanceId: () => 'text-1',
      getComponent: (component: unknown) => component === TextComponent ? textComponent : undefined,
    } as unknown as VFXItem;
    let selectedItems = [item];
    const selection = {
      getSelectedPlayerItems: () => selectedItems,
    } as unknown as Selection;
    const engine = {
    // 固定容器为 800/600，该用例依赖尺寸推算字号。
    // textarea 仍挂进真实 DOM，让 Escape keydown 能冒泡到 document 监听。
      canvas: {
        parentElement: {
          offsetWidth: 800,
          offsetHeight: 600,
          appendChild: (node: Node) => document.body.appendChild(node),
          removeChild: (node: Node) => document.body.removeChild(node),
        },
      },
      sceneServer: {
        compositions: [{
          time: 0,
          gotoAndStop: chai.spy(),
          camera: {
            getViewportMatrix: () => ({
              elements: [viewScale, 0, 0, 0, 0, viewScale, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            }),
          },
        }],
      },
    } as unknown as Engine;
    const resetEditMode = chai.spy();
    const rebuildGizmos = chai.spy();
    const emit = chai.spy();
    const configs = new ConfigManager();
    const frames = new FrameManager({} as unknown as Engine);
    const owner = {
      emit,
      getSelection: () => selection,
      getFrameManager: () => frames,
      getViewportNavigation: () => ({} as never),
      getMousePosition: () => new Vector2(),
      isPanning: () => false,
      isHandToolMode: () => false,
      isMouseButtonPressed: () => false,
      rebuildGizmos,
      resetEditMode,
      getGizmoManager: () => undefined,
      getConfigManager: () => configs,
      // TextGizmo 经 owner.getEngine().canvas.parentElement 挂隐藏 textarea
      getEngine: () => engine,
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    owner.getSnapManager = () => snapManager;
    const session = new TextEditSession(owner);
    const gizmo = new TextGizmo(owner, session);
    const resultBox = new Box2().setFromCenterAndSize(new Vector2(20, 20), new Vector2(30, 30));

    gizmo.result = {
      type: 'valid',
      box: resultBox,
      transform: getBoxTransformFromBox(resultBox)!,
    };
    chai.spy.on(gizmo, 'onUpdate', () => {});

    return {
      gizmo,
      session,
      owner,
      textComponent,
      resetEditMode,
      rebuildGizmos,
      emit,
      setSelectedItems: items => {
        selectedItems = items;
      },
      setItemVisible: visible => {
        itemVisible = visible;
      },
    };
  }

  afterEach(() => {
    document.head.querySelectorAll('style').forEach(style => style.remove());
  });

  describe('TextGizmo - inline editing', () => {
    it('输入始终写入编辑会话持有的文本对象', () => {
      const { gizmo, session, textComponent, emit } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();
      gizmo.textAreaElement.value = 'after';
      gizmo.textAreaElement.dispatchEvent(new Event('input'));

      expect(textComponent.setText).to.have.been.called.with.exactly('after');
      expect(emit).to.have.been.called.with.exactly('textinput', {
        source: gizmo,
        itemId: 'text-1',
        text: 'after',
        fontFamily: 'sans-serif',
      });
    });

    it('编辑期间不处理画布按下，退出竞争交给 LeaveEditModeGizmo', () => {
      const { gizmo, session, resetEditMode } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);

      const down = mouseButton(true);

      gizmo.onMouseDown(down);
      expect(down.isAccepted()).to.equal(false);
      expect(gizmo.isEditing).to.equal(true);
      expect(resetEditMode).not.to.have.been.called();
      const up = mouseButton(false, { });

      gizmo.onMouseUp(up);
      expect(up.isAccepted()).to.equal(true);
    });

    it('切换目标拖选期间不抢画布焦点，抬起后再聚焦 textarea', () => {
      chai.spy.on(TextCaretMapper.prototype, 'sync', () => {});
      chai.spy.on(TextCaretMapper.prototype, 'resolve', point => point.x < 20 ? 1 : 5);
      const { gizmo, session } = createGizmo();
      const focus = chai.spy.on(gizmo.textAreaElement, 'focus');
      const preview = document.querySelector<HTMLDivElement>('.text-gizmo-pointer-selection-preview')!;

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      session.beginPointerSelection({ x: 10, y: 20 });

      gizmo.draw();
      session.updatePointerSelection({ x: 30, y: 20 });

      expect(focus).not.to.have.been.called();
      expect(gizmo.textAreaElement.selectionStart).to.equal(1);
      expect(gizmo.textAreaElement.selectionEnd).to.equal(5);
      expect(preview.style.display).to.equal('block');
      expect(preview.textContent).to.equal('before');
      expect(preview.querySelector('span')?.textContent).to.equal('efor');
      expect(preview.querySelector('span')?.style.backgroundColor).to.equal('rgba(59, 130, 246, 0.35)');
      expect(getComputedStyle(preview).opacity).to.equal('0.8');
      expect(Array.from(document.head.querySelectorAll('style'))
        .find(style => style.textContent?.includes('.text-gizmo-custom-style::selection'))
        ?.textContent).to.include('rgba(59, 130, 246, 0.35)');

      session.finishPointerSelection({ x: 30, y: 20 });

      expect(focus).to.have.been.called.once;
      expect(document.activeElement).to.equal(gizmo.textAreaElement);
      expect(preview.style.display).to.equal('none');
    });

    it('双击进入编辑态使用 select activation 默认选中全文', () => {
      const { gizmo, session } = createGizmo();

      expect(session.beginFromCurrentSelection('select')).to.equal(true);

      gizmo.draw();

      expect(gizmo.textAreaElement.selectionStart).to.equal(0);
      expect(gizmo.textAreaElement.selectionEnd).to.equal(gizmo.textAreaElement.value.length);
      expect(document.activeElement).to.equal(gizmo.textAreaElement);
    });

    it('支持外部直接选中当前编辑文本的全部内容', () => {
      const { gizmo, session } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();
      gizmo.textAreaElement.setSelectionRange(1, 3);

      expect(gizmo.selectAllText()).to.equal(true);

      expect(gizmo.textAreaElement.selectionStart).to.equal(0);
      expect(gizmo.textAreaElement.selectionEnd).to.equal(gizmo.textAreaElement.value.length);
      expect(document.activeElement).to.equal(gizmo.textAreaElement);
    });

    it('首次投影前调用全选，会在输入框打开后恢复全文选区', () => {
      const { gizmo, session } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);

      expect(gizmo.selectAllText()).to.equal(true);
      gizmo.draw();

      expect(gizmo.textAreaElement.selectionStart).to.equal(0);
      expect(gizmo.textAreaElement.selectionEnd).to.equal(gizmo.textAreaElement.value.length);
    });

    it('没有正在编辑的文本时，全选返回 false', () => {
      const { gizmo } = createGizmo();

      expect(gizmo.selectAllText()).to.equal(false);
    });

    it('在已有文本选区内重新按下时取消原生文字拖放并允许重新拖选', () => {
      const { gizmo, session } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();
      gizmo.textAreaElement.setSelectionRange(1, 5);

      gizmo.textAreaElement.dispatchEvent(new MouseEvent('mousedown', {
        button: 0,
        bubbles: true,
        cancelable: true,
      }));

      expect(gizmo.textAreaElement.selectionStart).to.equal(1);
      expect(gizmo.textAreaElement.selectionEnd).to.equal(1);

      const dragStart = new Event('dragstart', {
        bubbles: true,
        cancelable: true,
      });

      expect(gizmo.textAreaElement.dispatchEvent(dragStart)).to.equal(false);
      expect(dragStart.defaultPrevented).to.equal(true);
    });

    it('textarea Escape 冒泡给 GestureHandler，不在 DOM handler 中直接结束或重建', () => {
      const { gizmo, session, resetEditMode, rebuildGizmos } = createGizmo();
      const bubbledKeyDown = chai.spy();

      document.addEventListener('keydown', bubbledKeyDown);
      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      gizmo.textAreaElement.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }));

      expect(bubbledKeyDown).to.have.been.called.once;
      expect(resetEditMode).not.to.have.been.called();
      expect(rebuildGizmos).not.to.have.been.called();
      document.removeEventListener('keydown', bubbledKeyDown);
    });

    it('onUpdate 只同步编辑目标，选区变化不会在帧同步阶段切换 EditMode', () => {
      const {
        gizmo,
        session,
        resetEditMode,
        rebuildGizmos,
        setSelectedItems,
        setItemVisible,
      } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.onUpdate = TextGizmo.prototype.onUpdate;
      setSelectedItems([]);
      setItemVisible(false);

      gizmo.onUpdate();

      expect(gizmo.isEditing).to.equal(true);
      expect(gizmo.result).to.deep.equal({ type: 'empty' });
      expect(resetEditMode).not.to.have.been.called();
      expect(rebuildGizmos).not.to.have.been.called();
    });

    it('外部 mode 切换导致 dispose 时不反向请求恢复默认模式', () => {
      const { gizmo, session, resetEditMode } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);

      gizmo.dispose();

      expect(session.isEditing).to.equal(true);
      expect(resetEditMode).not.to.have.been.called();
      session.dispose();
    });

    it('同一 TextEditMode 重建图时，旧投影 dispose 不会脱离新投影', () => {
      const { gizmo, session, owner } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      const replacement = new TextGizmo(owner, session);

      replacement.result = gizmo.result;
      gizmo.dispose();
      replacement.draw();

      expect(replacement.isEditing).to.equal(true);
      expect(replacement.textAreaElement.style.display).to.equal('block');
      replacement.dispose();
      session.dispose();
    });

    it('投影完全 detach 后，新投影会重新显示 textarea 并恢复焦点', () => {
      const { gizmo, session, owner } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      const textArea = gizmo.textAreaElement;

      gizmo.dispose();
      expect(textArea.style.display).to.equal('none');

      const focus = chai.spy.on(textArea, 'focus');
      const replacement = new TextGizmo(owner, session);

      replacement.result = gizmo.result;
      replacement.draw();

      expect(textArea.style.display).to.equal('block');
      expect(focus).to.have.been.called.once;
      replacement.dispose();
      session.dispose();
    });

    it('带有 control 时 draw 不抛错并同步 textarea（修复 drawEditBox 读 this.config 的回归）', () => {
      const { gizmo, session } = createGizmo();
      // 生产里 GestureHandler.drawGizmos 每帧传入 control；drawCorners 只用到 control.drawLine。
      const control = { drawLine: chai.spy() } as unknown as Control;

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);

      // 修复前：drawEditBox 解构 this.config（undefined）抛 TypeError，被 drawGizmo 吞掉，
      // 导致后续 syncTextArea 不执行、textarea 停在 display:none → 无光标。
      expect(() => gizmo.draw(control)).not.to.throw();
      expect(gizmo.textAreaElement.style.display).to.equal('block');
    });
  });

  describe('TextGizmo - textarea 字号按 投影框高/textLayout.height 缩放（与 canvas 字形同源）', () => {
  // canvas TextComponent 的 transform.size 由 textLayout 派生（×scaleFactor²，见 effects-runtime text-item.ts）；
  // DOM 字号屏幕缩放须与投影框同源：fontScale = size.y / textLayout.height，而非 ×viewScale
  // （viewScale=viewportMatrix[0] 漏相机基底/contentRatio，非默认相机下 DOM 字号≠canvas 字形→换行错位）。
    it('字号/行高/字距按 box高/textLayout.height 缩放，不随 viewScale', () => {
      const { gizmo, session } = createGizmo(2);   // viewScale=2，刻意与 fontScale(4) 不同以证非 viewScale 驱动
      const resultBox = new Box2().setFromCenterAndSize(new Vector2(20, 20), new Vector2(80, 80));

      gizmo.result = {
        type: 'valid',
        box: resultBox,
        transform: getBoxTransformFromBox(resultBox)!,
      };

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      // fontScale = 框高80 / textLayout.height20 = 4；fontSize 16×4=64、lineHeight 20×4=80、letterSpace 0×4=0
      expect(gizmo.textAreaElement.style.fontSize).to.equal('64px');
      expect(gizmo.textAreaElement.style.lineHeight).to.equal('80px');
      expect(gizmo.textAreaElement.style.letterSpacing).to.equal('0px');
    });

    it('textLayout.height≤0 时退化为 viewScale（守门避免除零/缺值）', () => {
      const { gizmo, session, textComponent } = createGizmo(3);

      textComponent.textLayout.height = 0;
      const resultBox = new Box2().setFromCenterAndSize(new Vector2(20, 20), new Vector2(30, 30));

      gizmo.result = {
        type: 'valid',
        box: resultBox,
        transform: getBoxTransformFromBox(resultBox)!,
      };

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      // 退化：fontScale=viewScale=3 → fontSize 16×3=48
      expect(gizmo.textAreaElement.style.fontSize).to.equal('48px');
    });

    it('word-break 随 keepWordIntact：true→normal（按词断，对齐 canvas 默认）', () => {
      const { gizmo, session, textComponent } = createGizmo();

      textComponent.textLayout.keepWordIntact = true;
      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();
      expect(gizmo.textAreaElement.style.wordBreak).to.equal('normal');
    });

    it('word-break 随 keepWordIntact：false→break-all（逐字断，对齐 canvas 逐字模式）', () => {
      const { gizmo, session, textComponent } = createGizmo();

      textComponent.textLayout.keepWordIntact = false;
      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();
      expect(gizmo.textAreaElement.style.wordBreak).to.equal('break-all');
    });

    it('位置/尺寸/旋转仍由 box 与 transform.rotation 决定,不受字号缩放影响', () => {
      const { gizmo, session } = createGizmo();

      expect(session.beginFromCurrentSelection('focus')).to.equal(true);
      gizmo.draw();

      // box center(20,20) size(30,30) → min(5,5);rotation.z=0 → rotateZ(0deg)
      expect(gizmo.textAreaElement.style.left).to.equal('5px');
      expect(gizmo.textAreaElement.style.top).to.equal('5px');
      expect(gizmo.textAreaElement.style.width).to.equal('30px');
      expect(gizmo.textAreaElement.style.height).to.equal('30px');
      expect(gizmo.textAreaElement.style.transform).to.equal('rotateZ(0rad)');
    });
  });
});
