import { PrimitiveType } from '@galacean/effects-plugin-editor-gizmo';
import type { GeometryExample } from './editor';

export const simpleJSON = `{
  "compositionId": 1,
  "requires": [],
  "compositions": [
    {
      "name": "composition_1",
      "id": 1,
      "duration": 10,
      "camera": {
        "fov": 30,
        "far": 400,
        "near": 0.1,
        "position": [
          0,
          0,
          20
        ],
        "rotation": [
          0,
          0,
          0
        ],
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
              "position": [
                0,
                0,
                0
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "scale": [
                1,
                1,
                1
              ],
              "path": [
                "bezier",
                [
                  [
                    [
                      0,
                      0,
                      1.1648,
                      1.1648
                    ],
                    [
                      0.9916,
                      0.9872,
                      1.1648,
                      1
                    ]
                  ],
                  [
                    [
                      0,
                      0,
                      0
                    ],
                    [
                      6.1939,
                      0,
                      0
                    ]
                  ],
                  [
                    [
                      0.3,
                      0,
                      0
                    ],
                    [
                      5.8939,
                      0,
                      0
                    ]
                  ]
                ]
              ]
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
              "startColor": [
                "color",
                [
                  255,
                  255,
                  255
                ]
              ],
              "duration": 4,
              "maxCount": 10,
              "gravityModifier": 1,
              "renderLevel": "B+",
              "looping": true
            },
            "emission": {
              "rateOverTime": 5
            },
            "shape": {
              "shape": "Sphere",
              "radius": 1,
              "arc": 360,
              "arcMode": 0
            },
            "transform": {
              "path": [
                "bezier",
                [
                  [
                    [
                      0,
                      0,
                      1,
                      1
                    ],
                    [
                      0.62,
                      0.62,
                      1,
                      1
                    ],
                    [
                      0.985,
                      0.985,
                      1,
                      1
                    ],
                    [
                      1,
                      0.985,
                      1,
                      1
                    ]
                  ],
                  [
                    [
                      -1.4525577106045429,
                      -0.6290673602203151,
                      -0.00001390949987012391
                    ],
                    [
                      1.0554219396040432,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ]
                  ],
                  [
                    [
                      -0.45255580147090807,
                      -0.6290673602203151,
                      -0.00001390949987012391
                    ],
                    [
                      0.05542003047040628,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      1.8054226555290849,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      0.9979230140888753,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ]
                  ]
                ]
              ]
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
              "startColor": [
                "color",
                [
                  255,
                  255,
                  255
                ]
              ],
              "duration": 2,
              "gravityModifier": 1,
              "renderLevel": "B+",
              "looping": true
            },
            "renderer": {
              "renderMode": 1
            },
            "transform": {
              "path": [
                "bezier",
                [
                  [
                    [
                      0,
                      0.1495,
                      1,
                      1
                    ],
                    [
                      0.1495,
                      0.1495,
                      1,
                      1
                    ],
                    [
                      0.66,
                      0.66,
                      1,
                      1
                    ],
                    [
                      1,
                      0.66,
                      1,
                      1
                    ]
                  ],
                  [
                    [
                      0,
                      0,
                      0
                    ],
                    [
                      0,
                      0,
                      0
                    ],
                    [
                      3,
                      0,
                      0
                    ],
                    [
                      3,
                      0,
                      0
                    ]
                  ],
                  [
                    [
                      0,
                      0,
                      0
                    ],
                    [
                      0,
                      0,
                      0
                    ],
                    [
                      1,
                      0,
                      0
                    ],
                    [
                      2,
                      0,
                      0
                    ],
                    [
                      3,
                      0,
                      0
                    ],
                    [
                      3,
                      0,
                      0
                    ]
                  ]
                ]
              ]
            }
          }
        }
      ],
      "meta": {
        "previewSize": [
          750,
          1624
        ]
      }
    }
  ],
  "gltf": [],
  "images": [],
  "version": "0.8.9-beta.9",
  "shapes": [],
  "plugins": [
    "editor-gizmo"
  ],
  "type": "mars",
  "_imgs": {
    "1": []
  }
}`;

export const primaryJSON = `{
  "compositionId": 1,
  "requires": [],
  "compositions": [
    {
      "name": "composition_1",
      "id": 1,
      "duration": 10,
      "camera": {
        "fov": 30,
        "far": 400,
        "near": 0.1,
        "position": [
          0,
          0,
          20
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "clipMode": 1
      },
      "items": [],
      "meta": {
        "previewSize": [
          750,
          1624
        ]
      }
    }
  ],
  "gltf": [],
  "images": [],
  "version": "0.8.9-beta.9",
  "shapes": [],
  "plugins": [
    "editor-gizmo"
  ],
  "type": "mars",
  "_imgs": {
    "1": []
  }
}`;

export const transformGizmoScene = `{
  "compositionId": 1,
  "requires": [],
  "compositions": [
    {
      "name": "composition_1",
      "id": 1,
      "duration": 10,
      "camera": {
        "fov": 30,
        "far": 400,
        "near": 0.1,
        "position": [
          0,
          0,
          20
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "clipMode": 1
      },
      "items": [
        {
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
      ],
      "meta": {
        "previewSize": [
          750,
          1624
        ]
      }
    }
  ],
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
  "plugins": [
    "editor-gizmo"
  ],
  "type": "mars",
  "_imgs": {
    "1": []
  }
}`;

