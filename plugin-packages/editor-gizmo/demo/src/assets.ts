import { glContext } from '@galacean/effects';
import { GizmoSubType } from '@galacean/effects-plugin-editor-gizmo';

export const simpleJSON = `
{
  "compositionId": 1,
  "requires": [],
  "compositions": [{
    "name": "composition_1",
    "id": 1,
    "duration": 10,
    "camera": {
      "fov": 30,
      "far": 400,
      "near": 0.1,
      "position": [0, 0, 20],
      "rotation": [0, 0, 0],
      "clipMode": 1
    },
    "items": [
      {
        "name": "null_2",
        "delay": 0,
        "id": "333",
        "type": "3",
        "cal": {
          "options": {
            "duration": 2.22,
            "startSize": 1,
            "sizeAspect": 1,
            "renderLevel": "B+",
            "looping": true
          },
          "transform": {
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
            "scale": [1, 1, 1],
            "path": ["bezier", [[[0, 0, 1.1648, 1.1648], [0.9916, 0.9872, 1.1648, 1]], [[0, 0, 0], [6.1939, 0, 0]], [[0.3, 0, 0], [5.8939, 0, 0]]]]
          }
        }
      },
      {
        "name": "item_2",
        "delay": 0,
        "id": 2,
        "ro": 0.1,
        "duration": 10,
        "parentId": "333",
        "particle": {
          "options": {
            "particleFollowParent": true,
            "startLifetime": 1.2,
            "startSize": 0.2,
            "sizeAspect": 1,
            "startSpeed": 1,
            "startColor": ["color", [255, 255, 255]],
            "duration": 4,
            "maxCount": 10,
            "gravityModifier": 1,
            "renderLevel": "B+",
            "looping": true
          },
          "emission": { "rateOverTime": 5 },
          "shape": {
            "shape": "Sphere",
            "radius": 1,
            "arc": 360,
            "arcMode": 0
          },
          "transform": { "path": ["bezier", [[[0, 0, 1, 1], [0.62, 0.62, 1, 1], [0.985, 0.985, 1, 1], [1, 0.985, 1, 1]], [[-1.4525577106045429, -0.6290673602203151, -0.00001390949987012391], [1.0554219396040432, 2.815665168334726, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391]], [[-0.45255580147090807, -0.6290673602203151, -0.00001390949987012391], [0.05542003047040628, 2.815665168334726, -0.00001390949987012391], [1.8054226555290849, 2.815665168334726, -0.00001390949987012391], [0.9979230140888753, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391]]]] }
        }
      },
      {
        "name": "gizmo",
        "delay": 0,
        "id": 3,
        "duration": 10,
        "content": {
          "options": {
            "type": "editor-gizmo",
            "subType": ${GizmoSubType.particleEmitter},
            "target": 2,
            "color": [255, 255, 0]
          }
        }
      },
      {
        "name": "sprite",
        "delay": 0,
        "id": 4,
        "ro": 0.1,
        "sprite": {
          "options": {
            "startLifetime": 2,
            "startSize": 1.2,
            "sizeAspect": 1,
            "startColor": ["color", [255, 255, 255]],
            "duration": 2,
            "gravityModifier": 1,
            "renderLevel": "B+",
            "looping": true
          },
          "renderer": { "renderMode": 1 },
          "transform": { "path": ["bezier", [[[0, 0.1495, 1, 1], [0.1495, 0.1495, 1, 1], [0.66, 0.66, 1, 1], [1, 0.66, 1, 1]], [[0, 0, 0], [0, 0, 0], [3, 0, 0], [3, 0, 0]], [[0, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [3, 0, 0]]]] }
        }
      },
      {
        "name": "gizmo",
        "delay": 0,
        "id": 5,
        "duration": 10,
        "content": {
          "options": {
            "type": "editor-gizmo",
            "subType": ${GizmoSubType.particleEmitter},
            "target": 4,
            "color": [255, 255, 0]
          }
        }
      },
      {
        "name": "gizmo",
        "delay": 0,
        "id": "filter-gizmo",
        "duration": 10,
        "content": {
          "options": {
            "type": "editor-gizmo",
            "subType": ${GizmoSubType.particleEmitter},
            "target": "filter",
            "color": [255, 255, 0]
          }
        }
      }
    ],
    "meta": { "previewSize": [750, 1624] }
  }],
  "gltf": [],
  "images": [],
  "version": "0.8.9-beta.9",
  "shapes": [],
  "plugins": ["editor-gizmo"],
  "type": "mars",
  "_imgs": { "1": [] }
}
`;

export const primaryJSON = `
{
  "compositionId": 1,
  "requires": [],
  "compositions": [{
    "name": "composition_1",
    "id": 1,
    "duration": 10,
    "camera": {
      "fov": 30,
      "far": 400,
      "near": 0.1,
      "position": [0, 0, 20],
      "rotation": [0, 0, 0],
      "clipMode": 1
    },
    "items": [],
    "meta": { "previewSize": [750, 1624] }
  }],
  "gltf": [],
  "images": [],
  "version": "0.8.9-beta.9",
  "shapes": [],
  "plugins": ["editor-gizmo"],
  "type": "mars",
  "_imgs": { "1": [] }
}
`;

export const transformGizmoScene = `
{
  "compositionId": 1,
  "requires": [],
  "compositions": [{
    "name": "composition_1",
    "id": 1,
    "duration": 10,
    "camera": {
      "fov": 30,
      "far": 400,
      "near": 0.1,
      "position": [0, 0, 20],
      "rotation": [0, 0, 0],
      "clipMode": 1
    },
    "items": [],
    "meta": { "previewSize": [750, 1624] }
  }],
  "gltf": [],
  "images": [
    {
    "url": "https://mdn.alipayobjects.com/mars/afts/img/A*rex7QbsF9McAAAAAAAAAAAAADlB4AQ/original",
    "webp": "https://mdn.alipayobjects.com/mars/afts/img/A*qWRBSrtbH1IAAAAAAAAAAAAADlB4AQ/original",
    "renderLevel": "B+"
    }
    ],
  "textures": [
    {
    "source": 0,
    "flipY": true
    }
    ],
  "version": "2.1",
  "shapes": [],
  "plugins": ["editor-gizmo"],
  "type": "mars",
  "_imgs": { "1": [] }
}
`;

