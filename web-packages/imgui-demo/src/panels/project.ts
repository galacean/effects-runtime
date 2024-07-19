import type { Player, spec } from '@galacean/effects';
import { generateGUID, loadImage, math } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { GeometryBoxProxy, ModelMeshComponent, Sphere } from '@galacean/effects-plugin-model';
import { GLTFTools, ModelIO } from '@vvfx/resource-detection';
import { folderIcon, jsonIcon } from '../asset/images';
import { AssetDatabase, createPreviewPlayer, generateAssetScene, readFileAsText } from '../core/asset-data-base';
import { editorWindow, menuItem } from '../core/decorators';
import { EditorWindow } from '../core/panel';
import { Selection } from '../core/selection';
import { ImGui, ImGui_Impl } from '../imgui';
import { FileNode } from '../core/file-node';

@editorWindow()
export class Project extends EditorWindow {
  private previewPlayer: Player;
  private rootFileNode: FileNode;
  private selectedFolder: FileNode;
  private fileViewSize = 100;
  private fileViewHovered = false;
  private folderIcon: WebGLTexture;
  private jsonIcon: WebGLTexture;
  private clickingFileNode: FileNode | undefined;

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
      const url = URL.createObjectURL(file);
      const modelIO = new ModelIO();

      let modelType = 'glb';

      if (file.name.endsWith('.fbx')) {
        modelType = 'FBX';
      }

      await modelIO.loadModelByURL([url], { modelType });
      await modelIO.writeGLB();
      const glb = modelIO.glb;
      const result = await GLTFTools.loadGLTF(new Uint8Array(glb));
      const doc = result.doc;
      const json = result.json;
      const editorResult = GLTFTools.processGLTFForEditorECS(doc, json);

      const projectWindow = EditorWindow.getWindow(Project);
      const currentDirHandle = projectWindow.selectedFolder.handle;