export const particleJSON = `{
  "compositionId": 1,
  "requires": [],
  "compositions": [
    {
      "name": "composition_1",
      "id": 1,
      "duration": 10,
      "camera": {
        "fov": 30,
        "far": 400,
        "near": 0.1,
        "position": [
          0,
          0,
          20
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "clipMode": 1
      },
      "items": [
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
              "startColor": [
                "color",
                [
                  255,
                  255,
                  255
                ]
              ],
              "duration": 4,
              "maxCount": 10,
              "gravityModifier": 1,
              "renderLevel": "B+",
              "looping": true
            },
            "emission": {
              "rateOverTime": 5
            },
            "shape": {
              "shape": "Sphere",
              "radius": 1,
              "arc": 360,
              "arcMode": 0
            },
            "transform": {
              "path": [
                "bezier",
                [
                  [
                    [
                      0,
                      0,
                      1,
                      1
                    ],
                    [
                      0.62,
                      0.62,
                      1,
                      1
                    ],
                    [
                      0.985,
                      0.985,
                      1,
                      1
                    ],
                    [
                      1,
                      0.985,
                      1,
                      1
                    ]
                  ],
                  [
                    [
                      -1.4525577106045429,
                      -0.6290673602203151,
                      -0.00001390949987012391
                    ],
                    [
                      1.0554219396040432,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ]
                  ],
                  [
                    [
                      -0.45255580147090807,
                      -0.6290673602203151,
                      -0.00001390949987012391
                    ],
                    [
                      0.05542003047040628,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      1.8054226555290849,
                      2.815665168334726,
                      -0.00001390949987012391
                    ],
                    [
                      0.9979230140888753,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ],
                    [
                      1.747923730013915,
                      -0.3295254166942107,
                      -0.00001390949987012391
                    ]
                  ]
                ]
              ]
            }
          }
        }
      ],
      "meta": {
        "previewSize": [
          750,
          1624
        ]
      }
    }
  ],
  "gltf": [],
  "images": [],
  "version": "0.8.9-beta.9",
  "shapes": [],
  "plugins": [
    "editor-gizmo"
  ],
  "type": "mars",
  "_imgs": {
    "1": []
  }
}`;

export const basicGeometry: GeometryExample[] = [
  {
    type: PrimitiveType.Box,
    'options': {
      'size': {
        'width': 0.8,
        'height': 0.8,
        'depth': 0.8,
      },
      'color': [
        1,
        0,
        0,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        -2,
        1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Box,
    'options': {
      'size': {
        'width': 0.8,
        'height': 0.8,
        'depth': 0.8,
      },
      'color': [
        0,
        1,
        0,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -2,
        1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Sphere,
    'options': {
      'size': {
        'radius': 0.5,
      },
      'color': [
        1,
        0,
        0,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        -1,
        1,
        0,
      ],
      'rotation': [
        0,
        90,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Sphere,
    'options': {
      'size': {
        'radius': 0.5,
      },
      'color': [
        0,
        1,
        0,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -1,
        1,
        0,
      ],
      'rotation': [
        0,
        90,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Cylinder,
    'options': {
      'size': {
        'radius': 0.4,
        'height': 1,
      },
      'color': [
        1,
        0,
        0,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        -3,
        1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Cylinder,
    'options': {
      'size': {
        'radius': 0.4,
        'height': 1,
      },
      'color': [
        0,
        1,
        0,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -3,
        1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Cone,
    'options': {
      'size': {
        'radius': 0.5,
        'height': 1,
      },
      'color': [
        1,
        0,
        0,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        -1,
        -1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Cone,
    'options': {
      'size': {
        'radius': 0.4,
        'height': 1,
      },
      'color': [
        0,
        1,
        0,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -1,
        -1,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Torus,
    'options': {
      'size': {
        'radius': 0.4,
        'tube': 0.2,
      },
      'color': [
        1,
        1,
        0,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        -3,
        -1,
        0,
      ],
      'rotation': [
        0,
        0,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Torus,
    'options': {
      'size': {
        'radius': 0.4,
        'tube': 0.2,
      },
      'color': [
        1,
        0,
        0,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -3,
        -1,
        0,
      ],
      'rotation': [
        0,
        0,
        0,
      ],
    },
  },
];

export const sceneGeometry: GeometryExample[] = [
  {
    type: 'frustum',
    'options': {
      'size': {
        'aspect': 2,
        'fov': 60,
        'far': 1.5,
        'near': 0.1,
        'position': [
          0,
          0,
          0,
        ],
        'rotation': [
          0,
          180,
          0,
        ],
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        2,
        0,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Plane,
    icon: 'camera',
    'options': {
      'size': {
        'width': 0.5,
        'height': 0.5,
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        2,
        0,
        0,
      ],
    },
  },
  {
    type: PrimitiveType.Plane,
    icon: 'light',
    'options': {
      'size': {
        'width': 0.5,
        'height': 0.5,
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 4,
    },
    'transform': {
      'position': [
        2,
        2,
        0,
      ],
    },
  },
  {
    type: 'point-light',
    'options': {
      'size': {
        'range': 1,
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -1,
        0,
        0,
      ],
      'rotation': [
        90,
        0,
        0,
      ],
    },
  },
  {
    type: 'spot-light',
    'options': {
      'size': {
        'range': 2,
        'spotAngle': 30,
        'segments': 64,
        'thetaStart': 0,
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        1,
        -1,
        0,
      ],
      'rotation': [
        -50,
        0,
        0,
      ],
    },
  },
  {
    type: 'directional-light',
    'options': {
      'size': {
        'range': 1,
        'segments': 64,
        'thetaStart': 0,
      },
      'color': [
        1,
        1,
        1,
      ],
      'depthTest': false,
      'renderMode': 1,
    },
    'transform': {
      'position': [
        -4,
        0,
        0,
      ],
      'rotation': [
        20,
        60,
        20,
      ],
    },
  },
];
