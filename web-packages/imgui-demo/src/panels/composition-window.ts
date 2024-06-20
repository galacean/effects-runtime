import inspireList from '../asset/inspire-list';
import { editorWindow, menuItem } from '../core/decorators';
import { UIManager } from '../core/ui-manager';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class CompositionWindow extends EditorWindow {

  private currentItem: number = 0;
  private compositionNames: string[] = [];
  private compositionURLs: string[] = [];
  private currentCompositionURL: string = '';

  @menuItem('Window/Composition')
  static showWindow () {
    UIManager.getWindow(CompositionWindow).open();
  }

  constructor () {
    super();
    this.title = 'Composition';

    for (const compositionName of Object.keys(inspireList)) {
      //@ts-expect-error
      this.compositionNames.push(inspireList[compositionName].name);
      //@ts-expect-error
      this.compositionURLs.push(inspireList[compositionName].url);
    }
    this.open();
  }

  protected override onGUI (): void {
    ImGui.Text('合成URL');
    ImGui.SameLine();
    if (ImGui.InputText('##CompositionURL', (value = this.currentCompositionURL) => this.currentCompositionURL = value, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
      void GalaceanEffects.playURL(this.currentCompositionURL);
    }
    ImGui.Text('合成列表');
    ImGui.SameLine();
    if (ImGui.ListBox('', (value = this.currentItem) => this.currentItem = value, this.compositionNames, this.compositionNames.length, this.compositionNames.length)) {
      this.currentCompositionURL = this.compositionURLs[this.currentItem];
      void GalaceanEffects.playURL(this.currentCompositionURL);
    }
  }
}