import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import { InputEventMouseButton, MouseButton, MouseButtonMask, FrameComponent, spec, TextComponent, type Engine, type VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { FrameManager, GestureCursorType, ConfigManager, SnapManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d';

import { EnterEditModeGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/enter-edit-mode-gizmo';
import { Vector2 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d/selection';
import { EffectsEditMode, TextEditMode, type EditMode } from '../../../../../../plugin-packages/editor-gizmo/src/2d/modes';

const { expect } = chai;

describe('plugin-editor-gizmo/enter-edit-mode-gizmo', () => {
  afterEach(restoreTestState);

  const textModes = new Set<TextEditMode>();

  afterEach(() => {
    for (const mode of textModes) {
      mode.onExit();
    }
    textModes.clear();
  });

  function createDoubleClick (): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(120, 80);
    event.globalPosition.set(120, 80);
    event.buttonMask = MouseButtonMask.Left;
    event.buttonIndex = MouseButton.Left;
    event.pressed = true;
    event.doubleClick = true;

    return event;
  }

  function createItem (kind: 'text' | 'effects', hasTextComponent: boolean): VFXItem {
    return {
      name: kind === 'effects' ? '特效' : 'text',
      type: kind === 'effects' ? spec.ItemType.null : spec.ItemType.text,
      getInstanceId: () => `selected-${kind}`,
      getComponent: (component: unknown) => {
        if (kind === 'text' && component === TextComponent && hasTextComponent) {
          return {};
        }
        if (kind === 'effects' && component === FrameComponent) {
          return {};
        }

        return undefined;
      },
    } as unknown as VFXItem;
  }

  function createFixture (kind: 'text' | 'effects', hitIds: string[], hasTextComponent = true): {
    gizmo: EnterEditModeGizmo,
    item: VFXItem,
    setActiveEditMode: TestSpy,
    setCursor: TestSpy,
  } {
    const item = createItem(kind, hasTextComponent);
    const selection = {
      getSelectedPlayerItems: () => [item],
      commitSelectedItems: chai.spy(),
      hitTest: chai.spy(() => hitIds),
      filterSelectedItems: chai.spy((ids: string[]) => (
        kind === 'effects' && ids.includes('nested-effects-child')
          ? ['selected-effects']
          : ids
      )),
    } as unknown as Selection;
    const emit = chai.spy();
    const setActiveEditMode = chai.spy((mode: EditMode) => {
      if (mode instanceof TextEditMode) {
        textModes.add(mode);
        mode.onEnter();
      }
    });
    const setCursor = chai.spy();
    const engine = { canvas: { parentElement: document.body } } as unknown as Engine;
    const configs = new ConfigManager();
    const frames = new FrameManager(engine);
    const owner = {
      getSelection: () => selection,
      getFrameManager: () => frames,
      getViewportNavigation: () => ({} as never),
      getMousePosition: () => new Vector2(),
      isPanning: () => false,
      isHandToolMode: () => false,
      isMouseButtonPressed: () => false,
      rebuildGizmos: () => {},
      setActiveEditMode,
      resetEditMode: () => {},
      setCursor,
      emit,
      getGizmoManager: () => undefined,
      getConfigManager: () => configs,
      getEngine: () => engine,
    } as unknown as GizmoOwner;
    const snapManager = new SnapManager(owner);

    owner.getSnapManager = () => snapManager;

    return {
      gizmo: new EnterEditModeGizmo(owner),
      item,
      setActiveEditMode,
      setCursor,
    };
  }

  describe('EnterEditModeGizmo', () => {
    it('双击当前选中的文本时进入 TextEditMode', () => {
      const { gizmo, item, setActiveEditMode, setCursor } = createFixture(
        'text',
        ['selected-text'],
      );
      const event = createDoubleClick();

      gizmo.onMouseDown(event);

      expect(setActiveEditMode).to.have.been.called.once;
      const mode = getSpyCalls(setActiveEditMode)[0][0] as TextEditMode;

      expect(mode).to.be.instanceOf(TextEditMode);
      expect(mode.editingItem).to.equal(item);
      const gizmos = mode.createGizmos();

      expect(gizmos[0]).to.have.deep.nested.property('interactionParam.type', 'edit');
      expect(gizmos[0]).to.have.deep.nested.property('interactionParam.textareaType', 'select');
      gizmos.forEach(gizmo => gizmo.dispose());
      expect(getSpyCalls(setCursor).at(-1)).to.deep.equal([{
        type: GestureCursorType.TEXT,
        angle: 0,
      }]);
      expect(event.isAccepted()).to.equal(true);
    });

    it('双击当前特效的深层子元素区域时进入 EffectsEditMode', () => {
      const { gizmo, setActiveEditMode } = createFixture(
        'effects',
        ['nested-effects-child'],
      );
      const event = createDoubleClick();

      gizmo.onMouseDown(event);

      expect(setActiveEditMode).to.have.been.called.once;
      const mode = getSpyCalls(setActiveEditMode)[0][0];

      expect(mode).to.be.instanceOf(EffectsEditMode);
      expect(mode.effectsItemId).to.equal('selected-effects');
      expect(event.isAccepted()).to.equal(true);
    });

    it('双击空白画布时不进入任何编辑模式', () => {
      const { gizmo, setActiveEditMode } = createFixture('text', []);
      const event = createDoubleClick();

      gizmo.onMouseDown(event);

      expect(setActiveEditMode).not.to.have.been.called();
      expect(event.isAccepted()).to.equal(false);
    });

    it('文本缺少组件时不切换模式或接受双击', () => {
      const { gizmo, setActiveEditMode } = createFixture('text', ['selected-text'], false);
      const event = createDoubleClick();

      gizmo.onMouseDown(event);

      expect(setActiveEditMode).not.to.have.been.called();
      expect(event.isAccepted()).to.equal(false);
      expect(document.querySelector('textarea')).to.equal(null);
    });
  });
});
