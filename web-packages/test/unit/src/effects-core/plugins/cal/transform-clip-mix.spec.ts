import type { Composition, TimelineInstance } from '@galacean/effects';
import { CompositionComponent, Player, spec, TransformMixerPlayable } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

/**
 * Transform clip 绝对属性混合单测。
 *
 * 覆盖：
 * - 旧数据在迁移后保持单 clip 的表现
 * - 多 clip 按有效通道归一化混合，未参与动画的轴保留当前值
 * - 零权重与未激活 clip 分开处理，退出后保留最后写回的 transform
 */
describe('core/plugins/calculate/transform-clip-mix', () => {
  const canvas = document.createElement('canvas');
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas, manualRender: true });
  });

  afterEach(() => {
    player.dispose();
    // @ts-expect-error 测试清理
    player = null;
  });

  // 构造一个绑定到 sprite 的 timeline，单条 TransformTrack 下挂载传入的 clip 列表
  const buildScene = (
    clips: {
      assetId: string, asset: Record<string, unknown>, start?: number, duration?: number,
      endBehavior?: number,
    }[],
    spritePosition = { x: 0, y: 0, z: 0 },
    spriteScale = { x: 1, y: 1, z: 1 },
  ) => {
    const transformTrack = {
      id: 'transform_track_1',
      dataType: 'TransformTrack',
      children: [],
      clips: clips.map(clip => ({
        start: clip.start ?? 0,
        duration: clip.duration ?? 5,
        endBehavior: clip.endBehavior ?? 4,
        asset: { id: clip.assetId },
      })),
    };
    const assetNodes = clips.map(clip => ({
      id: clip.assetId,
      dataType: 'TransformPlayableAsset',
      ...clip.asset,
    }));

    return {
      playerVersion: { web: '2.8.11', native: '0.0.1.202311221223' },
      fonts: [],
      version: '3.6',
      plugins: [],
      type: 'ge',
      compositions: [
        {
          id: 'comp_1',
          name: 'transform-clip-mix',
          duration: 5,
          startTime: 0,
          endBehavior: 4,
          camera: { fov: 60, far: 40, near: 0.1, clipMode: 1, position: [0, 0, 8], rotation: [0, 0, 0] },
          components: [{ id: 'comp_component_1' }],
          children: [{ id: 'sprite_1' }],
        },
      ],
      components: [
        {
          id: 'comp_component_1',
          item: { id: 'comp_1' },
          dataType: 'CompositionComponent',
          items: [{ id: 'sprite_1' }],
          timelineAsset: { id: 'timeline_1' },
          sceneBindings: [{ key: { id: 'obt_1' }, value: { id: 'sprite_1' } }],
        },
        {
          id: 'sprite_component_1',
          item: { id: 'sprite_1' },
          dataType: 'SpriteComponent',
          options: { startColor: [1, 1, 1, 1] },
          renderer: { renderMode: 1 },
        },
      ],
      geometries: [],
      materials: [],
      items: [
        {
          id: 'sprite_1',
          name: 'sprite_1',
          duration: 5,
          type: '1',
          visible: true,
          endBehavior: 4,
          delay: 0,
          renderLevel: 'B+',
          components: [{ id: 'sprite_component_1' }],
          children: [],
          transform: {
            position: spritePosition,
            eulerHint: { x: 0, y: 0, z: 0 },
            anchor: { x: 0, y: 0 },
            size: { x: 1, y: 1 },
            scale: spriteScale,
          },
          dataType: 'VFXItemData',
        },
      ],
      shaders: [],
      bins: [],
      textures: [],
      images: [],
      animations: [],
      miscs: [
        { id: 'timeline_1', dataType: 'TimelineAsset', tracks: [{ id: 'obt_1' }] },
        { id: 'activation_asset_1', dataType: 'ActivationPlayableAsset' },
        ...assetNodes,
        {
          id: 'activation_track_1',
          dataType: 'ActivationTrack',
          children: [],
          clips: [{ start: 0, duration: 5, endBehavior: 4, asset: { id: 'activation_asset_1' } }],
        },
        transformTrack,
        {
          id: 'obt_1',
          dataType: 'ObjectBindingTrack',
          children: [{ id: 'activation_track_1' }, { id: 'transform_track_1' }],
          clips: [],
        },
      ],
      compositionId: 'comp_1',
    };
  };
  const path = (end: number) => ({
    path: [
      22,
      [
        [[4, [0, 0]], [4, [0.612, 1]]],
        [[0, 0, 0], [end, 0, 0]],
        [[end / 3, 0, 0], [(end / 3) * 2, 0, 0]],
      ],
    ],
  });

  const getTimeline = (comp: Composition): TimelineInstance => {
    const component = comp.sceneRoot.getComponent(CompositionComponent);

    return (component as unknown as { timelineInstance: TimelineInstance }).timelineInstance;
  };
  const evaluateMixer = (comp: Composition, weights: number[]) => {
    const timeline = getTimeline(comp);
    const mixer = timeline.tracks.find(track => track instanceof TransformMixerPlayable)!;
    const segmentId = mixer.getSegments().findIndex(segment => comp.time >= segment.start && comp.time < segment.end);

    weights.forEach((weight, index) => mixer.setClipWeight(index, weight));
    mixer.evaluate(segmentId, timeline.getBoundObject(mixer.objectBindingId), { time: comp.time, deltaTime: 0 });
  };

  it('单 clip scale 归一化低权重，退出后重新捕获零权重混合初值', async () => {
    const scene = buildScene(
      [{
        assetId: 'asset_scale', asset: { positionOverLifetime: {}, sizeOverLifetime: { size: 2 } },
        start: 1, duration: 1, endBehavior: spec.EndBehavior.destroy,
      }],
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 5 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sprite.transform.scale.toArray()).to.deep.equals([3, 4, 5]);
    sprite.transform.setScale(10, 20, 30);

    comp.gotoAndStop(1.5);
    // 绝对曲线仍由序列化数据迁移，动画 Z 保留旧数据使用初始 X scale 的规则。
    expect(sanitizeNumbers(sprite.transform.scale.toArray())).to.deep.equals([6, 8, 6]);
    evaluateMixer(comp, [0.5]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([6, 8, 6]);
    evaluateMixer(comp, [0.5]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([6, 8, 6]);

    sprite.transform.setPosition(7, 8, 9);
    sprite.transform.setRotation(0, 0, 45);
    evaluateMixer(comp, [0]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([6, 8, 6]);
    expect(sprite.transform.position.toArray()).to.deep.equals([7, 8, 9]);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
    sprite.transform.setScale(30, 40, 50);
    evaluateMixer(comp, [0]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([6, 8, 6]);
    const component = comp.sceneRoot.getComponent(CompositionComponent);
    const mixer = getTimeline(comp).tracks.find(track => track instanceof TransformMixerPlayable)!;
    const evaluate = mixer.evaluate.bind(mixer);

    mixer.evaluate = (segmentId, item, context) => {
      mixer.setClipWeight(0, 0);
      evaluate(segmentId, item, context);
    };

    component.stop();
    expect(sprite.transform.scale.toArray()).to.deep.equals([6, 8, 6]);
    sprite.transform.setScale(30, 40, 50);
    component.setTime(1.5);
    expect(sprite.transform.scale.toArray()).to.deep.equals([30, 40, 50]);

    sprite.transform.setScale(60, 70, 80);
    component.setTime(1.75);
    expect(sprite.transform.scale.toArray()).to.deep.equals([30, 40, 50]);
    component.setTime(2.5);
    expect(sprite.transform.scale.toArray()).to.deep.equals([30, 40, 50]);
    sprite.transform.setScale(60, 70, 80);
    component.setTime(1.5);
    expect(sprite.transform.scale.toArray()).to.deep.equals([60, 70, 80]);
    component.stop();
    expect(sprite.transform.scale.toArray()).to.deep.equals([60, 70, 80]);
  });

  it('多 clip scale 混合绝对值', async () => {
    const scene = buildScene(
      [
        { assetId: 'asset_s1', asset: { positionOverLifetime: {}, sizeOverLifetime: { size: 2 } } },
        { assetId: 'asset_s2', asset: { positionOverLifetime: {}, sizeOverLifetime: { size: 0.5 } } },
      ],
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 4, z: 4 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    // 迁移后的绝对曲线分别为 8 和 2，等权混合得到 5。
    expect(sanitizeNumbers(sprite.transform.scale.toArray())).to.deep.equals([5, 5, 5]);
    evaluateMixer(comp, [0.25, 0.25]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([5, 5, 5]);
    evaluateMixer(comp, [2, 2]);
    expect(sprite.transform.scale.toArray()).to.deep.equals([5, 5, 5]);
  });

  it('多 clip rotation 按轴混合绝对 Euler 值，退出后保留结束结果', async () => {
    const scene = buildScene([
      {
        assetId: 'asset_r1', duration: 1, endBehavior: spec.EndBehavior.destroy,
        asset: { rotationOverLifetime: { asRotation: true, z: 40 } },
      },
      {
        assetId: 'asset_r2', duration: 1, endBehavior: spec.EndBehavior.destroy,
        asset: { rotationOverLifetime: { asRotation: true, z: 70 } },
      },
    ]);

    // 绝对曲线只包含 Z，缺失的 X/Y 通道不参与混合。
    scene.version = '3.9';
    scene.items[0].transform.eulerHint.x = 15;
    scene.items[0].transform.eulerHint.y = 20;
    scene.items[0].transform.eulerHint.z = 10;
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sprite.transform.rotation.x).to.equal(15);
    expect(sprite.transform.rotation.y).to.equal(20);
    expect(sprite.transform.rotation.z).to.be.closeTo(55, 1e-5);
    sprite.transform.setRotation(25, 35, sprite.transform.rotation.z);
    evaluateMixer(comp, [0.25, 0.25]);
    expect(sprite.transform.rotation.x).to.equal(25);
    expect(sprite.transform.rotation.y).to.equal(35);
    expect(sprite.transform.rotation.z).to.be.closeTo(55, 1e-5);
    comp.gotoAndStop(1.5);
    comp.sceneRoot.getComponent(CompositionComponent).stop();
    expect(sprite.transform.rotation.z).to.be.closeTo(55, 1e-5);
    sprite.transform.setRotation(15, 20, 80);
    comp.gotoAndStop(2);
    expect(sprite.transform.rotation.z).to.equal(80);
  });

  it('多 clip position 混合常量和分段绝对路径', async () => {
    const scene = buildScene(
      [
        { assetId: 'asset_p1', asset: { positionOverLifetime: { path: [spec.ValueType.CONSTANT_VEC3, [5, 2, 0]] } } },
        {
          assetId: 'asset_p2',
          asset: { positionOverLifetime: { path: [spec.ValueType.LINEAR_PATH, [
            [[0, 0, 1, 1], [0.612, 1, 1, 1]],
            [[1, 2, 0], [-3, 2, 0]],
          ]] } },
        },
      ],
      { x: 1, y: 2, z: 0 },
    );

    scene.version = '3.9';
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(4);
    // 常量路径与分段路径等权混合，得到位置 (1,2,0)。
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(1, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
    evaluateMixer(comp, [0.25, 0.5]);
    // 绝对位置 5 和 -3，按总权重 0.75 归一化。
    expect(pos.x).to.be.closeTo(-1 / 3, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
  });

  it('clip 退出后保留最后写回的 position，重新激活时继续采样绝对曲线', async () => {
    const scene = buildScene(
      [{ assetId: 'asset_p', asset: { positionOverLifetime: path(4) }, duration: 1, endBehavior: spec.EndBehavior.destroy }],
      { x: 1, y: 2, z: 0 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sprite.transform.position.x).to.not.closeTo(1, 1e-5);
    const previous = sprite.transform.position.toArray();

    comp.gotoAndStop(1.5);
    const pos = sprite.transform.position;

    expect(pos.toArray()).to.deep.equal(previous);
    sprite.transform.setPosition(7, 8, 9);
    comp.gotoAndStop(1.75);
    expect(pos.toArray()).to.deep.equal([7, 8, 9]);
    comp.gotoAndStop(0.5);
    expect(pos.toArray()).to.deep.equal(previous);
    comp.gotoAndStop(1.5);
    expect(pos.toArray()).to.deep.equal(previous);

    const component = comp.sceneRoot.getComponent(CompositionComponent);

    component.stop();
    sprite.setActive(false);
    component.setTime(0.5);
    expect(sprite.isActive).to.be.true;
    expect(pos.toArray()).to.deep.equal(previous);
    component.stop();
    expect(sprite.isActive).to.be.false;
    expect(pos.toArray()).to.deep.equal(previous);
  });

  it('各通道独立归一化，position clip 退出后保留当前值而 rotation 继续采样', async () => {
    const scene = buildScene(
      [
        { assetId: 'asset_p', asset: { positionOverLifetime: path(4) }, duration: 1, endBehavior: spec.EndBehavior.destroy },
        { assetId: 'asset_r', asset: { positionOverLifetime: {}, rotationOverLifetime: { asRotation: true, z: 45 } }, duration: 5 },
      ],
      { x: 1, y: 2, z: 0 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sprite.transform.position.x).to.not.closeTo(1, 1e-5);
    const fullPosition = sprite.transform.position.x;

    evaluateMixer(comp, [0.25, 0.5]);
    expect(sprite.transform.position.x).to.be.closeTo(fullPosition, 1e-5);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);

    comp.gotoAndStop(1.5);
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(fullPosition, 1e-5);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
    sprite.transform.setPosition(20, 30, 40);
    comp.gotoAndStop(2);
    expect(pos.toArray()).to.deep.equal([20, 30, 40]);
    comp.sceneRoot.getComponent(CompositionComponent).stop();
    expect(pos.toArray()).to.deep.equal([20, 30, 40]);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
  });
});
