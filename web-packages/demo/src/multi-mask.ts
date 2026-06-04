import type { Composition } from '@galacean/effects';
import { Player, SpriteComponent, ShapeComponent } from '@galacean/effects';

const container = document.getElementById('J-container');

const json = `{
  "playerVersion": {
    "web": "2.8.11",
    "native": "0.0.1.202311221223"
  },
  "images": [
    {
      "url": "https://mdn.alipayobjects.com/mars/afts/file/A*ku2GTJV7L3gAAAAARgAAAAgAelB4AQ/original",
      "id": "ed01efe5c98441d5a22deb34eff6869b",
      "renderLevel": "B+",
      "webp": "https://mdn.alipayobjects.com/mars/afts/file/A*E7lJT7ojGesAAAAARpAAAAgAelB4AQ/original"
    }
  ],
  "fonts": [],
  "version": "3.6",
  "plugins": [],
  "type": "ge",
  "compositions": [
    {
      "id": "31ec925ec0414adea5bd2d30b66b881b",
      "name": "新建合成1",
      "duration": 5,
      "startTime": 0,
      "endBehavior": 4,
      "previewSize": [
        750,
        1624
      ],
      "camera": {
        "fov": 60,
        "far": 40,
        "near": 0.1,
        "clipMode": 1,
        "position": [
          0,
          0,
          8
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "components": [
        {
          "id": "3ccdf734937843b98af0c918a8c393ae"
        }
      ]
    }
  ],
  "components": [
    {
      "id": "3ccdf734937843b98af0c918a8c393ae",
      "item": {
        "id": "31ec925ec0414adea5bd2d30b66b881b"
      },
      "dataType": "CompositionComponent",
      "items": [
        {
          "id": "43fe4b6a6fd7428898d471c58538232c"
        },
        {
          "id": "e88a85b56204488d8ed5802076ca4eb9"
        },
        {
          "id": "ccc03eabfa5c417a95cbf3e713925322"
        }
      ],
      "timelineAsset": {
        "id": "806e24e78d7647309aadda35bb3765b2"
      },
      "sceneBindings": [
        {
          "key": {
            "id": "830d5930c44d4efab62267e8916b2343"
          },
          "value": {
            "id": "43fe4b6a6fd7428898d471c58538232c"
          }
        },
        {
          "key": {
            "id": "62f4fedb1e644f0daaa05c4b0c252149"
          },
          "value": {
            "id": "e88a85b56204488d8ed5802076ca4eb9"
          }
        },
        {
          "key": {
            "id": "cc7c0a7b5a4a41528db192c955bd6034"
          },
          "value": {
            "id": "ccc03eabfa5c417a95cbf3e713925322"
          }
        }
      ]
    },
    {
      "id": "64b76dba8928479ba09e586397ed0171",
      "item": {
        "id": "43fe4b6a6fd7428898d471c58538232c"
      },
      "type": 2,
      "dataType": "ShapeComponent",
      "xRadius": 5.3571,
      "yRadius": 3.7384,
      "fills": [
        {
          "type": 0,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          }
        }
      ],
      "strokes": [],
      "strokeWidth": 0,
      "strokeCap": 0,
      "strokeJoin": 0,
      "renderer": {
        "renderMode": 1
      },
      "mask": {
        "isMask": true,
        "alphaMaskEnabled": false
      }
    },
    {
      "id": "b8d9e6dbd27f4e049a32ae78825d438c",
      "item": {
        "id": "e88a85b56204488d8ed5802076ca4eb9"
      },
      "type": 1,
      "dataType": "ShapeComponent",
      "width": 20.8118,
      "height": 11.3309,
      "roundness": 0,
      "fills": [
        {
          "type": 0,
          "color": {
            "r": 0.03137,
            "g": 0.01569,
            "b": 0.3412,
            "a": 1
          }
        }
      ],
      "strokes": [],
      "strokeWidth": 0,
      "strokeCap": 0,
      "strokeJoin": 0,
      "renderer": {
        "renderMode": 1
      },
      "mask": {
        "isMask": true,
        "alphaMaskEnabled": false
      }
    },
    {
      "id": "d0e9461a95a24ff4a3e2c3100814f5c4",
      "item": {
        "id": "ccc03eabfa5c417a95cbf3e713925322"
      },
      "dataType": "SpriteComponent",
      "options": {
        "startColor": [
          1,
          1,
          1,
          1
        ]
      },
      "renderer": {
        "renderMode": 1,
        "texture": {
          "id": "7113dc2ed8b54cebafeae57f7c4faa98"
        }
      },
      "mask": {
        "isMask": false,
        "references": [
          {
            "mask": {
              "id": "b8d9e6dbd27f4e049a32ae78825d438c"
            },
            "inverted": false
          },
          {
            "mask": {
              "id": "64b76dba8928479ba09e586397ed0171"
            },
            "inverted": false
          }
        ]
      },
      "splits": [
        [
          0,
          0,
          0.513671875,
          0.513671875,
          0
        ]
      ]
    }
  ],
  "geometries": [],
  "materials": [],
  "items": [
    {
      "id": "43fe4b6a6fd7428898d471c58538232c",
      "name": "ellipse_3",
      "duration": 5,
      "type": "shape",
      "visible": true,
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "64b76dba8928479ba09e586397ed0171"
        }
      ],
      "transform": {
        "position": {
          "x": 0,
          "y": 1.7536,
          "z": 0
        },
        "eulerHint": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "anchor": {
          "x": 0,
          "y": 0
        },
        "scale": {
          "x": 1,
          "y": 1,
          "z": 1
        }
      },
      "dataType": "VFXItemData"
    },
    {
      "id": "e88a85b56204488d8ed5802076ca4eb9",
      "name": "rectangle_5",
      "duration": 5,
      "type": "shape",
      "visible": true,
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "b8d9e6dbd27f4e049a32ae78825d438c"
        }
      ],
      "transform": {
        "position": {
          "x": 0,
          "y": -2.7349,
          "z": 0
        },
        "eulerHint": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "anchor": {
          "x": 0,
          "y": 0
        },
        "scale": {
          "x": 0.4704,
          "y": 0.6871,
          "z": 1
        }
      },
      "dataType": "VFXItemData"
    },
    {
      "id": "ccc03eabfa5c417a95cbf3e713925322",
      "name": "经典五福",
      "duration": 5,
      "type": "1",
      "visible": true,
      "endBehavior": 0,
      "delay": 0,
      "renderLevel": "B+",
      "components": [
        {
          "id": "d0e9461a95a24ff4a3e2c3100814f5c4"
        }
      ],
      "transform": {
        "position": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "eulerHint": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "anchor": {
          "x": 0,
          "y": 0
        },
        "size": {
          "x": 6.4719,
          "y": 6.549
        },
        "scale": {
          "x": 1,
          "y": 1,
          "z": 1
        }
      },
      "dataType": "VFXItemData"
    }
  ],
  "shaders": [],
  "bins": [],
  "textures": [
    {
      "id": "7113dc2ed8b54cebafeae57f7c4faa98",
      "source": {
        "id": "ed01efe5c98441d5a22deb34eff6869b"
      },
      "flipY": true
    }
  ],
  "animations": [],
  "miscs": [
    {
      "id": "806e24e78d7647309aadda35bb3765b2",
      "dataType": "TimelineAsset",
      "tracks": [
        {
          "id": "830d5930c44d4efab62267e8916b2343"
        },
        {
          "id": "62f4fedb1e644f0daaa05c4b0c252149"
        },
        {
          "id": "cc7c0a7b5a4a41528db192c955bd6034"
        }
      ]
    },
    {
      "id": "0d9fb8e965784061a4198d912396d039",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "236999972a50472f960460eaa7f2db96",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {}
    },
    {
      "id": "e97b723aaeaa4e6ea031dd38452ee11b",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "0d9fb8e965784061a4198d912396d039"
          }
        }
      ]
    },
    {
      "id": "fb74db9d4c47418d81c70a9e59d6a108",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "236999972a50472f960460eaa7f2db96"
          }
        }
      ]
    },
    {
      "id": "830d5930c44d4efab62267e8916b2343",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "e97b723aaeaa4e6ea031dd38452ee11b"
        },
        {
          "id": "fb74db9d4c47418d81c70a9e59d6a108"
        }
      ],
      "clips": []
    },
    {
      "id": "661bfcd2b221482fa20f5bc466163e8b",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "a204989b0dde405982ac0cd128dc8d1a",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {}
    },
    {
      "id": "c7db73aef86c40c5ab2a5de31552d52e",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "661bfcd2b221482fa20f5bc466163e8b"
          }
        }
      ]
    },
    {
      "id": "94e40fce31a04cb7ad69d92a9bd70b4c",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "a204989b0dde405982ac0cd128dc8d1a"
          }
        }
      ]
    },
    {
      "id": "62f4fedb1e644f0daaa05c4b0c252149",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "c7db73aef86c40c5ab2a5de31552d52e"
        },
        {
          "id": "94e40fce31a04cb7ad69d92a9bd70b4c"
        }
      ],
      "clips": []
    },
    {
      "id": "bf3d80d697bc49b8b15ef4f9a596f2b1",
      "dataType": "ActivationPlayableAsset"
    },
    {
      "id": "d92ac9de77ed4fedba748db246a91a31",
      "dataType": "TransformPlayableAsset",
      "positionOverLifetime": {}
    },
    {
      "id": "330359cb95e844efbb0d456d9d6be795",
      "dataType": "SpriteColorPlayableAsset",
      "startColor": [
        1,
        1,
        1,
        1
      ]
    },
    {
      "id": "1412032de4bf47f185e10d0fcd94c4ec",
      "dataType": "ActivationTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "bf3d80d697bc49b8b15ef4f9a596f2b1"
          }
        }
      ]
    },
    {
      "id": "c317bdd348a14fcc9761573f1c21dbc7",
      "dataType": "TransformTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "d92ac9de77ed4fedba748db246a91a31"
          }
        }
      ]
    },
    {
      "id": "8ef3c047a7fd4acd88dc0c01a7665fed",
      "dataType": "SpriteColorTrack",
      "children": [],
      "clips": [
        {
          "start": 0,
          "duration": 5,
          "endBehavior": 0,
          "asset": {
            "id": "330359cb95e844efbb0d456d9d6be795"
          }
        }
      ]
    },
    {
      "id": "cc7c0a7b5a4a41528db192c955bd6034",
      "dataType": "ObjectBindingTrack",
      "children": [
        {
          "id": "1412032de4bf47f185e10d0fcd94c4ec"
        },
        {
          "id": "c317bdd348a14fcc9761573f1c21dbc7"
        },
        {
          "id": "8ef3c047a7fd4acd88dc0c01a7665fed"
        }
      ],
      "clips": []
    }
  ],
  "compositionId": "31ec925ec0414adea5bd2d30b66b881b"
}
`;

