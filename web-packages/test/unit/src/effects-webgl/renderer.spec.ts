import { TextureSourceType, RenderPass } from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
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

  it('reset fbo attachments', () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer as GLRenderer;
    const gl = renderer.context.gl;
    const rp = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl?.RGBA } }],
    });

    rp.initialize(renderer);
    rp.configure(renderer);
    const texture = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer,
    });
    const originTex = rp.attachments[0].texture as GLTexture;
    const tex = gl?.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);

    expect(tex).to.eql(originTex.textureBuffer);
    engine.dispose();
  });

  it('safe to call destroy', async () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer as GLRenderer;
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
      expect(renderer.isDisposed).to.be.true;
      texture.dispose();
      // @ts-expect-error protected
      expect(texture.destroyed).to.be.true;
    }, 60);
    engine.dispose();
  });

  it('reset render pass color attachments', () => {
    const engine = new GLEngine(gl2Canvas, { glType: 'webgl2' });
    const renderer = engine.renderer as GLRenderer;
    const gl = renderer.context.gl as WebGLRenderingContext;
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
    });
    const ori = gl?.checkFramebufferStatus;
    const spy = chai.spy(gl.checkFramebufferStatus);

    gl.checkFramebufferStatus = spy;
    renderPass.initialize(renderer);
    expect(renderPass.attachments[0]).to.exist;
    expect(renderPass.attachments[0].texture).to.be.an.instanceof(GLTexture);
    expect(spy).has.been.called.once;

    engine.dispose();
  });
});
