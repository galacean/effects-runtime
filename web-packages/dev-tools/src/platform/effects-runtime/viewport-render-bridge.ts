import type { Player } from '@galacean/effects';
import { ImGuiBackend } from '../imgui/index';

export class ViewportRenderBridge {
  private currentTexture?: WebGLTexture;

  get texture (): WebGLTexture | undefined { return this.currentTexture; }

  update (player: Player): void {
    if (player.getCompositions().length === 0) {
      return;
    }
    const gl = ImGuiBackend.gl;

    if (gl) {
      if (!this.currentTexture) {
        const tex = gl.createTexture();

        if (tex) {
          this.currentTexture = tex;
        }
      }
    }

    if (this.currentTexture && gl) {
      gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, player.canvas);
    }
  }
}

export const viewportRenderBridge = new ViewportRenderBridge();
