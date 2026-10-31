import type { Engine, GPUFramebuffer } from '@galacean/effects';
import { Material, Texture, TextureSourceType, math, glContext } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import type { PreviewTextureSource } from './texture-preview-cache';

export interface TextureDisplay { channels: [number, number, number, number], desaturate: boolean }
export type TexturePreview = { tex: PreviewTextureSource, uv0: math.Vector2, uv1: math.Vector2, corners?: [math.Vector2, math.Vector2, math.Vector2, math.Vector2] };

export function imageTexturePreview (image: { texture: PreviewTextureSource, flipY?: boolean }): TexturePreview {
  return { tex: image.texture, uv0: new math.Vector2(0, image.flipY ? 1 : 0), uv1: new math.Vector2(1, image.flipY ? 0 : 1) };
}

export function getOrCreateTexturePreview (texture: Texture, source: PreviewTextureSource = texture): TexturePreview | null {
  if (!(texture instanceof Texture) || texture.isDestroyed) { return null; }

  return imageTexturePreview({ texture: source, flipY: texture.source.sourceType === TextureSourceType.framebuffer || !!texture.source.flipY });
}

/** Resolves scene resources during update; drawing only submits a normal Texture to Control. */
export class TexturePresentation {
  private result?: Texture;
  private preview?: TexturePreview;
  private target?: GPUFramebuffer;
  private material?: Material;
  private converted = false;

  constructor (private readonly engine: Engine) { }

  update (preview?: TexturePreview, display?: TextureDisplay, maxDimension = 2048): void {
    this.preview = preview; this.result = undefined; this.converted = false;
    const source = preview && (typeof preview.tex === 'function' ? preview.tex() : preview.tex);

    if (!source || source.isDestroyed || !preview) { return; }
    const device = this.engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const sourceDevice = source.engine.displayServer.renderingDevice as RenderingDeviceWebGL;

    if (device.contextWasLost || device.gl !== sourceDevice.gl) { return; }
    const premultiplied = source.source.premultiplyAlpha || source.source.sourceType === TextureSourceType.framebuffer;
    const filtered = display && (display.desaturate || display.channels.some(channel => channel !== 1));

    this.result = source;
    if (!premultiplied && !filtered && !preview.corners) { return; }
    const width = Math.max(1, Math.floor(Math.min(maxDimension, source.width))), height = Math.max(1, Math.floor(Math.min(maxDimension, source.height)));

    if (!this.target) {
      const color = Texture.create(this.engine, { name: 'EditorPreview', sourceType: TextureSourceType.framebuffer,
        data: { width, height }, minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE });

      color.unregisterObject();
      this.target = device.createFramebuffer({ name: 'EditorPreview', attachments: [color], viewport: [0, 0, width, height], storeAction: {} });
      this.target.initialize();
      this.material = Material.create(this.engine, { shader: {
        vertex: 'precision highp float; attribute vec2 aPos; varying vec2 uv; void main(){ uv=vec2(aPos.x*.5+.5,.5-aPos.y*.5); gl_Position=vec4(aPos,0.,1.); }',
        fragment: 'precision highp float; varying vec2 uv; uniform sampler2D _MainTex; uniform vec4 topUV; uniform vec4 bottomUV; uniform vec4 channels; uniform float premultiplied; uniform float desaturate; void main(){ vec2 p=mix(mix(topUV.xy,topUV.zw,uv.x),mix(bottomUV.xy,bottomUV.zw,uv.x),uv.y); vec4 c=texture2D(_MainTex,p); if(premultiplied>0.5 && c.a>0.00001) c.rgb/=c.a; if(dot(channels.rgb,vec3(1.))<0.5) c=vec4(vec3(c.a*channels.a),1.); else { c.rgb*=channels.rgb; if(desaturate>0.5) c.rgb=vec3(dot(c.rgb,vec3(.299,.587,.114))); c.a=mix(1.,c.a,channels.a); } gl_FragColor=c; }',
      } });
      this.material.unregisterObject(); this.material.blending = this.material.depthTest = this.material.culling = false;
    }
    const corners = preview.corners ?? [preview.uv0, new math.Vector2(preview.uv1.x, preview.uv0.y), preview.uv1, new math.Vector2(preview.uv0.x, preview.uv1.y)];
    const material = this.material!;

    material.setVector4('topUV', new math.Vector4(corners[0].x, corners[0].y, corners[1].x, corners[1].y));
    material.setVector4('bottomUV', new math.Vector4(corners[3].x, corners[3].y, corners[2].x, corners[2].y));
    material.setVector4('channels', new math.Vector4(...(display?.channels ?? [1, 1, 1, 1])));
    material.setFloat('premultiplied', premultiplied ? 1 : 0); material.setFloat('desaturate', display?.desaturate ? 1 : 0);
    device.gl.bindVertexArray(null); device.gl.activeTexture(device.gl.TEXTURE0); device.reset(); device.setScissorTest(false);
    this.target.resize(0, 0, width, height);
    this.engine.renderer.blit(source, this.target, material);
    this.result = this.target.getColorTextures()[0]; this.converted = true;
  }

  draw (control: Control, x: number, y: number, width: number, height: number): void {
    if (!this.result || this.result.isDestroyed || !this.preview) { return; }
    const p = this.preview;
    const region = this.converted ? { u0: 0, v0: 0, u1: 1, v1: 1 } : { u0: p.uv0.x, v0: p.uv1.y, u1: p.uv1.x, v1: p.uv0.y };

    control.drawTexture(x, y, width, height, this.result, region);
  }
  dispose (): void { this.target?.dispose(); this.material?.dispose(); }
}
