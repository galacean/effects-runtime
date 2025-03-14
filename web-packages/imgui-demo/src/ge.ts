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
      'playerVersion': { 'web': '2.2.5', 'native': '0.0.1.202311221223' },
      'images': [
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*43_zTqI7nz4AAAAAAAAAAAAAelB4AQ/original', 'id': 'c51d290fedd54357a8b05da47d4b6ec7' },
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*43_zTqI7nz4AAAAAAAAAAAAAelB4AQ/original', 'id': '9ccd157f02e44c148275f5f61985ca7f', 'oriY': 1 },
      ],
      'fonts': [],
      'version': '3.1',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '1',
          'name': '新建合成1',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 4,
          'previewSize': [750, 1624],
          'items': [{ 'id': 'a616c54d130740e6aff3636b7fd2afdc' }],
          'camera': { 'fov': 60, 'far': 40, 'near': 0.1, 'clipMode': 1, 'position': [0, 0, 8], 'rotation': [0, 0, 0] },
          'sceneBindings': [{ 'key': { 'id': '518b39d4b9ba41e79b46b937e9e26463' }, 'value': { 'id': 'a616c54d130740e6aff3636b7fd2afdc' } }],
          'timelineAsset': { 'id': '51453269031d45aabb4c2834a6d4d820' },
        },
      ],
      'components': [
        {
          'id': '473b92d40343423398ebf3f13d13c34f',
          'item': { 'id': 'a616c54d130740e6aff3636b7fd2afdc' },
          'dataType': 'EffectComponent',
          'geometry': { 'id': '4b7944c565fa44358515181345fcbc04' },
          'materials': [{ 'id': '14f87546cd11476b8288280eed2aa9df' }],
        },
        {
          'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b',
          'item': { 'id': 'a616c54d130740e6aff3636b7fd2afdc' },
          'dataType': 'FFDComponent',
          'controlPoints': [
            { 'x': -0.5, 'y': 0.5, 'z': 0 },
            { 'x': -0.25, 'y': 0.7, 'z': 0 },
            { 'x': 0, 'y': 0.5, 'z': 0 },
            { 'x': 0.25, 'y': 0.4, 'z': 0 },
            { 'x': 0.5, 'y': 0.5, 'z': 0 },

            { 'x': -0.5, 'y': 0.25, 'z': 0 },
            { 'x': -0.25, 'y': 0.3, 'z': 0 },
            { 'x': 0, 'y': 0.25, 'z': 0 },
            { 'x': 0.25, 'y': 0.3, 'z': 0 },
            { 'x': 0.5, 'y': 0.25, 'z': 0 },

            { 'x': -0.5, 'y': 0, 'z': 0 },
            { 'x': -0.25, 'y': 0, 'z': 0 },
            { 'x': 0, 'y': 0, 'z': 0 },
            { 'x': 0.25, 'y': 0, 'z': 0 },
            { 'x': 0.5, 'y': 0, 'z': 0 },

            { 'x': -0.5, 'y': -0.25, 'z': 0 },
            { 'x': -0.25, 'y': -0.3, 'z': 0 },
            { 'x': 0, 'y': -0.25, 'z': 0 },
            { 'x': 0.25, 'y': -0.3, 'z': 0 },
            { 'x': 0.5, 'y': -0.25, 'z': 0 },

            { 'x': -0.5, 'y': -0.5, 'z': 0 },
            { 'x': -0.25, 'y': -0.7, 'z': 0 },
            { 'x': 0, 'y': -0.5, 'z': 0 },
            { 'x': 0.25, 'y': -0.4, 'z': 0 },
            { 'x': 0.5, 'y': -0.5, 'z': 0 },
          ],
        },
      ],
      'geometries': [],
      'materials': [
        {
          'dataType': 'Material',
          'shader': { 'id': '2bb38aef323b443388fe310c93b05c46' },
          'stringTags': { 'RenderType': 'Transparent' },
          'floats': {
            '_MainTexAR': 0,
            '_MainTexUVPolar': 1,
            '_MainTexUSpeed': 1,
            '_MainTexVSpeed': 0,
            '_UseAddTex': 1,
            '_AddTexUSpeed': 0,
            '_AddTexVSpeed': 0,
            '_AddTexPower': 1,
            '_AddTexIntensity': 1,
            '_DistortTexUSpeed': 0,
            '_DistortTexVSpeed': 0,
            '_DistortIntensity': 0,
            '_MaskTexReverse': 0,
            '_MaskTexAR': 1,
            '_MaskTexUSpeed': 0,
            '_MaskTexVSpeed': 0,
            '_DissolveTexPower': 1,
            '_DissolveTexIntensity': 1,
            '_DissolveTexUSpeed': 0,
            '_DissolveTexVSpeed': 0,
            '_DissolveIntensity': 0,
            '_DissolveWide': 0.05,
            'ZWrite': 1,
          },
          'textures': {
            '_MainTex': { 'texture': { 'id': '8f4ac587135e40b3ad914507741c1ba1' } },
            '_AddTex': { 'texture': { 'id': '8f4ac587135e40b3ad914507741c1ba1' } },
            '_DistortTex': { 'texture': { 'id': 'whitetexture00000000000000000000' }, 'offset': { 'x': 0, 'y': 0 }, 'scale': { 'x': 1, 'y': 1 } },
            '_MaskTex': { 'texture': { 'id': 'whitetexture00000000000000000000' }, 'offset': { 'x': 0, 'y': 0 }, 'scale': { 'x': 1, 'y': 1 } },
            '_DissolveTex': { 'texture': { 'id': 'whitetexture00000000000000000000' }, 'offset': { 'x': 0, 'y': 0 }, 'scale': { 'x': 1, 'y': 1 } },
          },
          'colors': {
            '_MainColor': { 'r': 7.466666666666667, 'g': 1.2862745098039217, 'b': 1.2862745098039217, 'a': 1 },
            '_AddColor': { 'r': 172.67450980392158, 'g': 46.180392156862744, 'b': 44.17254901960784, 'a': 1 },
            '_DissolveColor': { 'r': 1, 'g': 1, 'b': 1, 'a': 1 },
          },
          'vector4s': { '_TillingOffset': { 'x': 1, 'y': 1, 'z': 0, 'w': 0 } },
          'ints': {},
          'macros': [],
          'id': '14f87546cd11476b8288280eed2aa9df',
        },
      ],
      'items': [
        {
          'id': 'a616c54d130740e6aff3636b7fd2afdc',
          'name': 'effect_15',
          'duration': 5,
          'type': 'effect',
          'visible': true,
          'endBehavior': 5,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [{ 'id': '473b92d40343423398ebf3f13d13c34f' }, { 'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b' }],
          'transform': { 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'eulerHint': { 'x': 0, 'y': 0, 'z': 0 }, 'scale': { 'x': 4, 'y': 4, 'z': 1 } },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [
        {
          'id': '2bb38aef323b443388fe310c93b05c46',
          'name': 'universal-vfx',
          'dataType': 'Shader',
          'vertex': 'precision highp float;attribute vec3 aPos;attribute vec2 aUV;varying vec2 uv0;varying vec2 uvDistort;uniform mat4 effects_ObjectToWorld;uniform mat4 effects_MatrixVP;uniform vec4 _Time;uniform float _DistortTexUSpeed;uniform float _DistortTexVSpeed;uniform vec3 u_ControlPoints[25];uniform vec3 u_BoundMin;uniform vec3 u_BoundMax;float B0(float t){return(1.0 - t)*(1.0 - t)*(1.0 - t)*(1.0 - t);}float B1(float t){return 4.0 * t *(1.0 - t)*(1.0 - t)*(1.0 - t);}float B2(float t){return 6.0 * t * t *(1.0 - t)*(1.0 - t);}float B3(float t){return 4.0 * t * t * t *(1.0 - t);}float B4(float t){return t * t * t * t;}vec3 bezierSurface(vec3 originalPos){bool isInBoundingBox =originalPos.x >= u_BoundMin.x && originalPos.x <= u_BoundMax.x &&originalPos.y >= u_BoundMin.y && originalPos.y <= u_BoundMax.y &&originalPos.z >= u_BoundMin.z && originalPos.z <= u_BoundMax.z;if(!isInBoundingBox){return originalPos;}float u =(originalPos.x - u_BoundMin.x)/(u_BoundMax.x - u_BoundMin.x);float v =(originalPos.y - u_BoundMin.y)/(u_BoundMax.y - u_BoundMin.y);float bu[5] = float[5](B0(u),B1(u),B2(u),B3(u),B4(u));float bv[5] = float[5](B0(v),B1(v),B2(v),B3(v),B4(v));vec3 newPos = vec3(0.0);for(int i = 0;i < 5;i++){for(int j = 0;j < 5;j++){newPos += u_ControlPoints[i * 5 + j] * bu[j] * bv[i];}}return newPos;}void main(){uv0 = aUV;uvDistort = aUV + fract(vec2(_DistortTexUSpeed,_DistortTexVSpeed)* _Time.y);vec3 newPos = bezierSurface(aPos);gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(newPos,1.0);}',
          'fragment': 'precision highp float;\r\n\r\n#define _FDISTORTTEX_ON\r\n#define _MAINTEXUVS_POLAR\r\n#define _FMASKTEX_ON\r\n#define _FDISSOLVETEX_ON\r\n#define _FADDTEX_ON\r\n\r\n// Varyings\r\nvarying vec2 uv0;\r\nvarying vec2 uvDistort;\r\n\r\n// Uniforms\r\nuniform vec4 _Time;\r\n\r\nuniform sampler2D _MainTex;\r\nuniform vec4 _TillingOffset;\r\nuniform vec4 _MainColor;\r\nuniform float _MainTexAR;\r\nuniform float _MainTexUVPolar;\r\nuniform float _MainTexUSpeed;\r\nuniform float _MainTexVSpeed;\r\n\r\nuniform float _UseAddTex;\r\nuniform sampler2D _AddTex;\r\nuniform vec4 _AddColor;\r\nuniform float _AddTexUSpeed;\r\nuniform float _AddTexVSpeed;\r\nuniform float _AddTexPower;\r\nuniform float _AddTexIntensity;\r\n\r\nuniform sampler2D _DistortTex;\r\nuniform float _DistortIntensity;\r\n\r\nuniform sampler2D _MaskTex;\r\nuniform float _MaskTexReverse;\r\nuniform float _MaskTexAR;\r\nuniform float _MaskTexUSpeed;\r\nuniform float _MaskTexVSpeed;\r\n\r\nuniform sampler2D _DissolveTex;\r\nuniform vec4 _DissolveColor;\r\nuniform float _DissolveTexUSpeed;\r\nuniform float _DissolveTexVSpeed;\r\nuniform float _DissolveTexPower;\r\nuniform float _DissolveTexIntensity;\r\nuniform float _DissolveIntensity;\r\nuniform float _DissolveSoft;\r\nuniform float _DissolveWide;\r\n\r\nvoid main() {\r\n    vec2 uvMain = uv0;\r\n\r\n    // 扭曲贴图\r\n    #ifdef _FDISTORTTEX_ON\r\n    vec2 uvDistort = uvDistort + fract(vec2(_MainTexUSpeed, _MainTexVSpeed) * _Time.y);\r\n    vec4 var_DistortTex = texture2D(_DistortTex, uvDistort);\r\n    float var_DistortTexAlpha = var_DistortTex.r - 0.5;\r\n    var_DistortTexAlpha *= _DistortIntensity;\r\n    vec2 DistortUV = vec2(var_DistortTexAlpha, var_DistortTexAlpha);\r\n    uvMain += DistortUV;  // 扭曲主贴图UV\r\n    #endif\r\n\r\n    // 采样主纹理\r\n    // 极坐标转化\r\n    #ifdef _MAINTEXUVS_POLAR\r\n    if(_MainTexUVPolar > 0.0) {\r\n        vec2 centerUV = uvMain - vec2(0.5, 0.5);\r\n        vec2 polarUV = vec2(length(centerUV) * 2.0, atan(centerUV.y, centerUV.x) * (1.0 / 6.28318)); // 6.28318 is 2*pi\r\n        uvMain = polarUV;\r\n    }\r\n    #endif\r\n    uvMain = uvMain * _TillingOffset.xy + _TillingOffset.zw;\r\n    uvMain += fract(vec2(_MainTexUSpeed, _MainTexVSpeed) * _Time.y);\r\n    vec4 mainTex = texture2D(_MainTex, uvMain);\r\n    mainTex.rgb = (_MainTexAR == 0.0 ? mainTex.rgb : mainTex.rrr);\r\n    float mainTexAlpha = (_MainTexAR == 0.0 ? mainTex.a : mainTex.r);\r\n    vec3 color = mainTex.rgb * _MainColor.rgb;\r\n    float alpha = mainTexAlpha * _MainColor.a;\r\n\r\n    // 额外贴图\r\n    if(_UseAddTex > 0.0) {\r\n        vec2 uvAdd = uv0;\r\n        #ifdef _ADDTEXUVS_POLAR\r\n        vec2 addCenterUV = uvAdd - vec2(0.5, 0.5);\r\n        vec2 addPolarUV = vec2(length(addCenterUV) * 2.0, atan(addCenterUV.y, addCenterUV.x) * (1.0 / 6.28318)); // 6.28318 is 2*pi\r\n        uvAdd = addPolarUV;\r\n        #endif\r\n        uvAdd.xy += fract(vec2(_AddTexUSpeed, _AddTexVSpeed) * _Time.y);\r\n        vec4 var_AddTex = texture2D(_AddTex, uvAdd);\r\n        var_AddTex = clamp(pow(abs(var_AddTex), vec4(_AddTexPower)) * _AddTexIntensity, 0.0, 1.0);\r\n        vec3 addColor = var_AddTex.rgb * _AddColor.rgb;\r\n        float addAlpha = var_AddTex.a * _AddColor.a;\r\n        color = mix(color, color + addColor, addAlpha);\r\n    }\r\n\r\n    // 遮罩贴图\r\n    #ifdef _FMASKTEX_ON\r\n    vec2 uvMask = uv0;\r\n        #ifdef _MASKTEXUVS_POLAR\r\n    vec2 maskCenterUV = uvMask - vec2(0.5, 0.5);\r\n    vec2 maskPolarUV = vec2(length(maskCenterUV) * 2.0, atan(maskCenterUV.y, maskCenterUV.x) / (2.0 * PI));\r\n    uvMask = maskPolarUV;\r\n        #endif\r\n    uvMask += fract(vec2(_MaskTexUSpeed, _MaskTexVSpeed) * _Time.y);\r\n    vec4 var_MaskTex = texture2D(_MaskTex, uvMask);\r\n    float var_MaskTexAlpha = (_MaskTexAR == 0.0 ? var_MaskTex.a : var_MaskTex.r);\r\n    var_MaskTexAlpha = (_MaskTexReverse == 0.0 ? var_MaskTexAlpha : 1.0 - var_MaskTexAlpha);\r\n    alpha *= var_MaskTexAlpha;\r\n    #endif\r\n\r\n    // 溶解效果\r\n    #ifdef _FDISSOLVETEX_ON\r\n    vec2 uvDissolve = uv0;\r\n        #ifdef _DISSOLVETEXUVS_POLAR\r\n    vec2 dissolveCenterUV = uvDissolve.xy - vec2(0.5, 0.5);\r\n    vec2 dissolvePolarUV = vec2(length(dissolveCenterUV) * 2.0, atan(dissolveCenterUV.y, dissolveCenterUV.x) / (2.0 * PI));\r\n    uvDissolve.xy = dissolvePolarUV;\r\n        #endif\r\n    uvDissolve += fract(vec2(_DissolveTexUSpeed, _DissolveTexVSpeed) * _Time.y);\r\n    vec4 var_DissolveTex = texture2D(_DissolveTex, uvDissolve.xy);\r\n    float var_DissolveTexAlpha = var_DissolveTex.r;\r\n    var_DissolveTexAlpha = clamp(pow(abs(var_DissolveTexAlpha), _DissolveTexPower) * _DissolveTexIntensity, 0.0, 1.0);\r\n    vec3 DissolveColor = _DissolveColor.rgb * 2.0;\r\n    float DissolveIntensity = _DissolveIntensity;\r\n        //DissolveIntensity += 0.001; // Uncomment and adjust this value as needed\r\n        #ifdef _DISSOLVETEXSOFT_ON\r\n    float SoftDissolveBig = DissolveIntensity * (_DissolveSoft + 1.0);\r\n    float SoftDissolveSmall = SoftDissolveBig - _DissolveSoft;\r\n    float SoftDissolve = smoothstep(SoftDissolveSmall, SoftDissolveBig, var_DissolveTexAlpha);\r\n    color = mix(DissolveColor, color, SoftDissolve);\r\n    alpha *= SoftDissolve;\r\n        #else\r\n    float HardDissolve = DissolveIntensity * (_DissolveWide + 1.0);\r\n    float HardDissolveSmall = step(HardDissolve, var_DissolveTexAlpha);\r\n    float HardDissolveBig = step(HardDissolve - _DissolveWide, var_DissolveTexAlpha);\r\n    color = mix(DissolveColor, color, HardDissolveSmall);\r\n    alpha *= HardDissolveBig;\r\n        #endif\r\n    #endif\r\n\r\n    color *= alpha;\r\n    gl_FragColor = vec4(color, alpha);\r\n}',
          'properties': '_MainTex("主贴图", 2D) = "white" {}\n[HDR]_MainColor("主颜色", Color) = (1,1,1,1)\n_TillingOffset("缩放偏移", Vector) = (1,1,0,0)\n[Toggle]_MainTexAR ("R通道为透明通道", Float) = 0.0\n[Toggle]_MainTexUVPolar ("极坐标UV", Float) = 0.0\n_MainTexUSpeed ("主贴图U方向流动", Float) = 0\n_MainTexVSpeed ("主贴图V方向流动", Float) = 0\n[Toggle]_UseAddTex("使用额外贴图", Float) = 0.0\n_AddTex("额外贴图", 2D) = "white" {}\n[HDR]_AddColor("额外颜色", Color) = (1,1,1,1)\n_AddTexUSpeed ("额外贴图U方向流动", Float) = 0\n_AddTexVSpeed ("额外贴图V方向流动", Float) = 0\n_AddTexPower ("额外贴图锐度", Range(0.0, 10.0)) = 1.0\n_AddTexIntensity ("额外贴图亮度", Range(0.0, 10.0)) = 1.0\n_DistortTex("扭曲贴图", 2D) = "white" {}\n_DistortTexUSpeed ("扭曲贴图U方向流动", Float) = 0\n_DistortTexVSpeed ("扭曲贴图V方向流动", Float) = 0\n_DistortIntensity ("扭曲程度", Range(0.0, 1.0)) = 0.0\n_MaskTex ("遮罩贴图", 2D) = "white" {}\n[Toggle]_MaskTexReverse ("遮罩贴图反转", Float) = 0\n[Toggle]_MaskTexAR ("R通道为遮罩通道", Float) = 1\n_MaskTexUSpeed ("遮罩贴图U方向流动", Float) = 0.0\n_MaskTexVSpeed ("遮罩贴图V方向流动", Float) = 0.0\n[HDR]_DissolveColor ("溶解颜色", Color) = (1.0, 1.0, 1.0, 1.0)\n_DissolveTex ("溶解贴图", 2D) = "white" {}\n_DissolveTexPower ("溶解贴图锐度", Range(0.0, 10.0)) = 1.0\n_DissolveTexIntensity ("溶解贴图亮度", Range(0.0, 10.0)) = 1.0\n_DissolveTexUSpeed ("溶解贴图U方向流动", Float) = 0.0\n_DissolveTexVSpeed ("溶解贴图V方向流动", Float) = 0.0\n_DissolveIntensity ("溶解程度", Range(0.0, 1.0)) = 0.0\n_DissolveWide ("溶解宽度", Range(0.0, 1.0)) = 0.05\n',
        },
      ],
      'bins': [{ 'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*FbdORb5mUYcAAAAAAAAAAAAAelB4AQ', 'id': '23913db1ec46407c87e435760007cd34' }],
      'textures': [
        {
          'id': '8f4ac587135e40b3ad914507741c1ba1',
          'dataType': 'Texture',
          'source': { 'id': 'c51d290fedd54357a8b05da47d4b6ec7' },
          'name': 'mask.tex',
          'flipY': true,
          'wrapS': 10497,
          'wrapT': 10497,
          'magFilter': 9729,
          'minFilter': 9729,
        },
        {
          'minFilter': 9729,
          'magFilter': 9729,
          'wrapS': 10497,
          'wrapT': 10497,
          'target': 3553,
          'format': 6408,
          'internalFormat': 6408,
          'type': 5121,
          'id': '8f4ac587135e40b3ad914507741c1ba1',
          'dataType': 'Texture',
          'source': { 'id': '9ccd157f02e44c148275f5f61985ca7f' },
          'name': 'mask.tex',
          'flipY': true,
          'generateMipmap': true,
          'sourceType': 2,
        },
      ],
      'animations': [],
      'miscs': [
        { 'id': '51453269031d45aabb4c2834a6d4d820', 'dataType': 'TimelineAsset', 'tracks': [{ 'id': '518b39d4b9ba41e79b46b937e9e26463' }] },
        { 'id': '7ed4996411d243f8916f25975718a610', 'dataType': 'ActivationPlayableAsset' },
        { 'id': 'eab56ba12c814716a63dd7c91ab1976a', 'dataType': 'TransformPlayableAsset', 'positionOverLifetime': {} },
        {
          'id': '07a26b2b8ed5404e8a339a0b25dc5529',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [{ 'start': 0, 'duration': 5, 'endBehavior': 5, 'asset': { 'id': '7ed4996411d243f8916f25975718a610' } }],
        },
        {
          'id': 'b5236fe4a61740bd88c6e59a2f9707cc',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [{ 'start': 0, 'duration': 5, 'endBehavior': 5, 'asset': { 'id': 'eab56ba12c814716a63dd7c91ab1976a' } }],
        },
        {
          'id': '518b39d4b9ba41e79b46b937e9e26463',
          'dataType': 'ObjectBindingTrack',
          'children': [{ 'id': '07a26b2b8ed5404e8a339a0b25dc5529' }, { 'id': 'b5236fe4a61740bd88c6e59a2f9707cc' }],
          'clips': [],
        },
      ],
      'compositionId': '1',
    }
    );
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
        // composition.postProcessingEnabled = true;
        // composition.createRenderFrame();
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
