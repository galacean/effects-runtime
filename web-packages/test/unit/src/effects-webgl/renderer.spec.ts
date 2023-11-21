//@ts-nocheck
import { TextureSourceType, RenderPass, Camera, TextureLoadAction, RenderFrame } from '@galacean/effects-core';
import { GLRenderer, GLTexture } from '@galacean/effects-webgl';
import { readPixels } from './texture-utils.js';

const { expect } = chai;

describe('renderer', () => {
  let webglCanvas = document.createElement('canvas');
  let webgl2Canvas = document.createElement('canvas');

  after(() => {
    webglCanvas.remove();
    webglCanvas = null;
    webgl2Canvas.remove();
    webgl2Canvas = null;
  });

  function copy (renderer) {
    setupRenderFrame(renderer);
    const pipelineContext = renderer.pipelineContext;
    const engine = renderer.engine;
    const gl = pipelineContext.gl;
    const target = new GLTexture(engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([100, 200, 50, 180]),
      },
    });

    target.initialize(renderer.engine);
    const source = new GLTexture(engine, {
      sourceType: TextureSourceType.data,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([1, 2, 3, 4]),
      },
    });

    source.initialize(renderer.engine);
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
    const renderer = new GLRenderer(webglCanvas, 'webgl');

    setupRenderFrame(renderer);
    const ex = renderer.extension;
    const func = ex.copy1;
    const spy = ex.copy1 = chai.spy(func);

    copy(renderer);
    expect(spy).has.been.called.once;
    renderer.dispose();
  });
  it('copy texture in webgl2', () => {
    const renderer = new GLRenderer(webgl2Canvas, 'webgl2');
    const ex = renderer.extension;
    const func = ex.copy2;
    const spy = ex.copy2 = chai.spy(func);

    copy(renderer);
    expect(spy).has.been.called.once;
    renderer.dispose();
  });

  it('copy texture in webgl1 will not change texture size', () => {
    const renderer = new GLRenderer(webglCanvas, 'webgl');
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
    const renderer = new GLRenderer(webgl2Canvas, 'webgl2');
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
    renderer.dispose();
  });

  it('reset fbo attachments', () => {
    const renderer = new GLRenderer(webglCanvas, 'webgl');
    const gl = renderer.context.gl;
    const rp = new RenderPass(renderer, {
      viewport: [0, 0, 515, 512],
      attachments: [{ texture: { format: gl.RGBA } }],
    });

    rp.initialize(renderer);
    rp.configure(renderer);
    const texture = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer,
    });
    const originTex = (rp.attachments[0].texture);
    let tex = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);

    expect(tex).to.eql(originTex.textureBuffer);
    renderer.extension.resetColorAttachments(rp, [texture]);
    tex = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    expect(tex).to.eql((texture).textureBuffer);
    expect(originTex.isDestroyed).to.be.true;
    renderer.dispose();
  });

  it('safe to call destroy', async () => {
    const renderer = new GLRenderer(webglCanvas, 'webgl');
    const gl = renderer.pipelineContext.gl;
    const texture = new GLTexture(renderer.engine, {
      sourceType: TextureSourceType.framebuffer, data: {
        width: 3,
        height: 3,
      },
    });

    texture.initialize();
    gl.getExtension('WEBGL_lose_context').loseContext();

    window.setTimeout(() => {
      expect(renderer.glRenderer.isDestroyed).to.be.true;
      texture.dispose();
      expect(texture.destroyed).to.be.true;
    }, 60);
    renderer.dispose();
  });

  it('reset render pass color attachments', () => {
    const renderer = new GLRenderer(webgl2Canvas, 'webgl2');
    const gl = renderer.context.gl;
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
    });
    const ori = gl.checkFramebufferStatus;
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
    renderer.dispose();
  });
});

function setupRenderFrame (renderer) {
  renderer.renderingData.currentFrame = new RenderFrame({
    renderer,
    camera: new Camera(),
    renderPasses: [],
    clearAction: {
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    },
  });
}
