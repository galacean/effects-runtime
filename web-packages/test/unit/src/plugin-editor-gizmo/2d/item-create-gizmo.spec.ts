import { restoreTestState, getSpyCalls } from '../helpers/spies';
import { InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, spec, type Engine, type VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoItemCreateActionEvent, GizmoItemCreateInfo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-action';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmo-owner';
import { toColor } from '../../../../../../plugin-packages/editor-gizmo/src/2d/drawing';
import { ItemCreateGizmo, ItemCreateType } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/item-create-gizmo';

import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxTransformFromBox } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { ConfigManager } from '../../../../../../plugin-packages/editor-gizmo/src/2d/configs/config-manager';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';

const { expect } = chai;

describe('plugin-editor-gizmo/item-create-gizmo', () => {
  afterEach(restoreTestState);

  function mouseButton (x: number, y: number, pressed = true, overrides: Partial<InputEventMouseButton> = {}): InputEventMouseButton {
    const event = new InputEventMouseButton();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    event.buttonIndex = MouseButton.Left;
    event.pressed = pressed;

    Object.assign(event, overrides);

    return event;
  }

  function mouseMotion (x: number, y: number, overrides: Partial<InputEventMouseMotion> = {}): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.set(x, y);
    event.globalPosition.set(x, y);
    event.buttonMask = MouseButtonMask.Left;

    Object.assign(event, overrides);
    event.pressed = (overrides.buttonMask ?? MouseButtonMask.Left) !== MouseButtonMask.None;

    return event;
  }

  function createHarness (createType: ItemCreateType, selectedItems: VFXItem[] = []) {
    const starts: GizmoItemCreateInfo[] = [];
    const updates: GizmoItemCreateInfo[] = [];
    const commits: GizmoItemCreateInfo[] = [];
    const engine = {
      compositions: [{ items: [] }],
      canvas: { parentElement: { offsetWidth: TEST_VIEW_SIZE.x, offsetHeight: TEST_VIEW_SIZE.y } },
      getServer (this: { compositions: unknown[] }) { return { compositions: this.compositions }; },

    } as unknown as Engine;
    const configs = new ConfigManager();
    const owner = {
      emit: (event: string, data: unknown) => {
        const createInfo = (data as GizmoItemCreateActionEvent).createInfo;

        if (event === 'actionstart') {
          starts.push(createInfo);
        } else if (event === 'actionupdate') {
          updates.push(createInfo);
        } else if (event === 'actioncommit') {
          commits.push(createInfo);
        }
      },
      setCursor: chai.spy(),
      getEngine: () => engine,
      getConfigManager: () => configs,
      getSelection: () => ({ getSelectedPlayerItems: () => selectedItems }),
    } as unknown as GizmoOwner;
    const gizmo = new ItemCreateGizmo(owner);

    gizmo.createType = createType;

    return { starts, updates, commits, gizmo };
  }

  describe('ItemCreateGizmo frame creation', () => {
    it('click creates the default frame around the pointer-down point', () => {
      const { commits, gizmo } = createHarness(ItemCreateType.FRAME);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      gizmo.onMouseUp(mouseButton(102, 123, false));

      expect(commits).to.have.lengthOf(1);
      expect(commits[0]).to.have.deep.nested.property('type', ItemCreateType.FRAME);
      expect(commits[0]).to.have.deep.nested.property('position', [100, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.position', [100, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.size', [1024, 1024]);
      expect(commits[0]).to.have.deep.nested.property('info.children', []);
    });

    it('the first admitted drag records frame geometry without applying a second 10px threshold', () => {
      const { starts, updates, commits, gizmo } = createHarness(ItemCreateType.FRAME);

      gizmo.onMouseDown(mouseButton(100, 100, true));
      gizmo.onMouseDrag(mouseMotion(106, 100));

      // Frame 拖拽阶段只有预览，真实元素等 mouseup 再创建。
      expect(starts).to.have.lengthOf(0);
      expect(updates).to.have.lengthOf(0);
      expect(commits).to.have.lengthOf(0);

      gizmo.onMouseUp(mouseButton(106, 100, false));

      expect(commits[0]).to.have.deep.nested.property('position', [103, 100.5]);
      expect(commits[0]).to.have.deep.nested.property('info.position', [103, 100.5]);
      expect(commits[0]).to.have.deep.nested.property('info.size', [6, 1]);
      expect(commits[0]).to.have.deep.nested.property('info.children', []);
    });

    it('keeps updating the frame preview and commits only the final box', () => {
      const { starts, updates, commits, gizmo } = createHarness(ItemCreateType.FRAME);

      gizmo.onMouseDown(mouseButton(100, 100, true));
      gizmo.onMouseDrag(mouseMotion(110, 110));
      gizmo.onMouseDrag(mouseMotion(150, 130));

      expect(starts).to.have.lengthOf(0);
      expect(updates).to.have.lengthOf(0);
      expect(commits).to.have.lengthOf(0);

      gizmo.onMouseUp(mouseButton(150, 130, false));
      expect(commits[0]).to.have.deep.nested.property('position', [125, 115]);
      expect(commits[0]).to.have.deep.nested.property('info.size', [50, 30]);
    });

    it('normalizes reverse drags and only reparents children for drag creation', () => {
      const { commits, gizmo } = createHarness(ItemCreateType.FRAME);

      gizmo.onMouseDown(mouseButton(100, 100, true));
      gizmo.onMouseDrag(mouseMotion(60, 80));
      gizmo.onMouseUp(mouseButton(60, 80, false));

      expect(commits[0]).to.have.deep.nested.property('position', [80, 90]);
      expect(commits[0]).to.have.deep.nested.property('info.position', [80, 90]);
      expect(commits[0]).to.have.deep.nested.property('info.size', [40, 20]);
    });

    it('draws the frame and enclosed elements as blue outlines without fills', () => {
      const { gizmo } = createHarness(ItemCreateType.FRAME);
      const interactiveChildrenBoxes = (gizmo as unknown as {
        interactiveChildrenBoxes: Map<string, Box2>,
      }).interactiveChildrenBoxes;

      gizmo.onMouseDown(mouseButton(100, 100, true));
      interactiveChildrenBoxes.set(
        'child-1',
        new Box2(new Vector2(110, 110), new Vector2(120, 120)),
      );
      gizmo.onMouseDrag(mouseMotion(150, 150));

      const drawLine = chai.spy();
      const fillRect = chai.spy();

      gizmo.draw({ drawLine, fillRect } as unknown as Control);

      expect(fillRect).not.to.have.been.called();
      expect(drawLine).to.have.been.called.exactly(8);
      expect(getSpyCalls(drawLine).slice(0, 4).every(call => call[5] === 1)).to.equal(true);
      expect(getSpyCalls(drawLine).slice(4).every(call => call[5] === 2)).to.equal(true);
      expect(getSpyCalls(drawLine).slice(4).every(call => call[4] === toColor(0x3b82f6, 1))).to.equal(true);
    });
  });

  describe('ItemCreateGizmo text creation', () => {
    it('quick horizontal movement remains a click-created text item', () => {
      let now = 0;

      chai.spy.on(Date, 'now', () => now);
      const { starts, commits, gizmo } = createHarness(ItemCreateType.TEXT);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      now = 100;
      gizmo.onMouseDrag(mouseMotion(200, 300));
      expect(starts).to.have.lengthOf(0);
      gizmo.onMouseUp(mouseButton(200, 300, false));

      expect(commits[0]).to.deep.include({
        type: ItemCreateType.TEXT,
        position: [100, 120],
      });
      expect(commits[0].info).to.equal(undefined);
    });

    it('creates fixed-width text after a delayed horizontal drag and ignores vertical distance', () => {
      let now = 0;

      chai.spy.on(Date, 'now', () => now);
      const { starts, commits, gizmo } = createHarness(ItemCreateType.TEXT);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      now = 151;
      gizmo.onMouseDrag(mouseMotion(160, 400));

      expect(starts).to.have.lengthOf(1);
      expect(commits).to.have.lengthOf(0);
      expect(starts[0]).to.have.deep.nested.property('type', ItemCreateType.TEXT);
      expect(starts[0]).to.have.deep.nested.property('position', [130, 120]);
      expect(starts[0]).to.have.deep.nested.property('info.width', 60);

      gizmo.onMouseUp(mouseButton(160, 400, false));

      expect(commits[0]).to.have.deep.nested.property('type', ItemCreateType.TEXT);
      expect(commits[0]).to.have.deep.nested.property('position', [130, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.position', [130, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.width', 60);
      expect(commits[0].id).to.equal(starts[0].id);
    });

    it('draws the actual text bounding box while fixed-width text is being created', () => {
      let now = 0;

      chai.spy.on(Date, 'now', () => now);
      const selectedText = { type: spec.ItemType.text } as VFXItem;
      const actualBox = new Box2(new Vector2(100, 96), new Vector2(160, 144));

      const projection = setItemViewTransform(selectedText, getBoxTransformFromBox(actualBox));
      const { gizmo } = createHarness(ItemCreateType.TEXT, [selectedText]);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      now = 151;
      gizmo.onMouseDrag(mouseMotion(160, 120));

      const drawLine = chai.spy();
      const fillRect = chai.spy();

      gizmo.draw({ drawLine, fillRect } as unknown as Control);

      expect(projection).to.have.been.called.once;
      expect(getSpyCalls(drawLine).map(call => call.slice(0, 4))).to.deep.equal([
        [100, 96, 160, 96],
        [160, 96, 160, 144],
        [160, 144, 100, 144],
        [100, 144, 100, 96],
      ]);
      expect(drawLine).to.have.been.called.exactly(4);
      expect(getSpyCalls(drawLine).every(call => call[4] === toColor(0x3b82f6, 1))).to.equal(true);
      expect(getSpyCalls(drawLine).every(call => call[5] === 2)).to.equal(true);
      expect(fillRect).not.to.have.been.called();
    });

    it('does not create fixed-width text from a vertical-only drag', () => {
      let now = 0;

      chai.spy.on(Date, 'now', () => now);
      const { commits, gizmo } = createHarness(ItemCreateType.TEXT);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      now = 151;
      gizmo.onMouseDrag(mouseMotion(100, 300));
      gizmo.onMouseUp(mouseButton(100, 300, false));

      expect(commits[0]).to.deep.include({ position: [100, 120] });
      expect(commits[0].info).to.equal(undefined);
    });

    it('normalizes reverse horizontal text drags', () => {
      let now = 0;

      chai.spy.on(Date, 'now', () => now);
      const { commits, gizmo } = createHarness(ItemCreateType.TEXT);

      gizmo.onMouseDown(mouseButton(100, 120, true));
      now = 151;
      gizmo.onMouseDrag(mouseMotion(40, 200));
      gizmo.onMouseUp(mouseButton(40, 200, false));

      expect(commits[0]).to.have.deep.nested.property('position', [70, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.position', [70, 120]);
      expect(commits[0]).to.have.deep.nested.property('info.width', 60);
    });
  });
});
