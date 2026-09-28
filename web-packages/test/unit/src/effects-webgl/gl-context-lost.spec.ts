import type { GPUTextureWebGL } from '@galacean/effects-webgl';
import { Texture } from '@galacean/effects-core';
import type { ShaderVariant } from '@galacean/effects-core';
import { Engine } from '@galacean/effects-core';
import { BufferUsage, Geometry, glContext, TextureSourceType } from '@galacean/effects-core';
import type { GPUProgramWebGL, RenderingDeviceWebGL } from '@galacean/effects-webgl';

import { readBufferContents } from './gl-utils';

const { assert, expect } = chai;

/**
 * 等待 engine 触发 contextrestored 事件。
 */
function onceContextRestored (engine: Engine): Promise<void> {
  return new Promise(resolve => {
    engine.once('contextrestored', () => resolve());
  });
}

/**
 * 触发一次真实的 context lost/restore 周期。
 * WEBGL_lose_context 不会在 loseContext 后自动恢复，必须等 lost 事件到达后显式 restoreContext。
 */
function emulateContextLoss (engine: Engine): Promise<void> {
  const restored = onceContextRestored(engine);
  const ext = ((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');

  engine.canvas.addEventListener('webglcontextlost', () => {
    window.setTimeout(() => ext?.restoreContext(), 0);
  }, { once: true });
  ext?.loseContext();

  return restored;
}

/**
 * 是否具备真实上下文丢失/恢复的测试条件（需要 WEBGL_lose_context 扩展）。
 */
function canEmulateContextLoss (engine: Engine): boolean {
  return !!((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
}

describe('webgl/gl-context-lost', () => {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let gl: WebGLRenderingContext;

  function createEngine (doNotHandleContextLost: boolean, ownsCanvas = true): Engine {
    const c = document.createElement('canvas');

    c.width = 64;
    c.height = 64;

    return new Engine(c, { glType: 'webgl2', doNotHandleContextLost, ownsCanvas });
  }

  afterEach(() => {
    if (engine) {
      engine.dispose();
      engine = null as any;
    }
    if (canvas) {
      canvas.remove();
      canvas = null as any;
    }
  });

  // 需要真实浏览器 + WEBGL_lose_context 扩展的用例，用 canEmulateContextLoss 守卫。
  describe('opt-in 自动恢复（doNotHandleContextLost=false）', () => {
    beforeEach(() => {
      engine = createEngine(false);
      gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext;
      // Engine 构造已创建内置纹理，但需 initialize 才有 GL 句柄。
      (engine.assetServer.whiteTexture).initialize();
      (engine.assetServer.transparentTexture).initialize();
    });

    it('纹理 GPU 句柄在 restore 后被重建', async function () {
      if (!canEmulateContextLoss(engine)) {
        this.skip();

        return;
      }

      const tex = new Texture(engine, {
        sourceType: TextureSourceType.data,
        data: { width: 2, height: 2, data: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]) },
        format: glContext.RGBA,
        internalFormat: glContext.RGBA,
        type: glContext.UNSIGNED_BYTE,
      });

      tex.initialize();
      const before = (tex.getGPUTexture() as GPUTextureWebGL).textureBuffer;

      await emulateContextLoss(engine);

      const after = (tex.getGPUTexture() as GPUTextureWebGL).textureBuffer;

      expect(after).to.not.equal(before);
      expect(after).to.be.instanceOf(WebGLTexture);
      engine.effectsObjectServer.removeTexture(tex);
      tex.dispose();
    }).timeout(8000);

    it('shader program 在 restore 后被重建', async function () {
      if (!canEmulateContextLoss(engine)) {
        this.skip();

        return;
      }

      const vs = `#version 300 es
      layout(location=0) in vec2 aPosition;
      uniform float uOffset;
      void main(){ gl_Position = vec4(aPosition + vec2(uOffset),0.0,1.0); }`;
      const fs = `#version 300 es
      precision highp float;
      out vec4 outColor;
      void main(){ outColor = vec4(1.0,0.0,0.0,1.0); }`;
      const library = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;
      const id = library.addShader({ vertex: vs, fragment: fs, name: 'restore-test' });
      const variant = (library as any).cachedShaders[id] as ShaderVariant;

      variant.initialize();
      variant.fillShaderInformation(['uOffset'], []);
      const beforeResource = variant.program as GPUProgramWebGL;
      const beforeProgram = beforeResource.program;
      const device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
      const resourceCount = device['resources'].length;

      await emulateContextLoss(engine);

      const afterProgram = (variant.program as GPUProgramWebGL)?.program;

      expect(afterProgram).to.not.equal(beforeProgram);
      expect(afterProgram).to.be.instanceOf(WebGLProgram);
      expect(beforeResource.program).to.equal(null);
      expect(beforeResource.device).to.equal(null);
      expect(device['resources']).to.not.include(beforeResource);
      expect(device['resources'].length).to.equal(resourceCount);
      expect(variant.initialized).to.equal(true);
      variant.bind();
      variant.setFloat('uOffset', 0.5);
      expect(gl.getUniform(afterProgram!, gl.getUniformLocation(afterProgram!, 'uOffset')!)).to.equal(0.5);
      expect(gl.getError()).to.equal(gl.NO_ERROR);
    }).timeout(8000);

    it('几何缓冲区在 restore 后被重建', async function () {
      if (!canEmulateContextLoss(engine)) {
        this.skip();

        return;
      }
      const geometry = new Geometry(engine, {
        attributes: {
          aPosition: {
            data: new Float32Array([0, 0, 1, 0, 0, 1]),
            size: 2,
          },
        },
        indices: { data: new Uint16Array([0, 1, 2]) },
        bufferUsage: BufferUsage.Dynamic,
        drawCount: 3,
      });

      geometry.initialize();
      const gpuBuffer = geometry.getAttributeBuffer('aPosition')!;
      const device = engine.displayServer.renderingDevice;
      const bufferCount = device['resources'].length;
      const beforeVertex = gpuBuffer.underlyingResource;
      const beforeIndex = geometry.getIndexBuffer()!.underlyingResource;

      await emulateContextLoss(engine);

      expect(geometry.getAttributeBuffer('aPosition')).equals(gpuBuffer);
      expect(device['resources'].length).equals(bufferCount);
      expect(gpuBuffer.underlyingResource).to.not.equal(beforeVertex);
      expect(geometry.getIndexBuffer()!.underlyingResource).to.not.equal(beforeIndex);
      const vertices = new Float32Array(6);
      const indices = new Uint16Array(3);

      readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, gpuBuffer, vertices);
      readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, geometry.getIndexBuffer()!, indices, 0, true);
      expect(vertices).to.deep.equal(new Float32Array([0, 0, 1, 0, 0, 1]));
      expect(indices).to.deep.equal(new Uint16Array([0, 1, 2]));
      geometry.dispose();
    }).timeout(8000);

    it('Geometry 在连续上下文恢复后保留局部更新内容', async function () {
      if (!canEmulateContextLoss(engine)) {
        this.skip();

        return;
      }
      const data = new Float32Array([0, 0, 1, 0, 0, 1]);
      const geometry = new Geometry(engine, {
        attributes: {
          aPosition: { data: data.slice(), size: 2 },
        },
        bufferUsage: BufferUsage.Dynamic,
        drawCount: 3,
      });

      geometry.initialize();

      data.set([2, 3], 0);
      geometry.setAttributeSubData('aPosition', 0, new Float32Array([2, 3]));
      await emulateContextLoss(engine);
      await emulateContextLoss(engine);
      const restored = new Float32Array(data.length);

      readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, geometry.getAttributeBuffer('aPosition')!, restored);
      expect(restored).to.deep.equal(data);
      geometry.dispose();
    }).timeout(8000);

    it('连续两次 context lost 均可恢复', async function () {
      if (!canEmulateContextLoss(engine)) {
        this.skip();

        return;
      }

      const tex = new Texture(engine, {
        sourceType: TextureSourceType.data,
        data: { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) },
        format: glContext.RGBA,
        internalFormat: glContext.RGBA,
        type: glContext.UNSIGNED_BYTE,
      });

      tex.initialize();

      // 第一次丢失恢复
      await emulateContextLoss(engine);
      expect((tex.getGPUTexture() as GPUTextureWebGL).textureBuffer).to.be.instanceOf(WebGLTexture);

      // 第二次丢失恢复（验证永久保留 CPU 数据策略）
      await emulateContextLoss(engine);
      expect((tex.getGPUTexture() as GPUTextureWebGL).textureBuffer).to.be.instanceOf(WebGLTexture);

      engine.effectsObjectServer.removeTexture(tex);
      tex.dispose();
    }).timeout(15000);
  });

  describe('默认模式（doNotHandleContextLost=true）', () => {
    beforeEach(() => {
      engine = createEngine(true);
      gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext;
    });

    it('release 释放 CPU 源数据（默认内存优先）', () => {
      const tex = new Texture(engine, {
        sourceType: TextureSourceType.data,
        data: { width: 2, height: 2, data: new Uint8Array(16) },
        format: glContext.RGBA,
        internalFormat: glContext.RGBA,
        type: glContext.UNSIGNED_BYTE,
      });

      tex.initialize();

      // 默认模式 release 后 source.data 被释放。
      expect((tex.source as any).data).to.be.undefined;
      engine.effectsObjectServer.removeTexture(tex);
      tex.dispose();
    });
  });

  it('销毁 Engine 时可保留外部 canvas 的 WebGL context', function () {
    engine = createEngine(true, false);
    gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext;
    if (!canEmulateContextLoss(engine)) {
      this.skip();

      return;
    }
    engine.dispose();

    expect(gl.isContextLost()).to.equal(false);
  });

  describe('opt-in 模式 CPU 数据保留', () => {
    beforeEach(() => {
      engine = createEngine(false);
      gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl as WebGLRenderingContext;
    });

    it('release 保留 CPU 源数据（opt-in 可恢复）', () => {
      const data = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
      const tex = new Texture(engine, {
        sourceType: TextureSourceType.data,
        data: { width: 2, height: 2, data },
        format: glContext.RGBA,
        internalFormat: glContext.RGBA,
        type: glContext.UNSIGNED_BYTE,
      });

      tex.initialize();

      // opt-in 模式 release 不释放源数据。
      expect((tex.source as any).data).to.not.be.undefined;
      engine.effectsObjectServer.removeTexture(tex);
      tex.dispose();
    });
  });
});
