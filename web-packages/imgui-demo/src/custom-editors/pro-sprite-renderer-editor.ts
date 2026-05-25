import { ProParticleSystemRendererComponent, ProRibbonRenderer, ProSpriteRenderer } from '@galacean/effects';
import { editor } from '../core/decorators';
import { ImGui } from '../imgui';
import { drawRibbonRendererProperties, drawSpriteRendererProperties } from '../panels/pro-particle-editor';
import { Editor } from './editor';

@editor(ProParticleSystemRendererComponent)
export class ProParticleSystemRendererComponentEditor extends Editor {
  override onInspectorGUI (): void {
    const rc = this.target as ProParticleSystemRendererComponent;

    for (let i = 0; i < rc.renderers.length; i++) {
      const r = rc.renderers[i];

      ImGui.PushID('rc_renderer_' + i);
      if (r instanceof ProSpriteRenderer) {
        drawSpriteRendererProperties(r);
      } else if (r instanceof ProRibbonRenderer) {
        drawRibbonRendererProperties(r);
      } else {
        ImGui.TextDisabled('Unknown renderer type');
      }
      ImGui.PopID();
    }
  }
}
