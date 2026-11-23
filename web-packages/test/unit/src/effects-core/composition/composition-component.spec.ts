import type { Region } from '@galacean/effects';
import {
  CompositionComponent, generateGUID, HitTestType, math, ObjectBindingTrack, Player, PlayState,
  RendererComponent, spec, TimelineAsset, VFXItem,
} from '@galacean/effects';

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

  it('仅按主轨道顺序分配渲染顺序，未绑定的元素保持原优先级且不占位', async () => {
    const composition = await loadEmptyScene();
    const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);
    const first = createRenderer(composition.sceneRoot, 'first');
    const unbound = createRenderer(composition.sceneRoot, 'unbound');
    const last = createRenderer(unbound.item, 'last');

    unbound.priority = 42;
    bindItem(rootComponent, last.item);
    bindItem(rootComponent, first.item);

    expect(rootComponent.setChildrenRenderOrder(5)).to.equal(7);
    expect([last.priority, first.priority, unbound.priority]).to.deep.equal([5, 6, 42]);
  });

  for (const imageCount of [1, 3]) {
    it(`根合成暂停时，子合成独立播放保留 ${imageCount} 个图片的全局渲染顺序`, async () => {
      const composition = await loadEmptyScene();
      const tree = createRenderTree(composition.sceneRoot, imageCount);
      const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);

      rootComponent.setTime(0);
      tree.component.speed = 2;
      tree.component.play();
      composition.sceneTicking.update.tick(100);

      expect(rootComponent.state).to.equal(PlayState.Paused);
      expect(rootComponent.getTime()).to.equal(0);
      expect(tree.component.getTime()).to.be.closeTo(0.2, 0.000001);
      expect(tree.background.priority).to.equal(1);
      expect(tree.images.map(image => image.priority)).to.deep.equal(
        Array.from({ length: imageCount }, (_, i) => i + 3),
      );
      expect(tree.after.priority).to.equal(imageCount + 3);
    });
  }

  it('暂停的子合成 seek 立即刷新全场景顺序，包括新增的前置轨道', async () => {
    const composition = await loadEmptyScene();
    const tree = createRenderTree(composition.sceneRoot);
    const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);

    rootComponent.setTime(0);
    const inserted = createRenderer(composition.sceneRoot, 'inserted');

    bindItem(rootComponent, inserted.item, 0);
    tree.component.pause();
    tree.component.setTime(0.5);

    expect(rootComponent.state).to.equal(PlayState.Paused);
    expect(rootComponent.getTime()).to.equal(0);
    expect(tree.component.state).to.equal(PlayState.Paused);
    expect(tree.component.getTime()).to.equal(0.5);
    expect(inserted.priority).to.equal(0);
    expect(tree.background.priority).to.equal(2);
    expect(tree.images[0].priority).to.equal(4);
    expect(tree.after.priority).to.equal(5);
  });

  it('多层子合成独立采样时，背景、图片和后续元素保留全局顺序', async () => {
    const composition = await loadEmptyScene();
    const tree = createRenderTree(composition.sceneRoot);
    const nested = createRenderTree(tree.component.item);
    const rootComponent = composition.sceneRoot.getComponent(CompositionComponent);

    rootComponent.setTime(0);
    tree.component.play();
    nested.component.play();
    composition.sceneTicking.update.tick(100);

    expect(tree.background.priority).to.equal(1);
    expect(tree.images[0].priority).to.equal(3);
    expect(nested.background.priority).to.equal(5);
    expect(nested.images[0].priority).to.equal(7);
    expect(nested.after.priority).to.equal(8);
    expect(tree.after.priority).to.equal(9);
  });

  it('子合成播放和 seek 不覆盖手动设置的 renderOrder', async () => {
    const composition = await loadEmptyScene();
    const tree = createRenderTree(composition.sceneRoot, 2);

    tree.images[0].item.renderOrder = 50;
    tree.component.play();
    composition.sceneTicking.update.tick(100);
    tree.component.setTime(0.5);

    expect(tree.images[0].priority).to.equal(50);
    expect(tree.images[1].priority).to.equal(4);
    expect(tree.after.priority).to.equal(5);
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

  /** 创建含前后兄弟元素的画板层级，并绑定各合成的主轨道。 */
  function createRenderTree (parent: VFXItem, imageCount = 1) {
    const parentComponent = parent.getComponent(CompositionComponent);
    const before = createRenderer(parent, 'before');
    const background = createRenderer(parent, 'frame');
    const compositionItem = new VFXItem(player.engine);

    compositionItem.name = 'frame-composition';
    compositionItem.duration = 2;
    compositionItem.setParent(background.item);
    const component = compositionItem.addComponent(CompositionComponent);
    const timeline = new TimelineAsset(player.engine);

    component.fromData({
      id: component.getInstanceId(),
      dataType: spec.DataType.CompositionComponent,
      item: { id: compositionItem.getInstanceId() },
      sceneBindings: [],
      timelineAsset: { id: timeline.getInstanceId() },
    });
    const images = Array.from({ length: imageCount }, (_, i) => createRenderer(compositionItem, `image-${i}`));
    const after = createRenderer(parent, 'after');

    for (const item of [before.item, background.item, compositionItem, after.item]) {
      bindItem(parentComponent, item);
    }
    for (const image of images) {
      bindItem(component, image.item);
    }

    return { component, background, images, after };
  }

  function createRenderer (parent: VFXItem, name: string) {
    const item = new VFXItem(player.engine);

    item.name = name;
    item.setParent(parent);

    return item.addComponent(RendererComponent);
  }

  function bindItem (component: CompositionComponent, item: VFXItem, index?: number) {
    const timeline = component.timelineAsset!;
    const track = new ObjectBindingTrack(player.engine);

    timeline.tracks.splice(index ?? timeline.tracks.length, 0, track);
    timeline.markAsChanged();
    component.setBinding(track, item);
  }
});
