import { Player, RendererComponent, TextComponent } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    interactive: true,
  });

  const composition = await player.loadScene(getTestScene());
  const sceneRendererComponents: RendererComponent[] = [];
  const hitResText = composition.getItemByName('text')?.getComponent(TextComponent);

  player.canvas.addEventListener('mousemove', e=>{
    const [x, y] = getHitTestCoord(e);
    const hitRes = composition.hitTest(x, y, true);

    hitResText?.setText('Text');

    for (const shape of sceneRendererComponents) {
      for (const material of shape.materials) {
        material.color.set(1, 1, 1, 1);
      }
    }

    for (const hit of hitRes) {
      const shape = composition.getItemByName(hit.name)?.getComponent(RendererComponent);

      if (!shape) {
        continue;
      }

      hitResText?.setText(shape.item.name);
      if (!sceneRendererComponents.includes(shape)) {
        sceneRendererComponents.push(shape);
      }

      for (const material of shape.materials) {
        material.color.set(38 / 255, 187 / 255, 255 / 255, 1);
      }
    }
  });
})();

function getHitTestCoord (e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  const bounding = canvas.getBoundingClientRect();
  const x = ((e.clientX - bounding.left) / bounding.width) * 2 - 1;
  const y = 1 - ((e.clientY - bounding.top) / bounding.height) * 2;

  return [x, y];
}

