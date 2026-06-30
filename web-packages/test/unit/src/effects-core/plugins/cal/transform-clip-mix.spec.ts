import { Player, spec } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

/**
 * Transform clip 叠加（additive）单测。
 *
 * 覆盖：
 * - 单 clip：行为与直写一致（base + delta）
 * - 多 clip scale：乘子连乘 base × c1 × c2
 * - 多 clip rotation：Euler 逐分量加权累加
 * - 多 clip position：两段反向位移叠加后抵消回到 base
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

  it('多 clip scale 乘子连乘（base × c1 × c2）', async () => {
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
    // base.scale(4) × 2 × 0.5 = 4
    expect(sanitizeNumbers(sprite.transform.scale.toArray())).to.deep.equals([4, 4, 4]);
  });

  it('多 clip rotation 逐分量加权累加（base + r1 + r2）', async () => {
    const scene = buildScene([
      { assetId: 'asset_r1', asset: { positionOverLifetime: {}, rotationOverLifetime: { asRotation: true, z: 30 } } },
      { assetId: 'asset_r2', asset: { positionOverLifetime: {}, rotationOverLifetime: { asRotation: true, z: 60 } } },
    ]);
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    // base z=0，两段 clip z 增量 30 + 60 = 90
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 90]);
  });

  it('多 clip position 反向位移叠加后抵消回到 base', async () => {
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
    // +4 与 -4 的 X 位移抵消，停在 base position (1,2,0)
    // 浮点累加 (base + d) - d 存在 ULP 级误差，用容差断言
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(1, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
  });

  it('clip 结束后恢复被 mixer 写过的 position', async () => {
    const scene = buildScene(
      [{ assetId: 'asset_p', asset: { positionOverLifetime: path(4) }, duration: 1, endBehavior: spec.EndBehavior.destroy }],
      { x: 1, y: 2, z: 0 },
    );
    const comp = await player.loadScene(scene as any);
    const sprite = comp.getItemByName('sprite_1')!;

    comp.gotoAndStop(0.5);
    expect(sprite.transform.position.x).to.not.closeTo(1, 1e-5);

    comp.gotoAndStop(1.5);
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(1, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
  });

  it('position clip 结束但 rotation clip 仍生效时恢复 position', async () => {
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

    comp.gotoAndStop(1.5);
    const pos = sprite.transform.position;

    expect(pos.x).to.be.closeTo(1, 1e-5);
    expect(pos.y).to.be.closeTo(2, 1e-5);
    expect(pos.z).to.be.closeTo(0, 1e-5);
    expect(sanitizeNumbers(sprite.transform.rotation.toArray())).to.deep.equals([0, 0, 45]);
  });
});
