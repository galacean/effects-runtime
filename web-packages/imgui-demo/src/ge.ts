import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-model';
import { ImGui_Impl } from './imgui';
import { JSONConverter } from '@galacean/effects-plugin-model';

export class GalaceanEffects {
  static player: Player;
  static sceneRendederTexture: WebGLTexture;
  static async initialize () {
    const container = document.getElementById('J-container');
    // const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ'; // 春促
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*dnU-SprU5pAAAAAAAAAAAAAADlB4AQ'; // 集五福

    GalaceanEffects.player = new Player({
      container,
    });

    await GalaceanEffects.player.loadScene(json, { autoplay:true });
    GalaceanEffects.player.ticker.add(GalaceanEffects.updateRenderTexture);
  }

  static playURL (url: string) {
    const converter = new JSONConverter(GalaceanEffects.player);

    GalaceanEffects.player.destroyCurrentCompositions();
    void converter.processScene(url).then(async scene =>{
      await GalaceanEffects.player.loadScene(scene, { autoplay:true });
    });
  }

  static updateRenderTexture () {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }
    const gl = ImGui_Impl.gl;

    if (gl) {
      if (!GalaceanEffects.sceneRendederTexture) {
        const tex = gl.createTexture();

        if (tex) {
          GalaceanEffects.sceneRendederTexture = tex;
        }
      }
    }

    if (GalaceanEffects.sceneRendederTexture && gl) {
      gl.bindTexture(gl.TEXTURE_2D, GalaceanEffects.sceneRendederTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GalaceanEffects.player.canvas);
    }
  }
}