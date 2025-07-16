//@ts-nocheck
import type { JSONValue, MaterialProps, Renderer, spec } from '@galacean/effects';
import { GLSLVersion, Geometry, Material, OrderType, Player, RenderPass, RenderPassPriorityPostprocess, VFXItem, glContext, math } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { JSONConverter } from '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-spine';
import { Selection } from './core/selection';
import { ImGui_Impl } from './imgui';
import { AssetDatabase } from './core/asset-data-base';
import * as animationScene from './demo.json';

export class GalaceanEffects {
  static player: Player;
  static assetDataBase: AssetDatabase;
  static sceneRendederTexture: WebGLTexture;
  static async initialize () {
    const container = document.getElementById('J-container');
    // const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ'; // 春促\

    GalaceanEffects.player = new Player({ container });
    GalaceanEffects.player.ticker.add(GalaceanEffects.updateRenderTexture);
    GalaceanEffects.assetDataBase = new AssetDatabase(GalaceanEffects.player.renderer.engine);
    GalaceanEffects.player.renderer.engine.database = GalaceanEffects.assetDataBase;
    GalaceanEffects.playURL(JSON.parse(JSON.stringify(animationScene)));
  }

  static playURL (url: string, use3DConverter = false) {
    GalaceanEffects.player.destroyCurrentCompositions();
    if (use3DConverter) {
      const converter = new JSONConverter(GalaceanEffects.player.renderer);

      void converter.processScene(url).then(async (scene: any) => {
        const composition = await GalaceanEffects.player.loadScene(scene, { autoplay: true });

        composition.renderFrame.addRenderPass(new OutlinePass(composition.renderer, {
          name: 'OutlinePass',
          priority: RenderPassPriorityPostprocess,
          meshOrder: OrderType.ascending,
        }),);
      });
    } else {
      const guidToItemMap: Record<string, spec.VFXItemData> = {};

      for (const item of (url as unknown as spec.JSONScene).items) {
        guidToItemMap[item.id] = item;

        item.transform!.size = {
          x:1,
          y:1,
          ...item.transform!.size,
        };

        item.transform!.sourceSize = {
          x:item.transform?.size?.x ?? 1,
          y:item.transform?.size?.y ?? 1,
        };
      }

      for (const item of (url as unknown as spec.JSONScene).items) {

        const parentItem = guidToItemMap[item.parentId!];

        let minX = -4.62;
        let minY = -10;
        let maxX = 4.62;
        let maxY = 10;

        if (parentItem) {
          const sizeX = parentItem.transform?.sourceSize?.x ?? 1;
          const sizeY = parentItem.transform?.sourceSize?.y ?? 1;

          minX = -sizeX / 2;
          minY = -sizeY / 2;
          maxX = sizeX / 2;
          maxY = sizeY / 2;
        }

        const defaultDeviceWidth = 720;
        const defaultDeviceHeight = 1280;

        const pixelsPerUnit = 1 / (4.62 - (-4.62)) * defaultDeviceWidth;

        if (item.name.includes('TopLeft')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 1,
            anchorRight: 0,
            anchorBottom: 1,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - minX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - maxY) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }
        if (item.name.includes('BottomRight')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 1,
            anchorTop: 0,
            anchorRight: 1,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - maxX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - minY) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }
        if (item.name.includes('TopRight')) {
          item.transform = {
            ...item.transform,
            anchorLeft:1,
            anchorTop: 1,
            anchorRight: 1,
            anchorBottom: 1,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - maxX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - maxY) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }
        if (item.name.includes('BottomLeft')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 0,
            anchorRight: 0,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - minX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - minY) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }
        if (item.name.includes('MiddleCenter')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0.5,
            anchorTop: 0.5,
            anchorRight: 0.5,
            anchorBottom: 0.5,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - (minX + maxX) / 2) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - (minY + maxY) / 2) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }

        if (item.name.includes('StretchLeft')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 1,
            anchorRight: 0,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - minX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - (maxY + minY) / 2) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = (maxY - minY - item.transform!.size!.y) * pixelsPerUnit;
        }

        if (item.name.includes('StretchRight')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 1,
            anchorTop: 1,
            anchorRight: 1,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - maxX) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - (maxY + minY) / 2) * pixelsPerUnit;

          item.transform!.size!.x = item.transform!.size!.x * pixelsPerUnit;
          item.transform!.size!.y = (maxY - minY - item.transform!.size!.y) * pixelsPerUnit;
        }

        if (item.name.includes('StretchTop')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 1,
            anchorRight: 1,
            anchorBottom: 1,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - (maxX + minX) / 2) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - maxY) * pixelsPerUnit;

          item.transform!.size!.x = (maxX - minX - item.transform!.size!.x) * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }

        if (item.name.includes('StretchBottom')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 0,
            anchorRight: 1,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - (maxX + minX) / 2) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - minY) * pixelsPerUnit;

          // TODO: sizeDelta cal
          item.transform!.size!.x = (maxX - minX - item.transform!.size!.x) * pixelsPerUnit;
          item.transform!.size!.y = item.transform!.size!.y * pixelsPerUnit;
        }

        if (item.name.includes('StretchAll')) {
          item.transform = {
            ...item.transform,
            anchorLeft: 0,
            anchorTop: 1,
            anchorRight: 1,
            anchorBottom: 0,
            anchoredPosition:{
              x:0,
              y:0,
            },
          };

          item.transform!.anchoredPosition.x = (item.transform!.position.x - (maxX + minX) / 2) * pixelsPerUnit;
          item.transform!.anchoredPosition.y = (item.transform!.position.y - (maxY + minY) / 2) * pixelsPerUnit;

          item.transform!.size.x = (maxX - minX - item.transform!.size.x) * pixelsPerUnit;
          item.transform!.size.y = (maxY - minY - item.transform!.size.y) * pixelsPerUnit;

        }

      }
      void GalaceanEffects.player.loadScene(url, { autoplay: true }).then(composition => {
        composition.renderFrame.addRenderPass(new OutlinePass(composition.renderer, {
          name: 'OutlinePass',
          priority: RenderPassPriorityPostprocess,
          meshOrder: OrderType.ascending,
        }));
      });
    }

  }

  static updateRenderTexture () {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }
    const gl = ImGui_Impl.gl;

    if (gl) {
      if (!GalaceanEffects.sceneRendederTexture) {
        const tex = gl.createTexture();

        if (tex) {
          GalaceanEffects.sceneRendederTexture = tex;
        }
      }
    }

    if (GalaceanEffects.sceneRendederTexture && gl) {
      gl.bindTexture(gl.TEXTURE_2D, GalaceanEffects.sceneRendederTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GalaceanEffects.player.canvas);
    }
  }
}

