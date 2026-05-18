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

async function loadWithDynamicMask () {
  resetPlayer();
  try {
    const jsonUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*JtRGQoWcN8UAAAAAQGAAAAgAelB4AQ';
    const composition = await currentPlayer?.loadScene(jsonUrl);

    const rectangle5 = composition?.getItemByName('rectangle_5');
    const ellipse3 = composition?.getItemByName('ellipse_3');
    const wufu = composition?.getItemByName('经典五福');

    if (!rectangle5 || !ellipse3 || !wufu) {
      console.error('❌ 未找到必要的元素');

      return;
    }

    const rectangle5Comp = rectangle5.getComponent(ShapeComponent);
    const ellipse3Comp = ellipse3.getComponent(ShapeComponent);
    const wufuComp = wufu.getComponent(SpriteComponent);

    if (!rectangle5Comp || !ellipse3Comp || !wufuComp) {
      console.error('❌ 未找到组件');

      return;
    }

    rectangle5Comp.maskManager.isMask = true;
    ellipse3Comp.maskManager.isMask = true;

    wufuComp.maskManager.clearMaskReferences();
    wufuComp.maskManager.addMaskReference(rectangle5Comp, false);
    wufuComp.maskManager.addMaskReference(ellipse3Comp, false);
  } catch (error) {
    console.error('❌ 方式一加载失败:', error);
  }
}

async function loadWithJsonMask () {
  resetPlayer();
  try {
    const composition = await currentPlayer?.loadScene(JSON.parse(json));

    const rectangle5 = composition?.getItemByName('rectangle_5');
    const ellipse3 = composition?.getItemByName('ellipse_3');
    const wufu = composition?.getItemByName('经典五福');

    if (!rectangle5 || !ellipse3 || !wufu) {
      console.error('❌ 未找到必要的元素');

      return;
    }

  } catch (error) {
    console.error('❌ 方式二加载失败:', error);
  }
}

async function loadWithOldJson () {
  resetPlayer();
  try {
    const jsonUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*JtRGQoWcN8UAAAAAQGAAAAgAelB4AQ';

    await currentPlayer?.loadScene(jsonUrl);

  } catch (error) {
    console.error('❌ 方法三加载失败:', error);
  }
}

const controlPanel = document.createElement('div');

controlPanel.style.cssText = 'position:fixed;top:10px;left:10px;display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,0.7);color:#fff;padding:8px 12px;border-radius:4px;font-size:14px;z-index:9999;';

const modeRow = document.createElement('div');

modeRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

const button1 = document.createElement('button');

button1.textContent = '动态设置';
button1.style.cssText = 'background:#4a90d9;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';

const button2 = document.createElement('button');

button2.textContent = 'JSON 多蒙版';
button2.style.cssText = 'background:#4a90d9;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';

const button3 = document.createElement('button');

button3.textContent = '旧 JSON 兼容';
button3.style.cssText = 'background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';

modeRow.appendChild(button3);
modeRow.appendChild(button1);
modeRow.appendChild(button2);

const legacyRow = document.createElement('div');

legacyRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

const expectedEl = document.createElement('span');

expectedEl.textContent = '预期：图片只显示矩形区域内';

legacyRow.appendChild(expectedEl);

controlPanel.appendChild(modeRow);
controlPanel.appendChild(legacyRow);

document.body.appendChild(controlPanel);
button1.onclick = async () => {
  expectedEl.textContent = '预期：图片只在矩形和椭圆的交集区域显示';
  await loadWithDynamicMask();
};

button2.onclick = async () => {
  expectedEl.textContent = '预期：图片只在矩形和椭圆的交集区域显示';
  await loadWithJsonMask();
};

button3.onclick = async () => {
  expectedEl.textContent = '预期：图片只显示矩形区域内';
  await loadWithOldJson();
};

(async () => {
  await loadWithOldJson();
})();
