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

  @menuItem('Editor/Composition')
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
    if (ImGui.InputText('合成URL', (value = this.currentCompositionURL) => this.currentCompositionURL = value, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
      void GalaceanEffects.playURL(this.currentCompositionURL);
    }

    if (ImGui.ListBox('', (value = this.currentItem) => this.currentItem = value, this.compositionNames, this.compositionNames.length, this.compositionNames.length)) {
      this.currentCompositionURL = this.compositionURLs[this.currentItem];
      void GalaceanEffects.playURL(this.currentCompositionURL);
    }
  }
}