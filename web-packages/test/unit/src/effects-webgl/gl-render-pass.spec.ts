import { Camera, Player, RenderPass, RendererComponent, RenderingData, SceneRendering } from '@galacean/effects';

const { expect } = chai;

describe('webgl/gl-render-pass', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });
  afterEach(() => player.dispose());

  it('uses the currently bound viewport', () => {
    const renderer = player.renderer;
    const pass = new RenderPass(renderer);

    renderer.setViewport(1, 2, 32, 16);
    expect(pass.viewport).deep.equals([1, 2, 32, 16]);
    pass.dispose();
  });

  it('collects stable priority order, reflects changed priorities, and deduplicates registrations', () => {
    const scene = new SceneRendering();
    const meshes = [2, 1, 1, 0].map(priority => {
      const mesh = new RendererComponent(player.engine);

      mesh.priority = priority;
      scene.addRenderer(mesh);

      return mesh;
    });
    const collect = () => {
      const data = new RenderingData({ camera: new Camera('') });

      scene.collect(data);

      return data.renderList.objects;
    };

    scene.addRenderer(meshes[0]);
    expect(collect()).deep.equals([meshes[3], meshes[1], meshes[2], meshes[0]]);
    meshes[0].priority = -1;
    expect(collect()).deep.equals([meshes[0], meshes[3], meshes[1], meshes[2]]);
    scene.removeRenderer(meshes[0]);
    scene.removeRenderer(meshes[0]);
    expect(collect()).deep.equals([meshes[3], meshes[1], meshes[2]]);
    scene.clear();
    expect(collect()).deep.equals([]);
  });

  it('collects extension groups independently of scene objects', () => {
    const scene = new SceneRendering();
    const mesh = new RendererComponent(player.engine);
    const data = new RenderingData();

    scene.addRenderer(mesh, 'gizmo');
    scene.collect(data);
    expect(data.renderList.objects).deep.equals([]);
    expect(data.renderList.groups.get('gizmo')).deep.equals([mesh]);
    scene.removeRenderer(mesh, 'gizmo');
    const next = new RenderingData();

    scene.collect(next);
    expect(next.renderList.groups.has('gizmo')).equals(false);
  });
});