      for (const meshData of editorResult.meshes) {
        const geometryAsset = JSON.stringify(Project.createPackageData([meshData.geometryData], 'Geometry'), null, 2);

        if (currentDirHandle.kind === 'directory') {
          await Project.saveFile(Project.createJsonFile(geometryAsset, meshData.geometryData.name + '.json'), currentDirHandle);
        }
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
    this.previewPlayer = createPreviewPlayer();
    this.previewPlayer.renderer.engine.database = new AssetDatabase(this.previewPlayer.renderer.engine);
    void this.createIconTexture(folderIcon).then(texture=>{
      if (texture) {
        this.folderIcon = texture;
      }
    });
    void this.createIconTexture(jsonIcon).then(texture=>{
      if (texture) {
        this.jsonIcon = texture;
      }
    });
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
    const button_sz: ImGui.Vec2 = new ImGui.Vec2(this.fileViewSize, this.fileViewSize);

    if (this.selectedFolder) {
      let n = 0;

      for (const child of this.selectedFolder.children) {
        ImGui.BeginGroup();
        ImGui.PushID(n);
        const frame_padding = 2;                             // -1 === uses default padding (style.FramePadding)
        const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
        const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
        const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background
        let icon = this.jsonIcon;

        if (child.handle.kind === 'directory') {
          icon = this.folderIcon;
        } else if (child.icon) {
          icon = child.icon;
        }
        child.instantiateAssetObject();
        if (Selection.activeObject === child || this.clickingFileNode === child) {
          ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Color(0.0, 100 / 255, 215 / 255, 1.0));
          ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Color(20 / 255, 122 / 255, 215 / 255, 1.0));
        } else {
          ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Color(40 / 255, 40 / 255, 40 / 255, 1.0));
          ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Color(70 / 255, 70 / 255, 70 / 255, 1.0));
        }
        ImGui.PushStyleColor(ImGui.Col.ButtonActive, new ImGui.Color(0.0, 122 / 255, 215 / 255, 1.0));
        if (ImGui.ImageButton(icon, button_sz, uv0, uv1, frame_padding, bg_col)) {
          Selection.activeObject = child;
        }
        if (this.clickingFileNode === child) {
          this.clickingFileNode = undefined;
        }
        if (ImGui.IsItemActive()) {
          this.clickingFileNode = child;
        }
        ImGui.PopID();
        ImGui.PopStyleColor(3);
        if (ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
          if (child.assetObject) {
            ImGui.SetDragDropPayload(child.assetObject.constructor.name, child);
          }
          ImGui.ImageButton(icon, button_sz, uv0, uv1);
          ImGui.EndDragDropSource();
        }
        this.drawFileName(child.handle.name);
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

    this.rootFileNode = new FileNode();
    this.rootFileNode.handle = folderHandle;
    await this.generateFileTree(this.rootFileNode);
    AssetDatabase.rootDirectoryHandle = folderHandle;
    await AssetDatabase.importAllAssets(folderHandle);
  }

  private async generateFileTree (item: FileNode) {
    item.children = [];
    const handle = item.handle;

    if (handle.kind === 'directory') {
      for await (const entry of handle.values()) {
        const childNode = new FileNode();

        childNode.handle = entry;
        item.children.push(childNode);
        await this.generateFileTree(childNode);
      }
    } else {
      const file = await handle.getFile();
      let res: string;

      try {
        res = await readFileAsText(file);
        const packageData = JSON.parse(res) as spec.EffectsPackageData;

        if (packageData.fileSummary.assetType) {
          item.assetType = packageData.fileSummary.assetType;
        }
      } catch (error) {
        console.error('读取文件 ' + file.name + ' 出错:' + error);

        return;
      }
    }
  }

  private async createFileIcons (item: FileNode) {
    if (item.handle.kind === 'directory') {
      for (const child of item.children) {
        if (child.handle.kind === 'file') {
          await child.handle.getFile().then(async (file: File)=>{
            if (file.name.endsWith('.json')) {
              const json = await readFileAsText(file);
              const packageData: spec.EffectsPackageData = JSON.parse(json);

              const previewScene = generateAssetScene(packageData);

              if (!previewScene) {
                return;
              }
              this.previewPlayer.destroyCurrentCompositions();
              const composition = await this.previewPlayer.loadScene(previewScene);
              const previewItem = composition.getItemByName('3d-mesh');

              if (!previewItem) {
                return;
              }
              const geometryproxy = new GeometryBoxProxy();
              const boundingBox = new math.Box3();

              geometryproxy.create(previewItem.getComponent(ModelMeshComponent).content.subMeshes[0].getEffectsGeometry(), []);
              geometryproxy.getBoundingBox(boundingBox);
              const sphere = new Sphere();

              boundingBox.getBoundingSphere(sphere);
              const radius = sphere.radius;
              const center = sphere.center;

              let scaleRatio = 4 * 1 / radius;

              if (packageData.fileSummary.assetType === 'Material') {
                scaleRatio = 8 * 1 / radius;
              }
              previewItem.setPosition(-center.x * scaleRatio, -center.y * scaleRatio, -center.z * scaleRatio);
              previewItem.setScale(scaleRatio, scaleRatio, scaleRatio);
              previewItem.rotate(0, 25, 0);

              this.previewPlayer.gotoAndStop(1);
              this.previewPlayer.renderer.renderRenderFrame(composition.renderFrame);

              const iconTexture = await this.createIconTexture(this.previewPlayer.canvas);

              if (iconTexture) {
                child.icon = iconTexture;
              }
            }
          });
        }
      }
    }
  }

  private drawFileTree (item: FileNode, baseFlags: ImGui.TreeNodeFlags) {
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;

    const handle = item.handle;

    if (Selection.activeObject === item) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (handle.kind === 'file') {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.handle.name === 'assets') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }
    const node_open: boolean = ImGui.TreeNodeEx(handle.name, nodeFlags, handle.name);

    if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
      if (handle.kind === 'directory') {
        this.selectedFolder = item;
        void this.createFileIcons(item);
      }
      Selection.activeObject = item;
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

  private drawFileName (name: string) {
    // 获取按钮的尺寸
    const buttonSize = ImGui.GetItemRectSize();

    // 要显示的文本
    let text = name;

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
  }

  private async createIconTexture (imageURLOrCanvas: string | HTMLCanvasElement) {
    if (ImGui_Impl && ImGui_Impl.gl) {
      const gl = ImGui_Impl.gl;
      const tex = gl.createTexture();
      let textureSource = null;

      if (imageURLOrCanvas instanceof HTMLCanvasElement) {
        textureSource = imageURLOrCanvas;
      } else if (typeof(imageURLOrCanvas) === 'string') {
        textureSource = await loadImage(imageURLOrCanvas);
      }

      if (!textureSource) {
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);

      return tex;
    }
  }
}