import type { TrackAsset } from '@galacean/effects';
import { CompositionComponent } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class Sequencer extends EditorWindow {

  private start: number = 0;

  @menuItem('Window/Sequencer')
  static showWindow () {
    EditorWindow.getWindow(Sequencer).open();
  }

  constructor () {
    super();
    this.title = 'Sequencer';
    this.open();
  }

  protected override onGUI (): void {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }
    const currentComposition = GalaceanEffects.player.getCompositions()[0];
    const compositionComponent = currentComposition.rootItem.getComponent(CompositionComponent);

    if (!compositionComponent) {
      return;
    }

    //@ts-expect-error
    for (const track of compositionComponent.timelineAsset.tracks) {
      const trackAsset = track as TrackAsset;

      //@ts-expect-error
      ImGui.CollapsingHeader(trackAsset.binding.name);
      this.drawTrack(trackAsset);
    }
    // ImGui.SliderInt('slider int', (value = this.start)=>this.start = value, -1, 100, '##NoDisplay');
  }

  private drawTrack (track: TrackAsset) {
    for (const child of track.getChildTracks()) {
      const trackAsset = child;

      for (const clip of trackAsset.getClips()) {
        ImGui.Text(trackAsset.constructor.name);

        ImGui.SameLine(200);
        ImGui.SliderFloat('##' + trackAsset.getInstanceId(), (value = clip.start) => clip.start = value, 0, GalaceanEffects.player.getCompositions()[0].getDuration());
      }
    }
  }
}