function getTestScene () {
  const json = {
    'playerVersion': {
      'web': '2.7.3',
      'native': '0.0.1.202311221223',
    },
    'images': [],
    'fonts': [],
    'version': '3.5',
    'plugins': [
      'video',
    ],
    'type': 'ge',
    'compositions': [
      {
        'id': '8111c30c0412475db2d86d6e99dfac0b',
        'name': '弹窗 (1)',
        'duration': 8,
        'startTime': 0,
        'endBehavior': 5,
        'previewSize': [750, 1624],
        'camera': {
          'fov': 60,
          'far': 20,
          'near': 0.1,
          'clipMode': 1,
          'position': [0, 0, 8],
          'rotation': [0, 0, 0],
        },
        'components': [
          {
            'id': 'ec9e8cccc9f54a348b359de6f6527cd9',
          },
        ],
      },
      {
        'id': '493064b543fc4a35907ea7721a6f4700',
        'name': '元素点击测试',
        'duration': 20,
        'startTime': 0,
        'endBehavior': 5,
        'previewSize': [1920, 1080],
        'camera': {
          'fov': 60,
          'far': 40,
          'near': 0.1,
          'clipMode': 1,
          'position': [0, 0, 8],
          'rotation': [0, 0, 0],
        },
        'components': [
          {
            'id': '55714a8e887a49f195ac6fa27547335b',
          },
        ],
      },
    ],
    'components': [
      {
        'id': '55714a8e887a49f195ac6fa27547335b',
        'item': {
          'id': '493064b543fc4a35907ea7721a6f4700',
        },
        'dataType': 'CompositionComponent',
        'items': [
          {
            'id': '474917daa3f34c12a8e6ed7213029e6c',
          },
          {
            'id': 'e02c8c35108641f3a9989765a2f68579',
          },
          {
            'id': '70a1794f0a35456d86542b7ad164b84b',
          },
          {
            'id': '7bbaa7b443504a2395e4ef3638fab377',
          },
          {
            'id': '44f078fb717d41baabbd826f9cdf6421',
          },
          {
            'id': 'c7b978fc9c1346efa02186c315d37bfd',
          },
          {
            'id': '0cb9052cf580494e9fe7164147809325',
          },
          {
            'id': '30343d48cc6f4d739a24b4783f281337',
          },
          {
            'id': '43670919a732482b86005b3a2e80f390',
          },
          {
            'id': '3561f50d537a44e59998822a2b9e3aa6',
          },
          {
            'id': 'e06a4188795e4056b8d4e3850d833440',
          },
          {
            'id': 'a1ddabcba1c3461cb162c4096722dc4d',
          },
          {
            'id': '9f10ff50190d4470beb10f25385aab1e',
          },
          {
            'id': '2041ddb55923444da776787640b4770e',
          },
          {
            'id': '2bc52029552e4e619c884d04cb0641ed',
          },
          {
            'id': '3dda864b69e54d6a83bf9d893d40b545',
          },
          {
            'id': '1ac57baba7224662b690b1b8c44060a0',
          },
          {
            'id': 'b6549b421e624d1593f21080f9177a03',
          },
          {
            'id': '35032124fe1d42cc93ebf794e049449f',
          },
          {
            'id': '4e2acfcf013248788a0dc6931bd205f9',
          },
          {
            'id': '4e15200d2dfb413c8b3b907a4c8d736c',
          },
          {
            'id': '62a5829c5f51492095963ecb67128262',
          },
          {
            'id': '9abde1c85e834196b2b1836b1c6d81ae',
          },
          {
            'id': 'c680a10296d946c3ada04b0d9d7e2042',
          },
          {
            'id': 'b7b2928ae66242318a95bff927f82a8b',
          },
          {
            'id': '80d83250e1aa4540857e54bd82773a59',
          },
          {
            'id': 'f1a0e0000000000000000000000000c2',
          },
          {
            'id': 'f1a0e0000000000000000000000000c3',
          },
        ],
        'timelineAsset': {
          'id': 'c61dbe0c35754a30b99c5ca77e0aff71',
        },
        'sceneBindings': [
          {
            'key': {
              'id': '7e2d09a1581744e3893b26cf7dbb5357',
            },
            'value': {
              'id': '474917daa3f34c12a8e6ed7213029e6c',
            },
          },
          {
            'key': {
              'id': '0eded561bed64bd4b3ec1235f15838e1',
            },
            'value': {
              'id': 'e02c8c35108641f3a9989765a2f68579',
            },
          },
          {
            'key': {
              'id': '4e2201ac5b8f49fbaa9e3c76216101e8',
            },
            'value': {
              'id': '70a1794f0a35456d86542b7ad164b84b',
            },
          },
          {
            'key': {
              'id': '9cb2e18e98d5426d9af6e4532195e60d',
            },
            'value': {
              'id': '7bbaa7b443504a2395e4ef3638fab377',
            },
          },
          {
            'key': {
              'id': '873891bf25af40eb836cc8cf0ef499ef',
            },
            'value': {
              'id': '44f078fb717d41baabbd826f9cdf6421',
            },
          },
          {
            'key': {
              'id': '6d58e34d1f1c465dbd442e99561b3b95',
            },
            'value': {
              'id': 'c7b978fc9c1346efa02186c315d37bfd',
            },
          },
          {
            'key': {
              'id': 'e2f8d25196a849f18b532137911c1075',
            },
            'value': {
              'id': '0cb9052cf580494e9fe7164147809325',
            },
          },
          {
            'key': {
              'id': '01c26218115e42a1bf031f75c341f5e5',
            },
            'value': {
              'id': '30343d48cc6f4d739a24b4783f281337',
            },
          },
          {
            'key': {
              'id': '4ba1ad6462cc470f9293f9b0a1c584be',
            },
            'value': {
              'id': '43670919a732482b86005b3a2e80f390',
            },
          },
          {
            'key': {
              'id': '381579cc8fba4a87b146f0760665b283',
            },
            'value': {
              'id': '3561f50d537a44e59998822a2b9e3aa6',
            },
          },
          {
            'key': {
              'id': '26e3e81d7e934ddea50f11f99480c9e3',
            },
            'value': {
              'id': 'e06a4188795e4056b8d4e3850d833440',
            },
          },
          {
            'key': {
              'id': '87d471a0824149639b5b5b0f935237cd',
            },
            'value': {
              'id': 'a1ddabcba1c3461cb162c4096722dc4d',
            },
          },
          {
            'key': {
              'id': '8bbd2b6d3a894d09a9fb3bb112fec127',
            },
            'value': {
              'id': '9f10ff50190d4470beb10f25385aab1e',
            },
          },
          {
            'key': {
              'id': '4d3a4f7c676441b18a8b033f2ad77f85',
            },
            'value': {
              'id': '2041ddb55923444da776787640b4770e',
            },
          },
          {
            'key': {
              'id': '2ccd28e12b354d2697781d6769bf6e77',
            },
            'value': {
              'id': '2bc52029552e4e619c884d04cb0641ed',
            },
          },
          {
            'key': {
              'id': 'ecae94b0f7894c479e2a97e74df6ad85',
            },
            'value': {
              'id': '3dda864b69e54d6a83bf9d893d40b545',
            },
          },
          {
            'key': {
              'id': 'c176a1557737439ab823b6390dc8f7c6',
            },
            'value': {
              'id': '1ac57baba7224662b690b1b8c44060a0',
            },
          },
          {
            'key': {
              'id': 'c8ec2b514f394ce594960d052ae9a216',
            },
            'value': {
              'id': 'b6549b421e624d1593f21080f9177a03',
            },
          },
          {
            'key': {
              'id': 'c04fda3499a74057bc94507ba86356f3',
            },
            'value': {
              'id': '35032124fe1d42cc93ebf794e049449f',
            },
          },
          {
            'key': {
              'id': '0c7102cc4a8544b6942f44d6c0f90d74',
            },
            'value': {
              'id': '4e2acfcf013248788a0dc6931bd205f9',
            },
          },
          {
            'key': {
              'id': '3513aab675484c328a8dfd92f6f6a43e',
            },
            'value': {
              'id': '4e15200d2dfb413c8b3b907a4c8d736c',
            },
          },
          {
            'key': {
              'id': '23f8bd9db8af410699fa278f92807b47',
            },
            'value': {
              'id': '62a5829c5f51492095963ecb67128262',
            },
          },
          {
            'key': {
              'id': 'b7e7fd95e93048d89944908ce746f985',
            },
            'value': {
              'id': '9abde1c85e834196b2b1836b1c6d81ae',
            },
          },
          {
            'key': {
              'id': '4a1f700bf8764914bb6e1f47370bdaea',
            },
            'value': {
              'id': 'c680a10296d946c3ada04b0d9d7e2042',
            },
          },
          {
            'key': {
              'id': '22d39686be0a41a4a2e3777b3f121828',
            },
            'value': {
              'id': 'b7b2928ae66242318a95bff927f82a8b',
            },
          },
          {
            'key': {
              'id': '02727f545e634386b195af56b4969a83',
            },
            'value': {
              'id': '80d83250e1aa4540857e54bd82773a59',
            },
          },
        ],
      },
      {
        'id': 'ec9e8cccc9f54a348b359de6f6527cd9',
        'item': {
          'id': '8111c30c0412475db2d86d6e99dfac0b',
        },
        'dataType': 'CompositionComponent',
        'items': [
          {
            'id': '592a1d74416a4605a1ce1962bc18e395',
          },
          {
            'id': '4055840d775740e28f800b49d1dc723a',
          },
          {
            'id': 'c5377d4cbc0146cdbef0f6e6412c7d5b',
          },
        ],
        'timelineAsset': {
          'id': '7f14115bbe56448fbfd65577482aa7f4',
        },
        'sceneBindings': [
          {
            'key': {
              'id': '7fcaf0b951fb4fe0b49536e2f477518d',
            },
            'value': {
              'id': '592a1d74416a4605a1ce1962bc18e395',
            },
          },
          {
            'key': {
              'id': 'fb00db1ac075488c818667af881dc7bc',
            },
            'value': {
              'id': '4055840d775740e28f800b49d1dc723a',
            },
          },
          {
            'key': {
              'id': '03f29ac1ac8a441c8439cbf915cb0bff',
            },
            'value': {
              'id': 'c5377d4cbc0146cdbef0f6e6412c7d5b',
            },
          },
        ],
      },
      {
        'id': '4ed7b461148a4c1eb89a14569f50b429',
        'item': {
          'id': '592a1d74416a4605a1ce1962bc18e395',
        },
        'dataType': 'SpriteComponent',
        'options': {
          'startColor': [1, 1, 1, 1],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'f1a0e0000000000000000000000000c1',
        'item': {
          'id': 'f1a0e0000000000000000000000000c2',
        },
        'dataType': 'FrameComponent',
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'f1a0e0000000000000000000000000c4',
        'item': {
          'id': 'f1a0e0000000000000000000000000c3',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '画框',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [
            255,
            255,
            255,
            1,
          ],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [
            0.6791,
            0.1876,
          ],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '91dec43df01440afb65a761d8b86f0b5',
        'item': {
          'id': '4055840d775740e28f800b49d1dc723a',
        },
        'type': 3,
        'dataType': 'ShapeComponent',
        'pointCount': 5,
        'radius': 1.3897,
        'roundness': 0,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '096d098cc3434c70a04e945a53e43ad8',
        'item': {
          'id': 'c5377d4cbc0146cdbef0f6e6412c7d5b',
        },
        'type': 2,
        'dataType': 'ShapeComponent',
        'xRadius': 1.2922,
        'yRadius': 1.2922,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'f078cfb36ed3423388f148622758f66e',
        'item': {
          'id': 'e02c8c35108641f3a9989765a2f68579',
        },
        'dataType': 'SpriteComponent',
        'options': {
          'startColor': [1, 1, 1, 1],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '56aa71a7e99f471bbdb89949d81b36c6',
        'item': {
          'id': '70a1794f0a35456d86542b7ad164b84b',
        },
        'dataType': 'VideoComponent',
        'options': {
          'startColor': [1, 1, 1, 1],
          'muted': true,
          'video': {

          },
          'volume': 1,
          'playbackRate': 1,
          'transparent': false,
        },
        'renderer': {
          'renderMode': 1,
        },
        'resourceId': '',
      },
      {
        'id': '38dcd0bf3d9348978fe1796d58bce9e2',
        'item': {
          'id': '7bbaa7b443504a2395e4ef3638fab377',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': 'Text',
          'fontFamily': 'sans-serif',
          'fontSize': 91.3,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 250.4982,
          'textHeight': 143,
          'lineHeight': 143.478,
          'size': [1.205, 0.6879],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'db663f4fce58418aa67ac548921d67e2',
        'item': {
          'id': '44f078fb717d41baabbd826f9cdf6421',
        },
        'type': 1,
        'dataType': 'ShapeComponent',
        'width': 0.9124,
        'height': 0.7578,
        'roundness': 0,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'd9858d630f4e43f29fc865334ed670bc',
        'item': {
          'id': 'c7b978fc9c1346efa02186c315d37bfd',
        },
        'type': 2,
        'dataType': 'ShapeComponent',
        'xRadius': 2,
        'yRadius': 1,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'a15cf821922a4e2fa76927e5f7a70468',
        'item': {
          'id': '0cb9052cf580494e9fe7164147809325',
        },
        'type': 3,
        'dataType': 'ShapeComponent',
        'pointCount': 5,
        'radius': 0.5233,
        'roundness': 0,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'e9d5351bd55f4bfb8bd30be4612a8460',
        'item': {
          'id': '30343d48cc6f4d739a24b4783f281337',
        },
        'type': 4,
        'dataType': 'ShapeComponent',
        'pointCount': 5,
        'innerRadius': 0.1921,
        'outerRadius': 0.3841,
        'innerRoundness': 0,
        'outerRoundness': 0,
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'f9d6e8c6f8cb422db393725c453025bc',
        'item': {
          'id': '43670919a732482b86005b3a2e80f390',
        },
        'type': 0,
        'dataType': 'ShapeComponent',
        'origin': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'points': [
          {
            'x': -0.2551,
            'y': 0.5556,
          },
          {
            'x': -0.7423,
            'y': 0.1789,
          },
          {
            'x': -0.2552,
            'y': -0.2022,
          },
          {
            'x': 0.7423,
            'y': 0.1789,
          },
          {
            'x': 0.3093,
            'y': -0.5556,
          },
          {
            'x': 473.569,
            'y': -131.3004,
          },
        ],
        'easingIns': [
          {
            'x': 0.3557,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0.1878,
          },
          {
            'x': -0.317,
            'y': -0.0055,
          },
          {
            'x': 0.0077,
            'y': 0.644,
          },
          {
            'x': 0,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0,
          },
        ],
        'easingOuts': [
          {
            'x': -0.3557,
            'y': 0,
          },
          {
            'x': 0,
            'y': -0.1878,
          },
          {
            'x': 0.317,
            'y': 0.0055,
          },
          {
            'x': -0.0077,
            'y': -0.644,
          },
          {
            'x': 0,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0,
          },
        ],
        'shapes': [
          {
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
              {
                'point': 3,
                'easingIn': 3,
                'easingOut': 3,
              },
            ],
            'close': true,
          },
          {
            'indexes': [
              {
                'point': 4,
                'easingIn': 5,
                'easingOut': 5,
              },
            ],
            'close': false,
          },
        ],
        'fills': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokes': [],
        'strokeWidth': 0,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'ed04631bb223471b820ada7ac45f481e',
        'item': {
          'id': '3561f50d537a44e59998822a2b9e3aa6',
        },
        'type': 2,
        'dataType': 'ShapeComponent',
        'xRadius': 2,
        'yRadius': 1,
        'fills': [],
        'strokes': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokeWidth': 0.5,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '3960edc1a1344d92b5beb2b7c21083cd',
        'item': {
          'id': 'e06a4188795e4056b8d4e3850d833440',
        },
        'type': 1,
        'dataType': 'ShapeComponent',
        'width': 0.9124,
        'height': 0.7578,
        'roundness': 0,
        'fills': [],
        'strokes': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokeWidth': 0.1,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'c1a31d513131446595a5f2e2cc8adee4',
        'item': {
          'id': 'a1ddabcba1c3461cb162c4096722dc4d',
        },
        'type': 3,
        'dataType': 'ShapeComponent',
        'pointCount': 5,
        'radius': 0.5233,
        'roundness': 0,
        'fills': [],
        'strokes': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokeWidth': 0.1,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '6236c49624d9441daeada1ee16f21ea6',
        'item': {
          'id': '9f10ff50190d4470beb10f25385aab1e',
        },
        'type': 4,
        'dataType': 'ShapeComponent',
        'pointCount': 5,
        'innerRadius': 0.1921,
        'outerRadius': 0.3841,
        'innerRoundness': 0,
        'outerRoundness': 0,
        'fills': [],
        'strokes': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokeWidth': 0.1,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '1a0c2953d9ee40068aaf7319cd543dbd',
        'item': {
          'id': '2041ddb55923444da776787640b4770e',
        },
        'type': 0,
        'dataType': 'ShapeComponent',
        'origin': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'points': [
          {
            'x': -0.2551,
            'y': 0.5556,
          },
          {
            'x': -0.7423,
            'y': 0.1789,
          },
          {
            'x': -0.2552,
            'y': -0.2022,
          },
          {
            'x': 0.7423,
            'y': 0.1789,
          },
          {
            'x': 0.3093,
            'y': -0.5556,
          },
          {
            'x': 473.569,
            'y': -131.3004,
          },
        ],
        'easingIns': [
          {
            'x': 0.3557,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0.1878,
          },
          {
            'x': -0.317,
            'y': -0.0055,
          },
          {
            'x': 0.0077,
            'y': 0.644,
          },
          {
            'x': 0,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0,
          },
        ],
        'easingOuts': [
          {
            'x': -0.3557,
            'y': 0,
          },
          {
            'x': 0,
            'y': -0.1878,
          },
          {
            'x': 0.317,
            'y': 0.0055,
          },
          {
            'x': -0.0077,
            'y': -0.644,
          },
          {
            'x': 0,
            'y': 0,
          },
          {
            'x': 0,
            'y': 0,
          },
        ],
        'shapes': [
          {
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
              {
                'point': 3,
                'easingIn': 3,
                'easingOut': 3,
              },
            ],
            'close': true,
          },
          {
            'indexes': [
              {
                'point': 4,
                'easingIn': 5,
                'easingOut': 5,
              },
            ],
            'close': false,
          },
        ],
        'fills': [],
        'strokes': [
          {
            'type': 0,
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
        ],
        'strokeWidth': 0.1,
        'strokeCap': 0,
        'strokeJoin': 0,
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '2cb9639582bb4c9d8b3719adf656a4ca',
        'item': {
          'id': '2bc52029552e4e619c884d04cb0641ed',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '元素点击测试',
          'fontFamily': 'sans-serif',
          'fontSize': 50,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 1044.5855,
          'textHeight': 79,
          'lineHeight': 78.575,
          'size': [5.0247, 0.38],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '70b0fa55070546b3bf8fdfed27196be3',
        'item': {
          'id': '3dda864b69e54d6a83bf9d893d40b545',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '预合成',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'a6982cde010a49518d356b8be18380fc',
        'item': {
          'id': '1ac57baba7224662b690b1b8c44060a0',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '图层',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 73.8816,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.3554, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '7eb26b4c7615408788bc38884ced8fd8',
        'item': {
          'id': 'b6549b421e624d1593f21080f9177a03',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '视屏',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '87c6fc17f55d4152884a4d0f16055e89',
        'item': {
          'id': '35032124fe1d42cc93ebf794e049449f',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '文本',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'fe1f740be506480cba857997bcb5209c',
        'item': {
          'id': '4e2acfcf013248788a0dc6931bd205f9',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '椭圆',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '3196e78e4cad41fcb55112c2e745d944',
        'item': {
          'id': '4e15200d2dfb413c8b3b907a4c8d736c',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '填充',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'e2205b65602e4c7c9b3149326a8f6194',
        'item': {
          'id': '62a5829c5f51492095963ecb67128262',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '线框',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '065345c6511f4bca9ddc9cfe1fd2c437',
        'item': {
          'id': '9abde1c85e834196b2b1836b1c6d81ae',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '矩形',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': 'a46d9da5cf3e4271a030aea0e1819c0d',
        'item': {
          'id': 'c680a10296d946c3ada04b0d9d7e2042',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '多边形',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '3266324181f74c858951e445ef6b8dc5',
        'item': {
          'id': 'b7b2928ae66242318a95bff927f82a8b',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '星形',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
      {
        'id': '98197ff690eb4ae89d9f4925b7633cd5',
        'item': {
          'id': '80d83250e1aa4540857e54bd82773a59',
        },
        'dataType': 'TextComponent',
        'options': {
          'text': '自定义形状',
          'fontFamily': 'sans-serif',
          'fontSize': 25,
          'textColor': [255, 255, 255, 1],
          'fontWeight': 'normal',
          'letterSpace': 0,
          'textAlign': 1,
          'fontStyle': 'normal',
          'autoWidth': false,
          'textWidth': 141.1821,
          'textHeight': 39,
          'lineHeight': 39.2875,
          'size': [0.6791, 0.1876],
        },
        'renderer': {
          'renderMode': 1,
        },
      },
    ],
    'geometries': [],
    'materials': [],
    'items': [
      {
        'id': '474917daa3f34c12a8e6ed7213029e6c',
        'components': [],
        'name': '弹窗 (1)',
        'duration': 8.87,
        'dataType': 'VFXItemData',
        'type': '7',
        'visible': true,
        'endBehavior': 4,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'refId': '8111c30c0412475db2d86d6e99dfac0b',
          },
          'positionOverLifetime': {

          },
        },
        'transform': {
          'position': {
            'x': 3.3549,
            'y': 1.4271,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.1749,
            'y': 0.1749,
            'z': 1,
          },
        },
      },
      {
        'id': '592a1d74416a4605a1ce1962bc18e395',
        'name': 'sprite_3',
        'duration': 8,
        'type': '1',
        'visible': true,
        'endBehavior': 4,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '4ed7b461148a4c1eb89a14569f50b429',
          },
        ],
        'transform': {
          'position': {
            'x': -1.7038,
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
            'x': 2.3307,
            'y': 2.3307,
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
        'id': '4055840d775740e28f800b49d1dc723a',
        'name': 'polygon_6',
        'duration': 8,
        'type': 'shape',
        'visible': true,
        'endBehavior': 4,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '91dec43df01440afb65a761d8b86f0b5',
          },
        ],
        'transform': {
          'position': {
            'x': 0,
            'y': -2.8684,
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
          'scale': {
            'x': 1,
            'y': 1,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': 'f1a0e0000000000000000000000000c2',
        'name': 'frame',
        'duration': 8,
        'type': 'shape',
        'visible': true,
        'endBehavior': 4,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'f1a0e0000000000000000000000000c1',
          },
        ],
        'transform': {
          'position': {
            'x': 1.865,
            'y': 1.1444,
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
            'y': 1,
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
        'id': 'f1a0e0000000000000000000000000c3',
        'name': 'frame_title',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 1.865,
            'y': 0.517,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': 'f1a0e0000000000000000000000000c4',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': 'c5377d4cbc0146cdbef0f6e6412c7d5b',
        'name': 'ellipse_7',
        'duration': 8,
        'type': 'shape',
        'visible': true,
        'endBehavior': 4,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '096d098cc3434c70a04e945a53e43ad8',
          },
        ],
        'transform': {
          'position': {
            'x': 1.6717,
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
          'scale': {
            'x': 1,
            'y': 1,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': 'e02c8c35108641f3a9989765a2f68579',
        'name': 'sprite',
        'duration': 20,
        'type': '1',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'f078cfb36ed3423388f148622758f66e',
          },
        ],
        'transform': {
          'position': {
            'x': -2.605,
            'y': 1.1444,
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
            'x': 0.8043,
            'y': 0.8043,
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
        'id': '70a1794f0a35456d86542b7ad164b84b',
        'name': 'video',
        'duration': 20,
        'type': 'video',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '56aa71a7e99f471bbdb89949d81b36c6',
          },
        ],
        'transform': {
          'position': {
            'x': -1.115,
            'y': 1.1444,
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
            'x': 0.8043,
            'y': 0.8043,
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
        'id': '7bbaa7b443504a2395e4ef3638fab377',
        'name': 'text',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 0.375,
            'y': 1.1444,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 1.205,
            'y': 0.6879,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '38dcd0bf3d9348978fe1796d58bce9e2',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '44f078fb717d41baabbd826f9cdf6421',
        'name': 'rectangle',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'db663f4fce58418aa67ac548921d67e2',
          },
        ],
        'transform': {
          'position': {
            'x': -1.4324,
            'y': -0.1182,
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
          'scale': {
            'x': 1,
            'y': 1,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': 'c7b978fc9c1346efa02186c315d37bfd',
        'name': 'ellipse',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'd9858d630f4e43f29fc865334ed670bc',
          },
        ],
        'transform': {
          'position': {
            'x': -3.0654,
            'y': -0.1047,
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
          'scale': {
            'x': 0.2912,
            'y': 0.2912,
            'z': 0.2912,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '0cb9052cf580494e9fe7164147809325',
        'name': 'polygon',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'a15cf821922a4e2fa76927e5f7a70468',
          },
        ],
        'transform': {
          'position': {
            'x': 0.2129,
            'y': -0.0853,
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
          'scale': {
            'x': 0.8043,
            'y': 0.8043,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '30343d48cc6f4d739a24b4783f281337',
        'name': 'star',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'e9d5351bd55f4bfb8bd30be4612a8460',
          },
        ],
        'transform': {
          'position': {
            'x': 1.7129,
            'y': -0.1174,
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
          'scale': {
            'x': 1.1789,
            'y': 1.1789,
            'z': 1.4656,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '43670919a732482b86005b3a2e80f390',
        'name': 'custom',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'f9d6e8c6f8cb422db393725c453025bc',
          },
        ],
        'transform': {
          'position': {
            'x': 3.4652,
            'y': -0.2176,
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
          'scale': {
            'x': 0.8043,
            'y': 0.8043,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '3561f50d537a44e59998822a2b9e3aa6',
        'name': 'ellipse_wireframe',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'ed04631bb223471b820ada7ac45f481e',
          },
        ],
        'transform': {
          'position': {
            'x': -3.0654,
            'y': -1.6337,
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
          'scale': {
            'x': 0.2912,
            'y': 0.2912,
            'z': 0.2912,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': 'e06a4188795e4056b8d4e3850d833440',
        'name': 'rectangle_wireframe',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '3960edc1a1344d92b5beb2b7c21083cd',
          },
        ],
        'transform': {
          'position': {
            'x': -1.4324,
            'y': -1.6228,
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
          'scale': {
            'x': 1,
            'y': 1,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': 'a1ddabcba1c3461cb162c4096722dc4d',
        'name': 'polygon_wireframe',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': 'c1a31d513131446595a5f2e2cc8adee4',
          },
        ],
        'transform': {
          'position': {
            'x': 0.2129,
            'y': -1.5899,
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
          'scale': {
            'x': 0.8043,
            'y': 0.8043,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '9f10ff50190d4470beb10f25385aab1e',
        'name': 'star_wireframe',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '6236c49624d9441daeada1ee16f21ea6',
          },
        ],
        'transform': {
          'position': {
            'x': 1.7129,
            'y': -1.622,
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
          'scale': {
            'x': 1.1789,
            'y': 1.1789,
            'z': 1.4656,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '2041ddb55923444da776787640b4770e',
        'name': 'custom_wireframe',
        'duration': 20,
        'type': 'shape',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'components': [
          {
            'id': '1a0c2953d9ee40068aaf7319cd543dbd',
          },
        ],
        'transform': {
          'position': {
            'x': 3.4652,
            'y': -1.7221,
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
          'scale': {
            'x': 0.8043,
            'y': 0.8043,
            'z': 1,
          },
        },
        'dataType': 'VFXItemData',
      },
      {
        'id': '2bc52029552e4e619c884d04cb0641ed',
        'name': 'title',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 0,
            'y': 2.0325,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 5.0247,
            'y': 0.38,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '2cb9639582bb4c9d8b3719adf656a4ca',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '3dda864b69e54d6a83bf9d893d40b545',
        'name': 'bottom_title10',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 3.4101,
            'y': 0.517,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '70b0fa55070546b3bf8fdfed27196be3',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '1ac57baba7224662b690b1b8c44060a0',
        'name': 'bottom_title9',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -2.6151,
            'y': 0.517,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.3554,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': 'a6982cde010a49518d356b8be18380fc',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': 'b6549b421e624d1593f21080f9177a03',
        'name': 'bottom_title8',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -1.115,
            'y': 0.517,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '7eb26b4c7615408788bc38884ced8fd8',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '35032124fe1d42cc93ebf794e049449f',
        'name': 'bottom_title7',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 0.375,
            'y': 0.517,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '87c6fc17f55d4152884a4d0f16055e89',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '4e2acfcf013248788a0dc6931bd205f9',
        'name': 'bottom_title6',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -3.0654,
            'y': -0.8544,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': 'fe1f740be506480cba857997bcb5209c',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '4e15200d2dfb413c8b3b907a4c8d736c',
        'name': 'bottom_title5',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -4.2388,
            'y': -0.1182,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '3196e78e4cad41fcb55112c2e745d944',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '62a5829c5f51492095963ecb67128262',
        'name': 'bottom_title4',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -4.2783,
            'y': -1.58,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': 'e2205b65602e4c7c9b3149326a8f6194',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '9abde1c85e834196b2b1836b1c6d81ae',
        'name': 'bottom_title3',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': -1.4324,
            'y': -0.8352,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '065345c6511f4bca9ddc9cfe1fd2c437',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': 'c680a10296d946c3ada04b0d9d7e2042',
        'name': 'bottom_title2',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 0.2129,
            'y': -0.8456,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': 'a46d9da5cf3e4271a030aea0e1819c0d',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': 'b7b2928ae66242318a95bff927f82a8b',
        'name': 'bottom_title1',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 1.7129,
            'y': -0.8456,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '3266324181f74c858951e445ef6b8dc5',
          },
        ],
        'dataType': 'VFXItemData',
      },
      {
        'id': '80d83250e1aa4540857e54bd82773a59',
        'name': 'bottom_title',
        'duration': 20,
        'type': 'text',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': {
            'x': 3.4644,
            'y': -0.8367,
            'z': 0,
          },
          'eulerHint': {
            'x': 0,
            'y': 0,
            'z': 0,
          },
          'scale': {
            'x': 0.6791,
            'y': 0.1876,
            'z': 1,
          },
        },
        'components': [
          {
            'id': '98197ff690eb4ae89d9f4925b7633cd5',
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
        'id': 'c61dbe0c35754a30b99c5ca77e0aff71',
        'dataType': 'TimelineAsset',
        'tracks': [
          {
            'id': '7e2d09a1581744e3893b26cf7dbb5357',
          },
          {
            'id': '0eded561bed64bd4b3ec1235f15838e1',
          },
          {
            'id': '4e2201ac5b8f49fbaa9e3c76216101e8',
          },
          {
            'id': '9cb2e18e98d5426d9af6e4532195e60d',
          },
          {
            'id': '873891bf25af40eb836cc8cf0ef499ef',
          },
          {
            'id': '6d58e34d1f1c465dbd442e99561b3b95',
          },
          {
            'id': 'e2f8d25196a849f18b532137911c1075',
          },
          {
            'id': '01c26218115e42a1bf031f75c341f5e5',
          },
          {
            'id': '4ba1ad6462cc470f9293f9b0a1c584be',
          },
          {
            'id': '381579cc8fba4a87b146f0760665b283',
          },
          {
            'id': '26e3e81d7e934ddea50f11f99480c9e3',
          },
          {
            'id': '87d471a0824149639b5b5b0f935237cd',
          },
          {
            'id': '8bbd2b6d3a894d09a9fb3bb112fec127',
          },
          {
            'id': '4d3a4f7c676441b18a8b033f2ad77f85',
          },
          {
            'id': '2ccd28e12b354d2697781d6769bf6e77',
          },
          {
            'id': 'ecae94b0f7894c479e2a97e74df6ad85',
          },
          {
            'id': 'c176a1557737439ab823b6390dc8f7c6',
          },
          {
            'id': 'c8ec2b514f394ce594960d052ae9a216',
          },
          {
            'id': 'c04fda3499a74057bc94507ba86356f3',
          },
          {
            'id': '0c7102cc4a8544b6942f44d6c0f90d74',
          },
          {
            'id': '3513aab675484c328a8dfd92f6f6a43e',
          },
          {
            'id': '23f8bd9db8af410699fa278f92807b47',
          },
          {
            'id': 'b7e7fd95e93048d89944908ce746f985',
          },
          {
            'id': '4a1f700bf8764914bb6e1f47370bdaea',
          },
          {
            'id': '22d39686be0a41a4a2e3777b3f121828',
          },
          {
            'id': '02727f545e634386b195af56b4969a83',
          },
        ],
      },
      {
        'id': 'f0141a63ab2948f0a57dfadf0008920c',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'e7989361a8bd4521a185cfffdc359edc',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '53dd52941513499c802547765e6d4a2e',
        'dataType': 'SubCompositionPlayableAsset',
      },
      {
        'id': '425555183ff0456a90fa2fa12897afd0',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8.87,
            'endBehavior': 4,
            'asset': {
              'id': 'f0141a63ab2948f0a57dfadf0008920c',
            },
          },
        ],
      },
      {
        'id': 'b1ba58e3560e4346b33941329b1db0b8',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8.87,
            'endBehavior': 4,
            'asset': {
              'id': 'e7989361a8bd4521a185cfffdc359edc',
            },
          },
        ],
      },
      {
        'id': '4cfcc575c6a640f5b1adfe0746c2fcde',
        'dataType': 'SubCompositionTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8.87,
            'endBehavior': 4,
            'asset': {
              'id': '53dd52941513499c802547765e6d4a2e',
            },
          },
        ],
      },
      {
        'id': '7e2d09a1581744e3893b26cf7dbb5357',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '425555183ff0456a90fa2fa12897afd0',
          },
          {
            'id': 'b1ba58e3560e4346b33941329b1db0b8',
          },
          {
            'id': '4cfcc575c6a640f5b1adfe0746c2fcde',
          },
        ],
        'clips': [],
      },
      {
        'id': '7f14115bbe56448fbfd65577482aa7f4',
        'dataType': 'TimelineAsset',
        'tracks': [
          {
            'id': '7fcaf0b951fb4fe0b49536e2f477518d',
          },
          {
            'id': 'fb00db1ac075488c818667af881dc7bc',
          },
          {
            'id': '03f29ac1ac8a441c8439cbf915cb0bff',
          },
        ],
      },
      {
        'id': '5d4f8a90ba38431da4a654b255555549',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '49f9a51800e64ec4a7d07da4673e9656',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '17460f00cc3b4d81862b01aa342052ef',
        'dataType': 'SpriteColorPlayableAsset',
        'startColor': [1, 1, 1, 1],
      },
      {
        'id': '9af89a0248104f1a9c898a7f135137d6',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': '5d4f8a90ba38431da4a654b255555549',
            },
          },
        ],
      },
      {
        'id': 'e0494ed9678748bba786a4c8d27271a6',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': '49f9a51800e64ec4a7d07da4673e9656',
            },
          },
        ],
      },
      {
        'id': '84dcf04dfa7548828bf78d42eebdef75',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': '17460f00cc3b4d81862b01aa342052ef',
            },
          },
        ],
      },
      {
        'id': '7fcaf0b951fb4fe0b49536e2f477518d',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '9af89a0248104f1a9c898a7f135137d6',
          },
          {
            'id': 'e0494ed9678748bba786a4c8d27271a6',
          },
          {
            'id': '84dcf04dfa7548828bf78d42eebdef75',
          },
        ],
        'clips': [],
      },
      {
        'id': '2e7e6fab59e94d889eda553e32fdce1e',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'b8ffd3fbfb2c473b8c30d324178f29dd',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '6a32427cc05644adb296fed87d7eb871',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': '2e7e6fab59e94d889eda553e32fdce1e',
            },
          },
        ],
      },
      {
        'id': '38d9657ce6ef4345acd50d918fa5fac4',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': 'b8ffd3fbfb2c473b8c30d324178f29dd',
            },
          },
        ],
      },
      {
        'id': 'fb00db1ac075488c818667af881dc7bc',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '6a32427cc05644adb296fed87d7eb871',
          },
          {
            'id': '38d9657ce6ef4345acd50d918fa5fac4',
          },
        ],
        'clips': [],
      },
      {
        'id': '876d7f5a43fc4b0885f0094f5e02570c',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'd3c610dea4af4f57b4d0c7a75978af04',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '765390b1dd3848de801a9b6a658db980',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': '876d7f5a43fc4b0885f0094f5e02570c',
            },
          },
        ],
      },
      {
        'id': 'd4d5b88543b847fb9f4cbbf923f9f380',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 8,
            'endBehavior': 4,
            'asset': {
              'id': 'd3c610dea4af4f57b4d0c7a75978af04',
            },
          },
        ],
      },
      {
        'id': '03f29ac1ac8a441c8439cbf915cb0bff',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '765390b1dd3848de801a9b6a658db980',
          },
          {
            'id': 'd4d5b88543b847fb9f4cbbf923f9f380',
          },
        ],
        'clips': [],
      },
      {
        'id': '7f755fd55d6140b58c19f925d6c34518',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '8166252a3b46404e9a67e5799181c682',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'e3f92513a3cc4bd0b94e5074abae733d',
        'dataType': 'SpriteColorPlayableAsset',
        'startColor': [1, 1, 1, 1],
      },
      {
        'id': '12e729a9ce234a688c2c2b66b8263e2a',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '7f755fd55d6140b58c19f925d6c34518',
            },
          },
        ],
      },
      {
        'id': '0cf221d4e33740fbbfa968d45ba5eb70',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '8166252a3b46404e9a67e5799181c682',
            },
          },
        ],
      },
      {
        'id': '73ba2b10f5044a62a323d16ff102aaa0',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'e3f92513a3cc4bd0b94e5074abae733d',
            },
          },
        ],
      },
      {
        'id': '0eded561bed64bd4b3ec1235f15838e1',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '12e729a9ce234a688c2c2b66b8263e2a',
          },
          {
            'id': '0cf221d4e33740fbbfa968d45ba5eb70',
          },
          {
            'id': '73ba2b10f5044a62a323d16ff102aaa0',
          },
        ],
        'clips': [],
      },
      {
        'id': '845d2dbcaa0241038029fcd0992f70e5',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '6cb2716fbba640fb830a03eeaa96c522',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '7d1917f3c294496497695888b0bb556b',
        'dataType': 'SpriteColorPlayableAsset',
        'startColor': [1, 1, 1, 1],
      },
      {
        'id': '20dadf57e55f468e85451560e147aa6a',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '845d2dbcaa0241038029fcd0992f70e5',
            },
          },
        ],
      },
      {
        'id': 'eab92bdee17d42ae90a6100e077e25e1',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '6cb2716fbba640fb830a03eeaa96c522',
            },
          },
        ],
      },
      {
        'id': '502a8c240ed341a986731449283ea638',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '7d1917f3c294496497695888b0bb556b',
            },
          },
        ],
      },
      {
        'id': '4e2201ac5b8f49fbaa9e3c76216101e8',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '20dadf57e55f468e85451560e147aa6a',
          },
          {
            'id': 'eab92bdee17d42ae90a6100e077e25e1',
          },
          {
            'id': '502a8c240ed341a986731449283ea638',
          },
        ],
        'clips': [],
      },
      {
        'id': 'c9df466ab1214b09b39c8a831e727a4d',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'e56d5dd79e564759bdf8cb556f74a9d9',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '8d3edffd70a14733b6745abaade44ebd',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '49ea2d7c9c744d48bc1e2d8ca4bc9104',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'c9df466ab1214b09b39c8a831e727a4d',
            },
          },
        ],
      },
      {
        'id': '8447f336b03f44e18f67ab45fbb7d957',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'e56d5dd79e564759bdf8cb556f74a9d9',
            },
          },
        ],
      },
      {
        'id': '346dada74a4e44ae912ce2aab45e650d',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '8d3edffd70a14733b6745abaade44ebd',
            },
          },
        ],
      },
      {
        'id': '9cb2e18e98d5426d9af6e4532195e60d',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '49ea2d7c9c744d48bc1e2d8ca4bc9104',
          },
          {
            'id': '8447f336b03f44e18f67ab45fbb7d957',
          },
          {
            'id': '346dada74a4e44ae912ce2aab45e650d',
          },
        ],
        'clips': [],
      },
      {
        'id': '4c5695f23f4f4e93adc33a6d3dcb7b89',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'a2716b026f3b42c0a2de2bf4ea907fd8',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '48f7b5b4e84848f3877dac4e5ad555ac',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '4c5695f23f4f4e93adc33a6d3dcb7b89',
            },
          },
        ],
      },
      {
        'id': '3afb46bfe6584d8abf6d315d17b264f2',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'a2716b026f3b42c0a2de2bf4ea907fd8',
            },
          },
        ],
      },
      {
        'id': '873891bf25af40eb836cc8cf0ef499ef',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '48f7b5b4e84848f3877dac4e5ad555ac',
          },
          {
            'id': '3afb46bfe6584d8abf6d315d17b264f2',
          },
        ],
        'clips': [],
      },
      {
        'id': '9c28ac3c296b4736a93c3fc9e3eff12b',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'aa4b56c0b4614641bc22494b52921137',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '8e143778378849eb95f9b6b9da5ecee2',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '9c28ac3c296b4736a93c3fc9e3eff12b',
            },
          },
        ],
      },
      {
        'id': '70903cf7a46d42d1a78ed4af4ba76322',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'aa4b56c0b4614641bc22494b52921137',
            },
          },
        ],
      },
      {
        'id': '6d58e34d1f1c465dbd442e99561b3b95',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '8e143778378849eb95f9b6b9da5ecee2',
          },
          {
            'id': '70903cf7a46d42d1a78ed4af4ba76322',
          },
        ],
        'clips': [],
      },
      {
        'id': '479c4bd8c16a4f5f9a2b69f46f6f69f4',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'dcf5ed9790034fc194b24d3a0c04afd6',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '0bbbcbad8c964c8284407648cd245ff8',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '479c4bd8c16a4f5f9a2b69f46f6f69f4',
            },
          },
        ],
      },
      {
        'id': '8d5342acb4fc4536b8b7f8263b9f93c8',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'dcf5ed9790034fc194b24d3a0c04afd6',
            },
          },
        ],
      },
      {
        'id': 'e2f8d25196a849f18b532137911c1075',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '0bbbcbad8c964c8284407648cd245ff8',
          },
          {
            'id': '8d5342acb4fc4536b8b7f8263b9f93c8',
          },
        ],
        'clips': [],
      },
      {
        'id': '4019a124b25a4e83aa3c691fa5385d71',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'bffee6bce7ec4cd2b2ef35aa1f5c7442',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '733f92a0276644c6bc6bf3204fd55a1c',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '4019a124b25a4e83aa3c691fa5385d71',
            },
          },
        ],
      },
      {
        'id': 'ff0381cf58854afca6742d2a0a0c7769',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'bffee6bce7ec4cd2b2ef35aa1f5c7442',
            },
          },
        ],
      },
      {
        'id': '01c26218115e42a1bf031f75c341f5e5',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '733f92a0276644c6bc6bf3204fd55a1c',
          },
          {
            'id': 'ff0381cf58854afca6742d2a0a0c7769',
          },
        ],
        'clips': [],
      },
      {
        'id': 'f32c6a9ce0fe40659fc1fca485c925f5',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '342c27174fa64b36bcefa6688468df0c',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '0292fb79cfe54674be3f31b70719c12c',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'f32c6a9ce0fe40659fc1fca485c925f5',
            },
          },
        ],
      },
      {
        'id': 'f65ec04c07ee46198066c140e34d2087',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '342c27174fa64b36bcefa6688468df0c',
            },
          },
        ],
      },
      {
        'id': '4ba1ad6462cc470f9293f9b0a1c584be',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '0292fb79cfe54674be3f31b70719c12c',
          },
          {
            'id': 'f65ec04c07ee46198066c140e34d2087',
          },
        ],
        'clips': [],
      },
      {
        'id': '5e353dc45a284c119a6c19b9fc731389',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '3ba3e249ca89446fb91801d4e0c14b9e',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '31e6ece734d14407bc4d027c171a8cb3',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '5e353dc45a284c119a6c19b9fc731389',
            },
          },
        ],
      },
      {
        'id': '6162c4956305435fbe00ad3fec8eb9c5',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '3ba3e249ca89446fb91801d4e0c14b9e',
            },
          },
        ],
      },
      {
        'id': '381579cc8fba4a87b146f0760665b283',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '31e6ece734d14407bc4d027c171a8cb3',
          },
          {
            'id': '6162c4956305435fbe00ad3fec8eb9c5',
          },
        ],
        'clips': [],
      },
      {
        'id': 'c5f5bfc24d3844b58654a0e97295ff5c',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '710fcf9384db4d2b8663253ee1d0ebf5',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '7eabbe5279f84d7783507de100fa6407',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'c5f5bfc24d3844b58654a0e97295ff5c',
            },
          },
        ],
      },
      {
        'id': 'afb59260891b4d91894aa7880a5f1e89',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '710fcf9384db4d2b8663253ee1d0ebf5',
            },
          },
        ],
      },
      {
        'id': '26e3e81d7e934ddea50f11f99480c9e3',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '7eabbe5279f84d7783507de100fa6407',
          },
          {
            'id': 'afb59260891b4d91894aa7880a5f1e89',
          },
        ],
        'clips': [],
      },
      {
        'id': '8dca98e3879240e48b4bd95bd35ed1bc',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '9861bbe431084ce8ad9bf5bedd30dbfb',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '0074a77bcf5343f19f441c14283dcbcb',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '8dca98e3879240e48b4bd95bd35ed1bc',
            },
          },
        ],
      },
      {
        'id': '61a9e7d9bf674c939921697b35ca5deb',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '9861bbe431084ce8ad9bf5bedd30dbfb',
            },
          },
        ],
      },
      {
        'id': '87d471a0824149639b5b5b0f935237cd',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '0074a77bcf5343f19f441c14283dcbcb',
          },
          {
            'id': '61a9e7d9bf674c939921697b35ca5deb',
          },
        ],
        'clips': [],
      },
      {
        'id': '0eb90dfc4d5f4bb7a38b44bd2a3d960f',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '31bcf04d1bf64b3e91cb094e92b3497f',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'd895424e37ec494e8abc0ed2a5de6c7a',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '0eb90dfc4d5f4bb7a38b44bd2a3d960f',
            },
          },
        ],
      },
      {
        'id': '6afa506f129c4f31880ee7ff0ed3e3e0',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '31bcf04d1bf64b3e91cb094e92b3497f',
            },
          },
        ],
      },
      {
        'id': '8bbd2b6d3a894d09a9fb3bb112fec127',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': 'd895424e37ec494e8abc0ed2a5de6c7a',
          },
          {
            'id': '6afa506f129c4f31880ee7ff0ed3e3e0',
          },
        ],
        'clips': [],
      },
      {
        'id': '383e4d52809b4bd2b50a313098dab6cc',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'e78b86fe90f74522b59ca70b40ce7fb2',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '46cc900e93b44513a356498f4068cf48',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '383e4d52809b4bd2b50a313098dab6cc',
            },
          },
        ],
      },
      {
        'id': '63de627bc5864d7ab7fff516bda2ef4d',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'e78b86fe90f74522b59ca70b40ce7fb2',
            },
          },
        ],
      },
      {
        'id': '4d3a4f7c676441b18a8b033f2ad77f85',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '46cc900e93b44513a356498f4068cf48',
          },
          {
            'id': '63de627bc5864d7ab7fff516bda2ef4d',
          },
        ],
        'clips': [],
      },
      {
        'id': 'aa7ff8f0b9dc42f3bbd0663069d26b47',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '1653271c86b542ddbd1e841633609733',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '644efd36561b4eca949d12edb43d8000',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '6b4a0bd0718b4193a640dd24095b9d74',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'aa7ff8f0b9dc42f3bbd0663069d26b47',
            },
          },
        ],
      },
      {
        'id': '88e7dbf17dfc459182a0265eaa7f93d8',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '1653271c86b542ddbd1e841633609733',
            },
          },
        ],
      },
      {
        'id': '724fcc4c81644043bcfd1a310f22a6f5',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '644efd36561b4eca949d12edb43d8000',
            },
          },
        ],
      },
      {
        'id': '2ccd28e12b354d2697781d6769bf6e77',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '6b4a0bd0718b4193a640dd24095b9d74',
          },
          {
            'id': '88e7dbf17dfc459182a0265eaa7f93d8',
          },
          {
            'id': '724fcc4c81644043bcfd1a310f22a6f5',
          },
        ],
        'clips': [],
      },
      {
        'id': '66e348dd1bd24c34ada69fc24dcf4dd8',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'ed72165c41d742069fb28e8d1d9a81ae',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '445ce75d1d854f539c5a6b44a95c0f3f',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': 'c049203d6ea744dd9fe12b92d180cae8',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '66e348dd1bd24c34ada69fc24dcf4dd8',
            },
          },
        ],
      },
      {
        'id': '43af2d3735d4441db490356e16c5a631',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'ed72165c41d742069fb28e8d1d9a81ae',
            },
          },
        ],
      },
      {
        'id': '1d34c09e81d7436eb6791b9a45a14bc0',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '445ce75d1d854f539c5a6b44a95c0f3f',
            },
          },
        ],
      },
      {
        'id': 'ecae94b0f7894c479e2a97e74df6ad85',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': 'c049203d6ea744dd9fe12b92d180cae8',
          },
          {
            'id': '43af2d3735d4441db490356e16c5a631',
          },
          {
            'id': '1d34c09e81d7436eb6791b9a45a14bc0',
          },
        ],
        'clips': [],
      },
      {
        'id': '31fa947e86434eb5aa2c27ed2f0ec435',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '099dd4b41385441baaa0cf6964955b58',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'da65eb5d8d2a42b381454d6d76873411',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '79344469ef7540d4b8690c0d9eaf811d',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '31fa947e86434eb5aa2c27ed2f0ec435',
            },
          },
        ],
      },
      {
        'id': '9867f8690c004ed9a91bc21c391b50d1',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '099dd4b41385441baaa0cf6964955b58',
            },
          },
        ],
      },
      {
        'id': 'abbfd3af1ef8421881560ff274b33b66',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'da65eb5d8d2a42b381454d6d76873411',
            },
          },
        ],
      },
      {
        'id': 'c176a1557737439ab823b6390dc8f7c6',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '79344469ef7540d4b8690c0d9eaf811d',
          },
          {
            'id': '9867f8690c004ed9a91bc21c391b50d1',
          },
          {
            'id': 'abbfd3af1ef8421881560ff274b33b66',
          },
        ],
        'clips': [],
      },
      {
        'id': 'a275acc92bc544629c047127a932aa34',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '295f8da2de8a42a4bb79708bbd8880ee',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '7a2dbc9803064e8aa2f74071b45a5e90',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': 'fb9a5edd91d5493f890c5dd21c3c7b09',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'a275acc92bc544629c047127a932aa34',
            },
          },
        ],
      },
      {
        'id': 'dd25a858ac474b3890928c88666c781a',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '295f8da2de8a42a4bb79708bbd8880ee',
            },
          },
        ],
      },
      {
        'id': '274562182c114fbea645b4cc064b92c6',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '7a2dbc9803064e8aa2f74071b45a5e90',
            },
          },
        ],
      },
      {
        'id': 'c8ec2b514f394ce594960d052ae9a216',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': 'fb9a5edd91d5493f890c5dd21c3c7b09',
          },
          {
            'id': 'dd25a858ac474b3890928c88666c781a',
          },
          {
            'id': '274562182c114fbea645b4cc064b92c6',
          },
        ],
        'clips': [],
      },
      {
        'id': '33e32815f627475cbdb9cf0d8e868fbd',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '78ffeab68d1e4eab875f46882e9388c2',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'b7b3b8997b544ac7a2c50bae5cff89f5',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '28bbab9894ba4d6495bdb9510ec91cbc',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '33e32815f627475cbdb9cf0d8e868fbd',
            },
          },
        ],
      },
      {
        'id': '04c5885700c84a839c4e3842c2c2a2b9',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '78ffeab68d1e4eab875f46882e9388c2',
            },
          },
        ],
      },
      {
        'id': '0df6943330224c189be5a525d3a1ca2a',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'b7b3b8997b544ac7a2c50bae5cff89f5',
            },
          },
        ],
      },
      {
        'id': 'c04fda3499a74057bc94507ba86356f3',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '28bbab9894ba4d6495bdb9510ec91cbc',
          },
          {
            'id': '04c5885700c84a839c4e3842c2c2a2b9',
          },
          {
            'id': '0df6943330224c189be5a525d3a1ca2a',
          },
        ],
        'clips': [],
      },
      {
        'id': 'd89bb5e2606f48f498bd114389ef59a1',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '131aca00a9bc45ccb5b191da93682962',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '2ce18724939e465ea18eaedc2e7da3ab',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '7ae6c1498b4b4162b4a52aa576ad6bb7',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'd89bb5e2606f48f498bd114389ef59a1',
            },
          },
        ],
      },
      {
        'id': '27bccb7b88744b9eb1c8ec4dba932710',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '131aca00a9bc45ccb5b191da93682962',
            },
          },
        ],
      },
      {
        'id': '03c730ba513a42c68c2b2552e1cb1553',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '2ce18724939e465ea18eaedc2e7da3ab',
            },
          },
        ],
      },
      {
        'id': '0c7102cc4a8544b6942f44d6c0f90d74',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '7ae6c1498b4b4162b4a52aa576ad6bb7',
          },
          {
            'id': '27bccb7b88744b9eb1c8ec4dba932710',
          },
          {
            'id': '03c730ba513a42c68c2b2552e1cb1553',
          },
        ],
        'clips': [],
      },
      {
        'id': 'ef63e9b038fd4dbf9b36979c178d9cf1',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '0c8e1ca5e8634a4081bd4b063161fe6d',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '267f7d2a55c64936b19de7cc121e8bbc',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '51f94647119c41f3b0fa09a5d57c6303',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'ef63e9b038fd4dbf9b36979c178d9cf1',
            },
          },
        ],
      },
      {
        'id': '0875acfe6d5449588f8f11fc023fb0cf',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '0c8e1ca5e8634a4081bd4b063161fe6d',
            },
          },
        ],
      },
      {
        'id': '77426b1c7b8b4265bbd56fff7cc2ad56',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '267f7d2a55c64936b19de7cc121e8bbc',
            },
          },
        ],
      },
      {
        'id': '3513aab675484c328a8dfd92f6f6a43e',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '51f94647119c41f3b0fa09a5d57c6303',
          },
          {
            'id': '0875acfe6d5449588f8f11fc023fb0cf',
          },
          {
            'id': '77426b1c7b8b4265bbd56fff7cc2ad56',
          },
        ],
        'clips': [],
      },
      {
        'id': 'b4d43947f55f4d58918674b372f57260',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'ac1b7395361b46489aafa85492253c95',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'ac80985bdeca46b197cf138a6411f4a5',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': 'aaec4385b0e2460ea39ac87578839973',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'b4d43947f55f4d58918674b372f57260',
            },
          },
        ],
      },
      {
        'id': 'a7e04a48923d48de99c1d2c0b85458e8',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'ac1b7395361b46489aafa85492253c95',
            },
          },
        ],
      },
      {
        'id': 'd73cf1f69d8d43378ec18c1fefffabf5',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'ac80985bdeca46b197cf138a6411f4a5',
            },
          },
        ],
      },
      {
        'id': '23f8bd9db8af410699fa278f92807b47',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': 'aaec4385b0e2460ea39ac87578839973',
          },
          {
            'id': 'a7e04a48923d48de99c1d2c0b85458e8',
          },
          {
            'id': 'd73cf1f69d8d43378ec18c1fefffabf5',
          },
        ],
        'clips': [],
      },
      {
        'id': '3c75918896c04b2ab001b3afce776439',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': 'f8e1423a2f25477dab9b04ec74624579',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'f88d6ae5d547414ab84ad033d3f55651',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '0111f743ad5d499eadc8558b76d1c659',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '3c75918896c04b2ab001b3afce776439',
            },
          },
        ],
      },
      {
        'id': 'eb4bfdae13c54e9d979132aa84673bf1',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'f8e1423a2f25477dab9b04ec74624579',
            },
          },
        ],
      },
      {
        'id': '3422418c1e394db4aa41696c14caf774',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'f88d6ae5d547414ab84ad033d3f55651',
            },
          },
        ],
      },
      {
        'id': 'b7e7fd95e93048d89944908ce746f985',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '0111f743ad5d499eadc8558b76d1c659',
          },
          {
            'id': 'eb4bfdae13c54e9d979132aa84673bf1',
          },
          {
            'id': '3422418c1e394db4aa41696c14caf774',
          },
        ],
        'clips': [],
      },
      {
        'id': '51867710243a4ed0be4c2587231a7bb2',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '8cf81e1b975e46799689d8b22623d339',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '07c080bb1cdd40b8814e83ef2008d046',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '855d73f598044c3296ac2c62827b36d4',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '51867710243a4ed0be4c2587231a7bb2',
            },
          },
        ],
      },
      {
        'id': '2642169b088741b58d6969f587328ff6',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '8cf81e1b975e46799689d8b22623d339',
            },
          },
        ],
      },
      {
        'id': 'a9a16cd375ed48bb9678ea0b4e373c72',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '07c080bb1cdd40b8814e83ef2008d046',
            },
          },
        ],
      },
      {
        'id': '4a1f700bf8764914bb6e1f47370bdaea',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '855d73f598044c3296ac2c62827b36d4',
          },
          {
            'id': '2642169b088741b58d6969f587328ff6',
          },
          {
            'id': 'a9a16cd375ed48bb9678ea0b4e373c72',
          },
        ],
        'clips': [],
      },
      {
        'id': '21701be8751e4f8bbb63423926a53c84',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '7896c81d2c504a9a9a291f7412417a0c',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': 'dd9a6cf7cef749ee8d09ca55ea3d03b4',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': 'ba63a6d6543b45f5a08ac23ebfd3d63d',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '21701be8751e4f8bbb63423926a53c84',
            },
          },
        ],
      },
      {
        'id': 'ea455a1b83834bbd98b739b90894ed40',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '7896c81d2c504a9a9a291f7412417a0c',
            },
          },
        ],
      },
      {
        'id': '3cfa600319b541af84b614019e7d01de',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': 'dd9a6cf7cef749ee8d09ca55ea3d03b4',
            },
          },
        ],
      },
      {
        'id': '22d39686be0a41a4a2e3777b3f121828',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': 'ba63a6d6543b45f5a08ac23ebfd3d63d',
          },
          {
            'id': 'ea455a1b83834bbd98b739b90894ed40',
          },
          {
            'id': '3cfa600319b541af84b614019e7d01de',
          },
        ],
        'clips': [],
      },
      {
        'id': '83974f00d7a344a2b352d340efd88f3a',
        'dataType': 'ActivationPlayableAsset',
      },
      {
        'id': '0a83ed2b6e4847888844e3158c3a25e5',
        'dataType': 'TransformPlayableAsset',
        'positionOverLifetime': {

        },
      },
      {
        'id': '46b7cd22a221465083ecf9da756757b3',
        'dataType': 'SpriteColorPlayableAsset',
      },
      {
        'id': '80b3051a07bf4614a36aee51d29db966',
        'dataType': 'ActivationTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '83974f00d7a344a2b352d340efd88f3a',
            },
          },
        ],
      },
      {
        'id': '8556eb7c74554ccaa5e98ca6423d3a9b',
        'dataType': 'TransformTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '0a83ed2b6e4847888844e3158c3a25e5',
            },
          },
        ],
      },
      {
        'id': '708c2de114444c0d8d227c7e41eb4ff5',
        'dataType': 'SpriteColorTrack',
        'children': [],
        'clips': [
          {
            'start': 0,
            'duration': 20,
            'endBehavior': 0,
            'asset': {
              'id': '46b7cd22a221465083ecf9da756757b3',
            },
          },
        ],
      },
      {
        'id': '02727f545e634386b195af56b4969a83',
        'dataType': 'ObjectBindingTrack',
        'children': [
          {
            'id': '80b3051a07bf4614a36aee51d29db966',
          },
          {
            'id': '8556eb7c74554ccaa5e98ca6423d3a9b',
          },
          {
            'id': '708c2de114444c0d8d227c7e41eb4ff5',
          },
        ],
        'clips': [],
      },
    ],
    'compositionId': '493064b543fc4a35907ea7721a6f4700',
  };

  return json;
}
