import type { MaterialProps, Renderer } from '@galacean/effects';
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
    //@ts-expect-error
    GalaceanEffects.playURL({
      'playerVersion': {
        'web': '2.5.3',
        'native': '0.0.1.202311221223',
      },
      'images': [
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*3HPsTI-fg5YAAAAAQEAAAAgAelB4AQ/original',
          'id': '5bbea2a63dc4495b8f799aaf63a35c7b',
          'renderLevel': 'B+',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/file/A*gisMQ7sfkckAAAAAQDAAAAgAelB4AQ/original',
        },
      ],
      'fonts': [],
      'version': '3.3',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '1',
          'name': 'FFD',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 4,
          'previewSize': [750, 1624],
          'items': [
            {
              'id': 'f6602c2bfc574d54a33d4f0c25be6939',
            },
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 1,
            'position': [0, 0, 8],
            'rotation': [0, 0, 0],
          },
          'sceneBindings': [
            {
              'key': {
                'id': '38e87215fa6b47919cfa78682ff3aa1e',
              },
              'value': {
                'id': 'f6602c2bfc574d54a33d4f0c25be6939',
              },
            },
          ],
          'timelineAsset': {
            'id': 'a8412c3982d243baa23ccd6b25359ae0',
          },
        },
      ],
      'components': [
        {
          'id': 'b15d3e90872d473f8bbd32e3bc1bbc6f',
          'item': {
            'id': 'f6602c2bfc574d54a33d4f0c25be6939',
          },
          'dataType': 'SpriteComponent',
          'options': {
            'startColor': [1, 1, 1, 1],
          },
          'renderer': {
            'renderMode': 1,
            'texture': {
              'id': '9b18ec2a6d434ca4b86de0fea2a76769',
            },
          },
          'splits': [
            [0, 0, 0.78125, 0.390625, 0],
          ],
        },
        {
          'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b',
          'item': { 'id': 'f6602c2bfc574d54a33d4f0c25be6939' },
          'dataType': 'FFDComponent',
          'controlPoints': [
            { 'x': -0.5, 'y': -0.5, 'z': 0 },
            { 'x': -0.25, 'y': -0.5, 'z': 0 },
            { 'x':  0.0, 'y': -0.5, 'z': 0 },
            { 'x':  0.25, 'y': -0.5, 'z': 0 },
            { 'x':  0.5, 'y': -0.5, 'z': 0 },

            { 'x': -0.5, 'y': -0.25, 'z': 0 },
            { 'x': -0.25, 'y': -0.25, 'z': 0 },
            { 'x':  0.0, 'y': -0.25, 'z': 0 },
            { 'x':  0.25, 'y': -0.25, 'z': 0 },
            { 'x':  0.5, 'y': -0.25, 'z': 0 },

            { 'x': -0.5, 'y':  0.0, 'z': 0 },
            { 'x': -0.25, 'y':  0.0, 'z': 0 },
            { 'x':  0.0, 'y':  0.0, 'z': 0 },
            { 'x':  0.25, 'y':  0.0, 'z': 0 },
            { 'x':  0.5, 'y':  0.0, 'z': 0 },

            { 'x': -0.5, 'y':  0.25, 'z': 0 },
            { 'x': -0.25, 'y':  0.25, 'z': 0 },
            { 'x':  0.0, 'y':  0.25, 'z': 0 },
            { 'x':  0.25, 'y':  0.25, 'z': 0 },
            { 'x':  0.5, 'y':  0.25, 'z': 0 },

            { 'x': -0.5, 'y':  0.5, 'z': 0 },
            { 'x': -0.25, 'y':  0.5, 'z': 0 },
            { 'x':  0.0, 'y':  0.5, 'z': 0 },
            { 'x':  0.25, 'y':  0.5, 'z': 0 },
            { 'x':  0.5, 'y':  0.5, 'z': 0 },
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
            'ZWrite': 1,
          },
          'textures': {
            '_MainTex': { 'texture': { 'id': '9b18ec2a6d434ca4b86de0fea2a76769' } },
          },
          'colors': {},
          'vector4s': { '_TillingOffset': { 'x': 1, 'y': 1, 'z': 0, 'w': 0 } },
          'ints': {},
          'macros': [],
          'id': '14f87546cd11476b8288280eed2aa9df',
        },
      ],
      'items': [
        {
          'id': 'f6602c2bfc574d54a33d4f0c25be6939',
          'name': 'checker',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 5,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'b15d3e90872d473f8bbd32e3bc1bbc6f',
            },
            {
              'id': 'ba8dfd10f7aa4f55941f0a908bdf2c7b',
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
              'x': 1,
              'y': 0.5,
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
          'id': '9b18ec2a6d434ca4b86de0fea2a76769',
          'source': {
            'id': '5bbea2a63dc4495b8f799aaf63a35c7b',
          },
          'flipY': true,
        },
      ],
      'animations': [],
      'miscs': [
        {
          'id': 'a8412c3982d243baa23ccd6b25359ae0',
          'dataType': 'TimelineAsset',
          'tracks': [
            {
              'id': '38e87215fa6b47919cfa78682ff3aa1e',
            },
          ],
        },
        {
          'id': '1c819cdf7f7641f690a14a2d73120901',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': 'fb7de1ed33a0471cad261c4b7d777480',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {

          },
        },
        {
          'id': '438c1edce0544a99a34b8d556e44aff1',
          'dataType': 'SpriteColorPlayableAsset',
          'startColor': [1, 1, 1, 1],
        },
        {
          'id': '2a5dfb84415d44ceac9463ed2cf4c922',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 5,
              'asset': {
                'id': '1c819cdf7f7641f690a14a2d73120901',
              },
            },
          ],
        },
        {
          'id': '62a457701fbd460cab3281ec4c316140',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 5,
              'asset': {
                'id': 'fb7de1ed33a0471cad261c4b7d777480',
              },
            },
          ],
        },
        {
          'id': 'bf5cc50d15fa42ec9576273efcb7b3e6',
          'dataType': 'SpriteColorTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 5,
              'asset': {
                'id': '438c1edce0544a99a34b8d556e44aff1',
              },
            },
          ],
        },
        {
          'id': '38e87215fa6b47919cfa78682ff3aa1e',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '2a5dfb84415d44ceac9463ed2cf4c922',
            },
            {
              'id': '62a457701fbd460cab3281ec4c316140',
            },
            {
              'id': 'bf5cc50d15fa42ec9576273efcb7b3e6',
            },
          ],
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