import type { spec, Player } from '@galacean/effects';
import { math } from '@galacean/effects';
import { GeometryBoxProxy, ModelMeshComponent, Sphere } from '@galacean/effects-plugin-model';
import { AssetDatabase, createPreviewPlayer, generateAssetScene } from '../core/asset-data-base';
import { editorWindow, menuItem } from '../core/decorators';
import { OrbitController } from '../core/orbit-controller';
import { Selection } from '../core/selection';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorWindow } from '../core/panel';
import { FileNode } from './project';

@editorWindow()
export class Preview extends EditorWindow {
  private previewPlayer: Player;
  private previewObject: object;
  private cameraController: OrbitController;
  private sceneRendederTexture: WebGLTexture;

  @menuItem('Window/Preview')
  static showWindow () {
    EditorWindow.getWindow(Preview).open();
  }

  constructor () {
    super();
    this.title = 'Preview';
    this.previewPlayer = createPreviewPlayer();
    this.previewPlayer.ticker.add(this.updateRenderTexture);
    this.previewPlayer.renderer.engine.database = new AssetDatabase(this.previewPlayer.renderer.engine);
    this.cameraController = new OrbitController();
    this.open();
  }

  protected override onGUI (): void {
    if (!(Selection.activeObject instanceof FileNode) || Selection.activeObject.handle.kind === 'directory') {
      ImGui.End();

      return;
    }

    if (Selection.activeObject !== this.previewObject) {
      void Selection.activeObject.handle.getFile().then(async (file: File)=>{
        if (file.name.endsWith('.json')) {
          const json = await this.readFile(file);
          const packageData: spec.EffectsPackageData = JSON.parse(json);
          const previewScene = generateAssetScene(packageData);

          if (previewScene) {
            this.previewPlayer.destroyCurrentCompositions();
            const composition = await this.previewPlayer.loadScene(previewScene);
            const previewItem = composition.getItemByName('3d-mesh');

            if (previewItem) {
              const geometryproxy = new GeometryBoxProxy();
              const boundingBox = new math.Box3();

              geometryproxy.create(previewItem.getComponent(ModelMeshComponent).content.subMeshes[0].getEffectsGeometry(), []);
              geometryproxy.getBoundingBox(boundingBox);
              const sphere = new Sphere();

              boundingBox.getBoundingSphere(sphere);
              const radius = sphere.radius;
              const center = sphere.center;

              const scaleRatio = 4 * 1 / radius;

              previewItem.setPosition(-center.x * scaleRatio, -center.y * scaleRatio, -center.z * scaleRatio);
              previewItem.setScale(scaleRatio, scaleRatio, scaleRatio);
              previewItem.rotate(0, 25, 0);
            }
          }
        }
      });
      this.previewObject = Selection.activeObject;
    }
    const sceneImageSize = ImGui.GetWindowSize();

    sceneImageSize.x -= 15;
    sceneImageSize.y -= 40;
    this.resizePlayer(sceneImageSize.x, sceneImageSize.y);

    if (this.sceneRendederTexture) {
      const frame_padding = 0;                             // -1 === uses default padding (style.FramePadding)
      const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
      const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
      const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background

      ImGui.ImageButton(this.sceneRendederTexture, new ImGui.Vec2(sceneImageSize.x, sceneImageSize.y), uv0, uv1, frame_padding, bg_col);
      if (ImGui.IsItemHovered()) {
        this.cameraController.update(this.previewPlayer.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
      }
    }
  }

  private resizePlayer (width: number, height: number) {
    const player = this.previewPlayer;

    if (player.container && (player.container.style.width !== width + 'px' ||
        player.container.style.height !== height + 'px')
    ) {
      player.container.style.width = width + 'px';
      player.container.style.height = height + 'px';
      player.resize();
    }
  }

  private updateRenderTexture = () =>{
    if (this.previewPlayer.getCompositions().length === 0) {
      return;
    }
    const gl = ImGui_Impl.gl;

    if (gl) {
      if (!this.sceneRendederTexture) {
        const tex = gl.createTexture();

        if (tex) {
          this.sceneRendederTexture = tex;
        }
      }
    }

    if (this.sceneRendederTexture && gl) {
      gl.bindTexture(gl.TEXTURE_2D, this.sceneRendederTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.previewPlayer.canvas);
    }
  };

  private readFile (file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('Failed to read the file'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read the file'));
      };
      reader.readAsText(file);
    });
  }
}