import type { Renderer } from '@galacean/effects-core';
import { TextureSourceType, RenderPass, Camera, TextureLoadAction, RenderFrame } from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
import { GLEngine, GLTexture } from '@galacean/effects-webgl';
import { readPixels } from './texture-utils.js';

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

  function copy (renderer: GLRenderer) {
    setupRenderFrame(renderer);
    const engine = renderer.engine as GLEngine;
    const gl = engine.gl;
    const target = new GLTexture(engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([100, 200, 50, 180]),
      },
    });

    target.initialize();
    const source = new GLTexture(engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([1, 2, 3, 4]),
      },
    });

    source.initialize();
    const data = {
      width: 1,
      height: 1,
      data: new Uint8Array(4),
    };

    readPixels(gl, source.textureBuffer, data);

    expect(data.data).to.deep.equals(new Uint8Array([1, 2, 3, 4]));
    readPixels(gl, target.textureBuffer, data);
    expect(data.data).to.deep.equals(new Uint8Array([100, 200, 50, 180]));
    data.data = new Uint8Array(4);
    renderer.extension.copyTexture(source, target);
    readPixels(gl, source.textureBuffer, data);
    expect(data.data).to.deep.equals(new Uint8Array([1, 2, 3, 4]));

    renderer.dispose();
  }

  it('copy texture in webgl1', () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer as GLRenderer;

    setupRenderFrame(renderer);
    const ex = renderer.extension;
    const func = ex.copy1;
    const spy = ex.copy1 = chai.spy(func);

    copy(renderer);
    expect(spy).has.been.called.once;
    engine.dispose();
  });

  it('copy texture in webgl2', () => {
    const engine = new GLEngine(gl2Canvas, { glType: 'webgl2' });
    const renderer = engine.renderer as GLRenderer;
    const ex = renderer.extension;
    const func = ex.copy2;
    const spy = ex.copy2 = chai.spy(func);

    copy(renderer);
    expect(spy).has.been.called.once;
    engine.dispose();
  });

  it('copy texture in webgl1 will not change texture size', () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer as GLRenderer;
    const source = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 10,
        height: 10,
        data: new Uint8Array(10 * 10 * 4),
      },
    });
    const target = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer,
      data: {
        width: 5,
        height: 5,
      },
    });

    setupRenderFrame(renderer);
    renderer.extension.copyTexture(source, target);
    expect(target.width).to.eql(5);
    expect(target.height).to.eql(5);
    renderer.dispose();
  });

  it('copy texture in webgl2 will not change texture size', () => {
    const engine = new GLEngine(gl2Canvas, { glType: 'webgl2' });
    const renderer = engine.renderer as GLRenderer;
    const source = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 10,
        height: 10,
        data: new Uint8Array(10 * 10 * 4),
      },
    });
    const target = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer,
      data: {
        width: 5,
        height: 5,
      },
    });

    renderer.extension.copyTexture(source, target);
    expect(target.width).to.eql(5);
    expect(target.height).to.eql(5);
    engine.dispose();
  });

  it('reset fbo attachments', () => {
    const engine = new GLEngine(glCanvas, { glType: 'webgl' });
    const renderer = engine.renderer as GLRenderer;
    const gl = renderer.context.gl;
    const rp = new RenderPass(renderer, {
      viewport: [0, 0, 515, 512],
      attachments: [{ texture: { format: gl?.RGBA } }],
    });

    rp.initialize(renderer);
    rp.configure(renderer);
    const texture = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer,
    });
    const originTex = rp.attachments[0].texture as GLTexture;
    let tex = gl?.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);

    expect(tex).to.eql(originTex.textureBuffer);
    renderer.extension.resetColorAttachments(rp, [texture]);
    tex = gl?.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    expect(tex).to.eql((texture).textureBuffer);
    expect(originTex.isDestroyed).to.be.true;
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
      expect(renderer.glRenderer.isDestroyed).to.be.true;
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
    const tex = new GLTexture(renderer.engine, {
      name: 't2',
      sourceType: TextureSourceType.data,
      data: { width: 1, height: 1, data: new Uint8Array(4) },
    });

    renderer.extension.resetColorAttachments(renderPass, [tex]);
    expect(renderPass.attachments[0].texture).to.eql(tex);
    expect(tex.sourceType).to.eql(TextureSourceType.framebuffer);
    expect(spy).has.been.called.once;
    renderer.extension.resetColorAttachments(renderPass, []);
    expect(renderPass.attachments.length).to.eql(0);
    expect(spy).has.been.called.once;
    renderer.extension.resetColorAttachments(renderPass, [new GLTexture(renderer.engine, {
      name: 't3',
      sourceType: TextureSourceType.framebuffer,
    })]);
    expect(spy).has.been.called.twice;
    expect(renderPass.attachments[0].texture.name).to.eql('t3');
    gl.checkFramebufferStatus = ori;
    engine.dispose();
  });
});

function setupRenderFrame (renderer: Renderer) {
  renderer.renderingData.currentFrame = new RenderFrame({
    renderer,
    camera: new Camera(''),
    clearAction: {
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    },
  });
}
