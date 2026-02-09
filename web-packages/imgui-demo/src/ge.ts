import type { MaterialProps, Renderer } from '@galacean/effects';
import { Component, FrameComponent, GLSLVersion, Geometry, Material, Player, RenderPass, RenderPassPriorityPostprocess, TextComponent, VFXItem, glContext, math } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { JSONConverter, Matrix4 } from '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-ffd';
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
    GalaceanEffects.player.ticker?.add(GalaceanEffects.updateRenderTexture);
    GalaceanEffects.assetDataBase = new AssetDatabase(GalaceanEffects.player.renderer.engine);
    GalaceanEffects.player.renderer.engine.database = GalaceanEffects.assetDataBase;
    //@ts-expect-error
    GalaceanEffects.playURL({
      'playerVersion': {
        'web': '2.7.3',
        'native': '0.0.1.202311221223',
      },
      'images': [
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*P1hBTbDWL_kAAAAAgCAAAAgAelB4AQ/original',
          'id': '1b22e860410749338c6b4f3b358c948c',
          'renderLevel': 'B+',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/file/A*k-2pR5Tngy0AAAAAWQAAAAgAelB4AQ/original',
        },
      ],
      'fonts': [],
      'version': '3.5',
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '0df1fb78819d44529097e0272ba6bb36',
          'name': '新建合成2',
          'duration': 3,
          'startTime': 0,
          'endBehavior': 5,
          'previewSize': [
            750,
            1624,
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 1,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
          'components': [
            {
              'id': '4826dfcdf84a46b68c69e4b8c30afc11',
            },
          ],
        },
      ],
      'components': [
        {
          'id': '4826dfcdf84a46b68c69e4b8c30afc11',
          'item': {
            'id': '0df1fb78819d44529097e0272ba6bb36',
          },
          'dataType': 'CompositionComponent',
          'items': [
            {
              'id': '7a02696874c94d2a8dbfd41fdd9f45e2',
            },
            {
              'id': 'ba1bdd9fdce043d0bfc4d809b5bb7158',
            },
          ],
          'timelineAsset': {
            'id': 'e6a56b1387ea42538b77fb2abfdd261a',
          },
          'sceneBindings': [
            {
              'key': {
                'id': '663f496ddb804037bfb002090f57f0fa',
              },
              'value': {
                'id': '7a02696874c94d2a8dbfd41fdd9f45e2',
              },
            },
            {
              'key': {
                'id': '9a3fb9e674f042568b068e4bbc007c85',
              },
              'value': {
                'id': 'ba1bdd9fdce043d0bfc4d809b5bb7158',
              },
            },
          ],
        },
        {
          'id': 'd2f1a50e026b479baf944bd863fcc830',
          'item': {
            'id': '7a02696874c94d2a8dbfd41fdd9f45e2',
          },
          'dataType': 'SpriteComponent',
          'options': {
            'startColor': [
              1,
              1,
              1,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
            'texture': {
              'id': '36adeb8d3147469186c57b4fa8a3c9c3',
            },
          },
          'textureSheetAnimation': {
            'col': 8,
            'row': 8,
            'total': 64,
            'animate': true,
          },
        },
      ],
      'geometries': [],
      'materials': [],
      'items': [
        {
          'id': '7a02696874c94d2a8dbfd41fdd9f45e2',
          'name': 'sprite_4',
          'duration': 3,
          'type': '1',
          'parentId': 'ba1bdd9fdce043d0bfc4d809b5bb7158',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'd2f1a50e026b479baf944bd863fcc830',
            },
          ],
          'transform': {
            'position': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'size': {
              'x': 9.3911,
              'y': 9.3911,
            },
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
        {
          'id': 'ba1bdd9fdce043d0bfc4d809b5bb7158',
          'name': 'null_2',
          'duration': 3,
          'type': '3',
          'visible': true,
          'endBehavior': 4,
          'delay': 0,
          'renderLevel': 'B+',
          'content': {
            'options': {
              'startColor': [
                1,
                1,
                1,
                1,
              ],
            },
          },
          'components': [],
          'transform': {
            'position': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [],
      'bins': [],
      'textures': [
        {
          'id': '36adeb8d3147469186c57b4fa8a3c9c3',
          'source': {
            'id': '1b22e860410749338c6b4f3b358c948c',
          },
          'flipY': true,
        },
      ],
      'animations': [],
      'miscs': [
        {
          'id': 'e6a56b1387ea42538b77fb2abfdd261a',
          'dataType': 'TimelineAsset',
          'tracks': [
            {
              'id': '663f496ddb804037bfb002090f57f0fa',
            },
            {
              'id': '9a3fb9e674f042568b068e4bbc007c85',
            },
          ],
        },
        {
          'id': '96f74f07f77b4e5eacff646c13be5b67',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '0c823c9bc6f240caa30581507ece79f8',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'e1c5b5f28ded4a9caaa0fb2c11a4f9e6',
          'dataType': 'SpriteColorPlayableAsset',
          'startColor': [
            1,
            1,
            1,
            1,
          ],
        },
        {
          'id': '180742d3fae345658a632d3bb094b40c',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 3,
              'endBehavior': 0,
              'asset': {
                'id': '96f74f07f77b4e5eacff646c13be5b67',
              },
            },
          ],
        },
        {
          'id': '249a24ed230740c780ac4bf26af1b0c3',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 3,
              'endBehavior': 0,
              'asset': {
                'id': '0c823c9bc6f240caa30581507ece79f8',
              },
            },
          ],
        },
        {
          'id': 'b88f0fd47cac45ea87bb4898f8a8a7ec',
          'dataType': 'SpriteColorTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 3,
              'endBehavior': 0,
              'asset': {
                'id': 'e1c5b5f28ded4a9caaa0fb2c11a4f9e6',
              },
            },
          ],
        },
        {
          'id': '663f496ddb804037bfb002090f57f0fa',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '180742d3fae345658a632d3bb094b40c',
            },
            {
              'id': '249a24ed230740c780ac4bf26af1b0c3',
            },
            {
              'id': 'b88f0fd47cac45ea87bb4898f8a8a7ec',
            },
          ],
          'clips': [],
        },
        {
          'id': 'aca19ee9066542d08b107fd920b2a879',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '804a10e656cb4548b609ef28dd96d959',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': '3c1a8e2ee01f49958453a628f4bbca5a',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 3,
              'endBehavior': 4,
              'asset': {
                'id': 'aca19ee9066542d08b107fd920b2a879',
              },
            },
          ],
        },
        {
          'id': 'c197250764324032a2fb8359b3201b1d',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 3,
              'endBehavior': 4,
              'asset': {
                'id': '804a10e656cb4548b609ef28dd96d959',
              },
            },
          ],
        },
        {
          'id': '9a3fb9e674f042568b068e4bbc007c85',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '3c1a8e2ee01f49958453a628f4bbca5a',
            },
            {
              'id': 'c197250764324032a2fb8359b3201b1d',
            },
          ],
          'clips': [],
        },
      ],
      'compositionId': '0df1fb78819d44529097e0272ba6bb36',
    });
  }

  static playURL (url: string, use3DConverter = false) {
    GalaceanEffects.player.destroyCurrentCompositions();
    if (use3DConverter) {
      const converter = new JSONConverter(GalaceanEffects.player.renderer);

      void converter.processScene(url).then(async (scene: any) => {
        const composition = await GalaceanEffects.player.loadScene(scene, { autoplay: true });

        composition.renderFrame.addRenderPass(new OutlinePass(composition.renderer));
      });
    } else {
      void GalaceanEffects.player.loadScene(url, { autoplay: true }).then(composition => {
        composition.renderFrame.addRenderPass(new OutlinePass(composition.renderer));

        composition.rootItem.addComponent(FrameComponent);
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

  constructor (renderer: Renderer) {
    super(renderer);
    this.priority = 5000;
    this.name = 'OutlinePass';

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

  override configure (renderer: Renderer): void {
    renderer.setFramebuffer(this.framebuffer);
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
      renderer.drawGeometry(this.geometry, Matrix4.IDENTITY, this.material);
    }
  }
}
