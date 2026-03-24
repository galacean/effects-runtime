import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ffd';
import '@galacean/effects-plugin-model';
import { JSONConverter } from '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-rich-text';
import '@galacean/effects-plugin-spine';
import { AssetDatabase } from './core/asset-data-base';
import { CanvasGizmo } from './core/canvas-gizmo';
import { ImGui_Impl } from './imgui';

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
    // @ts-expect-error
    GalaceanEffects.playURL({
      'playerVersion': {
        'web': '2.8.3',
        'native': '0.0.1.202311221223',
      },
      'images': [],
      'fonts': [],
      'version': '3.6',
      'plugins': [
        'rich-text',
      ],
      'type': 'ge',
      'compositions': [
        {
          'id': 'dee7c98fc5f34aad957bc756c8face77',
          'name': '新建合成1',
          'duration': 5,
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
              'id': 'e02717491c664d06aa9a3d26395abee1',
            },
          ],
        },
      ],
      'components': [
        {
          'id': 'e02717491c664d06aa9a3d26395abee1',
          'item': {
            'id': 'dee7c98fc5f34aad957bc756c8face77',
          },
          'dataType': 'CompositionComponent',
          'items': [
            {
              'id': 'a1f56cce115b4339bbe60faef95fa6db',
            },
            {
              'id': '085daf4d06674a36aa91f4509bfe2d54',
            },
            {
              'id': '8f3ef2117bd146f18db0b50381981016',
            },
          ],
          'timelineAsset': {
            'id': '59576d5cf5fc4a6b8201370b3369e9e2',
          },
          'sceneBindings': [
            {
              'key': {
                'id': '5c332f21ea1147f9abe7c0a65fdfb788',
              },
              'value': {
                'id': 'a1f56cce115b4339bbe60faef95fa6db',
              },
            },
            {
              'key': {
                'id': '739a5a4f62b54ecfb971d9c82dceb02d',
              },
              'value': {
                'id': '085daf4d06674a36aa91f4509bfe2d54',
              },
            },
            {
              'key': {
                'id': '55c137146caf4efc8b5858f5ee97c9f5',
              },
              'value': {
                'id': '8f3ef2117bd146f18db0b50381981016',
              },
            },
          ],
        },
        {
          'id': '3b9fd8872df34628a86eece2164b268c',
          'item': {
            'id': 'a1f56cce115b4339bbe60faef95fa6db',
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
            'anchor': [
              0.5,
              0.5,
            ],
          },
        },
        {
          'id': '5d16a80b4eed4d9fac7ffc8f1f11b82d',
          'item': {
            'id': '085daf4d06674a36aa91f4509bfe2d54',
          },
          'dataType': 'SpriteComponent',
          'options': {
            'startColor': [
              0.5,
              0.8,
              0.5,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
            'anchor': [
              0.5,
              0.5,
            ],
          },
        },
        {
          'id': '6b4acd6f1197459ab360a6bec154413f',
          'item': {
            'id': '8f3ef2117bd146f18db0b50381981016',
          },
          'dataType': 'RichTextComponent',
          'options': {
            'useLegacyRichText': false,
            'text': '富文本',
            'maxTextWidth': 7.26,
            'maxTextHeight': 7.26,
            'fontFamily': 'sans-serif',
            'fontSize': 40,
            'textColor': [
              255,
              255,
              255,
              1,
            ],
            'fontWeight': 'normal',
            'fontStyle': 'normal',
            'textVerticalAlign': 0,
            'textAlign': 0,
            'textOverflow': 2,
            'letterSpace': 0,
            'lineHeight': 40,
            'wrapEnabled': false,
            'sizeMode': 2,
          },
          'renderer': {
            'renderMode': 1,
            'anchor': [
              0.5,
              0.5,
            ],
          },
        },
      ],
      'geometries': [],
      'materials': [],
      'items': [
        {
          'id': 'a1f56cce115b4339bbe60faef95fa6db',
          'name': 'sprite_1',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': '3b9fd8872df34628a86eece2164b268c',
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
        {
          'id': '085daf4d06674a36aa91f4509bfe2d54',
          'name': 'ssss',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': '5d16a80b4eed4d9fac7ffc8f1f11b82d',
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
              'x': 7.2604,
              'y': 7.2604,
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
          'id': '8f3ef2117bd146f18db0b50381981016',
          'name': 'richText_3',
          'duration': 5,
          'type': 'richtext',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
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
          'components': [
            {
              'id': '6b4acd6f1197459ab360a6bec154413f',
            },
          ],
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [],
      'bins': [],
      'textures': [],
      'animations': [],
      'miscs': [
        {
          'id': '59576d5cf5fc4a6b8201370b3369e9e2',
          'dataType': 'TimelineAsset',
          'tracks': [
            {
              'id': '5c332f21ea1147f9abe7c0a65fdfb788',
            },
            {
              'id': '739a5a4f62b54ecfb971d9c82dceb02d',
            },
            {
              'id': '55c137146caf4efc8b5858f5ee97c9f5',
            },
          ],
        },
        {
          'id': '5080a59081be4b72bed11ac513343535',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': 'b728d0ab2d244f95851c7c0253e95ed2',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'a14b9ac9f627402d9bd1e06271e6915f',
          'dataType': 'SpriteColorPlayableAsset',
          'startColor': [
            1,
            1,
            1,
            1,
          ],
        },
        {
          'id': '958d0c60991f42fbaa5a87b26b1990c0',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '5080a59081be4b72bed11ac513343535',
              },
            },
          ],
        },
        {
          'id': 'f65cbe1e13cb4d778ea6dbc39749ef4f',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'b728d0ab2d244f95851c7c0253e95ed2',
              },
            },
          ],
        },
        {
          'id': '6b6af572be224fd28a592028f092534a',
          'dataType': 'SpriteColorTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'a14b9ac9f627402d9bd1e06271e6915f',
              },
            },
          ],
        },
        {
          'id': '5c332f21ea1147f9abe7c0a65fdfb788',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '958d0c60991f42fbaa5a87b26b1990c0',
            },
            {
              'id': 'f65cbe1e13cb4d778ea6dbc39749ef4f',
            },
            {
              'id': '6b6af572be224fd28a592028f092534a',
            },
          ],
          'clips': [],
        },
        {
          'id': '459bb93ab59a4bcda83fea85d4d90873',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '5e86e66102c04c2c81a40090de18f10e',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': '3a8a5fb1173d46e2a13ec05d63148c19',
          'dataType': 'SpriteColorPlayableAsset',
          'startColor': [
            1,
            0,
            0,
            1,
          ],
        },
        {
          'id': '8c84bd81afe240b58377ffb2bbc79c01',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '459bb93ab59a4bcda83fea85d4d90873',
              },
            },
          ],
        },
        {
          'id': 'de32a003d7c94760880d96e1ee858627',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '5e86e66102c04c2c81a40090de18f10e',
              },
            },
          ],
        },
        {
          'id': '27e43d8782b34f99abce0a0da11acc9a',
          'dataType': 'SpriteColorTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '3a8a5fb1173d46e2a13ec05d63148c19',
              },
            },
          ],
        },
        {
          'id': '739a5a4f62b54ecfb971d9c82dceb02d',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '8c84bd81afe240b58377ffb2bbc79c01',
            },
            {
              'id': 'de32a003d7c94760880d96e1ee858627',
            },
            {
              'id': '27e43d8782b34f99abce0a0da11acc9a',
            },
          ],
          'clips': [],
        },
        {
          'id': '2f145352f26f4673a747fb207c3057f9',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '721641c297904954a594013fe6865b2e',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'aa84ef60f0254411852214d3b68ce61a',
          'dataType': 'SpriteColorPlayableAsset',
        },
        {
          'id': '12b6df2a72f54069902d45a64653828c',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '2f145352f26f4673a747fb207c3057f9',
              },
            },
          ],
        },
        {
          'id': 'e9f79d4cfdd447c499aba04d31885127',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '721641c297904954a594013fe6865b2e',
              },
            },
          ],
        },
        {
          'id': '974de3c583b045f0bcfe4087003bd9b1',
          'dataType': 'SpriteColorTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'aa84ef60f0254411852214d3b68ce61a',
              },
            },
          ],
        },
        {
          'id': '55c137146caf4efc8b5858f5ee97c9f5',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '12b6df2a72f54069902d45a64653828c',
            },
            {
              'id': 'e9f79d4cfdd447c499aba04d31885127',
            },
            {
              'id': '974de3c583b045f0bcfe4087003bd9b1',
            },
          ],
          'clips': [],
        },
      ],
      'compositionId': 'dee7c98fc5f34aad957bc756c8face77',
      'shapes': [],
    });
  }

  static playURL (url: string, use3DConverter = false) {
    GalaceanEffects.player.destroyCurrentCompositions();
    if (use3DConverter) {
      const converter = new JSONConverter(GalaceanEffects.player.renderer);

      void converter.processScene(url).then(async (scene: any) => {
        const composition = await GalaceanEffects.player.loadScene(scene, { autoplay: true });

        composition.rootItem.addComponent(CanvasGizmo);
      });
    } else {
      void GalaceanEffects.player.loadScene(url, { autoplay: true }).then(composition => {
        composition.rootItem.addComponent(CanvasGizmo);
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