export const basicJSON = `
[
  {
    "name": "gizmo",
    "delay": 0,
    "id": 4,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.box},
        "size": { "width": 0.8, "height": 0.8, "depth": 0.8 },
        "target": 4,
        "color": [255, 0, 0]
      },
      "transform": {
        "position": [
          -2,
          1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 41,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.box},
        "size": { "width": 0.8, "height": 0.8, "depth": 0.8 },
        "renderMode": ${glContext.LINES},
        "target": 41,
        "color": [0, 255, 0]
      },
      "transform": {
        "position": [
          -2,
          1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 5,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.sphere},
        "size": { "radius": 0.5 },
        "target": 5,
        "color": [255, 0, 0]
      },
      "transform": {
        "position": [
          -1,
          1,
          0
        ],
        "rotation": [
          0, 90, 0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 51,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.sphere},
        "renderMode": ${glContext.LINES},
        "size": { "radius": 0.5 },
        "target": 51,
        "color": [0, 255, 0]
      },
      "transform": {
        "position": [
          -1,
          1,
          0
        ],
        "rotation": [
          0, 90, 0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 6,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.cylinder},
        "size": { "radius": 0.4, "height": 1 },
        "target": 6,
        "color": [255, 0, 0]
      },
      "transform": {
        "position": [
          -3,
          1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 61,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.cylinder},
        "renderMode": ${glContext.LINES},
        "size": { "radius": 0.4, "height": 1 },
        "target": 61,
        "color": [0, 255, 0]
      },
      "transform": {
        "position": [
          -3,
          1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 7,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.cone},
        "size": { "radius": 0.5, "height": 1 },
        "target": 7,
        "color": [255, 0, 0]
      },
      "transform": {
        "position": [
          -1,
          -1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 71,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.cone},
        "renderMode": ${glContext.LINES},
        "size": { "radius": 0.4, "height": 1 },
        "target": 71,
        "color": [0, 255, 0]
      },
      "transform": {
        "position": [
          -1,
          -1,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 8,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.torus},
        "size": { "radius": 0.4, "tube": 0.2 },
        "target": 8,
        "color": [255, 255, 0]
      },
      "transform": {
        "position": [
          -3,
          -1,
          0
        ],
        "rotation": [
          0, 0, 0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 81,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.torus},
        "renderMode": ${glContext.LINES},
        "size": { "radius": 0.4, "tube": 0.2 },
        "target": 81,
        "color": [255, 0, 0]
      },
      "transform": {
        "position": [
          -3,
          -1,
          0
        ],
        "rotation": [
          0, 0, 0
        ]
      }
    }
  }
]
`;

export const gizmoJSON = `
[
  {
    "name": "gizmo",
    "delay": 0,
    "id": 19,
    "duration": 10,
    "pluginName":"editor-gizmo",
    "content": {
      "options": {
        "type": "editor-gizmo",
        "size": {
          "scale": 1.5
        },
        "subType": ${GizmoSubType.scale},
        "target": 19
      },
      "transform": {
        "position": [
          1,
          -2,
          0
        ],
        "rotation": [
          0, 140, 0
        ]
      }
    }
  }, {
    "name": "gizmo1",
    "delay": 0,
    "id": 9,
    "duration": 10,
    "pluginName":"editor-gizmo",
    "content": {
      "options": {
        "type": "editor-gizmo",
        "size": {
          "scale": 1.5
        },
        "subType": ${GizmoSubType.translation},
        "target": 9
      },
      "transform": {
        "position": [
          4,
          -2,
          0
        ],
        "rotation": [
          0, 140, 0
        ]
      }
    }
  }, {
    "name": "gizmo2",
    "delay": 0,
    "id": 10,
    "duration": 10,
    "pluginName":"editor-gizmo",
    "content": {
      "options": {
        "type": "editor-gizmo",
        "size": {
          "scale": 2,
          "padding": 1.2
        },
        "subType": ${GizmoSubType.viewHelper},
        "target": 10
      },
      "transform": {
        "rotation": [
          0, 40, 0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 11,
    "duration": 10,
    "pluginName":"editor-gizmo",
    "content": {
      "options": {
        "type": "editor-gizmo",
        "size": {
          "scale": 0.5
        },
        "subType": ${GizmoSubType.rotation},
        "target": 11
      },
      "transform": {
        "position": [
          0,
          0,
          0
        ]
      }
    }
  },{
    "id": "2",
    "name": "sprite_2",
    "duration": 10,
    "type": "1",
    "visible": true,
    "endBehavior": 0,
    "delay": 0,
    "renderLevel": "B+",
    "content": {
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
    "texture": 0
    },
    "positionOverLifetime": {
    "direction": [
    0,
    0,
    0
    ],
    "startSpeed": 0,
    "gravity": [
    0,
    0,
    0
    ],
    "gravityOverLifetime": [
    0,
    1
    ]
    },
    "splits": [
    [
    0,
    0,
    0.6337890625,
    0.625,
    0
    ]
    ]
    },
    "transform": {
    "position": [
    0,
    -2.5,
    0
    ],
    "rotation": [
    90,
    0,
    0
    ],
    "scale": [
    12.460965002731042,
    12.288162714557577,
    1
    ]
    }
    }
]
`;

export const sceneJSON = `
[
  {
    "name": "gizmo",
    "delay": 0,
    "id": 12,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.frustum},
        "color": [255, 255, 255],
        "size": {
          "aspect": 2, "fov": 60, "far": 1.5, "near": 0.1, "position": [0, 0, 0], "rotation": [0, 180, 0]
        },
        "target": 12
      },
      "transform": {
        "position": [
          2,
          0,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 13,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.camera},
        "size": {
          "width": 0.5, "height": 0.5
        },
        "target": 13
      },
      "transform": {
        "position": [
          2,
          0,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 14,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.light},
        "size": {
          "width": 0.5, "height": 0.5
        },
        "target": 14
      },
      "transform": {
        "position": [
          2,
          2,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 15,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.pointLight},
        "size": {
          "range": 1
        },
        "target": 15
      },
      "transform": {
        "position": [-1, 0, 0],
        "rotation": [
          90,
          0,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 16,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.spotLight},
        "size": {
          "range": 2, "spotAngle": 30, "segments": 64, "thetaStart": 0
        },
        "target": 16
      },
      "transform": {
        "position": [1, -1, 0],
        "rotation": [
          -50,
          0,
          0
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 17,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.directionLight},
        "size": {
          "range": 1, "segments": 64, "thetaStart": 0
        },
        "target": 17
      },
      "transform": {
        "position": [-4, 0, 0],
        "rotation": [
          20,
          60,
          20
        ]
      }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 20,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.floorGrid},
        "depthTest": true,
        "size": {
          "sideLength": 5,
          "parts": 10
        },
        "color": [255, 255, 255],
        "target": 20
      },
      "transform": {
        "position": [0, 0, 0],
        "rotation": [
          82,
          0,
          0
        ]
      }
    }
  }
]
`;

