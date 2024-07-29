// @ts-nocheck
import { Player, Transform, spec } from '@galacean/effects';
import { sanitizeNumbers } from '../../../utils';

const { expect } = chai;

describe('calculate item transform', () => {
  let player;
  const canvas = document.createElement('canvas');

  beforeEach(() => {
    player = new Player({
      canvas,
      manualRender: true,
    });
  });

  afterEach(() => {
    player.dispose();
    player = null;
  });

  // if parent lifetime not begin, it will not affect children
  it('cascade transform for delay and end', async () => {
    const scene = {
      'requires': [],
      'compositionId': '17',
      'bins': [],
      'textures': [],
      'compositions': [
        {
          'name': 'composition_1',
          'id': '17',
          'duration': 15,
          'endBehavior': 0,
          'camera': {
            'fov': 30,
            'far': 20,
            'near': 0.1,
            'position': [
              0,
              0,
              8,
            ],
            'clipMode': 1,
          },
          'items': [
            {
              'id': 'f975e561744f402b94321354b8efc2d8',
            },
            {
              'id': 'c1dbb2c8519b4094a98d083d227e2023',
            },
          ],
          'previewSize': [
            750,
            1334,
          ],
          'timelineAsset': {
            'id': '9fc7f808b55b4632aa220d336cd94b6d',
          },
          'sceneBindings': [
            {
              'key': {
                'id': '68ea3ecfdfca4d4b87a3764fec91bd43',
              },
              'value': {
                'id': 'f975e561744f402b94321354b8efc2d8',
              },
            },
            {
              'key': {
                'id': '75e31dd77abb49d7a82b311d58484a55',
              },
              'value': {
                'id': 'c1dbb2c8519b4094a98d083d227e2023',
              },
            },
          ],
        },
      ],
      'playerVersion': {
        'web': '2.4.5',
        'native': '1.0.0.231013104006',
      },
      'images': [],
      'fonts': [],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'items': [
        {
          'name': 'p',
          'delay': 0.5,
          'id': 'f975e561744f402b94321354b8efc2d8',
          'type': '3',
          'endBehavior': 0,
          'duration': 1,
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
            'positionOverLifetime': {},
            'tracks': [
              {
                'clips': [
                  {
                    'id': '501e66bc1c154fa48efe903e26f1da7c',
                    'dataType': 'TransformPlayableAsset',
                    'positionOverLifetime': {},
                  },
                ],
              },
            ],
          },
          'transform': {
            'position': {
              'x': 1,
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
          'oldId': '1',
          'components': [],
          'dataType': 'VFXItemData',
          'listIndex': 0,
        },
        {
          'name': 'x',
          'delay': 0,
          'id': 'c1dbb2c8519b4094a98d083d227e2023',
          'parentId': 'f975e561744f402b94321354b8efc2d8',
          'type': '3',
          'endBehavior': 4,
          'duration': 5,
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
            'positionOverLifetime': {},
            'tracks': [
              {
                'clips': [
                  {
                    'id': 'aa7580aeedab447e8139dc5eb0d931ad',
                    'dataType': 'TransformPlayableAsset',
                    'positionOverLifetime': {},
                  },
                ],
              },
            ],
          },
          'transform': {
            'position': {
              'x': 0,
              'y': 1,
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
          'oldId': '2',
          'components': [],
          'dataType': 'VFXItemData',
          'listIndex': 1,
        },
      ],
      'components': [],
      'materials': [],
      'shaders': [],
      'geometries': [],
      'animations': [],
      'miscs': [
        {
          'tracks': [
            {
              'id': '68ea3ecfdfca4d4b87a3764fec91bd43',
            },
            {
              'id': '75e31dd77abb49d7a82b311d58484a55',
            },
          ],
          'id': '9fc7f808b55b4632aa220d336cd94b6d',
          'dataType': 'TimelineAsset',
        },
        {
          'id': 'aae735b3990a4ed39f7907fc64448de8',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0.5,
              'duration': 1,
              'endBehavior': 0,
              'asset': {
                'id': '9066792d7db3447b903853ec08aa2c45',
              },
            },
          ],
        },
        {
          'id': '228fbce941e945d28617a4053303e9d0',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0.5,
              'duration': 1,
              'endBehavior': 0,
              'asset': {
                'id': '815698f199ab425daa2830aa489c253e',
              },
            },
          ],
        },
        {
          'id': '68ea3ecfdfca4d4b87a3764fec91bd43',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': 'aae735b3990a4ed39f7907fc64448de8',
            },
            {
              'id': '228fbce941e945d28617a4053303e9d0',
            },
          ],
          'clips': [],
        },
        {
          'id': 'bf4771159826491cbd92d7924233ea94',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 4,
              'asset': {
                'id': 'a646184550b54790843fe0dda7194bcc',
              },
            },
          ],
        },
        {
          'id': '326c251c7b7347d397e5042b9e777a85',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 4,
              'asset': {
                'id': '504ee7d7eefa4bb1bf9e1b5e3925d4b8',
              },
            },
          ],
        },
        {
          'id': '75e31dd77abb49d7a82b311d58484a55',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': 'bf4771159826491cbd92d7924233ea94',
            },
            {
              'id': '326c251c7b7347d397e5042b9e777a85',
            },
          ],
          'clips': [],
        },
        {
          'id': '9066792d7db3447b903853ec08aa2c45',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '815698f199ab425daa2830aa489c253e',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'a646184550b54790843fe0dda7194bcc',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '504ee7d7eefa4bb1bf9e1b5e3925d4b8',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
      ],
    };
    const comp = await player.loadScene(scene);
    const item = comp.getItemByName('x');
    const parent = comp.getItemByName('p');

    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([0, 1, 0], 'world 0');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 0');
    comp.gotoAndStop(comp.time + 0.6);
    expect(item.transform.parentTransform).to.eql(parent.transform, 'item transform t1');
    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([1, 1, 0], 'world 1');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 1');

    comp.gotoAndStop(comp.time + 1);

    // expect(item.transform.parentTransform).to.eql(comp.transform, 'item transform t2');
    expect(sanitizeNumbers(item.transform.getWorldPosition().toArray())).to.deep.equals([0, 1, 0], 'world 0');
    expect(sanitizeNumbers(item.transform.position.toArray())).to.deep.equals([0, 1, 0], 'local 0');

  });
  it('transform set rotation', () => {
    const t = new Transform();

    t.setRotation(0, 30, 0);
    const r = t.rotation.toArray();

    expect(new Float32Array(sanitizeNumbers(r))).to.deep.equal(new Float32Array([0, 30, 0]));
  });

});

async function generateComposition (items, player, playerOptions) {
  const json = {
    requires: [],
    compositionId: '17',
    bins: [],
    textures: [],
    'compositions': [{
      'name': 'composition_1',
      'id': '17',
      'duration': 15,
      'endBehavior': spec.EndBehavior.destroy,
      'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
      'items': items.map((item, i) => ({
        'name': item.name || ('null_' + i),
        'delay': item.delay || 0,
        'id': item.id || (10086 + i),
        'parentId': item.parentId,
        'type': '3',
        'endBehavior': spec.EndBehavior.destroy,
        'duration': item.duration || 2,
        'renderLevel': 'B+',
        content: {
          options: {
            startColor: [
              1,
              1,
              1,
              1,
            ],
          },
          positionOverLifetime: { },
        },
        transform: item.transform,
      })),
      'previewSize': [750, 1334],
    }],
    playerVersion: {
      web: '2.4.5',
      native: '1.0.0.231013104006',
    },
    images: [],
    fonts: [],
    spines: [],
    version: '2.1',
    shapes: [],
    plugins: [],
    type: 'mars',
  };

  const scene = await player.createComposition(json);

  await player.gotoAndPlay(0.01);

  return scene;
}
