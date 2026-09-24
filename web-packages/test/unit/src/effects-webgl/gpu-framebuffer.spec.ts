import {
  Engine, GPUFramebuffer, GPUResource, RenderPassAttachmentStorageType, Texture, TextureSourceType,
} from '@galacean/effects-core';
import { GPUFramebufferWebGL } from '@galacean/effects-webgl';
import type { GPUTextureWebGL, RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`${glType}/gpu-framebuffer`, () => {
    let engine: Engine;
    let device: RenderingDeviceWebGL;
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
      engine = new Engine(document.createElement('canvas'), { glType, manualRender: true });
      device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
      gl = device.gl;
      // Framebuffer.bind uses the engine-owned fallback texture. Include it in the baseline.
      engine.assetServer.whiteTexture.initialize();
    });

    afterEach(() => engine.dispose());

    function createFramebuffer () {
      const texture = new Texture(engine, {
        sourceType: TextureSourceType.framebuffer,
        data: { width: 16, height: 16 },
      });
      const framebuffer = device.createFramebuffer({
        attachments: [texture],
        depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.depth_stencil_opaque },
        viewport: [0, 0, 16, 16],
        storeAction: {},
      });

      return { framebuffer, texture };
    }

    it('registers before allocation and releases only the FBO while retaining attachments for reuse', () => {
      const count = device['resources'].length;
      const { framebuffer, texture } = createFramebuffer();

      expect(framebuffer).instanceOf(GPUFramebuffer);
      expect(framebuffer).instanceOf(GPUResource);
      expect(framebuffer).instanceOf(GPUFramebufferWebGL);
      expect(framebuffer.fbo).equals(undefined);
      expect(device['resources'].length).equals(count + 1);
      expect(device['framebuffers']).not.includes(framebuffer);
      framebuffer.initialize();
      framebuffer.bind();
      const native = framebuffer.fbo!;
      const depth = framebuffer.depthStencilRenderbuffer!;
      const depthNative = depth.buffer;
      const colorNative = (texture.getGPUTexture() as GPUTextureWebGL).textureBuffer;
      const allocatedCount = device['resources'].length;
      let releases = 0;

      framebuffer.on('releasing', () => {
        releases++;
        expect(framebuffer.device).equals(device);
        expect(gl.isFramebuffer(framebuffer.fbo!)).equals(true);
      });
      framebuffer.releaseGPU();
      expect(framebuffer.fbo).equals(undefined);
      expect(framebuffer.ready).equals(false);
      expect(gl.isFramebuffer(native)).equals(false);
      expect(gl.isRenderbuffer(depthNative)).equals(true);
      expect(gl.isTexture(colorNative)).equals(true);
      expect(framebuffer.getColorTextures()).deep.equals([texture]);
      framebuffer.initialize();
      framebuffer.bind();
      expect(framebuffer.fbo).not.equals(native);
      expect(framebuffer.depthStencilRenderbuffer).equals(depth);
      expect(depth.buffer).equals(depthNative);
      expect(device['resources'].length).equals(allocatedCount);
      expect(device['framebuffers'].filter(item => item === framebuffer)).length(1);
      expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).equals(gl.FRAMEBUFFER_COMPLETE);
      framebuffer.dispose();
      framebuffer.dispose();
      expect(releases).equals(2);
      expect(framebuffer.device).equals(null);
      expect(gl.isRenderbuffer(depthNative)).equals(false);
      expect(gl.isTexture(colorNative)).equals(false);
      expect(device['resources'].length).equals(count);
      expect(device['framebuffers']).not.includes(framebuffer);
    });

    it('keeps device shutdown attachment cleanup and avoids repeated native deletion', () => {
      const { framebuffer } = createFramebuffer();

      framebuffer.initialize();
      framebuffer.bind();
      const native = framebuffer.fbo!;
      const depth = framebuffer.depthStencilRenderbuffer!;
      const deleteFramebuffer = gl.deleteFramebuffer.bind(gl);
      let deletions = 0;

      gl.deleteFramebuffer = buffer => {
        if (buffer === native) {
          deletions++;
        }
        deleteFramebuffer(buffer);
      };
      device.dispose();
      expect(deletions).equals(1);
      expect(framebuffer.device).equals(null);
      expect(depth.isDestroyed).equals(true);
      framebuffer.dispose();
      expect(deletions).equals(1);
    });

    it('does not create native storage for an empty target', () => {
      const count = device['resources'].length;
      const framebuffer = device.createFramebuffer({
        attachments: [], viewport: [0, 0, 16, 16], storeAction: {},
      });

      framebuffer.initialize();
      framebuffer.bind();
      expect(framebuffer.fbo).equals(undefined);
      expect(device['framebuffers']).not.includes(framebuffer);
      expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).equals(null);
      framebuffer.dispose();
      expect(device['resources'].length).equals(count);
    });
  });
}