let currentPlayer: Player | null = null;

const legacyJsonUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*JtRGQoWcN8UAAAAAQGAAAAgAelB4AQ';
const rectangleMaskId = 'b8d9e6dbd27f4e049a32ae78825d438c';
const ellipseMaskId = '64b76dba8928479ba09e586397ed0171';
const wufuComponentId = 'd0e9461a95a24ff4a3e2c3100814f5c4';
const buttonStyle = 'background:#4a90d9;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
const activeButtonStyle = 'background:#f5a623;color:#111;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';

type MaskRefOptions = {
  id: string,
  inverted?: boolean,
};

type MaskDemoComponents = {
  rectangle: ShapeComponent,
  ellipse: ShapeComponent,
  wufu: SpriteComponent,
};

function resetPlayer () {
  if (currentPlayer) {
    currentPlayer.dispose();
  }

  currentPlayer = new Player({
    container,
    interactive: true,
    transparentBackground: true,
    onError: (err, ...args) => {
      console.error(err.message);
    },
  });
}

function cloneSceneJSON (): any {
  return JSON.parse(json);
}

function getWufuComponentData (sceneData: any): any {
  return sceneData.components.find((component: any) => component.id === wufuComponentId);
}

function createMaskReference (options: MaskRefOptions): any {
  return {
    mask: {
      id: options.id,
    },
    inverted: !!options.inverted,
  };
}

