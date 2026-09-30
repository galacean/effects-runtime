import { restoreTestState } from '../helpers/spies';
import { Euler, Matrix4, Quaternion, Vector2, Vector3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { Selection } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { FrameComponent, spec, type Engine, type VFXItem } from '@galacean/effects';

const { expect } = chai;

describe('plugin-editor-gizmo/selection', () => {
  afterEach(restoreTestState);

  function makeSelection (): Selection {
    const engine = {
      compositions: [],
      canvas: { offsetWidth: 0, offsetHeight: 0, parentElement: null },
      getServer (this: { compositions: unknown[] }) { return { compositions: this.compositions }; },

    } as unknown as Engine;

    return new Selection(engine);
  }

  function makeItem (id: string, children: VFXItem[] = []): VFXItem {
    const item = {
      name: id,
      type: spec.ItemType.null,
      children,
      parent: undefined,
      parentId: '',
      isVisible: true,
      getInstanceId: () => id,
      getComponent: () => undefined,
    } as unknown as VFXItem;

    for (const child of children) {
      child.parent = item;
      child.parentId = id;
    }

    return item;
  }

  function makeSelectionWithItems (items: VFXItem[]): Selection {
    const engine = {
      compositions: [{ items }],
      canvas: { parentElement: { offsetWidth: 800, offsetHeight: 600 } },
      getServer (this: { compositions: unknown[] }) { return { compositions: this.compositions }; },

    } as unknown as Engine;

    return new Selection(engine);
  }

  function makeViewItem (id: string, x: number, rotation = 0): VFXItem {
    const worldMatrix = new Matrix4().compose(
      new Vector3(x, 0, 0),
      new Quaternion().setFromEuler(new Euler(0, 0, rotation)),
      new Vector3(1, 1, 1),
    );
    const cameraMatrix = new Matrix4();

    return {
      name: id,
      type: spec.ItemType.sprite,
      children: [],
      parent: undefined,
      parentId: '',
      isVisible: true,
      getInstanceId: () => id,
      getComponent: () => undefined,
      transform: {
        size: new Vector2(0.2, 0.2),
        updateLocalMatrix: chai.spy(),
        getWorldMatrix: () => worldMatrix,
      },
      composition: {
        camera: {
          getProjectionMatrix: () => cameraMatrix.clone(),
          getViewMatrix: () => cameraMatrix.clone(),
        },
        transform: {
          getWorldMatrix: () => cameraMatrix.clone(),
        },
      },
    } as unknown as VFXItem;
  }

  describe('Selection hit snapshot and atomic commit', () => {
    it('多选时整体选框内的元素间空白可作为移动命中区域', () => {
      const left = makeViewItem('left', -0.5);
      const right = makeViewItem('right', 0.5);
      const selection = makeSelectionWithItems([left, right]);

      selection.setSelectedIds(['left', 'right']);

      // 单个元素分别位于 x=160..240 和 x=560..640；中心点只在整体选框内。
      expect(selection.isPointInSelectedViewBox(new Vector2(400, 300))).to.equal(true);
      expect(selection.isPointInSelectedViewBox(new Vector2(100, 300))).to.equal(false);
    });

    it('单选时继续按旋转后的元素四边形精确命中', () => {
      const item = makeViewItem('rotated', 0, 45);
      const selection = makeSelectionWithItems([item]);

      selection.setSelectedIds(['rotated']);

      expect(selection.isPointInSelectedViewBox(new Vector2(400, 300))).to.equal(true);
      expect(selection.isPointInSelectedViewBox(new Vector2(455, 355))).to.equal(false);
    });

    it('原子提交真空白选择并只发送一次准确变化', () => {
      const selection = makeSelection();

      selection.setSelectedIds(['text-A']); // 已选文本
      const listener = chai.spy();

      selection.on('selectionchange', listener);

      expect(selection.commitSelectedItems([])).to.equal(true);
      expect(selection.commitSelectedItems([])).to.equal(false);
      expect(selection.getSelectedIds()).to.deep.equal([]);
      expect(listener).to.have.been.called.once;
      expect(listener).to.have.been.called.with.exactly({
        oldSelectedIds: ['text-A'],
        newSelectedIds: [],
      });
    });

    it('重叠命中快照同时保留 topmost 和已选下层作用域', () => {
      const selection = makeSelection();

      selection.setSelectedIds(['lower']); // 下层已选
      chai.spy.on(selection, 'hitTest', () => (['raw-upper', 'raw-lower']));
      chai.spy.on(selection, 'filterSelectedItems', () => (['upper', 'lower']));

      expect(selection.createHitSnapshot(new Vector2())).to.deep.include({
        selectableIds: ['upper', 'lower'],
        topmostId: 'upper',
        selectedScopeHitIds: ['lower'],
      });
      expect(selection.getSelectedIds()).to.deep.equal(['lower']);
    });

    it('selected group 的子元素计入 selected scope', () => {
      const child = makeItem('child');
      const group = makeItem('group', [child]);
      const selection = makeSelectionWithItems([group]);

      selection.setSelectedIds(['group']);
      chai.spy.on(selection, 'hitTest', () => (['raw-child']));
      chai.spy.on(selection, 'filterSelectedItems', () => (['child']));

      expect(selection.createHitSnapshot(new Vector2()).selectedScopeHitIds).to.deep.equal(['child']);
    });

    it('选中画板后子元素也计入 selected scope', () => {
      const child = makeItem('child');
      const frame = makeItem('画板', [child])

    ;(frame as unknown as { getComponent: (component: unknown) => unknown }).getComponent =
      component => component === FrameComponent ? {} : undefined;
      const selection = makeSelectionWithItems([frame]);

      selection.setSelectedIds(['画板']);
      chai.spy.on(selection, 'hitTest', () => (['raw-child']));
      chai.spy.on(selection, 'filterSelectedItems', () => (['child']));

      expect(selection.createHitSnapshot(new Vector2()).selectedScopeHitIds).to.deep.equal(['child']);
    });

    it('选中 group 时保持外层目标，选中 child 后聚焦父组', () => {
      const child = makeItem('child');
      const group = makeItem('group', [child]);
      const selection = makeSelectionWithItems([group]);

      selection.addSelectedItem('group');

      const hitIds = ['child'];

      chai.spy.on(selection, 'hitTest', () => (hitIds));
      expect(selection.filterSelectedItems(hitIds)[0]).to.equal('group');
      expect(selection.resolveHoverTarget(new Vector2())).to.equal('group');
      expect(selection.getFocusedGroupId()).to.equal(undefined);

      selection.clear();
      selection.addSelectedItem('child');

      expect(selection.getFocusedGroupId()).to.equal('group');
      expect(selection.filterSelectedItems(hitIds)[0]).to.equal('child');
      expect(selection.resolveHoverTarget(new Vector2())).to.equal('child');
    });

    it('嵌套 group 只在当前焦点容器内解析命中', () => {
    // 公网 group(G1) > group(G1) > 叶子 e：对 G2 再次 group 得到两层嵌套。
      const e = makeItem('e');
      const g1 = makeItem('G1', [e]);
      const g2 = makeItem('G2', [g1]);
      const selection = makeSelectionWithItems([g2]);

      selection.addSelectedItem('G1');
      expect(selection.getFocusedGroupId()).to.equal('G2');

      chai.spy.on(selection, 'hitTest', () => (['e']));

      expect(selection.filterSelectedItems(['e'])).to.deep.equal(['G1']);
      expect(selection.resolveHoverTarget(new Vector2())).to.equal('G1');
    });

    it('光标下无已选元素时快照没有 selected scope hit', () => {
      const selection = makeSelection();

      selection.setSelectedIds(['other']); // 已选在别处，不在光标下
      chai.spy.on(selection, 'hitTest', () => (['raw-upper']));
      chai.spy.on(selection, 'filterSelectedItems', () => (['upper'])); // 光标下仅未选 upper

      expect(selection.createHitSnapshot(new Vector2())).to.deep.include({
        topmostId: 'upper',
        selectedScopeHitIds: [],
      });
      expect(selection.getSelectedIds()).to.deep.equal(['other']);
    });

    it('深入选择子元素时移除所有已选祖先并保留无关节点', () => {
      const child = makeItem('child');
      const innerGroup = makeItem('inner-group', [child]);
      const outerGroup = makeItem('outer-group', [innerGroup]);
      const sibling = makeItem('sibling');
      const selection = makeSelectionWithItems([outerGroup, sibling]);

      selection.commitSelectedItems(['outer-group', 'sibling']);
      selection.addSelectedItems(['child']);

      expect(selection.getSelectedIds()).to.deep.equal(['sibling', 'child']);
    });

    it('选择外层 Group 时移除所有已选后代', () => {
      const child = makeItem('child');
      const innerGroup = makeItem('inner-group', [child]);
      const outerGroup = makeItem('outer-group', [innerGroup]);
      const sibling = makeItem('sibling');
      const selection = makeSelectionWithItems([outerGroup, sibling]);

      selection.commitSelectedItems(['child', 'sibling', 'outer-group']);

      expect(selection.getSelectedIds()).to.deep.equal(['sibling', 'outer-group']);
    });

    it('程序化替换选区同样维持父子互斥，后加入目标胜出', () => {
      const child = makeItem('child');
      const group = makeItem('group', [child]);
      const selection = makeSelectionWithItems([group]);

      selection.setSelectedIds(['group', 'child']);
      expect(selection.getSelectedIds()).to.deep.equal(['child']);

      selection.setSelectedItems(['child', 'group']);
      expect(selection.getSelectedIds()).to.deep.equal(['group']);
    });

    it('Effects 运行时后代始终归并到 Effects 容器', () => {
      const child = makeItem('effect-child');
      const compositionChild = makeItem('effect-composition', [child]);

      compositionChild.type = spec.ItemType.composition;
      const effects = makeItem('effects', [compositionChild]);

      effects.name = '特效'
      ;(effects as unknown as { getComponent: () => unknown }).getComponent = () => ({});
      const selection = makeSelectionWithItems([effects]);

      expect(selection.filterSelectedItems(['effect-child'])).to.deep.equal(['effects']);
    });

    it('EffectsEditMode 只放开当前特效的内部层级', () => {
      const child = makeItem('effect-child');
      const group = makeItem('effect-group', [child]);
      const compositionChild = makeItem('effect-composition', [group]);

      compositionChild.type = spec.ItemType.composition;
      const effects = makeItem('effects', [compositionChild]);

      effects.name = '特效'
      ;(effects as unknown as { getComponent: () => unknown }).getComponent = () => ({});

      const otherChild = makeItem('other-child');
      const otherComposition = makeItem('other-composition', [otherChild]);

      otherComposition.type = spec.ItemType.composition;
      const otherEffects = makeItem('other-effects', [otherComposition]);

      otherEffects.name = '特效'
      ;(otherEffects as unknown as { getComponent: () => unknown }).getComponent = () => ({});

      const selection = makeSelectionWithItems([effects, otherEffects]);

      selection.enterEffectsEditScope('effects');

      // 首次点击深层子元素仍遵循 Group 层级，先选中组；再次点击可下钻一层。
      expect(selection.filterSelectedItems(['effect-child'])).to.deep.equal(['effect-group']);
      selection.commitSelectedItems(['effect-group']);
      chai.spy.on(selection, 'hitTest', () => (['effect-child']));
      expect(selection.createHitSnapshot(new Vector2())).to.deep.include({
        topmostId: 'effect-group',
        drillTargetId: 'effect-child',
      });

      selection.commitSelectedItems(['effect-child']);
      expect(selection.getFocusedGroupId()).to.equal('effect-group');
      expect(selection.filterSelectedItems(['effect-child'])).to.deep.equal(['effect-child']);

      // 当前容器本身、其他特效及特效外部元素都不属于内部编辑范围。
      expect(selection.filterSelectedItems(['effects'])).to.deep.equal([]);
      expect(selection.filterSelectedItems(['other-child'])).to.deep.equal([]);

      selection.leaveEffectsEditScope();
      expect(selection.filterSelectedItems(['effect-child'])).to.deep.equal(['effects']);
    });

    it('Effects 子节点 parentId 缺失时仍沿运行时 parent 链保持子元素可交互', () => {
      const child = makeItem('effect-child');
      const emptyNode = makeItem('effect-empty-node', [child]);
      const compositionChild = makeItem('effect-composition', [emptyNode]);

      compositionChild.type = spec.ItemType.composition;
      const effects = makeItem('effects', [compositionChild]);

      effects.name = '特效'
      ;(effects as unknown as { getComponent: () => unknown }).getComponent = () => ({})

      // Effects 子预合成运行时可能只有 parent 对象关系，没有可用于实例查找的 parentId。
      ;(child as VFXItem & { parentId?: string }).parentId = '';
      const selection = makeSelectionWithItems([effects]);

      selection.enterEffectsEditScope('effects');
      selection.commitSelectedItems(['effect-child']);

      expect(selection.getFocusedGroupId()).to.equal('effect-empty-node');
      expect(selection.filterSelectedItems(['effect-child'])).to.deep.equal(['effect-child']);
    });

    it('框选候选随 EffectsEditMode 在容器与内部元素之间切换', () => {
      const child = makeItem('effect-child');
      const compositionChild = makeItem('effect-composition', [child]);

      compositionChild.type = spec.ItemType.composition;
      const effects = makeItem('effects', [compositionChild]);

      effects.name = '特效'
      ;(effects as unknown as { getComponent: () => unknown }).getComponent = () => ({});
      const outside = makeItem('outside');
      const selection = makeSelectionWithItems([effects, outside]);

      expect(selection.resolveMarqueeSelectableItem(child)).to.equal(effects);
      selection.enterEffectsEditScope('effects');
      expect(selection.resolveMarqueeSelectableItem(child)).to.equal(child);
      expect(selection.resolveMarqueeSelectableItem(effects)).to.equal(undefined);
      expect(selection.resolveMarqueeSelectableItem(outside)).to.equal(undefined);
    });
  });

  describe('Selection.ignoreNames - 按名称忽略交互', () => {
  /** 顶层元素（无 parent），getFinalSelectedId 直接返回其自身 id，便于独立验名称过滤 */
    function namedItem (id: string, name: string): VFXItem {
      return Object.assign(makeItem(id), { name });
    }

    it('命中 ignoreNames 的元素被排除，未命中元素保留（按 name 而非 id 匹配，name≠id 证明确按名）', () => {
      const ignoreMe = namedItem('A', 'bg-decor'); // id=A、name=bg-decor
      const normal = namedItem('B', 'text-1');
      const selection = makeSelectionWithItems([ignoreMe, normal]);

      selection.setIgnoreNames(['bg-decor']);

      // 'A' 的 name 命中名单 → 排除；'B' 保留
      expect(selection.filterSelectedItems(['A', 'B'])).to.deep.equal(['B']);
    });

    it('ignoreNames 为空时不过滤（空名单短路，行为与既有忽略机制一致）', () => {
      const ignoreMe = namedItem('A', 'bg-decor');
      const selection = makeSelectionWithItems([ignoreMe]);

      expect(selection.ignoreNames).to.deep.equal([]);

      expect(selection.filterSelectedItems(['A'])).to.deep.equal(['A']);
    });

    it('addIgnoreNames/deleteIgnoreNames 增删名单，影响后续过滤', () => {
      const ignoreMe = namedItem('A', 'bg-decor');
      const selection = makeSelectionWithItems([ignoreMe]);

      expect(selection.filterSelectedItems(['A'])).to.deep.equal(['A']);

      selection.addIgnoreNames(['bg-decor']);
      expect(selection.filterSelectedItems(['A'])).to.deep.equal([]);

      selection.deleteIgnoreNames(['bg-decor']);
      expect(selection.filterSelectedItems(['A'])).to.deep.equal(['A']);
    });

    it('setIgnoreNames 覆盖式重置名单', () => {
      const a = namedItem('A', 'bg-decor');
      const b = namedItem('B', 'mask-decor');
      const selection = makeSelectionWithItems([a, b]);

      selection.setIgnoreNames(['bg-decor']);
      expect(selection.filterSelectedItems(['A', 'B'])).to.deep.equal(['B']);

      selection.setIgnoreNames(['mask-decor']); // 覆盖：旧名不再忽略
      expect(selection.filterSelectedItems(['A', 'B'])).to.deep.equal(['A']);
    });

    /**
   * 回归：SceneArtis createMaskScene 把原合成作为预合成 item 挂到「主合成蒙版」(null+Frame,
   * name='主合成蒙版'≠'画板'，故 isFramePlayerItem 判 false) 下；player 加载的就是 maskScene，
   * 所以普通元素的祖先链 sceneRoot > 蒙版 > 合成item > 元素。getFinalSelectedId 上溯父链时，
   * 元素/合成item 都非 frame 且其 parent.name 非 sceneRoot，一路上溯到蒙版才因蒙版.parent==='sceneRoot'
   * 停在「蒙版自己」。一旦蒙版名进入 ignoreNames，所有普通元素的 finalSelectedId 被解析为蒙版
   * → 全部被 isIgnoredNameById 误伤 → 合成中元素不能选中。
   *
   * 现有 harness makeItem 不带 FrameComponent，isFramePlayerItem 对所有项恒 false，恰好复现
   * 「蒙版非画板」的行为，故直接复用。
   */
    it('回归：忽略「主合成蒙版」不应误伤挂在其子树下的普通元素（祖先链上溯不能停在忽略名节点）', () => {
    // treeRoot(sceneRoot, name='sceneRoot') > mask('主合成蒙版') > leaf('text-1')
      const leaf = makeItem('leaf');
      const mask = makeItem('mask', [leaf]);
      const sceneRoot = makeItem('sceneRoot', [mask]);

      // 覆写名字（makeItem 默认 name=id）
      sceneRoot.name = 'sceneRoot';
      mask.name = '主合成蒙版';
      leaf.name = 'text-1';

      const selection = makeSelectionWithItems([sceneRoot]);

      selection.setIgnoreNames(['主合成蒙版']);

      // 期望：leaf 仍可被选中（finalSelectedId 应是 leaf，不应上溯到被忽略的 mask）
      expect(selection.filterSelectedItems(['leaf'])).to.deep.equal(['leaf']);
    });

    it('对照：直接点中被忽略容器本身 → 仍被排除（回退到自身后由 final 过滤挡掉，蒙版不被选入）', () => {
      const leaf = makeItem('leaf');
      const mask = makeItem('mask', [leaf]);
      const sceneRoot = makeItem('sceneRoot', [mask]);

      sceneRoot.name = 'sceneRoot';
      mask.name = '主合成蒙版';
      leaf.name = 'text-1';

      const selection = makeSelectionWithItems([sceneRoot]);

      selection.setIgnoreNames(['主合成蒙版']);

      // 直接命中蒙版（origin===final）→ 回退到自身 → isIgnoredNameById 排除 → 不被选入
      expect(selection.filterSelectedItems(['mask'])).to.deep.equal([]);
    });

    it('对照：非忽略名容器（普通画板 name）的子项仍按既有归并语义上提到画板（回退仅对 ignoreNames 命中生效）', () => {
    // 普通画板：makeItem 默认 type=null，但 isFramePlayerItem 还要求 name==='画板' 且有 FrameComponent。
    // 本 harness makeItem 不带 FrameComponent → isFramePlayerItem 恒 false，final 会按 sceneRoot 之子停在画板自己。
    // 用 name='画板' 的容器模拟「sceneRoot 之子」（getFinalSelectedId 在 parent.name==='sceneRoot' 时返回自己），
    // 验证：即使画板名不在 ignoreNames，子项也会归并到画板（既有语义不因本次回退而改变）。
      const child = makeItem('child');
      const board = makeItem('board', [child]);
      const sceneRoot = makeItem('sceneRoot', [board]);

      sceneRoot.name = 'sceneRoot';
      board.name = '画板';
      child.name = 'text-1';

      const selection = makeSelectionWithItems([sceneRoot]);

      // board 名不在 ignoreNames → 不触发回退 → child 归并到 board（既有上提语义保留）
      expect(selection.filterSelectedItems(['child'])).to.deep.equal(['board']);
    });
  });
});
