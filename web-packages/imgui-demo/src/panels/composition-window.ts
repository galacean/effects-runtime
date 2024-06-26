import inspireList from '../asset/inspire-list';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class CompositionWindow extends EditorWindow {

  private currentItem: number = 0;
  private compositionNames: string[] = [];
  private compositionURLs: string[] = [];
  private currentCompositionURL: string = '';

  private use3DConverter: boolean = false;

  @menuItem('Window/Composition')
  static showWindow () {
    EditorWindow.getWindow(CompositionWindow).open();
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
    const alignedSize = 200;

    ImGui.Text('合成URL');
    ImGui.SameLine(alignedSize);
    if (ImGui.InputText('##CompositionURL', (value = this.currentCompositionURL) => this.currentCompositionURL = value, undefined, ImGui.InputTextFlags.EnterReturnsTrue)) {
      void GalaceanEffects.playURL(this.currentCompositionURL, this.use3DConverter);
    }
    ImGui.Text('使用 3D 转换器');
    ImGui.SameLine(alignedSize);
    ImGui.Checkbox('##Use3DConverter', (value = this.use3DConverter) => this.use3DConverter = value);
    ImGui.Text('合成列表');
    ImGui.SameLine(alignedSize);
    if (ImGui.ListBox('', (value = this.currentItem) => this.currentItem = value, this.compositionNames, this.compositionNames.length, this.compositionNames.length)) {
      this.currentCompositionURL = this.compositionURLs[this.currentItem];
      void GalaceanEffects.playURL(this.currentCompositionURL);
    }
  }
}