export const bboxJSON = `
[
  {
    "name": "gizmo",
    "delay": 0,
    "id": 1,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.boundingBox},
        "size": {
          "width": 1, "height": 1, "depth": 1, "center": [0, 0.5, 0]
        },
        "depthTest": true,
        "color": [255, 255, 0],
        "target": 1
      },
      "transform": {
        "position": [0, 0, 0],
        "rotation": [
          0,
          45,
          45
        ]
      }
    }
  },
  {
    "name": "gizmo",
    "delay": 0,
    "id": 19,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.box},
        "depthTest": true,
        "size": {
          "width": 1, "height": 1, "depth": 1
        },
        "color": [0, 0, 0],
        "target": 19
      },
      "transform": {
        "position": [0, 0, 0],
        "rotation": [
          0,
          45,
          45
        ]
      }
    }
  }
]
`;

export const particleJSON = `
[
  {
    "name": "item_2",
    "delay": 0,
    "id": 2,
    "ro": 0.1,
    "duration": 10,
    "particle": {
      "options": {
        "startLifetime": 1.2,
        "startSize": 0.2,
        "sizeAspect": 1,
        "startSpeed": 1,
        "startColor": ["color", [255, 255, 255]],
        "duration": 4,
        "maxCount": 10,
        "gravityModifier": 1,
        "renderLevel": "B+",
        "looping": true
      },
      "emission": { "rateOverTime": 5 },
      "shape": {
        "shape": "Sphere",
        "radius": 1,
        "arc": 360,
        "arcMode": 0
      },
      "transform": { "path": ["bezier", [[[0, 0, 1, 1], [0.62, 0.62, 1, 1], [0.985, 0.985, 1, 1], [1, 0.985, 1, 1]], [[-1.4525577106045429, -0.6290673602203151, -0.00001390949987012391], [1.0554219396040432, 2.815665168334726, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391]], [[-0.45255580147090807, -0.6290673602203151, -0.00001390949987012391], [0.05542003047040628, 2.815665168334726, -0.00001390949987012391], [1.8054226555290849, 2.815665168334726, -0.00001390949987012391], [0.9979230140888753, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391], [1.747923730013915, -0.3295254166942107, -0.00001390949987012391]]]] }
    }
  }, {
    "name": "gizmo",
    "delay": 0,
    "id": 3,
    "duration": 10,
    "content": {
      "options": {
        "type": "editor-gizmo",
        "subType": ${GizmoSubType.particleEmitter},
        "target": 2,
        "color": [255, 255, 0]
      }
    }
  }
]
`;

