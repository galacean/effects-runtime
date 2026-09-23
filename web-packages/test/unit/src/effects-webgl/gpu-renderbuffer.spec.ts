import {
  Engine, GPUResource, GPURenderbuffer, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, Texture, TextureSourceType,
} from '@galacean/effects-core';
import { GPURenderbufferWebGL } from '@galacean/effects-webgl';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`${glType}/gpu-renderbuffer`, () => {
    let engine: Engine;
    let device: RenderingDeviceWebGL;
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
      engine = new Engine(document.createElement('canvas'), { glType, manualRender: true, doNotHandleContextLost: false });
      device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
      gl = device.gl;
    });

    afterEach(() => engine.dispose());

    function createResource () {
      return device.createRenderbuffer({
        format: gl.DEPTH_COMPONENT16,
        attachment: gl.DEPTH_ATTACHMENT,
        storageType: RenderPassAttachmentStorageType.depth_16_opaque,
      });
    }

    it('separates creation and allocation, resizes and reinitializes at the same dimensions', () => {
      const count = device['resources'].length;
      const resource = createResource();

      expect(resource).instanceOf(GPUResource);
      expect(resource).instanceOf(GPURenderbuffer);
      expect(resource).instanceOf(GPURenderbufferWebGL);
      expect(resource.buffer).equals(null);
      expect(device['resources'].length).equals(count + 1);
      expect(device['renderbuffers']).not.includes(resource);
      resource.initialize();
      resource.setSize(16, 8);
      const native = resource.buffer;

      resource.initialize();
      expect(resource.buffer).equals(native);
      expect(device['renderbuffers'].filter(item => item === resource)).length(1);
      resource.setSize(32, 16);
      expect(gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_WIDTH)).equals(32);
      expect(gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_HEIGHT)).equals(16);
      let releases = 0;

      resource.on('releasing', () => {
        releases++;
        expect(resource.device).equals(device);
        expect(gl.isRenderbuffer(resource.buffer)).equals(true);
      });
      resource.releaseGPU();
      expect(resource.buffer).equals(null);
      expect(gl.isRenderbuffer(native)).equals(false);
      expect(device['resources']).includes(resource);
      resource.initialize();
      resource.setSize(32, 16);
      expect(resource.buffer).not.equals(native);
      expect(gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_WIDTH)).equals(32);
      resource.dispose();
      resource.dispose();
      expect(releases).equals(2);
      expect(resource.device).equals(null);
      expect(device['resources'].length).equals(count);
      expect(device['renderbuffers']).not.includes(resource);
      expect(() => resource.initialize()).throws('Destroyed item cannot be used again.');
    });

    it('releases surviving storage on device shutdown and allows later disposal', () => {
      const resource = createResource();

      resource.initialize();
      resource.setSize(8, 8);
      const native = resource.buffer;
      const deleteRenderbuffer = gl.deleteRenderbuffer.bind(gl);
      let deletions = 0;

      gl.deleteRenderbuffer = buffer => {
        if (buffer === native) {
          deletions++;
        }
        deleteRenderbuffer(buffer);
      };
      device.dispose();
      expect(deletions).equals(1);
      expect(resource.buffer).equals(null);
      expect(resource.device).equals(null);
      resource.dispose();
      resource.dispose();
      expect(deletions).equals(1);
    });

    it('restores borrowed storage before framebuffer attachments and preserves ownership', async function () {
      const extension = gl.getExtension('WEBGL_lose_context');

      if (!extension) {
        this.skip();

        return;
      }
      const resource = createResource();

      resource.initialize();
      const framebuffer = device.createFramebuffer({
        attachments: [new Texture(engine, {
          sourceType: TextureSourceType.framebuffer,
          data: { width: 16, height: 16 },
        })],
        depthStencilAttachment: { storageType: resource.storageType, storage: resource },
        viewport: [0, 0, 16, 16],
        storeAction: {},
      });

      framebuffer.initialize();

      framebuffer.bind();
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).equals(gl.FRAMEBUFFER_COMPLETE);
      const native = resource.buffer;
      const nativeFramebuffer = framebuffer.fbo;
      const count = device['resources'].length;
      const restored = new Promise<void>(resolve => engine.once('contextrestored', () => resolve()));

      engine.canvas.addEventListener('webglcontextlost', () => {
        window.setTimeout(() => extension.restoreContext(), 0);
      }, { once: true });
      extension.loseContext();
      await restored;
      framebuffer.bind();
      expect(resource.buffer).not.equals(native);
      expect(framebuffer.fbo).not.equals(nativeFramebuffer);
      expect(resource.size).deep.equals([16, 16]);
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).equals(gl.FRAMEBUFFER_COMPLETE);
      expect(gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)).equals(resource.buffer);
      expect(device['resources'].length).equals(count);
      framebuffer.dispose({ depthStencilAttachment: RenderPassDestroyAttachmentType.keepExternal });
      expect(resource.isDestroyed).equals(false);
      expect(gl.isRenderbuffer(resource.buffer)).equals(true);
      resource.dispose();
    }).timeout(8000);
  });
}
