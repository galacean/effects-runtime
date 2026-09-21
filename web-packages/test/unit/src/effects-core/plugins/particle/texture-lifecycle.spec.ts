import { Player, ParticleSystemRenderer, Texture, createValueGetter, math } from '@galacean/effects';
import type { ParticleMeshProps } from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/particle/texture-lifecycle', () => {
  let player: Player;
  let renderer: ParticleSystemRenderer;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
    renderer = new ParticleSystemRenderer(player.engine);
  });

  afterEach(() => {
    renderer.disposeMeshes();
    player.dispose();
  });

  function setup (color: NonNullable<ParticleMeshProps['colorOverLifetime']>['color'], texture?: Texture) {
    const gradient: [number, number, number, number, number][] = [[0, 255, 255, 255, 1], [1, 255, 255, 255, 0]];

    renderer.setup({
      name: 'texture-lifecycle',
      shaderCachePrefix: '',
      side: 0,
      maxCount: 1,
      anchor: new math.Vector2(),
      gravityModifier: createValueGetter(1),
      sizeOverLifetime: { x: createValueGetter(1) },
      colorOverLifetime: { color },
      diffuse: texture,
    }, {
      name: 'texture-lifecycle-trail',
      shaderCachePrefix: '',
      maxTrailCount: 1,
      pointCountPerTrail: 2,
      minimumVertexDistance: 0.01,
      blending: 0,
      widthOverTrail: createValueGetter(1),
      opacityOverLifetime: createValueGetter(1),
      lifetime: createValueGetter(1),
      occlusion: false,
      transparentOcclusion: false,
      colorOverLifetime: gradient,
      colorOverTrail: gradient,
      texture,
    });
  }

  it('releases particle and trail gradients and default textures exactly once', () => {
    setup([[0, 255, 255, 255, 1], [1, 255, 255, 255, 0]]);
    const textures = renderer.getTextures();
    const disposals = new Map<Texture, number>();

    expect(textures).to.have.length(5);
    for (const texture of textures) {
      texture.initialize();
      const dispose = texture.dispose.bind(texture);

      texture.dispose = () => {
        disposals.set(texture, (disposals.get(texture) ?? 0) + 1);
        dispose();
      };
    }
    renderer.disposeMeshes();
    renderer.onDestroy();
    for (const texture of textures) {
      expect(texture.isDestroyed).to.equal(true);
      expect(disposals.get(texture)).to.equal(1);
    }
  });

  it('preserves external textures shared by particle and trail materials', () => {
    const shared = Texture.createWithData(player.engine);

    shared.initialize();
    setup(shared, shared);
    const owned = renderer.getTextures().filter(texture => texture !== shared);

    renderer.onDestroy();
    expect(shared.isDestroyed).to.equal(false);
    expect(owned).to.have.length(2);
    owned.forEach(texture => expect(texture.isDestroyed).to.equal(true));
    shared.dispose();
  });

  it('owns solid color textures created from particle data', () => {
    setup(new Uint8Array([255, 0, 0, 255]));
    const texture = renderer.particleMesh.mesh.material.getTexture('uColorOverLifetime')!;

    texture.initialize();
    expect(texture.getWidth()).to.equal(1);
    expect(texture.getHeight()).to.equal(1);
    renderer.disposeMeshes();
    expect(texture.isDestroyed).to.equal(true);
  });
});
