import type { MaterialProps, Renderer } from '@galacean/effects';
import { GLSLVersion, Geometry, Material, OrderType, Player, PostProcessVolume, RenderPass, RenderPassPriorityPostprocess, RendererComponent, VFXItem, glContext, math } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { JSONConverter } from '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-spine';
import { Selection } from './core/selection';
import { ImGui_Impl } from './imgui';
import { AssetDatabase } from './core/asset-data-base';

export class GalaceanEffects {
  static player: Player;
  static assetDataBase: AssetDatabase;
  static sceneRendederTexture: WebGLTexture;
  static async initialize () {
    const container = document.getElementById('J-container');
    // const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ'; // 春促
    const json = {
      'playerVersion': {
        'web': '2.0.0',
        'native': '2.0.0',
      },
      'images': [],
      'fonts': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '1',
          'name': '新建合成1',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '3f40a594b3f34d10b963ad4fc736e505',
            },
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
          'sceneBindings': [
            {
              'key': {
                'id': '3f8c5104a1f84f518fc08ddc61837d3d',
              },
              'value': {
                'id': '3f40a594b3f34d10b963ad4fc736e505',
              },
            },
          ],
          'timelineAsset': {
            'id': 'af65d09764e54dccadf291571b4d0c6c',
          },
        },
      ],
      'components': [
        {
          'id': 'b76977b93d1640cc95e5ba3cfa863dd4',
          'item': {
            'id': '3f40a594b3f34d10b963ad4fc736e505',
          },
          'dataType': 'ShapeComponent',
          'geometry': {
            'id': '78cc7d2350bb417bb5dc93afab243411',
          },
          'materials': [
            {
              'id': 'f23adccff3694fd98a0b905c9698188a',
            },
          ],
        },
      ],
      'geometries': [
        {
          'id': '78cc7d2350bb417bb5dc93afab243411',
          'dataType': 'Geometry',
          'vertexData': {
            'vertexCount': 121,
            'channels': [
              {
                'offset': 0,
                'format': 1,
                'dimension': 3,
              },
              {
                'offset': 1452,
                'format': 1,
                'dimension': 2,
              },
              {
                'offset': 2420,
                'format': 1,
                'dimension': 3,
              },
            ],
          },
          'mode': 4,
          'indexFormat': 1,
          'indexOffset': 3872,
          'buffer': 'zcxMv83MTL8AAAAAAACAv83MTL8AAAAAAACAvwAAgL8AAAAAzcxMvwAAgL8AAAAAmpkZv83MTL8AAAAAmpkZvwAAgL8AAAAAzMzMvs3MTL8AAAAAzMzMvgAAgL8AAAAAzMxMvs3MTL8AAAAAzMxMvgAAgL8AAAAAAAAAAM3MTL8AAAAAAAAAAAAAgL8AAAAA0MxMPs3MTL8AAAAA0MxMPgAAgL8AAAAAzMzMPs3MTL8AAAAAzMzMPgAAgL8AAAAAmpkZP83MTL8AAAAAmpkZPwAAgL8AAAAAzsxMP83MTL8AAAAAzsxMPwAAgL8AAAAAAACAP83MTL8AAAAAAACAPwAAgL8AAAAAzcxMv5qZGb8AAAAAAACAv5qZGb8AAAAAmpkZv5qZGb8AAAAAzMzMvpqZGb8AAAAAzMxMvpqZGb8AAAAAAAAAAJqZGb8AAAAA0MxMPpqZGb8AAAAAzMzMPpqZGb8AAAAAmpkZP5qZGb8AAAAAzsxMP5qZGb8AAAAAAACAP5qZGb8AAAAAzcxMv8zMzL4AAAAAAACAv8zMzL4AAAAAmpkZv8zMzL4AAAAAzMzMvszMzL4AAAAAzMxMvszMzL4AAAAAAAAAAMzMzL4AAAAA0MxMPszMzL4AAAAAzMzMPszMzL4AAAAAmpkZP8zMzL4AAAAAzsxMP8zMzL4AAAAAAACAP8zMzL4AAAAAzcxMv8zMTL4AAAAAAACAv8zMTL4AAAAAmpkZv8zMTL4AAAAAzMzMvszMTL4AAAAAzMxMvszMTL4AAAAAAAAAAMzMTL4AAAAA0MxMPszMTL4AAAAAzMzMPszMTL4AAAAAmpkZP8zMTL4AAAAAzsxMP8zMTL4AAAAAAACAP8zMTL4AAAAAzcxMvwAAAAAAAAAAAACAvwAAAAAAAAAAmpkZvwAAAAAAAAAAzMzMvgAAAAAAAAAAzMxMvgAAAAAAAAAAAAAAAAAAAAAAAAAA0MxMPgAAAAAAAAAAzMzMPgAAAAAAAAAAmpkZPwAAAAAAAAAAzsxMPwAAAAAAAAAAAACAPwAAAAAAAAAAzcxMv9DMTD4AAAAAAACAv9DMTD4AAAAAmpkZv9DMTD4AAAAAzMzMvtDMTD4AAAAAzMxMvtDMTD4AAAAAAAAAANDMTD4AAAAA0MxMPtDMTD4AAAAAzMzMPtDMTD4AAAAAmpkZP9DMTD4AAAAA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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAEAAgACAAMAAAAEAAAAAwADAAUABAAGAAQABQAFAAcABgAIAAYABwAHAAkACAAKAAgACQAJAAsACgAMAAoACwALAA0ADAAOAAwADQANAA8ADgAQAA4ADwAPABEAEAASABAAEQARABMAEgAUABIAEwATABUAFAAWABcAAQABAAAAFgAYABYAAAAAAAQAGAAZABgABAAEAAYAGQAaABkABgAGAAgAGgAbABoACAAIAAoAGwAcABsACgAKAAwAHAAdABwADAAMAA4AHQAeAB0ADgAOABAAHgAfAB4AEAAQABIAHwAgAB8AEgASABQAIAAhACIAFwAXABYAIQAjACEAFgAWABgAIwAkACMAGAAYABkAJAAlACQAGQAZABoAJQAmACUAGgAaABsAJgAnACYAGwAbABwAJwAoACcAHAAcAB0AKAApACgAHQAdAB4AKQAqACkAHgAeAB8AKgArACoAHwAfACAAKwAsAC0AIgAiACEALAAuACwAIQAhACMALgAvAC4AIwAjACQALwAwAC8AJAAkACUAMAAxADAAJQAlACYAMQAyADEAJgAmACcAMgAzADIAJwAnACgAMwA0ADMAKAAoACkANAA1ADQAKQApACoANQA2ADUAKgAqACsANgA3ADgALQAtACwANwA5ADcALAAsAC4AOQA6ADkALgAuAC8AOgA7ADoALwAvADAAOwA8ADsAMAAwADEAPAA9ADwAMQAxADIAPQA+AD0AMgAyADMAPgA/AD4AMwAzADQAPwBAAD8ANAA0ADUAQABBAEAANQA1ADYAQQBCAEMAOAA4ADcAQgBEAEIANwA3ADkARABFAEQAOQA5ADoARQBGAEUAOgA6ADsARgBHAEYAOwA7ADwARwBIAEcAPAA8AD0ASABJAEgAPQA9AD4ASQBKAEkAPgA+AD8ASgBLAEoAPwA/AEAASwBMAEsAQABAAEEATABNAE4AQwBDAEIATQBPAE0AQgBCAEQATwBQAE8ARABEAEUAUABRAFAARQBFAEYAUQBSAFEARgBGAEcAUgBTAFIARwBHAEgAUwBUAFMASABIAEkAVABVAFQASQBJAEoAVQBWAFUASgBKAEsAVgBXAFYASwBLAEwAVwBYAFkATgBOAE0AWABaAFgATQBNAE8AWgBbAFoATwBPAFAAWwBcAFsAUABQAFEAXABdAFwAUQBRAFIAXQBeAF0AUgBSAFMAXgBfAF4AUwBTAFQAXwBgAF8AVABUAFUAYABhAGAAVQBVAFYAYQBiAGEAVgBWAFcAYgBjAGQAWQBZAFgAYwBlAGMAWABYAFoAZQBmAGUAWgBaAFsAZgBnAGYAWwBbAFwAZwBoAGcAXABcAF0AaABpAGgAXQBdAF4AaQBqAGkAXgBeAF8AagBrAGoAXwBfAGAAawBsAGsAYABgAGEAbABtAGwAYQBhAGIAbQBuAG8AZABkAGMAbgBwAG4AYwBjAGUAcABxAHAAZQBlAGYAcQByAHEAZgBmAGcAcgBzAHIAZwBnAGgAcwB0AHMAaABoAGkAdAB1AHQAaQBpAGoAdQB2AHUAagBqAGsAdgB3AHYAawBrAGwAdwB4AHcAbABsAG0AeAA=',
        },
      ],
      'materials': [
        {
          'id': 'f23adccff3694fd98a0b905c9698188a',
          'dataType': 'Material',
          'shader': {
            'id': '90ed7bbc1c364b3097b502b4a0f13d5b',
          },
          'floats': {
            '_Speed': 1,
          },
          'stringTags': {},
          'vector4s': {},
          'textures': {
            '_MainTex': {
              'texture': {
                'id': 'whitetexture00000000000000000000',
              },
              'offset': {
                'x': 0,
                'y': 0,
              },
              'scale': {
                'x': 1,
                'y': 1,
              },
            },
          },
          'ints': {},
          'blending': false,
          'zTest': true,
          'zWrite': true,
          'colors': {
            '_MainColor': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        },
      ],
      'items': [
        {
          'id': '3f40a594b3f34d10b963ad4fc736e505',
          'name': 'effect_1',
          'duration': 5,
          'type': 'ECS',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'b76977b93d1640cc95e5ba3cfa863dd4',
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
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [
        {
          'id': '90ed7bbc1c364b3097b502b4a0f13d5b',
          'name': 'unlit',
          'dataType': 'Shader',
          'vertex': 'precision highp float;attribute vec3 aPos;attribute vec2 aUV;varying vec2 uv;uniform mat4 effects_ObjectToWorld;uniform mat4 effects_MatrixInvV;uniform mat4 effects_MatrixVP;void main(){uv=aUV;gl_Position=effects_MatrixVP*effects_ObjectToWorld*vec4(aPos,1.0);}',
          'fragment': 'precision highp float;varying vec2 uv;uniform vec4 _MainColor;uniform sampler2D _MainTex;uniform sampler2D _Tex2;uniform sampler2D _Tex3;void main(){vec4 texColor=texture2D(_MainTex,uv).rgba;vec4 color=texColor*_MainColor.rgba;gl_FragColor=vec4(color);}',
          'properties': '_MainTex("MainTex", 2D) = "white" {}\n_MainColor("MainColor", Color) = (1,1,1,1)',
        },
      ],
      'bins': [],
      'textures': [],
      'animations': [],
      'miscs': [
        {
          'id': 'af65d09764e54dccadf291571b4d0c6c',
          'dataType': 'TimelineAsset',
          'tracks': [
            {
              'id': '3f8c5104a1f84f518fc08ddc61837d3d',
            },
          ],
        },
        {
          'id': '3f8c5104a1f84f518fc08ddc61837d3d',
          'dataType': 'ObjectBindingTrack',
          'children': [],
          'clips': [],
        },
      ],
      'compositionId': '1',
      'spines': [],
    }; // 集五福

    GalaceanEffects.player = new Player({ container });
    GalaceanEffects.player.ticker.add(GalaceanEffects.updateRenderTexture);
    GalaceanEffects.assetDataBase = new AssetDatabase(GalaceanEffects.player.renderer.engine);
    GalaceanEffects.player.renderer.engine.database = GalaceanEffects.assetDataBase;
    //@ts-expect-error
    GalaceanEffects.playURL({
      'playerVersion': {
        'web': '2.0.4',
        'native': '0.0.1.202311221223',
      },
      'images': [],
      'fonts': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '1',
          'name': '新建合成1',
          'duration': 6,
          'startTime': 0,
          'endBehavior': 4,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
            },
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
          'sceneBindings': [
            {
              'key': {
                'id': 'f8a6089ed7794f479907ed0bcac17220',
              },
              'value': {
                'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
              },
            },
          ],
          'timelineAsset': {
            'id': 'dd50ad0de3f044a5819576175acf05f7',
          },
        },
      ],
      'components': [
        {
          'id': 'b7890caa354a4c279ff9678c5530cd83',
          'item': {
            'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
          },
          'dataType': 'ShapeComponent',
          'type': 0,
          'points': [
            {
              'x': -1,
              'y': -1,
              'z': 0,
            },
            {
              'x': 1,
              'y': -1,
              'z': 0,
            },
            {
              'x': 0,
              'y': 1,
              'z': 0,
            },
          ],
          'easingIns': [
            {
              'x': -1,
              'y': -0.5,
              'z': 0,
            },
            {
              'x': 0.5,
              'y': -1.5,
              'z': 0,
            },
            {
              'x': 0.5,
              'y': 1,
              'z': 0,
            },
          ],
          'easingOuts': [
            {
              'x': -0.5,
              'y': -1.5,
              'z': 0,
            },
            {
              'x': 1,
              'y': -0.5,
              'z': 0,
            },
            {
              'x': -0.5,
              'y': 1,
              'z': 0,
            },
          ],
          'shapes': [
            {
              'verticalToPlane': 'z',
              'indexes': [
                {
                  'point': 0,
                  'easingIn': 0,
                  'easingOut': 0,
                },
                {
                  'point': 1,
                  'easingIn': 1,
                  'easingOut': 1,
                },
                {
                  'point': 2,
                  'easingIn': 2,
                  'easingOut': 2,
                },
              ],
              'close': true,
              'fill': {
                'color': { 'r': 1, 'g': 0.7, 'b': 0.5, 'a': 1 },
              },
            },
          ],
          'renderer': {
            'renderMode': 1,
          },
        },
      ],
      'geometries': [],
      'materials': [],
      'items': [
        {
          'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
          'name': 'sprite_1',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'b7890caa354a4c279ff9678c5530cd83',
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
              'x': 1.2,
              'y': 1.2,
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
      'textures': [],
      'animations': [],
      'miscs': [
        {
          'id': 'dd50ad0de3f044a5819576175acf05f7',
          'dataType': 'TimelineAsset',
          'tracks': [
          ],
        },
        {
          'id': '51ed062462544526998daf514c320854',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '9fd3412cf92c4dc19a2deabb942dadb2',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'a59a15a3f3b4414abb81217733561926',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '51ed062462544526998daf514c320854',
              },
            },
          ],
        },
        {
          'id': '9436a285d586414ab72622f64b11f54d',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '9fd3412cf92c4dc19a2deabb942dadb2',
              },
            },
          ],
        },
        {
          'id': 'f8a6089ed7794f479907ed0bcac17220',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': 'a59a15a3f3b4414abb81217733561926',
            },
            {
              'id': '9436a285d586414ab72622f64b11f54d',
            },
          ],
          'clips': [],
        },
      ],
      'compositionId': '1',
    });
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
      void GalaceanEffects.player.loadScene(url, { autoplay: true }).then(composition => {
        composition.postProcessingEnabled = true;
        composition.createRenderFrame();
        composition.rootItem.addComponent(PostProcessVolume);

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
