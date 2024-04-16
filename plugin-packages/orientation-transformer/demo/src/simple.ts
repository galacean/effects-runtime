// @ts-nocheck
import { Player } from '@galacean/effects';
import { getAdapter, type OrientationAdapterAcceler } from '@galacean/effects-plugin-orientation-transformer';

const json = {
  'compositionId':1,
  'requires':[],
  'compositions':[
    {
      'name':'composition_1',
      'id':1,
      'duration':999,
      'camera':{
        'fov':30,
        'far':20,
        'near':0.1,
        'position':[
          0,
          0,
          8,
        ],
        'clipMode':1,
      },
      'items':[
        {
          'name':'item_3',
          'delay':0,
          'id':3,
          'type':'2',
          'parentId':2,
          'ro':0.01,
          'particle':{
            'options':{
              'startLifetime':1.2,
              'startSize':0.2,
              'sizeAspect':1,
              'startSpeed':1,
              'startColor':[
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration':2,
              'maxCount':10,
              'gravityModifier':1,
              'renderLevel':'B+',
              'looping':true,
            },
            'emission':{
              'rateOverTime':5,
            },
            'shape':{
              'shape':'Sphere',
              'radius':1,
              'arc':360,
              'arcMode':0,
            },
          },
        },
        {
          'name':'plugin_3',
          'delay':0,
          'id':4,
          'type':'5',
          'content':{
            'options':{
              'duration':999,
              'type':'orientation-transformer',
              'renderLevel':'B+',
              'targets':[
                {
                  'name':'null_1',
                  'xMin':'3',
                  'xMax':'-3',
                  'yMin':'3',
                  'yMax':'-3',
                  'vMin': '-20',
                  'vMax': '20',
                  'hMin': '-20',
                  'hMax': '20',
                },
              ],
            },
          },
        },
        {
          'name':'null_1',
          'delay':0,
          'id':2,
          'type':'3',
          'cal':{
            'options':{
              'duration':2,
              'startSize':1,
              'sizeAspect':1,
              'relative':true,
              'renderLevel':'B+',
              'looping':true,
            },
          },
        },
        {
          'name':'item_1',
          'delay':0,
          'id':1,
          'type':'1',
          'parentId':2,
          'ro':0.02,
          'sprite':{
            'options':{
              'startLifetime':2,
              'startSize':1.2,
              'sizeAspect':1,
              'startColor':[
                'color',
                [
                  255,
                  255,
                  255,
                ],
              ],
              'duration':2,
              'gravityModifier':1,
              'renderLevel':'B+',
              'looping':true,
            },
            'renderer':{
              'renderMode':1,
            },
          },
        },
      ],
      'meta':{
        'previewSize':[
          750,
          1334,
        ],
      },
    },
  ],
  'gltf':[],
  'images':[],
  'version':'0.9.0',
  'shapes':[],
  'plugins':[
    'orientation-transformer',
  ],
  'type':'mars',
  '_imgs':{
    '1':[],
  },
};
const container = document.getElementById('J-container');
const betaInput = document.querySelector('input[name="beta"]');
const gammaInput = document.querySelector('input[name="gamma"]');

(async () => {
  const adapter = getAdapter();
  const player = createPlayer();
  const scene = await player.loadScene(json);

  betaInput.addEventListener('input', () => { handleInputChange(adapter); });
  gammaInput.addEventListener('input', () => { handleInputChange(adapter); });

  void player.play(scene);
})();

function handleInputChange (adapter: OrientationAdapterAcceler) {
  adapter.dispatchMotion({
    x: +betaInput.value / 100,
    y: +gammaInput.value / 100,
  });
  document.getElementById('J-info').innerText = `[info] x: ${betaInput.value}, y: ${gammaInput.value}`;
}

function createPlayer () {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    interactive: true,
  });

  return player;
}