function createSceneWithReferences (references: MaskRefOptions[]): any {
  const sceneData = cloneSceneJSON();
  const wufuComponent = getWufuComponentData(sceneData);

  wufuComponent.mask = {
    isMask: false,
    references: references.map(createMaskReference),
  };

  return sceneData;
}

function createSceneWithLegacyReference (id: string, inverted = false): any {
  const sceneData = cloneSceneJSON();
  const wufuComponent = getWufuComponentData(sceneData);

  wufuComponent.mask = {
    isMask: false,
    reference: {
      id,
    },
    inverted,
  };

  return sceneData;
}

async function loadSceneData (sceneData: any): Promise<Composition> {
  resetPlayer();

  const composition = await currentPlayer?.loadScene(sceneData);

  if (!composition) {
    throw new Error('Load scene failed.');
  }

  return composition;
}

function getMaskDemoComponents (composition: Composition): MaskDemoComponents {
  const rectangleItem = composition.getItemByName('rectangle_5');
  const ellipseItem = composition.getItemByName('ellipse_3');
  const wufuItem = composition.getItemByName('经典五福');

  if (!rectangleItem || !ellipseItem || !wufuItem) {
    throw new Error('Missing demo items.');
  }

  const rectangle = rectangleItem.getComponent(ShapeComponent);
  const ellipse = ellipseItem.getComponent(ShapeComponent);
  const wufu = wufuItem.getComponent(SpriteComponent);

  if (!rectangle || !ellipse || !wufu) {
    throw new Error('Missing demo components.');
  }

  rectangle.maskManager.isMask = true;
  ellipse.maskManager.isMask = true;

  return {
    rectangle,
    ellipse,
    wufu,
  };
}

