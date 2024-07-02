import type { spec } from '@galacean/effects';
import { generateGUID } from '@galacean/effects';
import { GLTFTools, ModelIO } from '@vvfx/resource-detection';
import { editorWindow, menuItem } from '../core/decorators';
import { ImGui } from '../imgui';
import { EditorWindow } from './panel';

@editorWindow()
export class Project extends EditorWindow {
  private rootFileNode: FileNode;
  private selectedFolder: FileNode;
  private fileViewSize = 100;
  private fileViewHovered = false;

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

  static async drop (event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) {
      return;
    }
    const files = event.dataTransfer.files;

    if (EditorWindow.getWindow(Project).isFileViewHovered()) {
      await Project.handleDroppedFiles(files);
    }
  }

  static async handleDroppedFiles (files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 处理拖拽进来的文件，比如显示文件信息，上传文件等等
      //   console.log('拖拽进来的文件：' + file.name);

      const url = URL.createObjectURL(file);

      const modelIO = new ModelIO();

      await modelIO.loadModelByURL([url]);
      await modelIO.writeGLB();
      const glb = modelIO.glb;
      const result = await GLTFTools.loadGLTF(new Uint8Array(glb));
      const doc = result.doc;
      const json = result.json;
      const editorResult = GLTFTools.processGLTFForEditorECS(doc, json);

      const projectWindow = EditorWindow.getWindow(Project);
      const currentDirHandle = projectWindow.selectedFolder.handle;
      const geometryAsset = JSON.stringify(Project.createPackageData([editorResult.meshes[0].geometryData], 'Geometry'), null, 2);

      if (currentDirHandle.kind === 'directory') {
        await Project.saveFile(Project.createJsonFile(geometryAsset, editorResult.meshes[0].geometryData.name + '.json'), currentDirHandle);
      }

      await projectWindow.generateFileTree(projectWindow.selectedFolder);
    }
  }

  static createJsonFile (json: string, fileName: string) {
    // 将字符串转换为Blob
    const newBlob = new Blob([json], { type: 'application/json' });

    // 创建File对象，需要提供Blob、文件名和最后修改时间
    const newFile = new File([newBlob], fileName, { type: 'application/json', lastModified: Date.now() });

    return newFile;
  }

  static async saveFile (file: File, dirHandle?: FileSystemDirectoryHandle) {
    if (!dirHandle) {return;}

    // create a new handle
    const newFileHandle = await dirHandle.getFileHandle(file.name, { create: true });

    if (!newFileHandle) {return;}

    // create a FileSystemWritableFileStream to write to
    const writableStream = await newFileHandle.createWritable();

    // write our file
    await writableStream.write(file);

    // close the file and write the contents to disk.
    await writableStream.close();

    return newFileHandle;
  }

  static createPackageData (effectsObjectDatas: spec.EffectsObjectData[], assetType = 'any') {
    const newPackageData: spec.EffectsPackageData = {
      fileSummary: { guid: generateGUID(), assetType },
      exportObjects: effectsObjectDatas,
    };

    return newPackageData;
  }

  constructor () {
    super();
    this.title = 'Project';
    this.open();
  }

  isFileViewHovered () {
    return this.fileViewHovered;
  }

  protected override onGUI (): void {
    ImGui.BeginChild('FileTree', new ImGui.Vec2(ImGui.GetWindowContentRegionWidth() * 0.2, ImGui.GetWindowContentRegionMax().y - ImGui.GetWindowContentRegionMin().y), true);
    if (ImGui.Button('选择文件夹')) {
      void this.readFolder();
    }

    if (this.rootFileNode) {
      const base_flags = ImGui.TreeNodeFlags.OpenOnArrow |
          ImGui.TreeNodeFlags.OpenOnDoubleClick |
          ImGui.TreeNodeFlags.SpanAvailWidth |
          ImGui.TreeNodeFlags.SpanFullWidth;

      void this.drawFileTree(this.rootFileNode, base_flags);
    }
    ImGui.EndChild();

    ImGui.SameLine();
    ImGui.BeginChild('FileView', new ImGui.Vec2(ImGui.GetWindowContentRegionWidth() * 0.8, ImGui.GetWindowContentRegionMax().y - ImGui.GetWindowContentRegionMin().y), true);
    this.fileViewHovered = ImGui.IsWindowHovered();
    const style: ImGui.Style = ImGui.GetStyle();
    const buttons_count = 20;
    const window_visible_x2 = ImGui.GetWindowPos().x + ImGui.GetWindowContentRegionMax().x;
    const button_sz: ImGui.Vec2 = new ImGui.Vec2(this.fileViewSize, this.fileViewSize * 1.2);

    if (this.selectedFolder) {
      let n = 0;

      for (const child of this.selectedFolder.children) {
        ImGui.BeginGroup();
        ImGui.PushID(n);
        ImGui.Button('##' + n, button_sz);
        ImGui.PopID();
        // 获取按钮的尺寸
        const buttonSize = ImGui.GetItemRectSize();

        // 要显示的文本
        let text = child.handle.name;

        // 计算文本所需的宽度
        const textSize = ImGui.CalcTextSize(text);

        // 如果文本的宽度超过按钮宽度，则进行截断
        if (textSize.x > buttonSize.x) {
          while (text.length > 0 && ImGui.CalcTextSize(text + '...').x > buttonSize.x) {
            text = text.slice(0, -1);
          }
          text += '...';
        }

        let preEmptySpace = '';

        while (ImGui.CalcTextSize(preEmptySpace).x < buttonSize.x - ImGui.CalcTextSize(text).x) {
          preEmptySpace += ' ';
          text = ' ' + text;
        }

        // 显示文本
        ImGui.Text(text);
        ImGui.EndGroup();
        const last_button_x2 = ImGui.GetItemRectMax().x;
        const next_button_x2 = last_button_x2 + style.ItemSpacing.x + button_sz.x; // Expected position if next button was on same line

        if (n + 1 < buttons_count && next_button_x2 < window_visible_x2) {ImGui.SameLine();}
        n++;
      }
    }
    ImGui.NewLine();
    this.drawFileSizeSlider();
    ImGui.EndChild();
  }

  private async readFolder () {
    const folderHandle = await window.showDirectoryPicker();

    // for await (const entry of folderHandle.values()) {
    //   if (entry.kind === 'directory') {
    //     console.log('Found sub-directory:', entry.name);
    //   } else {
    //     const file = await entry.getFile();

    //     console.log('Found file:', file.name);
    //     // 你可以使用 FileReader 对象等方法来读取文件内容
    //   }
    // }

    this.rootFileNode = { handle:folderHandle, children:[] };
    await this.generateFileTree(this.rootFileNode);
  }

  private async generateFileTree (item: FileNode) {
    item.children = [];
    const handle = item.handle;

    if (handle.kind === 'directory') {
      for await (const entry of handle.values()) {
        const childNode = {
          handle:entry,
          children:[],
        };

        item.children.push(childNode);
        await this.generateFileTree(childNode);
      }
    }

  }

  private drawFileTree (item: FileNode, baseFlags: ImGui.TreeNodeFlags) {
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;

    const handle = item.handle;

    if (this.selectedFolder === item) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (handle.kind === 'file') {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.handle.name === 'assets') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }
    const node_open: boolean = ImGui.TreeNodeEx(handle.name, nodeFlags, handle.name);

    if (handle.kind === 'directory' && ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
      this.selectedFolder = item;
    }

    if (node_open) {
      for (const node of item.children) {
        this.drawFileTree(node, baseFlags);
      }
      ImGui.TreePop();
    }
  }

  private drawFileSizeSlider () {
    // 获取窗口的尺寸和位置
    const windowSize = ImGui.GetWindowSize();
    const padding: number = 20; // 边距

    // 估算 Slider 的大小
    const sliderSize = new ImGui.ImVec2(200, 20); // 宽 200，高 20

    // 计算 Slider 在窗口右下角的位置
    const sliderPos = new ImGui.ImVec2(
      windowSize.x - sliderSize.x - padding,
      windowSize.y - sliderSize.y - padding
    );

    // 设置光标位置
    ImGui.SetCursorPos(sliderPos);
    ImGui.SetNextItemWidth(sliderSize.x);
    // 显示 Slider
    ImGui.PushStyleVar(ImGui.StyleVar.GrabMinSize, 25);
    ImGui.SliderFloat('##RightBottomSlider', (value = this.fileViewSize) => this.fileViewSize = value, 5, 200, '');
    ImGui.PopStyleVar();
  }
}

interface FileNode {
  handle: FileSystemDirectoryHandle | FileSystemFileHandle,
  children: FileNode[],
}

