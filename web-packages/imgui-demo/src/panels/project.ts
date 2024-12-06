import type { Player } from '@galacean/effects';
import { generateGUID, glContext, loadImage, math, spec } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { GeometryBoxProxy, ModelMeshComponent, Sphere } from '@galacean/effects-plugin-model';
import { GLTFTools, ModelIO } from '@vvfx/resource-detection';
import { folderIcon, jsonIcon } from '../asset/images';
import { AssetDatabase, createPreviewPlayer, generateAssetScene, readFileAsAsData, readFileAsText } from '../core/asset-data-base';
import { editorWindow, menuItem } from '../core/decorators';
import { FileNode } from '../core/file-node';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorWindow } from './editor-window';

/**
 * Used to sync play preview scene when generating asset icon.
 */
class AssetLock {
  private isLocked: boolean = false; // 当前锁的状态
  private waitingResolvers: Array<() => void> = []; // 等待锁释放的 Promise 解析函数

  // 尝试获取锁，如果锁被占用则返回一个会等待锁释放的 Promise
  async acquire (): Promise<void> {
    if (this.isLocked) {
      await new Promise<void>(resolve => this.waitingResolvers.push(resolve));
    }
    this.isLocked = true;
  }

  // 释放锁，并通知下一个等待者（如果有的话）
  release (): void {
    if (!this.isLocked) {
      throw new Error('Lock is not acquired yet.');
    }

    this.isLocked = false;

    const resolve = this.waitingResolvers.shift();

    if (resolve) {
      resolve();
    }
  }
}

@editorWindow()
export class Project extends EditorWindow {
  private fileViewSize = 100;
  private fileViewHovered = false;

  private previewPlayer: Player;

  private selectedFolder: FileNode;
  private rootFileNode: FileNode;
  private clickingFileNode: FileNode | undefined;

  private folderIcon: WebGLTexture;
  private jsonIcon: WebGLTexture;

  private assetLock = new AssetLock();

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
    const projectWindow = EditorWindow.getWindow(Project);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const currentDirHandle = projectWindow.selectedFolder.handle as FileSystemDirectoryHandle;
      const lastDotIndex = file.name.lastIndexOf('.');
      const fileType = lastDotIndex !== -1 ? file.name.substring(lastDotIndex + 1) : '';

