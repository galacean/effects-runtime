import { TextureSourceType, RenderPass } from '@galacean/effects-core';
import { GLEngine, GLTexture } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/renderer', () => {
  let glCanvas = document.createElement('canvas');
  let gl2Canvas = document.createElement('canvas');

  after(() => {
    glCanvas.remove();
    // @ts-expect-error
    glCanvas = null;
    gl2Canvas.remove();
    // @ts-expect-error
    gl2Canvas = null;
  });

  it('safe to call destroy', async () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer;
    const gl = (renderer.engine as GLEngine).gl;
    const texture = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer, data: {
        width: 3,
        height: 3,
      },
    });

    texture.initialize();
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    window.setTimeout(() => {
      //@ts-expect-error
      expect(renderer.disposed).to.be.true;
      texture.dispose();
      // @ts-expect-error protected
      expect(texture.destroyed).to.be.true;
    }, 60);
    engine.dispose();
  });
});
