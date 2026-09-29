import type { Region } from '@galacean/effects';
import { CompositionComponent, generateGUID, HitTestType, math, Player, spec, VFXItem } from '@galacean/effects';

const { expect } = chai;
const { Ray, Vector3 } = math;

/**
 * 预合成相关行为由 CompositionComponent 驱动，元素 type 仅作为元数据保留，
 * 运行时不再依赖它分支。
 */
describe('core/composition/composition-component', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  beforeEach(() => {
    player.destroyCurrentCompositions();
  });

  it('命中子元素时，带 CompositionComponent 的元素冒泡自身 region（不依赖 type）', async () => {
    const composition = await loadEmptyScene();
    const { parent } = createHitTree(composition.sceneRoot);
    const regions: Region[] = [];
    const ray = new Ray(new Vector3(0, 0, 8), new Vector3(0, 0, -1));

    parent.addComponent(CompositionComponent);

    const hit = parent.hitTest(ray, 0, 0, regions, [], true);

    expect(parent.type).to.eql(spec.ItemType.base, 'type 未设置为 composition');
    expect(hit).to.be.true;
    expect(regions.map(region => region.name)).to.deep.equal(['child', 'parent']);
  });

  it('不带 CompositionComponent 的元素命中子元素时不冒泡 region', async () => {
    const composition = await loadEmptyScene();
    const { parent } = createHitTree(composition.sceneRoot);
    const regions: Region[] = [];
    const ray = new Ray(new Vector3(0, 0, 8), new Vector3(0, 0, -1));

    const hit = parent.hitTest(ray, 0, 0, regions, [], true);

    expect(hit).to.be.true;
    expect(regions.map(region => region.name)).to.deep.equal(['child']);
  });

  it('收集渲染顺序时不递归进入带 CompositionComponent 的子元素内部（不依赖 type）', async () => {
    const composition = await loadEmptyScene();
    const { parent } = createHitTree(composition.sceneRoot);
    const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);
    const collected: VFXItem[] = [];

    parent.addComponent(CompositionComponent);

    collectChildren(rootComponent, composition.sceneRoot, collected);
    expect(collected.map(item => item.name)).to.deep.equal(['parent']);
  });

  it('收集渲染顺序时递归进入普通子元素内部', async () => {
    const composition = await loadEmptyScene();
    const { parent } = createHitTree(composition.sceneRoot);
    const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);
    const collected: VFXItem[] = [];

    collectChildren(rootComponent, composition.sceneRoot, collected);
    expect(collected.map(item => item.name)).to.deep.equal(['parent', 'child']);
  });

  async function loadEmptyScene () {
    const id = generateGUID();

    return player.loadScene({
      version: '1.5', type: 'mars', compositionId: id,
      compositions: [{
        id, name: 'comp-driven', duration: 2, startTime: 0, endBehavior: spec.EndBehavior.freeze,
        items: [],
      }],
      images: [], textures: [], bins: [], plugins: [], shapes: [],
    }, { autoplay: false });
  }

  /**
   * 构造 parent > child 命中测试树，child 提供一个单位盒包围盒
   */
  function createHitTree (rootParent: VFXItem) {
    const parent = new VFXItem(player.engine);
    const child = new VFXItem(player.engine);

    parent.name = 'parent';
    parent.setParent(rootParent);
    child.name = 'child';
    child.setParent(parent);
    child.getHitTestParams = () => ({
      type: HitTestType.box,
      center: new Vector3(0, 0, 0),
      size: new Vector3(1, 1, 1),
      clipMasks: [],
      behavior: spec.InteractBehavior.NONE,
    });

    return { parent, child };
  }

  /**
   * collectChildren 为私有方法，通过结构断言直接调用以验证递归行为
   */
  function collectChildren (
    component: CompositionComponent,
    item: VFXItem,
    result: VFXItem[],
  ) {
    (component as unknown as {
      collectChildren (item: VFXItem, result: VFXItem[]): void,
    }).collectChildren(item, result);
  }
});