async function loadWithDynamicMask (configure: (components: MaskDemoComponents) => void): Promise<void> {
  const composition = await loadSceneData(cloneSceneJSON());
  const components = getMaskDemoComponents(composition);

  components.wufu.maskManager.clearMaskReferences();
  configure(components);
}

async function loadWithOldJson (): Promise<void> {
  resetPlayer();
  await currentPlayer?.loadScene(legacyJsonUrl);
}

async function runMaskCase (run: () => Promise<unknown>, expectedText: string, button: HTMLButtonElement): Promise<void> {
  expectedEl.textContent = expectedText;
  statusEl.textContent = '加载中...';
  setActiveButton(button);

  try {
    await run();
    statusEl.textContent = '已加载';
  } catch (error) {
    statusEl.textContent = '加载失败，请查看控制台';
    console.error('multi-mask demo failed:', error);
  }
}

const controlPanel = document.createElement('div');

controlPanel.style.cssText = 'position:fixed;top:10px;left:10px;max-width:350px;display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,0.7);color:#fff;padding:8px 12px;border-radius:4px;font-size:14px;z-index:9999;';

const modeRow = document.createElement('div');

modeRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

const legacyRow = document.createElement('div');

legacyRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;line-height:1.5;';

const expectedEl = document.createElement('span');
const statusEl = document.createElement('span');

expectedEl.textContent = '';
statusEl.textContent = '';

legacyRow.appendChild(expectedEl);
legacyRow.appendChild(statusEl);

controlPanel.appendChild(modeRow);
controlPanel.appendChild(legacyRow);

document.body.appendChild(controlPanel);

const buttons: HTMLButtonElement[] = [];

function setActiveButton (activeButton: HTMLButtonElement): void {
  for (const button of buttons) {
    button.style.cssText = button === activeButton ? activeButtonStyle : buttonStyle;
  }
}