      switch (fileType) {
        case 'glb':
        case 'fbx': {
          const url = URL.createObjectURL(file);
          const modelIO = new ModelIO();
          let modelType = 'glb';

          if (fileType === 'fbx') {
            modelType = 'FBX';
          }

          await modelIO.loadModelByURL([url], { modelType });
          await modelIO.writeGLB();
          const glb = modelIO.glb;
          const result = await GLTFTools.loadGLTF(new Uint8Array(glb));
          const doc = result.doc;
          const json = result.json;
          const editorResult = GLTFTools.processGLTFForEditorECS(doc, json);

          for (const meshData of editorResult.meshes) {
            const geometryAsset = JSON.stringify(Project.createPackageData([meshData.geometryData], 'Geometry'), null, 2);

            await Project.saveFile(Project.createJsonFile(geometryAsset, meshData.geometryData.name + '.json'), currentDirHandle);
          }

          break;
        }
        case 'png':
        case 'jpg':{
          const result = await readFileAsAsData(file);

          const textureData = { id: generateGUID(), source: result, dataType: spec.DataType.Texture, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT };
          const textureAsset = JSON.stringify(Project.createPackageData([textureData], 'Texture'), null, 2);

          await Project.saveFile(Project.createJsonFile(textureAsset, file.name + '.json'), currentDirHandle);
        }
      }
    }
    await projectWindow.generateFileTree(projectWindow.selectedFolder);
    await projectWindow.createFileIcons(projectWindow.selectedFolder);
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

  imNode = new ImNodeFlow(new Context(), new Style());
  protected override onGUI (): void {
    // ImGui.BeginChild('FileTree', new ImGui.Vec2(ImGui.GetWindowContentRegionWidth() * 0.2, ImGui.GetWindowContentRegionMax().y - ImGui.GetWindowContentRegionMin().y), true);
    // if (ImGui.Button('选择文件夹')) {
    //   void this.readFolder();
    // }
    // ImGui.SameLine();
    // if (ImGui.Button('刷新')) {
    //   void this.refresh();
    // }
    // ImGui.SameLine();
    // if (ImGui.Button('保存')) {
    //   void GalaceanEffects.assetDataBase.saveAssets();
    // }

    // if (this.rootFileNode) {
    //   const base_flags = ImGui.TreeNodeFlags.OpenOnArrow |
    //       ImGui.TreeNodeFlags.OpenOnDoubleClick |
    //       ImGui.TreeNodeFlags.SpanAvailWidth |
    //       ImGui.TreeNodeFlags.SpanFullWidth;

    //   void this.drawFileTree(this.rootFileNode, base_flags);
    // }
    // ImGui.EndChild();

    // ImGui.SameLine();
    // ImGui.BeginChild('FileView', new ImGui.Vec2(ImGui.GetWindowContentRegionWidth() * 0.8, ImGui.GetWindowContentRegionMax().y - ImGui.GetWindowContentRegionMin().y - 40), true);
    // this.fileViewHovered = ImGui.IsWindowHovered();
    // const style: ImGui.Style = ImGui.GetStyle();
    // const window_visible_x2 = ImGui.GetWindowPos().x + ImGui.GetWindowContentRegionMax().x;
    // const button_sz: ImGui.Vec2 = new ImGui.Vec2(this.fileViewSize, this.fileViewSize);

    // if (this.selectedFolder) {
    //   let n = 0;
    //   const buttons_count = this.selectedFolder.children.length;

    //   for (const child of this.selectedFolder.children) {
    //     ImGui.BeginGroup();
    //     ImGui.PushID(n);
    //     const frame_padding = 2;                             // -1 === uses default padding (style.FramePadding)
    //     const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
    //     const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
    //     const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background
    //     let icon = this.jsonIcon;

    //     if (child.handle.kind === 'directory') {
    //       icon = this.folderIcon;
    //     } else if (child.icon) {
    //       icon = child.icon;
    //     }
    //     child.instantiateAssetObject();
    //     if (Selection.activeObject === child || this.clickingFileNode === child) {
    //       ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Color(0.0, 100 / 255, 215 / 255, 1.0));
    //       ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Color(20 / 255, 122 / 255, 215 / 255, 1.0));
    //     } else {
    //       ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Color(40 / 255, 40 / 255, 40 / 255, 1.0));
    //       ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Color(70 / 255, 70 / 255, 70 / 255, 1.0));
    //     }
    //     ImGui.PushStyleColor(ImGui.Col.ButtonActive, new ImGui.Color(0.0, 122 / 255, 215 / 255, 1.0));
    //     if (ImGui.ImageButton(icon, button_sz, uv0, uv1, frame_padding, bg_col)) {
    //       Selection.activeObject = child;
    //     }
    //     if (this.clickingFileNode === child) {
    //       this.clickingFileNode = undefined;
    //     }
    //     if (ImGui.IsItemActive()) {
    //       this.clickingFileNode = child;
    //     }
    //     ImGui.PopID();
    //     ImGui.PopStyleColor(3);
    //     if (ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
    //       if (child.assetObject) {
    //         ImGui.SetDragDropPayload(child.assetObject.constructor.name, child);
    //       }
    //       ImGui.ImageButton(icon, button_sz, uv0, uv1);
    //       ImGui.EndDragDropSource();
    //     }
    //     this.drawFileName(child.handle.name);
    //     ImGui.EndGroup();
    //     const last_button_x2 = ImGui.GetItemRectMax().x;
    //     const next_button_x2 = last_button_x2 + style.ItemSpacing.x + button_sz.x; // Expected position if next button was on same line

    //     if (n + 1 < buttons_count && next_button_x2 < window_visible_x2) {ImGui.SameLine();}
    //     n++;
    //   }
    // }

    // ImGui.EndChild();
    // this.drawFileSizeSlider();

    this.imNode.update();

  }

  private async readFolder () {
    const folderHandle = await window.showDirectoryPicker();

    this.rootFileNode = new FileNode();
    this.rootFileNode.handle = folderHandle;
    await this.refresh();
  }

  private async refresh () {
    await this.generateFileTree(this.rootFileNode);
    AssetDatabase.rootDirectoryHandle = this.rootFileNode.handle as FileSystemDirectoryHandle;
    await AssetDatabase.importAllAssets(this.rootFileNode.handle as FileSystemDirectoryHandle);
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
    if (item.handle.kind !== 'directory') {
      return;
    }
    for (const child of item.children) {
      if (child.handle.kind !== 'file') {
        continue;
      }
      void child.handle.getFile().then(async (file: File)=>{
        if (!file.name.endsWith('.json')) {
          return;
        }
        const json = await readFileAsText(file);
        const packageData: spec.EffectsPackageData = JSON.parse(json);
        let iconTexture: WebGLTexture | undefined;

        switch (packageData.fileSummary.assetType) {
          case 'Geometry':
          case 'Material':{
            const previewScene = generateAssetScene(packageData);

            if (!previewScene) {
              return;
            }

            await this.assetLock.acquire();
            this.previewPlayer.destroyCurrentCompositions();
            const composition = await this.previewPlayer.loadScene(previewScene);
            const previewItem = composition.getItemByName('3d-mesh');

            if (!previewItem) {
              this.assetLock.release();

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
            iconTexture = await this.createIconTexture(this.previewPlayer.canvas);
            this.assetLock.release();

            break;
          }
          case 'Texture':{
            await (GalaceanEffects.player.renderer.engine.database as AssetDatabase).convertImageData(packageData);
            //@ts-expect-error
            iconTexture = await this.createIconTexture(packageData.exportObjects[0].image);
          }
        }
        if (iconTexture) {
          child.icon = iconTexture;
        }
      });
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

  private async createIconTexture (imageURLOrCanvas: string | HTMLCanvasElement | HTMLImageElement): Promise<WebGLTexture | undefined> {
    if (ImGui_Impl && ImGui_Impl.gl) {
      const gl = ImGui_Impl.gl;
      const tex = gl.createTexture();
      let textureSource = null;

      if (imageURLOrCanvas instanceof HTMLCanvasElement || imageURLOrCanvas instanceof HTMLImageElement) {
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

      if (tex) {
        return tex;
      }
    }
  }
}

// 假设您已经有以下类型和接口
// Vec2, Color, Style, Node, Link, Context 等

type Vec2 = ImGui.ImVec2;
type Color = number; // 假设颜色用 32 位整数表示（例如 ARGB）

class Style {
  grid_size: number = 50;
  grid_subdivisions: number = 4;
  colors: {
    grid: Color,
    subGrid: Color,
  } = {
      grid: ImGui.ColorConvertFloat4ToU32(new ImGui.Vec4(1, 1, 1, 1)),
      subGrid: ImGui.ColorConvertFloat4ToU32(new ImGui.Vec4(0.3, 0.3, 0.3, 1)),
    };
  // 添加其他样式属性
}

interface Node {
  update(): void,
  toDestroy(): boolean,
  updatePublicStatus(): void,
  createLink(target: any): void,
  getType(): string,
  pinPoint(): Vec2,
  getStyle(): {
    color: Color,
    extra: {
      link_dragged_thickness: number,
    },
  },
  // 添加其他节点相关属性和方法
}

interface Link {
  update(): void,
  expired(): boolean,
  // 添加其他链接相关属性和方法
}

class Context {
  begin (): void {

  }
  end (): void {

  }
  scroll (): Vec2 {
    return new ImGui.ImVec2(100, 100);
  }
  scale (): number {
    return 1.0;
  }
  // 添加其他上下文相关属性和方法
}

class ImNodeFlow {
  private hovering: any = null;
  private hoveredNode: any = null;
  private draggingNode: any = null;
  private draggingNodeNext: any = null;
  private singleUseClick: boolean = false;
  private context: Context;
  private style: Style;
  private nodes: Map<string, Node> = new Map();
  private links: Array<WeakRef<Link>> = [];
  private dragOut: any = null;
  private droppedLinkPopUp: boolean = false;
  private droppedLinkPopUpComboKey: number | null = null;
  private droppedLinkLeft: any = null;
  private rightClickPopUp: boolean = false;
  private hoveredNodeAux: any = null;
  private pinRecursionBlacklist: Set<any> = new Set();

  // 回调函数用于弹出窗口
  private on_free_space: () => boolean = () => true;
  private m_rightClickPopUp: (node: any) => void = () => {};
  private m_droppedLinkPopUp: (link: any) => void = () => {};

  constructor (context: Context, style: Style) {
    this.context = context;
    this.style = style;
  }

  update () {
    // 更新循环相关状态
    this.hovering = null;
    this.hoveredNode = null;
    this.draggingNode = this.draggingNodeNext;
    this.singleUseClick = ImGui.IsMouseClicked(ImGui.MouseButton.Left);

    // 创建子画布
    this.context.begin();
    // ImGui.GetIO().IniFilename = null;

    const drawList = ImGui.GetWindowDrawList();

    const windowPos = ImGui.GetWindowPos();

    // 显示网格
    const windowSize: Vec2 = ImGui.GetWindowSize();
    const subGridStep = this.style.grid_size / this.style.grid_subdivisions;

    // 绘制主网格线
    for (let x = this.mod(this.context.scroll().x, this.style.grid_size); x < windowSize.x; x += this.style.grid_size) {
      drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.style.colors.grid);
    }

    for (let y = this.mod(this.context.scroll().y, this.style.grid_size); y < windowSize.y; y += this.style.grid_size) {
      drawList.AddLine(new ImGui.ImVec2(windowPos.x, y + windowPos.y), new ImGui.ImVec2(windowPos.x + windowSize.x, y + windowPos.y), this.style.colors.grid);
    }

    // 绘制子网格线
    if (this.context.scale() > 0.7) {
      for (let x = this.mod(this.context.scroll().x, subGridStep); x < windowSize.x; x += subGridStep) {
        drawList.AddLine(new ImGui.ImVec2(x + windowPos.x, windowPos.y), new ImGui.ImVec2(x + windowPos.x, windowPos.y + windowSize.y), this.style.colors.subGrid);
      }

      for (let y = this.mod(this.context.scroll().y, subGridStep); y < windowSize.y; y += subGridStep) {
        drawList.AddLine(new ImGui.ImVec2(windowPos.x, y + windowPos.y), new ImGui.ImVec2(windowPos.x + windowSize.x, y + windowPos.y), this.style.colors.subGrid);
      }
    }

    // // 更新并绘制节点
    // // TODO: 这里可能需要优化
    // drawList.ChannelsSplit(2);
    // this.nodes.forEach(node => node.update());

    // // 移除需要删除的节点
    // for (const [key, node] of this.nodes) {
    //   if (node.toDestroy()) {
    //     this.nodes.delete(key);
    //   }
    // }

    // drawList.ChannelsMerge();
    // this.nodes.forEach(node => node.updatePublicStatus());

    // // 更新并绘制链接
    // this.links.forEach(weakLink => {
    //   const link = weakLink.deref();

    //   if (link && !link.expired()) {
    //     link.update();
    //   }
    // });

    // // 链接放下逻辑
    // if (this.dragOut && ImGui.IsMouseReleased(ImGui.MouseButton.Left)) {
    //   if (!this.hovering) {
    //     if (this.on_free_space() && this.droppedLinkPopUp) {
    //       if (
    //         this.droppedLinkPopUpComboKey === null ||
    //         ImGui.IsKeyDown(this.droppedLinkPopUpComboKey)
    //       ) {
    //         this.droppedLinkLeft = this.dragOut;
    //         ImGui.OpenPopup('DroppedLinkPopUp');
    //       }
    //     }
    //   } else {
    //     this.dragOut.createLink(this.hovering);
    //   }
    // }

    // // 链接拖出逻辑
    // if (!this.draggingNode && this.hovering && !this.dragOut && ImGui.IsMouseClicked(ImGui.MouseButton.Left)) {
    //   this.dragOut = this.hovering;
    // }

    // if (this.dragOut) {
    //   const mousePos = ImGui.GetMousePos();

    //   if (this.dragOut.getType() === 'Output') {
    //     this.smartBezier(
    //       this.dragOut.pinPoint(),
    //       mousePos,
    //       this.dragOut.getStyle().color,
    //       this.dragOut.getStyle().extra.link_dragged_thickness
    //     );
    //   } else {
    //     this.smartBezier(
    //       mousePos,
    //       this.dragOut.pinPoint(),
    //       this.dragOut.getStyle().color,
    //       this.dragOut.getStyle().extra.link_dragged_thickness
    //     );
    //   }

    //   if (ImGui.IsMouseReleased(ImGui.MouseButton.Left)) {
    //     this.dragOut = null;
    //   }
    // }

    // // 右键弹出窗口
    // if (this.rightClickPopUp && ImGui.IsMouseClicked(ImGui.MouseButton.Right) && ImGui.IsWindowHovered()) {
    //   this.hoveredNodeAux = this.hoveredNode;
    //   ImGui.OpenPopup('RightClickPopUp');
    // }

    // if (ImGui.BeginPopup('RightClickPopUp')) {
    //   this.m_rightClickPopUp(this.hoveredNodeAux);
    //   ImGui.EndPopup();
    // }

    // // 放下链接弹出窗口
    // if (ImGui.BeginPopup('DroppedLinkPopUp')) {
    //   this.m_droppedLinkPopUp(this.droppedLinkLeft);
    //   ImGui.EndPopup();
    // }

    // // 移除失效的链接
    // this.links = this.links.filter(weakLink => {
    //   const link = weakLink.deref();

    //   return link && !link.expired();
    // });

    // // 清空递归黑名单
    // this.pinRecursionBlacklist.clear();

    this.context.end();
  }

  // 工具方法

  private mod (value: number, modulus: number): number {
    return value % modulus;
  }

  private smartBezier (start: Vec2, end: Vec2, color: Color, thickness: number): void {
    // 实现智能贝塞尔曲线绘制逻辑
    // 这里假设有一个函数来绘制贝塞尔曲线
    ImGui.GetWindowDrawList().AddBezierCubic(
      start,
      new ImGui.ImVec2((start.x + end.x) / 2, start.y),
      new ImGui.ImVec2((start.x + end.x) / 2, end.y),
      end,
      color,
      thickness
    );
  }

  // 您可能需要实现或绑定以下方法，具体取决于您的 ImGui 绑定
  // 例如：hovering 和 hoveredNode 的检测等
}

