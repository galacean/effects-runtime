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
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*OzhLSqbiQzcAAAAAAAAAAAAAelB4AQ/original', 'id': '0bfc1a8f87854a5dbbd1da883f258a80' },
        { 'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*6t4oToXSR9EAAAAAAAAAAAAAelB4AQ/original', 'id': '0d619457999e4a1fb658548133988471' },
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
          'items': [{ 'id': 'de210a9dd2dc478a9af188fd99de7548' }],
          'camera': { 'fov': 60, 'far': 40, 'near': 0.1, 'clipMode': 1, 'position': [0, 0, 8], 'rotation': [0, 0, 0] },
          'sceneBindings': [{ 'key': { 'id': 'c55eabb5934a4f99994d400cdb2f9539' }, 'value': { 'id': 'de210a9dd2dc478a9af188fd99de7548' } }],
          'timelineAsset': { 'id': 'b1e4434b3ed4480cab6c04d3de29e4a6' },
        },
      ],
      'components': [
        {
          'id': '0491350a2f884a2796f6bea2f67ac889',
          'item': { 'id': 'de210a9dd2dc478a9af188fd99de7548' },
          'dataType': 'EffectComponent',
          'geometry': { 'id': '4b7944c565fa44358515181345fcbc04' },
          'materials': [{ 'id': 'f1f915c2e48041c99658820fc3a14b3d' }],
        },
        {
          'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b',
          'item': { 'id': 'de210a9dd2dc478a9af188fd99de7548' },
          'dataType': 'SubdComponent',
          'motionType': 'Perspective',
          'loop': true,
          'amountOfMotion': 0.4,
          'animationLength': 5,
          'mode': 0,
          'amplitudeX': 0.1,
          'amplitudeY': 0.05,
          'amplitudeZ': 0.4,
          'phaseX': 0,
          'phaseY': 0.25,
          'phaseZ': 0.25,
          'startPositionX': 0,
          'startPositionY': 0,
          'startPositionZ': 0,
          'endPositionX': 0,
          'endPositionY': 0,
          'endPositionZ': 0,
        },
      ],
      'geometries': [],
      'materials': [
        {
          'dataType': 'Material',
          'shader': { 'id': '9c38811e6da44aee40b6d464cf428c4d' },
          'stringTags': { 'RenderType': 'Transparent', 'RenderFace': 'Both' },
          'floats': { '_Enlarge': 2.02, '_Focus': 1, 'ZWrite': 1, 'DepthMapRadius': 0.54 },
          'textures': {
            '_MainTex': { 'texture': { 'id': 'b49efd8a624842ca8ba127a6beb0a043' } },
            '_DepthTex': { 'texture': { 'id': 'c3079500ad4e4c9abb3604c6da08d635' } },
          },
          'colors': {},
          'vector4s': {},
          'ints': {},
          'macros': [],
          'id': 'f1f915c2e48041c99658820fc3a14b3d',
        },
      ],
      'items': [
        {
          'id': 'de210a9dd2dc478a9af188fd99de7548',
          'name': 'fake3d',
          'duration': 5,
          'type': 'effect',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [{ 'id': '0491350a2f884a2796f6bea2f67ac889' }, { 'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b' }],
          'transform': { 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'eulerHint': { 'x': 0, 'y': 0, 'z': 0 }, 'scale': { 'x': 5.8872, 'y': 5.3286, 'z': 1 } },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [
        {
          'id': '9c38811e6da44aee40b6d464cf428c4d',
          'name': 'fake-3d',
          'dataType': 'Shader',
          'vertex': 'precision highp float;\r\n\r\nattribute vec3 aPos;\r\nattribute vec2 aUV;\r\n\r\nvarying vec2 uv;\r\n\r\nuniform mat4 effects_ObjectToWorld;\r\nuniform mat4 effects_MatrixVP;\r\n\r\nvoid main() {\r\n    uv = aUV;\r\n    gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);\r\n}',
          'fragment': 'precision highp float;\r\n\r\n#define PI 3.14159265359\r\n\r\nvarying vec2 uv;\r\n\r\nuniform sampler2D _MainTex;\r\nuniform sampler2D _DepthTex;\r\nuniform float _Focus;\r\nuniform float _Enlarge;\r\n\r\nuniform float _PosX;\r\nuniform float _PosY;\r\nuniform float _PosZ;\r\n\r\nvec4 perspective(\r\n    vec2 uv,\r\n    vec3 cameraShift,\r\n    float convergence\r\n) {\r\n    vec3 ray_origin = vec3(uv - 0.5, 0) * (1.0 - convergence * cameraShift.z);\r\n    vec3 ray_direction = vec3(0, 0, 1);\r\n    ray_origin.xy -= cameraShift.xy * convergence;\r\n    ray_direction.xy += (uv - 0.5) * cameraShift.z + cameraShift.xy;\r\n    const int step_count = 45;\r\n    const float hit_threshold = 0.01;\r\n    ray_direction /= float(step_count);\r\n    vec4 color = vec4(0.0);\r\n    for(int i = 0; i < step_count; i++) {\r\n        ray_origin += ray_direction;\r\n        float scene_z = 1.0 - texture2D(_DepthTex, ray_origin.xy + 0.5).x;\r\n        if(ray_origin.z > scene_z) {\r\n            if(ray_origin.z - scene_z < hit_threshold) {\r\n                break;\r\n            }\r\n            ray_origin -= ray_direction;\r\n            ray_direction /= 2.0;\r\n        }\r\n\r\n    }\r\n    color = texture2D(_MainTex, ray_origin.xy + 0.5);\r\n\r\n    return color;\r\n}\r\nvoid main(void) {\r\n    float moveX = _PosX;\r\n    float moveY = _PosY;\r\n    float moveZ = _PosZ;\r\n\r\n    vec3 offset = vec3(moveX, moveY, moveZ);\r\n    vec2 uv = (uv - vec2(0.5)) /\r\n        vec2(1.0 + _Enlarge * 0.125) +\r\n        vec2(0.5);\r\n\r\n    vec4 color = perspective(uv, vec3(offset.x, offset.y, offset.z), _Focus);\r\n    color.rgb *= color.a;\r\n    gl_FragColor = color;\r\n}',
          'properties': '_MainTex("主贴图", 2D) = "white" {}\n_DepthTex("深度贴图", 2D) = "white" {}\n_Enlarge("Enlarge", Float) = 1.06\n_Focus("Focus", Float) = 0.5\n',
        },
      ],
      'bins': [{ 'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*EqGaSptjpjYAAAAAAAAAAAAAelB4AQ', 'id': '584a96b543424c7fb8b57c14b14391fc' }],
      'textures': [
        {
          'id': 'b49efd8a624842ca8ba127a6beb0a043',
          'dataType': 'Texture',
          'source': { 'id': '0bfc1a8f87854a5dbbd1da883f258a80' },
          'name': 'Image_HDR.tex',
          'flipY': true,
          'wrapS': 10497,
          'wrapT': 10497,
          'magFilter': 9729,
          'minFilter': 9729,
        },
        {
          'id': 'c3079500ad4e4c9abb3604c6da08d635',
          'dataType': 'Texture',
          'source': { 'id': '0d619457999e4a1fb658548133988471' },
          'name': '深度图-0.54-b49efd8a624842ca8ba127a6beb0a043.tex',
          'flipY': true,
          'wrapS': 10497,
          'wrapT': 10497,
          'magFilter': 9729,
          'minFilter': 9729,
        },
      ],
      'animations': [],
      'miscs': [
        { 'id': 'b1e4434b3ed4480cab6c04d3de29e4a6', 'dataType': 'TimelineAsset', 'tracks': [{ 'id': 'c55eabb5934a4f99994d400cdb2f9539' }] },
        { 'id': '07e42568c971418a856902f92616bd12', 'dataType': 'ActivationPlayableAsset' },
        { 'id': '096209dd68284ee1b3da3de1df60edc1', 'dataType': 'TransformPlayableAsset', 'positionOverLifetime': {} },
        {
          'id': '9409f2a4b5e74b67bbcd7616e9ca2d82',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [{ 'start': 0, 'duration': 5, 'endBehavior': 0, 'asset': { 'id': '07e42568c971418a856902f92616bd12' } }],
        },
        {
          'id': 'ae82a8c0ab19437e95874b435ecc27fb',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [{ 'start': 0, 'duration': 5, 'endBehavior': 0, 'asset': { 'id': '096209dd68284ee1b3da3de1df60edc1' } }],
        },
        {
          'id': 'c55eabb5934a4f99994d400cdb2f9539',
          'dataType': 'ObjectBindingTrack',
          'children': [{ 'id': '9409f2a4b5e74b67bbcd7616e9ca2d82' }, { 'id': 'ae82a8c0ab19437e95874b435ecc27fb' }],
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