const maskCases = [
  {
    label: '旧 JSON 兼容',
    expected: '预期：图片只显示旧数据里的矩形遮罩区域',
    run: loadWithOldJson,
  },
  {
    label: 'JSON 单矩形',
    expected: '预期：图片只显示矩形区域',
    run: () => loadSceneData(createSceneWithReferences([{ id: rectangleMaskId }])),
  },
  {
    label: 'JSON 交集',
    expected: '预期：图片只显示矩形和椭圆的交集区域',
    run: () => loadSceneData(createSceneWithReferences([{ id: rectangleMaskId }, { id: ellipseMaskId }])),
  },
  {
    label: 'JSON 反向',
    expected: '预期：图片显示矩形区域，但挖掉椭圆区域',
    run: () => loadSceneData(createSceneWithReferences([{ id: rectangleMaskId }, { id: ellipseMaskId, inverted: true }])),
  },
  {
    label: 'JSON 仅反向',
    expected: '预期：图片显示在椭圆外侧，椭圆区域被排除',
    run: () => loadSceneData(createSceneWithReferences([{ id: ellipseMaskId, inverted: true }])),
  },
  {
    label: 'JSON 空引用',
    expected: '预期：references 为空数组等价于无蒙版，图片完整显示',
    run: () => loadSceneData(createSceneWithReferences([])),
  },
  {
    label: 'JSON 引用缺失',
    expected: '预期：引用不存在的 id 被跳过并打印警告，图片只显示矩形区域',
    run: () => loadSceneData(createSceneWithReferences([
      { id: rectangleMaskId },
      { id: 'non-existent-mask-id' },
    ])),
  },
  {
    label: '旧 reference',
    expected: '预期：使用旧 mask.reference 字段，图片只显示矩形区域',
    run: () => loadSceneData(createSceneWithLegacyReference(rectangleMaskId)),
  },
  {
    label: '动态交集',
    expected: '预期：通过 addMaskReference 动态添加，图片只显示矩形和椭圆交集',
    run: () => loadWithDynamicMask(({ rectangle, ellipse, wufu }) => {
      wufu.maskManager.addMaskReference(rectangle);
      wufu.maskManager.addMaskReference(ellipse);
    }),
  },
  {
    label: '动态移除',
    expected: '预期：先添加两个蒙版再移除椭圆，图片只显示矩形区域',
    run: () => loadWithDynamicMask(({ rectangle, ellipse, wufu }) => {
      wufu.maskManager.addMaskReference(rectangle);
      wufu.maskManager.addMaskReference(ellipse);
      wufu.maskManager.removeMaskReference(ellipse);
    }),
  },
  {
    label: '动态清空',
    expected: '预期：添加后 clearMaskReferences，图片完整显示',
    run: () => loadWithDynamicMask(({ rectangle, ellipse, wufu }) => {
      wufu.maskManager.addMaskReference(rectangle);
      wufu.maskManager.addMaskReference(ellipse);
      wufu.maskManager.clearMaskReferences();
    }),
  },
  {
    label: '动态反向',
    expected: '预期：先移除再反向添加椭圆，图片显示矩形区域但挖掉椭圆',
    run: () => loadWithDynamicMask(({ rectangle, ellipse, wufu }) => {
      wufu.maskManager.addMaskReference(rectangle);
      wufu.maskManager.addMaskReference(ellipse);
      wufu.maskManager.removeMaskReference(ellipse);
      wufu.maskManager.addMaskReference(ellipse, true);
    }),
  },
  {
    label: '重复 add',
    expected: '预期：重复添加同一矩形不会更新 inverted，图片仍只显示矩形区域',
    run: () => loadWithDynamicMask(({ rectangle, wufu }) => {
      wufu.maskManager.addMaskReference(rectangle);
      wufu.maskManager.addMaskReference(rectangle, true);
    }),
  },
  {
    label: 'JSON 去重',
    expected: '预期：references 内重复引用同一矩形会被去重，图片只显示矩形区域',
    run: () => loadSceneData(createSceneWithReferences([
      { id: rectangleMaskId },
      { id: rectangleMaskId },
    ])),
  },
];

for (const maskCase of maskCases) {
  const button = document.createElement('button');

  button.textContent = maskCase.label;
  button.style.cssText = buttonStyle;
  button.onclick = () => runMaskCase(maskCase.run, maskCase.expected, button);
  buttons.push(button);
  modeRow.appendChild(button);
}

(async () => {
  buttons[0].click();
})();
