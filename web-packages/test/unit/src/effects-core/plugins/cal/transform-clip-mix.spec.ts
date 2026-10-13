import { Player, spec } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

/**
 * Transform clip 绝对属性混合单测。
 *
 * 覆盖：
 * - 旧数据在迁移后保持单 clip 的表现
 * - 多 clip 按各自提供的属性归一化加权混合
 * - 无有效 clip 时保留当前 transform
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
    clips: { assetId: string, asset: Record<string, unknown>, start?: number, duration?: number, endBehavior?: number }[],
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

  it('单 clip scale 与直写一致（base × 常量乘子）', async () => {
    const scene = buildScene(
      [{ assetId: 'asset_scale', asset: { positionOverLifetime: {}, sizeOverLifetime: { size: 2 } } }],
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 3, z: 3 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    // base.scale(3,3,3) × 2 → (6,6,6)；z 取 x，仍是 6
    expect(sanitizeNumbers(sprite.transform.scale.toArray())).to.deep.equals([6, 6, 6]);
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
  });

  it('多 clip rotation 混合绝对 Euler 值', async () => {
    const scene = buildScene([
      { assetId: 'asset_r1', asset: { positionOverLifetime: {}, rotationOverLifetime: { asRotation: true, z: 30 } } },
      { assetId: 'asset_r2', asset: { positionOverLifetime: {}, rotationOverLifetime: { asRotation: true, z: 60 } } },
    ]);
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
  });

  it('多 clip position 混合对称的绝对曲线', async () => {
    const scene = buildScene(
      [
        { assetId: 'asset_p1', asset: { positionOverLifetime: path(4) } },
        { assetId: 'asset_p2', asset: { positionOverLifetime: path(-4) } },
      ],
      { x: 1, y: 2, z: 0 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(2.5);
    // 两条对称的绝对位置曲线等权混合，得到初始位置 (1,2,0)。
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(1, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
  });

  it('clip 结束后保留当前 position', async () => {
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
  });

  it('position clip 结束后保留 position，rotation clip 继续生效', async () => {
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
    const previous = sprite.transform.position.toArray();

    comp.gotoAndStop(1.5);
    const pos = sprite.transform.position;

    expect(pos.toArray()).to.deep.equal(previous);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
  });
});
