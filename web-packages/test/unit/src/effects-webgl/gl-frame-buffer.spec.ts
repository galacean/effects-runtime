// @ts-nocheck
import { glContext, RenderPassAttachmentStorageType, TextureSourceType, TextureStoreAction } from '@galacean/effects-core';
import { GLFrameBuffer, GLRenderBuffer, GLRenderer, GLTexture } from '@galacean/effects-webgl';
import { sleep } from '../utils';

const { expect } = chai;

describe('webgl/gl-frame-buffer', mainTest(document.createElement('canvas'), 'webgl'));
describe('webgl2/gl-frame-buffer', mainTest(document.createElement('canvas'), 'webgl2'));

function mainTest (canvas, framework) {
  return function () {
    let gpu, fakeRenderer, gl, engine;
    const colorTexOptions = {
      sourceType: TextureSourceType.framebuffer,
      format: glContext.RGBA,
      internalFormat: glContext.RGBA,
      type: glContext.UNSIGNED_BYTE,
    };

    this.timeout('10s');

    before(async () => {
      await sleep(3000);
      fakeRenderer = new GLRenderer(canvas, framework);
      engine = fakeRenderer.engine;
      gl = fakeRenderer.glRenderer.pipelineContext.gl;
      gpu = engine.gpuCapability;
    });

    after(() => {
      fakeRenderer.dispose();
      fakeRenderer = null;
      engine = null;
      gpu = null;
      gl.canvas.remove();
      gl = null;
    });

    it('fbo only with color texture', () => {
      const framebuffer = new GLFrameBuffer({
        name: 'test',
        storeAction: {
          colorAction: TextureStoreAction.clear,
        },
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        isCustomViewport: false,
        depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.none },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      if (gpu.level === 2) {
        expect(framebuffer.storeInvalidAttachments).to.deep.equals([gl.COLOR_ATTACHMENT0]);
      }
      expect(framebuffer.depthStencilRenderBuffer).is.undefined;
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      expect(framebuffer.stencilStorage).is.undefined;
      expect(framebuffer.depthStorage).is.undefined;
      checkColorAttachment(framebuffer);
    });

    it('fbo with depth & stencil renderBuffer', () => {
      const storageType = RenderPassAttachmentStorageType.depth_stencil_opaque;
      const framebuffer = new GLFrameBuffer({
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        depthStencilAttachment: {
          storageType,
        },
        storeAction: {
          stencilAction: TextureStoreAction.clear,
          depthAction: TextureStoreAction.clear,
          colorAction: TextureStoreAction.clear,
        },
        isCustomViewport: false,
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();

      if (gpu.level === 2) {
        expect(framebuffer.storeInvalidAttachments).to.deep.equals([gl.DEPTH_STENCIL_ATTACHMENT, gl.COLOR_ATTACHMENT0]);
      }
      expect(framebuffer.depthStencilRenderBuffer).is.instanceof(GLRenderBuffer);
      expect(framebuffer.depthStencilRenderBuffer?.storageType).is.eql(storageType);
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const stencilStorage = framebuffer.stencilStorage;

      expect(stencilStorage.storageType).is.eql(storageType);
      expect(stencilStorage.size).to.deep.equal([256, 256]);
      expect(stencilStorage.format).is.equal(gl.DEPTH_STENCIL);
      expect(stencilStorage).is.equal(framebuffer.depthStorage);
      checkColorAttachment(framebuffer);
    });

    it('fbo only with depth uint16 renderBuffer', () => {
      const storageType = RenderPassAttachmentStorageType.depth_16_opaque;
      const framebuffer = new GLFrameBuffer({
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        storeAction: {
          depthAction: TextureStoreAction.clear,
        },
        isCustomViewport: false,
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      if (gpu.level === 2) {
        expect(framebuffer.storeInvalidAttachments).to.deep.equals([gl.DEPTH_ATTACHMENT]);
      }
      expect(framebuffer.depthStencilRenderBuffer).is.instanceof(GLRenderBuffer);
      expect(framebuffer.depthStencilRenderBuffer?.storageType).is.eql(storageType, 'depthStencilRenderBuffer?.storageType');
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const depthStorage = framebuffer.depthStorage;

      expect(depthStorage.storageType).is.eql(storageType, 'depthStorage.storageType');
      expect(depthStorage.size).to.deep.equal([256, 256]);
      expect(depthStorage.format).is.equal(gl.DEPTH_COMPONENT16);
      expect(framebuffer.stencilStorage).is.undefined;
      checkColorAttachment(framebuffer);
    });

    it('fbo only with stencil uint8 renderBuffer', () => {
      const storageType = RenderPassAttachmentStorageType.stencil_8_opaque;
      const framebuffer = new GLFrameBuffer({
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        storeAction: {
          colorAction: TextureStoreAction.clear,
          stencilAction: TextureStoreAction.clear,
          depthAction: TextureStoreAction.clear,
        },
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      if (gpu.level === 2) {
        expect(framebuffer.storeInvalidAttachments).to.deep.equals([gl.STENCIL_ATTACHMENT, gl.COLOR_ATTACHMENT0]);
      }
      expect(framebuffer.depthStencilRenderBuffer).is.instanceof(GLRenderBuffer);
      expect(framebuffer.depthStencilRenderBuffer?.storageType).is.eql(storageType);
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const stencilStorage = framebuffer.stencilStorage;

      expect(stencilStorage.storageType).is.eql(storageType);
      expect(stencilStorage.size).to.deep.equal([256, 256]);
      expect(stencilStorage.format).is.equal(gl.STENCIL_INDEX8);
      expect(framebuffer.depthStorage).is.undefined;
      checkColorAttachment(framebuffer);
    });

    it('fbo use other renderBuffer', () => {
      const storageType = RenderPassAttachmentStorageType.depth_stencil_opaque;
      const framebuffer0 = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer0.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        depthStencilAttachment: {
          storageType,
          storage: framebuffer0.depthStorage,
        },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      expect(framebuffer.depthStencilRenderBuffer).is.instanceof(GLRenderBuffer);
      expect(framebuffer.depthStencilRenderBuffer?.storageType).is.eql(storageType);
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const stencilStorage = framebuffer.stencilStorage;

      expect(stencilStorage.storageType).is.eql(storageType);
      expect(stencilStorage.size).to.deep.equal([256, 256]);
      expect(stencilStorage.format).is.equal(gl.DEPTH_STENCIL);
      expect(stencilStorage).is.equal(framebuffer.depthStorage);
      checkColorAttachment(framebuffer);
    });

    it('fbo [ext] depth 16 texture', () => {
      const storageType = RenderPassAttachmentStorageType.depth_16_texture;

      if (!gpu.readableDepthStencilTextures) {
        return;
      }
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const texture = framebuffer.depthTexture;

      expect(texture).is.instanceof(GLTexture);
      expect(texture.width).is.equal(256);
      expect(texture.height).is.eql(256);
      expect(texture.source.format).is.eql(gl.DEPTH_COMPONENT);
      expect(texture.source.internalFormat).is.eql(gpu.internalFormatDepth16);
      expect(texture.source.type).is.eql(gl.UNSIGNED_SHORT);
      checkColorAttachment(framebuffer);
    });

    it('fbo not support depth 16 texture', () => {
      const storageType = RenderPassAttachmentStorageType.depth_16_texture;

      if (gpu.readableDepthStencilTextures) {
        //@ts-expect-error
        gpu.readableDepthStencilTextures = false;
        expect(() => new GLFrameBuffer({
          storeAction: {},
          attachments: [new GLTexture(engine, {
            ...colorTexOptions,
            data: { width: 256, height: 256 },
          })],
          depthStencilAttachment: { storageType },
          viewport: [0, 0, 256, 256],
        }, fakeRenderer)).to.throw;
        // @ts-expect-error
        gpu.readableDepthStencilTextures = true;
      }
    });

    it('fbo [ext] support depth 24 stencil 8 texture', () => {
      const storageType = RenderPassAttachmentStorageType.depth_24_stencil_8_texture;
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, {
          ...colorTexOptions,
          data: { width: 256, height: 256 },
        })],
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const texture = framebuffer.depthTexture;

      expect(texture).is.not.undefined;
      expect(texture).is.instanceof(GLTexture);
      expect(texture.width).is.equal(256);
      expect(texture.height).is.eql(256);
      expect(texture.source.format).is.eql(gl.DEPTH_STENCIL, 'format');
      expect(texture.source.internalFormat).is.eql(gpu.internalFormatDepth24_stencil8, 'internalFormat');
      expect(texture.source.type).is.eql(gpu.UNSIGNED_INT_24_8, 'type');
      expect(texture).is.eql(framebuffer.stencilTexture);
      checkColorAttachment(framebuffer);
    });

    it('fbo auto set color attachment size', () => {
      const storageType = RenderPassAttachmentStorageType.depth_stencil_opaque;
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, colorTexOptions)],
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 100, 100],
      }, fakeRenderer);

      framebuffer.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const texture = framebuffer.colorTextures[0];

      expect(texture).is.not.undefined;
      expect(texture).is.instanceof(GLTexture);
      expect(texture.width).is.equal(100);
      expect(texture.height).is.eql(100);
      expect(texture.source.format).is.eql(gl.RGBA, 'format');
      expect(texture.source.internalFormat).is.eql(gl.RGBA, 'internalFormat');
      expect(texture.source.type).is.eql(gl.UNSIGNED_BYTE, 'type');

      const storage = framebuffer.depthStorage;

      expect(storage.size).is.deep.equal([100, 100]);
      expect(storage.storageType).is.eql(storageType);
      expect(storage.format).is.eql(gl.DEPTH_STENCIL);
      expect(storage.attachment).is.eql(gl.DEPTH_STENCIL_ATTACHMENT);
    });

    it('fbo [ext] auto set depth stencil attachment size', () => {
      const storageType = RenderPassAttachmentStorageType.depth_24_stencil_8_texture;
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [new GLTexture(engine, colorTexOptions)],
        depthStencilAttachment: { storageType },
        viewport: [0, 0, 100, 100],
      }, fakeRenderer);

      framebuffer.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
      const color = framebuffer.colorTextures[0];

      expect(color).is.not.undefined;
      expect(color).is.instanceof(GLTexture);
      expect(color.width).is.equal(100);
      expect(color.height).is.eql(100);
      expect(color.source.format).is.eql(gl.RGBA, 'format');
      expect(color.source.internalFormat).is.eql(gl.RGBA, 'internalFormat');
      expect(color.source.type).is.eql(gl.UNSIGNED_BYTE, 'type');
      const depth = framebuffer.depthTexture;

      expect(depth).is.instanceof(GLTexture);
      expect(depth.width).is.equal(100);
      expect(depth.height).is.eql(100);
      expect(depth.source.format).is.eql(gl.DEPTH_STENCIL, 'format');
      expect(depth.source.internalFormat).is.eql(gpu.internalFormatDepth24_stencil8, 'internalFormat');
      expect(depth.source.type).is.eql(gpu.UNSIGNED_INT_24_8, 'type');
    });

    it('fbo bind multiple color attachments', () => {
      const colorOptions = [{
        sourceType: TextureSourceType.framebuffer,
        format: gl.RGBA,
        internalFormat: gl.RGBA,
        type: gl.UNSIGNED_BYTE,
      }, {
        sourceType: TextureSourceType.framebuffer,
        format: gl.RGBA,
        internalFormat: gl.RGBA,
        type: gl.UNSIGNED_BYTE,
      },
      {
        sourceType: TextureSourceType.framebuffer,
        format: gl.RGBA,
        internalFormat: gl.RGBA,
        type: gl.UNSIGNED_BYTE,
      },
      ];
      const framebuffer = new GLFrameBuffer({
        attachments: [
          new GLTexture(engine, colorOptions[0]),
          new GLTexture(engine, colorOptions[1]),
          new GLTexture(engine, colorOptions[2]),
        ],
        storeAction: {
          colorAction: TextureStoreAction.clear,
        },
        viewport: [0, 0, 200, 200],
      }, fakeRenderer);

      framebuffer.bind();
      expect(framebuffer.colorTextures.length).is.eql(3);
      if (gpu.level === 2) {
        expect(framebuffer.storeInvalidAttachments).to.deep.equals([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      }
      framebuffer.colorTextures.forEach((tex, i) => {
        expect(tex.width).is.equal(200, `texture_${i}_width`);
        expect(tex.height).is.eql(200, `texture_${i}_height`);
        expect(tex.source.sourceType).is.eql(TextureSourceType.framebuffer, `texture_${i}_source_type`);
        expect(tex.source.format).is.eql(colorOptions[i].format, `texture_${i}_format`);
        expect(tex.source.internalFormat).is.eql(colorOptions[i].internalFormat, `texture_${i}_internalFormat`);
        expect(tex.source.type).is.eql(colorOptions[i].type, `texture_${i}_type`);
      });
    });

    it('fbo support half float texture color attachment', () => {
      const colorOptions = {
        sourceType: TextureSourceType.framebuffer,
        format: gl.RGBA,
        internalFormat: gl.RGBA,
        type: glContext.HALF_FLOAT,
        minFilter: glContext.LINEAR,
        magFilter: glContext.LINEAR,
      };
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [
          new GLTexture(engine, colorOptions),
        ],
        isCustomViewport: false,
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      expect(framebuffer.colorTextures.length).is.eql(1);
      const tex = framebuffer.colorTextures[0];

      expect(tex.width).is.equal(256, 'texture_width');
      expect(tex.height).is.eql(256, 'texture_height');
      expect(tex.source.type).is.eql(glContext.HALF_FLOAT);
    });

    it('fbo support float texture color attachment', () => {
      const colorOptions = {
        sourceType: TextureSourceType.framebuffer,
        format: gl.RGBA,
        internalFormat: gl.RGBA,
        type: glContext.FLOAT,
        minFilter: glContext.LINEAR,
        magFilter: glContext.LINEAR,
      };
      const framebuffer = new GLFrameBuffer({
        storeAction: {},
        attachments: [
          new GLTexture(engine, colorOptions),
        ],
        isCustomViewport: false,
        viewportScale: 1,
        viewport: [0, 0, 256, 256],
      }, fakeRenderer);

      framebuffer.bind();
      expect(framebuffer.colorTextures.length).is.eql(1);
      const tex = framebuffer.colorTextures[0];

      expect(tex.width).is.equal(256, 'texture_width');
      expect(tex.height).is.eql(256, 'texture_height');
      expect(tex.source.type).is.eql(glContext.FLOAT);
    });

    function checkColorAttachment (fb) {
      const tex = fb.colorTextures[0];

      expect(fb.colorTextures.length).is.eql(1);
      expect(tex.width).is.equal(256);
      expect(tex.height).is.eql(256);
      expect(tex.source.sourceType).is.eql(TextureSourceType.framebuffer);
      expect(tex.source.format).is.eql(gl.RGBA);
      expect(tex.source.internalFormat).is.eql(gl.RGBA);
      expect(tex.source.type).is.eql(gl.UNSIGNED_BYTE);
      const vp0 = Array.from(gl.getParameter(gl.VIEWPORT));

      expect(vp0).is.deep.equal([0, 0, 256, 256]);
    }
  };
}