export const gizmo3D = {
  'images': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*mtQIQ5EsdSAAAAAAAAAAAAAADlB4AQ/original',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*Y-F5SqCBYNoAAAAAAAAAAAAADlB4AQ/original',
      'oriY': 1,
    },
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*K2rVRIoFhjoAAAAAAAAAAAAADlB4AQ/original',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*EnuIQodpqFUAAAAAAAAAAAAADlB4AQ/original',
      'oriY': 1,
    },
  ],
  'spines': [],
  'version': '1.5',
  'shapes': [],
  'plugins': [
    'model',
    'editor-gizmo',
  ],
  'type': 'mars',
  'compositions': [
    {
      'id': '6',
      'name': '新建合成3',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 1,
      'previewSize': [
        1016,
        611,
      ],
      'items': [
        {
          'duration': 999,
          'delay': 0,
          'endBehavior': 5,
          'id': '9',
          'name': 'skyBox_9',
          'pluginName': 'model',
          'type': 'skybox',
          'content': {
            'options': {
              'delay': 0,
              'endBehavior': 5,
              'renderLevel': 'B+',
              'duration': 5,
              'looping': true,
              'renderable': false,
              'intensity': 1,
              'reflectionsIntensity': 1,
              'specularImageSize': 128,
              'specularMipCount': 7,
              'name': 'skyBox_9',
              'specularImage': 0,
              'diffuseImage': 1,
            },
          },
        },
        {
          'id': '1',
          'name': 'sprite_1',
          'duration': 5,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
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
            'renderer': {
              'renderMode': 1,
            },
            'positionOverLifetime': {
              'direction': [
                0,
                0,
                0,
              ],
              'startSpeed': 0,
              'gravity': [
                0,
                0,
                0,
              ],
              'gravityOverLifetime': [
                0,
                1,
              ],
            },
          },
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1.2,
              1.2,
              1,
            ],
          },
        },
        {
          'duration': 999,
          'id': '3',
          'parentId': '2^3',
          'pn': 0,
          'name': 'ka',
          'pluginName': 'model',
          'type': 'mesh',
          'delay': 0,
          'endBehavior': 1,
          'renderLevel': 'B+',
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
          'content': {
            'options': {
              'primitives': [
                {
                  'geometry': {
                    'attributes': {
                      'a_Position': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            290940,
                            288,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Normal': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            291228,
                            288,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Tangent': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            291516,
                            384,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_UV1': {
                        'type': 5126,
                        'size': 2,
                        'data': [
                          20,
                          [
                            0,
                            291900,
                            192,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Joint1': {
                        'type': 5123,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            292092,
                            192,
                            'u16',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Weight1': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            292284,
                            384,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                    },
                    'index': {
                      'data': [
                        20,
                        [
                          0,
                          290904,
                          36,
                          'u8',
                        ],
                      ],
                    },
                    'drawStart': 0,
                    'drawCount': 36,
                    'mode': 4,
                  },
                  'material': {
                    'name': '未命名(2)',
                    'type': 'unlit',
                    'baseColorFactor': [
                      255,
                      255,
                      255,
                      255,
                    ],
                    'depthMask': true,
                    'baseColorTextureCoordinate': 0,
                    'side': 1032,
                    'blending': 100,
                    'alphaCutOff': 0.5,
                    'baseColorTexture': 2,
                  },
                },
              ],
              'skin': {
                'name': '',
                'joints': [
                  44,
                ],
                'inverseBindMatrices': [
                  20,
                  [
                    0,
                    0,
                    64,
                    'f32',
                  ],
                ],
              },
            },
            'interaction': {
              'type': 2,
              'center': [
                0.17651329934597015,
                0.5138601064682007,
                0.8864595293998718,
              ],
              'size': [
                0.3596566617488861,
                0.39835071563720703,
                0.06798982620239258,
              ],
            },
          },
        },
        {
          'duration': 999,
          'id': '4',
          'parentId': '2^6',
          'pn': 0,
          'name': 'glass',
          'pluginName': 'model',
          'type': 'mesh',
          'delay': 0,
          'endBehavior': 1,
          'renderLevel': 'B+',
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
          'content': {
            'options': {
              'primitives': [
                {
                  'geometry': {
                    'attributes': {
                      'a_Position': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            300252,
                            10248,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Normal': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            310500,
                            10248,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Tangent': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            320748,
                            13664,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_UV1': {
                        'type': 5126,
                        'size': 2,
                        'data': [
                          20,
                          [
                            0,
                            334412,
                            6832,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Joint1': {
                        'type': 5123,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            341244,
                            6832,
                            'u16',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Weight1': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            348076,
                            13664,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                    },
                    'index': {
                      'data': [
                        20,
                        [
                          0,
                          292668,
                          7584,
                          'u16',
                        ],
                      ],
                    },
                    'drawStart': 0,
                    'drawCount': 3792,
                    'mode': 4,
                  },
                  'material': {
                    'name': '未命名(1)',
                    'type': 'unlit',
                    'baseColorFactor': [
                      100,
                      100,
                      100,
                      127.5,
                    ],
                    'depthMask': true,
                    'baseColorTextureCoordinate': 0,
                    'side': 1028,
                    'blending': 102,
                    'alphaCutOff': 0.5,
                    'baseColorTexture': 2,
                  },
                },
              ],
              'skin': {
                'name': '',
                'joints': [
                  23,
                ],
                'inverseBindMatrices': [
                  20,
                  [
                    0,
                    64,
                    64,
                    'f32',
                  ],
                ],
              },
            },
            'interaction': {
              'type': 2,
              'center': [
                -0.05639594793319702,
                0.9918005466461182,
                -0.4026860296726227,
              ],
              'size': [
                1.1876606941223145,
                0.44867438077926636,
                0.6254833340644836,
              ],
            },
          },
        },
        {
          'duration': 999,
          'id': '5',
          'parentId': '2^7',
          'pn': 0,
          'name': 'tu',
          'pluginName': 'model',
          'type': 'mesh',
          'delay': 0,
          'endBehavior': 1,
          'renderLevel': 'B+',
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
          'content': {
            'options': {
              'primitives': [
                {
                  'geometry': {
                    'attributes': {
                      'a_Position': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            550248,
                            207072,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Normal': {
                        'type': 5126,
                        'size': 3,
                        'data': [
                          20,
                          [
                            0,
                            757320,
                            207072,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Tangent': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            964392,
                            276096,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_UV1': {
                        'type': 5126,
                        'size': 2,
                        'data': [
                          20,
                          [
                            0,
                            1240488,
                            138048,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_UV2': {
                        'type': 5126,
                        'size': 2,
                        'data': [
                          20,
                          [
                            0,
                            1378536,
                            138048,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Joint1': {
                        'type': 5123,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            1516584,
                            138048,
                            'u16',
                          ],
                        ],
                        'normalize': false,
                      },
                      'a_Weight1': {
                        'type': 5126,
                        'size': 4,
                        'data': [
                          20,
                          [
                            0,
                            1654632,
                            276096,
                            'f32',
                          ],
                        ],
                        'normalize': false,
                      },
                    },
                    'index': {
                      'data': [
                        20,
                        [
                          0,
                          361740,
                          188508,
                          'u16',
                        ],
                      ],
                    },
                    'drawStart': 0,
                    'drawCount': 94254,
                    'mode': 4,
                  },
                  'material': {
                    'name': '未命名',
                    'type': 'unlit',
                    'baseColorFactor': [
                      255,
                      255,
                      255,
                      255,
                    ],
                    'depthMask': true,
                    'baseColorTextureCoordinate': 0,
                    'side': 1028,
                    'blending': 100,
                    'alphaCutOff': 0.5,
                    'baseColorTexture': 3,
                  },
                },
              ],
              'skin': {
                'name': '',
                'joints': [
                  10,
                  21,
                  22,
                  23,
                  28,
                  29,
                  30,
                  31,
                  24,
                  25,
                  26,
                  27,
                  33,
                  32,
                  39,
                  40,
                  41,
                  42,
                  43,
                  34,
                  35,
                  36,
                  37,
                  38,
                  16,
                  17,
                  18,
                  19,
                  20,
                  11,
                  12,
                  13,
                  14,
                  15,
                ],
                'inverseBindMatrices': [
                  20,
                  [
                    0,
                    128,
                    2176,
                    'f32',
                  ],
                ],
              },
            },
            'interaction': {
              'type': 2,
              'center': [
                -0.032865315675735474,
                0.6350956559181213,
                -0.08398643136024475,
              ],
              'size': [
                1.291332483291626,
                2.7579026222229004,
                1.3332104682922363,
              ],
            },
          },
        },
        {
          'id': '6',
          'name': 'light_117',
          'duration': 999,
          'type': 'light',
          'parentId': '2^46',
          'visible': true,
          'endBehavior': 1,
          'delay': 0,
          'renderLevel': 'B+',
          'pluginName': 'model',
          'content': {
            'options': {
              'color': [
                255,
                255,
                255,
                1,
              ],
              'intensity': 0.2,
              'lightType': 'directional',
            },
          },
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
        },
        {
          'id': '7',
          'name': 'light_117 (1)',
          'duration': 999,
          'type': 'light',
          'parentId': '2^47',
          'visible': true,
          'endBehavior': 1,
          'delay': 0,
          'renderLevel': 'B+',
          'pluginName': 'model',
          'content': {
            'options': {
              'color': [
                255,
                255,
                255,
                1,
              ],
              'intensity': 0.2,
              'lightType': 'directional',
            },
          },
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
        },
        {
          'endBehavior': 5,
          'duration': 999,
          'renderLevel': 'B+',
          'delay': 0,
          'id': '2',
          'name': 'scene',
          'type': 'tree',
          'transform': {
            'position': [
              0,
              0,
              0,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
            'scale': [
              1,
              1,
              1,
            ],
          },
          'content': {
            'options': {
              'tree': {
                'animation': -1,
                'children': [
                  49,
                ],
                'nodes': [
                  {
                    'name': 'Main Camera',
                    'transform': {
                      'position': [
                        0,
                        1,
                        10,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '0',
                  },
                  {
                    'name': 'Directional Light',
                    'transform': {
                      'position': [
                        0,
                        3,
                        0,
                      ],
                      'quat': [
                        -0.4082178771495819,
                        0.23456968367099762,
                        0.10938163846731186,
                        0.8754261136054993,
                      ],
                      'scale': [
                        1,
                        1,
                        0.9999999403953552,
                      ],
                    },
                    'children': [],
                    'id': '1',
                  },
                  {
                    'name': 'tuzi11_skin',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      3,
                      4,
                      44,
                    ],
                    'id': '2',
                  },
                  {
                    'name': 'ka',
                    'transform': {
                      'position': [
                        -0.0018765495624393225,
                        -0.0038225555326789618,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '3',
                  },
                  {
                    'name': 'tuzi',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      5,
                      8,
                    ],
                    'id': '4',
                  },
                  {
                    'name': 'Geometry',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      6,
                      7,
                    ],
                    'id': '5',
                  },
                  {
                    'name': 'glass',
                    'transform': {
                      'position': [
                        0,
                        0,
                        -0.03970499336719513,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '6',
                  },
                  {
                    'name': 'tu',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '7',
                  },
                  {
                    'name': 'Main',
                    'transform': {
                      'position': [
                        0,
                        -0.6202276945114136,
                        -0.13118325173854828,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        2.519261598587036,
                        2.519261598587036,
                        2.519261598587036,
                      ],
                    },
                    'children': [
                      9,
                    ],
                    'id': '8',
                  },
                  {
                    'name': 'DeformationSystem',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      10,
                    ],
                    'id': '9',
                  },
                  {
                    'name': 'Root_M',
                    'transform': {
                      'position': [
                        0,
                        0.2591208815574646,
                        0.010945890098810196,
                      ],
                      'quat': [
                        -0.5398150086402893,
                        0.45672720670700073,
                        -0.5398150086402893,
                        0.45672720670700073,
                      ],
                      'scale': [
                        0.9999999403953552,
                        0.9999999403953552,
                        0.9999999403953552,
                      ],
                    },
                    'children': [
                      11,
                      16,
                      21,
                    ],
                    'id': '10',
                  },
                  {
                    'name': 'Hip_L',
                    'transform': {
                      'position': [
                        -0.0025328879710286856,
                        0.010594513267278671,
                        -0.07473581284284592,
                      ],
                      'quat': [
                        -0.9977052211761475,
                        -0.06391115486621857,
                        0.01467025838792324,
                        0.01686582714319229,
                      ],
                      'scale': [
                        1,
                        0.9999999403953552,
                        0.9999999403953552,
                      ],
                    },
                    'children': [
                      12,
                    ],
                    'id': '11',
                  },
                  {
                    'name': 'Knee_L',
                    'transform': {
                      'position': [
                        0.08982662111520767,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0.16322846710681915,
                        0.9865882992744446,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      13,
                    ],
                    'id': '12',
                  },
                  {
                    'name': 'Ankle_L',
                    'transform': {
                      'position': [
                        0.09337887912988663,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.009263407438993454,
                        0.019219037145376205,
                        0.04567116126418114,
                        0.9987286925315857,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      14,
                    ],
                    'id': '13',
                  },
                  {
                    'name': 'Toes_L',
                    'transform': {
                      'position': [
                        0.050658758729696274,
                        -0.09895679354667664,
                        0,
                      ],
                      'quat': [
                        -0.0020645547192543745,
                        -0.0010860551847144961,
                        -0.46558353304862976,
                        0.8850008845329285,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      15,
                    ],
                    'id': '14',
                  },
                  {
                    'name': 'ToesEnd_L',
                    'transform': {
                      'position': [
                        0.047256484627723694,
                        0,
                        1.1924233822568908e-9,
                      ],
                      'quat': [
                        -4.644337536774401e-7,
                        -0.0000014955301139707444,
                        -6.945746603738423e-13,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '15',
                  },
                  {
                    'name': 'Hip_R',
                    'transform': {
                      'position': [
                        -0.0025328879710286856,
                        0.010594513267278671,
                        0.07473581284284592,
                      ],
                      'quat': [
                        0.06391115486621857,
                        -0.9977052211761475,
                        0.01686582714319229,
                        -0.01467025838792324,
                      ],
                      'scale': [
                        0.9999999403953552,
                        1,
                        0.9999999403953552,
                      ],
                    },
                    'children': [
                      17,
                    ],
                    'id': '16',
                  },
                  {
                    'name': 'Knee_R',
                    'transform': {
                      'position': [
                        -0.08982662111520767,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0.16322846710681915,
                        0.9865882992744446,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      18,
                    ],
                    'id': '17',
                  },
                  {
                    'name': 'Ankle_R',
                    'transform': {
                      'position': [
                        -0.09337887912988663,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.009263407438993454,
                        0.019219037145376205,
                        0.04567116126418114,
                        0.9987286925315857,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      19,
                    ],
                    'id': '18',
                  },
                  {
                    'name': 'Toes_R',
                    'transform': {
                      'position': [
                        -0.050658758729696274,
                        0.09895679354667664,
                        0,
                      ],
                      'quat': [
                        -0.00206310348585248,
                        -0.0010852916166186333,
                        -0.4655835032463074,
                        0.8850008845329285,
                      ],
                      'scale': [
                        1.0000001192092896,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      20,
                    ],
                    'id': '19',
                  },
                  {
                    'name': 'ToesEnd_R',
                    'transform': {
                      'position': [
                        -0.047256484627723694,
                        0,
                        -1.2890791367681231e-7,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '20',
                  },
                  {
                    'name': 'Spine1_M',
                    'transform': {
                      'position': [
                        -0.062129225581884384,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0.06381494551897049,
                        0.9979617595672607,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      22,
                    ],
                    'id': '21',
                  },
                  {
                    'name': 'Chest_M',
                    'transform': {
                      'position': [
                        -0.05584282800555229,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0.013425588607788086,
                        0.9999098777770996,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      23,
                      34,
                      39,
                    ],
                    'id': '22',
                  },
                  {
                    'name': 'Neck_M',
                    'transform': {
                      'position': [
                        -0.0964042916893959,
                        0,
                        0,
                      ],
                      'quat': [
                        0.03191046416759491,
                        -0.059981610625982285,
                        -0.00615599425509572,
                        0.9976702928543091,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      24,
                      28,
                      32,
                      33,
                    ],
                    'id': '23',
                  },
                  {
                    'name': 'joint1_L',
                    'transform': {
                      'position': [
                        -0.3869307339191437,
                        -0.013035646639764309,
                        -0.05759076774120331,
                      ],
                      'quat': [
                        0.16032876074314117,
                        0.11023963242769241,
                        -0.9656423330307007,
                        0.17226961255073547,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      25,
                    ],
                    'id': '24',
                  },
                  {
                    'name': 'joint2_L',
                    'transform': {
                      'position': [
                        0.10499709844589233,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.011042805388569832,
                        -0.039738256484270096,
                        0.6032554507255554,
                        0.7964808940887451,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      26,
                    ],
                    'id': '25',
                  },
                  {
                    'name': 'joint3_L',
                    'transform': {
                      'position': [
                        0.14956915378570557,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.03758874908089638,
                        -0.030365489423274994,
                        0.3448159694671631,
                        0.9374257326126099,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      27,
                    ],
                    'id': '26',
                  },
                  {
                    'name': 'joint4_L',
                    'transform': {
                      'position': [
                        0.11971690505743027,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '27',
                  },
                  {
                    'name': 'joint1_R',
                    'transform': {
                      'position': [
                        -0.3869307339191437,
                        -0.013035646639764309,
                        0.05759076774120331,
                      ],
                      'quat': [
                        -0.10969198495149612,
                        0.19917066395282745,
                        0.17654645442962646,
                        0.9576690793037415,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      29,
                    ],
                    'id': '28',
                  },
                  {
                    'name': 'joint2_R',
                    'transform': {
                      'position': [
                        -0.10499709844589233,
                        0,
                        0,
                      ],
                      'quat': [
                        0.010627205483615398,
                        0.04367830231785774,
                        0.6148152947425842,
                        0.7873889803886414,
                      ],
                      'scale': [
                        1,
                        1,
                        0.9999999403953552,
                      ],
                    },
                    'children': [
                      30,
                    ],
                    'id': '29',
                  },
                  {
                    'name': 'joint3_R',
                    'transform': {
                      'position': [
                        -0.14956915378570557,
                        0,
                        0,
                      ],
                      'quat': [
                        0.03712062910199165,
                        0.03150373697280884,
                        0.3505168855190277,
                        0.9352900385856628,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      31,
                    ],
                    'id': '30',
                  },
                  {
                    'name': 'joint4_R',
                    'transform': {
                      'position': [
                        -0.11971690505743027,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '31',
                  },
                  {
                    'name': 'joint7',
                    'transform': {
                      'position': [
                        -0.144016832113266,
                        0.10944227874279022,
                        -0.09617386013269424,
                      ],
                      'quat': [
                        0.3760696351528168,
                        -0.3075218200683594,
                        0.5903275609016418,
                        0.6446048021316528,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '32',
                  },
                  {
                    'name': 'joint8',
                    'transform': {
                      'position': [
                        -0.144016832113266,
                        0.10944227874279022,
                        0.09617386013269424,
                      ],
                      'quat': [
                        0.5849424600601196,
                        -0.6157062649726868,
                        0.4025281071662903,
                        0.34164202213287354,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '33',
                  },
                  {
                    'name': 'Scapula_L',
                    'transform': {
                      'position': [
                        -0.05680840462446213,
                        -0.004457075614482164,
                        -0.07359477877616882,
                      ],
                      'quat': [
                        0.6819440722465515,
                        -0.07965730875730515,
                        -0.7210887670516968,
                        0.09294061362743378,
                      ],
                      'scale': [
                        1,
                        1.0000001192092896,
                        1.0000001192092896,
                      ],
                    },
                    'children': [
                      35,
                    ],
                    'id': '34',
                  },
                  {
                    'name': 'Shoulder_L',
                    'transform': {
                      'position': [
                        0.02022920548915863,
                        0,
                        0,
                      ],
                      'quat': [
                        0.058014754205942154,
                        0.33848387002944946,
                        -0.20958922803401947,
                        0.9154973030090332,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      36,
                    ],
                    'id': '35',
                  },
                  {
                    'name': 'Elbow_L',
                    'transform': {
                      'position': [
                        0.13527339696884155,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        -0.85685133934021,
                        0.5155635476112366,
                      ],
                      'scale': [
                        1.0000001192092896,
                        1.0000001192092896,
                        1,
                      ],
                    },
                    'children': [
                      37,
                    ],
                    'id': '36',
                  },
                  {
                    'name': 'Wrist_L',
                    'transform': {
                      'position': [
                        0.12157611548900604,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.32225367426872253,
                        -0.008750787936151028,
                        0.08640769124031067,
                        0.9426609873771667,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      38,
                    ],
                    'id': '37',
                  },
                  {
                    'name': 'MiddleFinger1_L',
                    'transform': {
                      'position': [
                        0.09257850795984268,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '38',
                  },
                  {
                    'name': 'Scapula_R',
                    'transform': {
                      'position': [
                        -0.05680840462446213,
                        -0.004457075614482164,
                        0.07359477877616882,
                      ],
                      'quat': [
                        0.07965732365846634,
                        0.6819441318511963,
                        0.09294061362743378,
                        0.7210887670516968,
                      ],
                      'scale': [
                        1,
                        1,
                        1.0000001192092896,
                      ],
                    },
                    'children': [
                      40,
                    ],
                    'id': '39',
                  },
                  {
                    'name': 'Shoulder_R',
                    'transform': {
                      'position': [
                        -0.02022920548915863,
                        0,
                        0,
                      ],
                      'quat': [
                        0.20154830813407898,
                        0.1016339436173439,
                        -0.28820091485977173,
                        0.9305853247642517,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      41,
                    ],
                    'id': '40',
                  },
                  {
                    'name': 'Elbow_R',
                    'transform': {
                      'position': [
                        -0.13527339696884155,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        -0.8411810398101807,
                        0.5407536029815674,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      42,
                    ],
                    'id': '41',
                  },
                  {
                    'name': 'Wrist_R',
                    'transform': {
                      'position': [
                        -0.12157611548900604,
                        0,
                        0,
                      ],
                      'quat': [
                        -0.38265421986579895,
                        -0.409843772649765,
                        -0.013651364482939243,
                        0.8278994560241699,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      43,
                    ],
                    'id': '42',
                  },
                  {
                    'name': 'MiddleFinger1_R',
                    'transform': {
                      'position': [
                        -0.09257850795984268,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '43',
                  },
                  {
                    'name': 'Z',
                    'transform': {
                      'position': [
                        0.17645001411437988,
                        0.5070447325706482,
                        0.8862719535827637,
                      ],
                      'quat': [
                        -0.9956503510475159,
                        -0.04603128880262375,
                        0.07990417629480362,
                        -0.013297908939421177,
                      ],
                      'scale': [
                        0.8230693936347961,
                        0.8228763341903687,
                        0.8228763341903687,
                      ],
                    },
                    'children': [],
                    'id': '44',
                  },
                  {
                    'name': 'new_root',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      0,
                      1,
                      2,
                    ],
                    'id': '45',
                  },
                  {
                    'name': 'light_117',
                    'transform': {
                      'position': [
                        0,
                        1.5,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '46',
                  },
                  {
                    'name': 'light_117 (1)',
                    'transform': {
                      'position': [
                        0,
                        1.5,
                        0,
                      ],
                      'quat': [
                        0,
                        -1,
                        0,
                        6.123234262925839e-17,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '47',
                  },
                  {
                    'name': 'camera_2',
                    'transform': {
                      'position': [
                        -1.0485600233078003,
                        0,
                        -5.373702526092529,
                      ],
                      'quat': [
                        0,
                        -1,
                        0,
                        6.123234262925839e-17,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [],
                    'id': '48',
                  },
                  {
                    'name': 'new_root',
                    'transform': {
                      'position': [
                        0,
                        0,
                        0,
                      ],
                      'quat': [
                        0,
                        0,
                        0,
                        1,
                      ],
                      'scale': [
                        1,
                        1,
                        1,
                      ],
                    },
                    'children': [
                      45,
                      46,
                      47,
                      48,
                    ],
                    'id': '49',
                  },
                ],
                'animations': [
                  {
                    'name': 'ani_bipedPreV01_dance001',
                    'tracks': [
                      {
                        'node': 44,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            2304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            2904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 44,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            4704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            5304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 44,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            7704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            8304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 8,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            10104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            10704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 8,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            12504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            13104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 8,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            15504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            16104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 9,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            17904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            18504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 9,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            20304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            20904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 9,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            23304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            23904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 10,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            25704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            26304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 10,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            28104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            28704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 10,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            31104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            31704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 21,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            33504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            34104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 21,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            35904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            36504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 21,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            38904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            39504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 22,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            41304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            41904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 22,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            43704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            44304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 22,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            46704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            47304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 23,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            49104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            49704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 23,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            51504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            52104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 23,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            54504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            55104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 28,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            56904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            57504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 28,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            59304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            59904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 28,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            62304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            62904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 29,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            64704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            65304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 29,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            67104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            67704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 29,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            70104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            70704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 30,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            72504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            73104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 30,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            74904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            75504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 30,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            77904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            78504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 31,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            80304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            80904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 31,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            82704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            83304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 31,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            85704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            86304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 24,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            88104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            88704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 24,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            90504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            91104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 24,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            93504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            94104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 25,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            95904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            96504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 25,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            98304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            98904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 25,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            101304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            101904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 26,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            103704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            104304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 26,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            106104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            106704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 26,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            109104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            109704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 27,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            111504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            112104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 27,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            113904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            114504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 27,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            116904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            117504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 33,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            119304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            119904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 33,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            121704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            122304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 33,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            124704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            125304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 32,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            127104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            127704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 32,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            129504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            130104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 32,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            132504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            133104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 39,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            134904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            135504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 39,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            137304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            137904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 39,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            140304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            140904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 40,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            142704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            143304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 40,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            145104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            145704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 40,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            148104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            148704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 41,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            150504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            151104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 41,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            152904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            153504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 41,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            155904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            156504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 42,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            158304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            158904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 42,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            160704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            161304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 42,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            163704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            164304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 43,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            166104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            166704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 43,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            168504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            169104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 43,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            171504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            172104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 34,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            173904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            174504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 34,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            176304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            176904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 34,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            179304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            179904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 35,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            181704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            182304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 35,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            184104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            184704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 35,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            187104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            187704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 36,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            189504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            190104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 36,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            191904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            192504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 36,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            194904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            195504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 37,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            197304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            197904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 37,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            199704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            200304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 37,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            202704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            203304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 38,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            205104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            205704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 38,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            207504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            208104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 38,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            210504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            211104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 16,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            212904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            213504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 16,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            215304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            215904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 16,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            218304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            218904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 17,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            220704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            221304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 17,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            223104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            223704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 17,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            226104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            226704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 18,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            228504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            229104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 18,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            230904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            231504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 18,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            233904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            234504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 19,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            236304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            236904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 19,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            238704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            239304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 19,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            241704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            242304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 20,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            244104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            244704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 20,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            246504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            247104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 20,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            249504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            250104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 11,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            251904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            252504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 11,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            254304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            254904,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 11,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            257304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            257904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 12,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            259704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            260304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 12,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            262104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            262704,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 12,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            265104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            265704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 13,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            267504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            268104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 13,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            269904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            270504,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 13,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            272904,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            273504,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 14,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            275304,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            275904,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 14,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            277704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            278304,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 14,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            280704,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            281304,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 15,
                        'path': 'translation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            283104,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            283704,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 15,
                        'path': 'rotation',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            285504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            286104,
                            2400,
                            'f32',
                          ],
                        ],
                      },
                      {
                        'node': 15,
                        'path': 'scale',
                        'interpolation': 'LINEAR',
                        'input': [
                          20,
                          [
                            0,
                            288504,
                            600,
                            'f32',
                          ],
                        ],
                        'output': [
                          20,
                          [
                            0,
                            289104,
                            1800,
                            'f32',
                          ],
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          'name': 'editor-3d-bounding-gizmo',
          'delay': 0,
          'id': '2-20-gizmo',
          'type': 'editor-gizmo',
          'pn': 1,
          'duration': 999,
          'content': {
            'options': {
              'depthTest': true,
              'size': {
                'width': 1.291332483291626,
                'height': 2.7579026222229004,
                'depth': 1.6755871325731277,
                'center': [
                  -0.032865315675735474,
                  0.6350956559181213,
                  0.08266087621450424,
                ],
              },
              'type': 'editor-gizmo',
              'subType': 20,
              'target': '2-20-gizmo',
            },
            'transform': {
              'position': [
                0,
                0,
                0,
              ],
              'scale': [
                1,
                1,
                1,
              ],
              'rotation': [
                0,
                0,
                0,
              ],
            },
          },
        },
        {
          'type': 'editor-gizmo',
          'name': 'editor-3d-transform-gizmo',
          'delay': 0,
          'id': '2-11-gizmo',
          'pn': 1,
          'duration': 999,
          'content': {
            'options': {
              'size': {
                'scale': 2,
              },
              'type': 'editor-gizmo',
              'subType': 11,
              'target': '2',
            },
            'transform': {
              'position': [
                0,
                0,
                0,
              ],
              'scale': [
                1,
                1,
                1,
              ],
              'rotation': [
                0,
                0,
                0,
              ],
            },
          },
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
    },
  ],
  'requires': [],
  'compositionId': '6',
  'bins': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*eA_wSI7BsGEAAAAAAAAAAAAADlB4AQ',
    },
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*8y1vQ7Jzs8IAAAAAAAAAAAAADlB4AQ',
    },
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/file/A*8QkISJA3WEgAAAAAAAAAAAAADlB4AQ',
    },
  ],
  'textures': [
    {
      'minFilter': 9987,
      'magFilter': 9729,
      'wrapS': 33071,
      'wrapT': 33071,
      'target': 34067,
      'format': 6408,
      'internalFormat': 6408,
      'type': 5121,
      'mipmaps': [
        [
          [
            20,
            [
              1,
              0,
              24661,
            ],
          ],
          [
            20,
            [
              1,
              24664,
              26074,
            ],
          ],
          [
            20,
            [
              1,
              50740,
              26845,
            ],
          ],
          [
            20,
            [
              1,
              77588,
              24422,
            ],
          ],
          [
            20,
            [
              1,
              102012,
              24461,
            ],
          ],
          [
            20,
            [
              1,
              126476,
              27099,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              153576,
              7699,
            ],
          ],
          [
            20,
            [
              1,
              161276,
              7819,
            ],
          ],
          [
            20,
            [
              1,
              169096,
              8919,
            ],
          ],
          [
            20,
            [
              1,
              178016,
              7004,
            ],
          ],
          [
            20,
            [
              1,
              185020,
              7657,
            ],
          ],
          [
            20,
            [
              1,
              192680,
              8515,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              201196,
              2305,
            ],
          ],
          [
            20,
            [
              1,
              203504,
              2388,
            ],
          ],
          [
            20,
            [
              1,
              205892,
              2789,
            ],
          ],
          [
            20,
            [
              1,
              208684,
              2147,
            ],
          ],
          [
            20,
            [
              1,
              210832,
              2351,
            ],
          ],
          [
            20,
            [
              1,
              213184,
              2541,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              215728,
              755,
            ],
          ],
          [
            20,
            [
              1,
              216484,
              810,
            ],
          ],
          [
            20,
            [
              1,
              217296,
              902,
            ],
          ],
          [
            20,
            [
              1,
              218200,
              727,
            ],
          ],
          [
            20,
            [
              1,
              218928,
              775,
            ],
          ],
          [
            20,
            [
              1,
              219704,
              835,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              220540,
              292,
            ],
          ],
          [
            20,
            [
              1,
              220832,
              301,
            ],
          ],
          [
            20,
            [
              1,
              221136,
              317,
            ],
          ],
          [
            20,
            [
              1,
              221456,
              285,
            ],
          ],
          [
            20,
            [
              1,
              221744,
              301,
            ],
          ],
          [
            20,
            [
              1,
              222048,
              307,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              222356,
              147,
            ],
          ],
          [
            20,
            [
              1,
              222504,
              147,
            ],
          ],
          [
            20,
            [
              1,
              222652,
              149,
            ],
          ],
          [
            20,
            [
              1,
              222804,
              149,
            ],
          ],
          [
            20,
            [
              1,
              222956,
              149,
            ],
          ],
          [
            20,
            [
              1,
              223108,
              149,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              223260,
              96,
            ],
          ],
          [
            20,
            [
              1,
              223356,
              96,
            ],
          ],
          [
            20,
            [
              1,
              223452,
              96,
            ],
          ],
          [
            20,
            [
              1,
              223548,
              97,
            ],
          ],
          [
            20,
            [
              1,
              223648,
              97,
            ],
          ],
          [
            20,
            [
              1,
              223748,
              97,
            ],
          ],
        ],
        [
          [
            20,
            [
              1,
              223848,
              83,
            ],
          ],
          [
            20,
            [
              1,
              223932,
              83,
            ],
          ],
          [
            20,
            [
              1,
              224016,
              83,
            ],
          ],
          [
            20,
            [
              1,
              224100,
              83,
            ],
          ],
          [
            20,
            [
              1,
              224184,
              83,
            ],
          ],
          [
            20,
            [
              1,
              224268,
              83,
            ],
          ],
        ],
      ],
      'sourceType': 7,
    },
    {
      'minFilter': 9729,
      'magFilter': 9729,
      'wrapS': 33071,
      'wrapT': 33071,
      'target': 34067,
      'format': 6408,
      'internalFormat': 6408,
      'type': 5121,
      'sourceType': 7,
      'mipmaps': [
        [
          [
            20,
            [
              2,
              0,
              83,
            ],
          ],
          [
            20,
            [
              2,
              84,
              83,
            ],
          ],
          [
            20,
            [
              2,
              168,
              83,
            ],
          ],
          [
            20,
            [
              2,
              252,
              83,
            ],
          ],
          [
            20,
            [
              2,
              336,
              83,
            ],
          ],
          [
            20,
            [
              2,
              420,
              83,
            ],
          ],
        ],
      ],
    },
    {
      'minFilter': 9987,
      'magFilter': 9729,
      'wrapS': 10497,
      'wrapT': 10497,
      'target': 3553,
      'format': 6408,
      'internalFormat': 6408,
      'type': 5121,
      'anisotropic': 1,
      'premultiplyAlpha': false,
      'sourceType': 2,
      'generateMipmap': true,
      'source': 0,
    },
    {
      'minFilter': 9987,
      'magFilter': 9729,
      'wrapS': 10497,
      'wrapT': 10497,
      'target': 3553,
      'format': 6408,
      'internalFormat': 6408,
      'type': 5121,
      'anisotropic': 1,
      'premultiplyAlpha': false,
      'sourceType': 2,
      'generateMipmap': true,
      'source': 1,
    },
  ],
};
