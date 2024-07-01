import { editorWindow, menuItem } from '../core/decorators';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class Project extends EditorWindow {

  @menuItem('Window/Project')
  static showWindow () {
    EditorWindow.getWindow(Project).open();
  }

  static allowDrop (event: any) {
    event.preventDefault();
    const io = ImGui.GetIO();

    io.MousePos.x = event.offsetX;
    io.MousePos.y = event.offsetY;
  }

  static drop (event: any) {
    event.preventDefault();
    const files = event.dataTransfer.files;

    if (EditorWindow.getWindow(Project).isHovered()) {
      Project.handleDroppedFiles(files);
    }
  }

  static handleDroppedFiles (files: any) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 处理拖拽进来的文件，比如显示文件信息，上传文件等等
    //   console.log('拖拽进来的文件：' + file.name);
    }
  }

  constructor () {
    super();
    this.title = 'Project';
    this.open();
  }

  protected override onGUI (): void {
  }
}