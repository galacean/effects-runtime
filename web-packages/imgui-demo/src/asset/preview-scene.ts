export const previewScene = {
  'playerVersion': {
    'web': '1.5.2',
    'native': '1.5.2',
  },
  'images': [],
  'fonts': [],
  'version': '3.0',
  'shapes': [],
  'plugins': ['model'],
  'type': 'ge',
  'compositions': [
    {
      'id': '1',
      'name': '新建合成1',
      'duration': 10,
      'startTime': 0,
      'endBehavior': 1,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
        },
        {
          'id': '5d2ea6f25e2b40308d824d6db9c89661',
        },
        {
          'id': 'b570cb441387e98916b993f25ff00e9c',
        },
      ],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [
          0,
          3,
          10,
        ],
        'rotation': [
          -16,
          0,
          0,
        ],
      },
      'globalVolume': {
        'usePostProcessing': true,
        'useHDR': true,
        'useBloom': 0,
        'threshold': 1.0,
        'bloomIntensity': 1,
        'brightness': 1.5,
        'saturation': 1,
        'contrast': 1,
        'useToneMapping': 1,
      },
      'sceneBindings': [

      ],
      'timelineAsset': {
        'id': '6889598e429d48a2921f67002b46a57d',
      },
    },
  ],
  'components': [
    {
      'id': 'aac897288a7d4e3a94d2bd3cf6a4e06a',
      'dataType': 'MeshComponent',
      'item': {
        'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
      },
      'materials':[{
        'id': 'd34dc6a9d6124543923042f9e304365c',
      }],
      'geometry': {
        'id': '78cc7d2350bb417bb5dc93afab243411',
      },
    },
    {
      'id': '35be2cb10a014194844c6ce89c8a41c4',
      'dataType': 'LightComponent',
      'item': {
        'id': '5d2ea6f25e2b40308d824d6db9c89661',
      },
      'lightType': 'directional',
      'color': {
        'r': 1.0,
        'g': 1.0,
        'b': 1.0,
        'a': 1.0,
      },
      'intensity': 2,
      'range': 100,
    },
    {
      'id': '1de1c5af598b954a6c0dc00735efa3a9',
      'dataType': 'LightComponent',
      'item': {
        'id': 'b570cb441387e98916b993f25ff00e9c',
      },
      'lightType': 'ambient',
      'color': {
        'r': 0.2,
        'g': 0.2,
        'b': 0.2,
        'a': 1.0,
      },
      'intensity': 1,
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
      'id': 'd34dc6a9d6124543923042f9e304365c',
      'shader': {
        'id': 'pbr00000000000000000000000000000',
      },
      'name': '3d-material',
      'dataType': 'Material',
      'zTest': true,
      'zWrite': true,
      'blending': false,
      'stringTags': {
        'RenderType': 'Opaque',
        'Cull': 'Front',
      },
      'ints': {
      },
      'floats': {
        '_SpecularAA': 1,
        '_AlphaCutoff': 0.3,
        '_MetallicFactor': 0.0,
        '_RoughnessFactor': 0.2,
        '_NormalScale': 1,
        '_OcclusionStrength': 1,
        '_EmissiveIntensity': 0,
      },
      'vector4s': {
      },
      'colors': {
        '_BaseColorFactor': {
          'r': 1,
          'g': 1,
          'b': 1,
          'a': 1,
        },
        '_EmissiveFactor': {
          'r': 0.6,
          'g': 0.2,
          'b': 0.8,
          'a': 1,
        },
      },
      'textures': {
        '_BaseColorSampler': {
          'texture': {
            'id': 'whitetexture00000000000000000000',
          },
        },
      },
    },
  ],
  'items': [
    {
      'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
      'name': '3d-mesh',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
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
      'components': [
        {
          'id': 'aac897288a7d4e3a94d2bd3cf6a4e06a',
        },
      ],
      'listIndex': 6,
      'content': {},
    },
    {
      'id': '5d2ea6f25e2b40308d824d6db9c89661',
      'name': '3d-light',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
          'x': 45,
          'y': -30,
          'z': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'components': [
        {
          'id': '35be2cb10a014194844c6ce89c8a41c4',
        },
      ],
      'listIndex': 6,
      'content': {},
    },
    {
      'id': 'b570cb441387e98916b993f25ff00e9c',
      'name': '3d-ambient-light',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
          'x': 45,
          'y': -30,
          'z': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'components': [
        {
          'id': '1de1c5af598b954a6c0dc00735efa3a9',
        },
      ],
      'listIndex': 6,
      'content': {},
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
      'id': '6889598e429d48a2921f67002b46a57d',
      'dataType': 'TimelineAsset',
      'tracks': [
      ],
    },
  ],
  'compositionId': '1',
  'spines': [],
};