export class OutlinePass extends RenderPass {
  private material: Material;
  private geometry: Geometry;

  private vert = `precision highp float;

  attribute vec3 aPos;//x y

  varying vec4 vColor;

  uniform vec4 _Color;
  uniform mat4 effects_MatrixVP;
  uniform mat4 effects_MatrixInvV;
  uniform mat4 effects_ObjectToWorld;

  void main() {
    vColor = _Color;
    vec4 pos = vec4(aPos.xyz, 1.0);
    gl_Position = effects_MatrixVP * pos;
  }
  `;

  private frag = `precision highp float;

  varying vec4 vColor;

  void main() {
    vec4 color = vec4(1.0,1.0,1.0,1.0);
    gl_FragColor = color;
  }
  `;

  override configure (renderer: Renderer): void {
    if (!this.geometry) {
      this.geometry = Geometry.create(renderer.engine, {
        attributes: {
          aPos: {
            type: glContext.FLOAT,
            size: 3,
            data: new Float32Array([
              -0.5, 0.5, 0, //左上
              -0.5, -0.5, 0, //左下
              0.5, 0.5, 0, //右上
              0.5, -0.5, 0, //右下
              0, 0, 0,
              10, 10, 10,
            ]),
          },
        },
        mode: glContext.LINE_LOOP,
        drawCount: 6,
      });
    }

    if (!this.material) {
      const materialProps: MaterialProps = {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
          glslVersion: GLSLVersion.GLSL1,
        },
      };

      this.material = Material.create(renderer.engine, materialProps);
      this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
      this.material.depthMask = true;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override execute (renderer: Renderer): void {
    if (Selection.activeObject instanceof VFXItem) {
      const transform = Selection.activeObject.transform;
      const position = transform.getWorldPosition();
      const size = transform.getWorldScale().clone().multiply(new math.Vector3(transform.size.x, transform.size.y, 0));
      const halfWidth = size.x / 2;
      const halfHeight = size.y / 2;
      const point1 = position.clone().add(new math.Vector3(halfWidth, halfHeight, 0));
      const point2 = position.clone().add(new math.Vector3(halfWidth, -halfHeight, 0));
      const point3 = position.clone().add(new math.Vector3(-halfWidth, -halfHeight, 0));
      const point4 = position.clone().add(new math.Vector3(-halfWidth, halfHeight, 0));

      this.geometry.setDrawCount(4);
      this.geometry.setAttributeData('aPos', new Float32Array(point1.toArray().concat(point2.toArray(), point3.toArray(), point4.toArray())));
      renderer.drawGeometry(this.geometry, this.material);
    }
  }
}