import { getStandardItem, getStandardJSON } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/model/plugin-items', () => {
  it('load camera item', () => {
    const item = getStandardItem({
      id: 'extra-camera',
      duration: 8,
      name: 'extra-camera',
      pn: 0,
      type: 'camera',
      transform: {
        position: [0, 0, 5],
        rotation: [0, 40, 0],
      },
      content: {
        options: {
          duration: 8,
          near: 0.1,
          far: 5000,
          fov: 60,
        },
      },
    });

    expect(item.type).to.eql('camera');
    expect(item.transform?.position).to.eql([0, 0, 5]);
    expect(item.transform?.rotation).to.eql([0, 40, 0]);
    expect(item.content.options).to.exist;
    expect(item.pn).to.eql(0);
    expect(item.duration).to.eql(8);
    expect(item.content.options).to.contains({
      duration: 8, near: 0.1, far: 5000, fov: 60,
    });
  });

  it('load mesh item', () => {
    const geometry = {};
    const item = getStandardItem({
      id: 'extra-camera',
      duration: 8,
      name: 'extra-camera',
      pluginName: 'model',
      type: 'mesh',
      transform: {
        position: [0, 0, 5],
        rotation: [0, 40, 0],
      },
      content: {
        options: {
          geometry,
        },
      },
    });

    expect(item.type).to.eql('mesh');
    expect(item.pluginName).to.eql('model');
    expect(item.transform).to.deep.equals({
      position: [0, 0, 5],
      rotation: [0, 40, 0],
    });
    expect(item.duration).to.eql(8);
    expect(item.content.options).to.contains({ geometry });
  });

  it('load model json', () => {
    const scn = getStandardJSON({
      compositionId: 0,
      version: '0.8.1',
      images: [],
      gltf: ['xxx'],
      _imgs: {},
      compositions: [
        {
          id: 0,
          items: [
            {
              id: 1,
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 5,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: 'mesh',
              duration: 8,
              name: 'extra-camera',
              pluginName: 'model',
              type: 'mesh',
              transform: {
                position: [0, 0, 5],
                rotation: [0, 40, 0],
              },
              content: {
                options: {
                  geometry: {},
                },
              },
            },
          ],
        },
      ],
    });

    //@ts-expect-error
    const item0 = scn.items.find(item => item.id === scn.compositions[0].items[0].id);
    //@ts-expect-error
    const item1 = scn.items.find(item => item.id === scn.compositions[0].items[1].id);

    expect(scn.plugins).to.deep.equal(['model']);
    //@ts-expect-error
    expect(scn.compositions[0].items.length).to.eql(2);
    expect(scn.items.length).to.eql(2);
    expect(item0?.pn).to.eql(0);
    expect(item0?.endBehavior).to.eql(5);
    expect(item1?.pn).to.eql(0);

    const scn08MeshFix = getStandardJSON({
      compositionId: 0,
      version: '0.8.1',
      images: [],
      gltf: ['xxx'],
      _imgs: {},
      compositions: [
        {
          id: 0,
          items: [
            {
              id: '1',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '12',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '13',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '14',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: 'mesh',
              duration: 8,
              name: 'extra-camera',
              pluginName: 'model',
              type: 'mesh',
              transform: {
                position: [0, 0, 5],
                rotation: [0, 40, 0],
              },
              content: {
                options: {
                  geometry: {},
                },
              },
            },
          ],
        },
      ],
    });

    //@ts-expect-error
    const item0From08 = scn08MeshFix.items.find(item => item.id === scn08MeshFix.compositions[0].items[0].id);
    //@ts-expect-error
    const item1From08 = scn08MeshFix.items.find(item => item.id === scn08MeshFix.compositions[0].items[1].id);
    //@ts-expect-error
    const item2From08 = scn08MeshFix.items.find(item => item.id === scn08MeshFix.compositions[0].items[2].id);
    //@ts-expect-error
    const item3From08 = scn08MeshFix.items.find(item => item.id === scn08MeshFix.compositions[0].items[3].id);

    expect(item0From08?.endBehavior).to.eql(0);
    expect(item1From08?.endBehavior).to.eql(4);
    expect(item2From08?.endBehavior).to.eql(0);
    expect(item3From08?.endBehavior).to.eql(4);

    const scn18MeshFix = getStandardJSON({
      compositionId: 0,
      version: '1.8',
      images: [],
      gltf: ['xxx'],
      _imgs: {},
      compositions: [
        {
          id: 0,
          items: [
            {
              id: '1',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '12',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '13',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '14',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: 'mesh',
              duration: 8,
              name: 'extra-camera',
              pluginName: 'model',
              type: 'mesh',
              transform: {
                position: [0, 0, 5],
                rotation: [0, 40, 0],
              },
              content: {
                options: {
                  geometry: {},
                },
              },
            },
          ],
        },
      ],
    });
    //@ts-expect-error
    const item0From18 = scn18MeshFix.items.find(item => item.id === scn18MeshFix.compositions[0].items[0].id);
    //@ts-expect-error
    const item1From18 = scn18MeshFix.items.find(item => item.id === scn18MeshFix.compositions[0].items[1].id);
    //@ts-expect-error
    const item2From18 = scn18MeshFix.items.find(item => item.id === scn18MeshFix.compositions[0].items[2].id);
    //@ts-expect-error
    const item3From18 = scn18MeshFix.items.find(item => item.id === scn18MeshFix.compositions[0].items[3].id);

    expect(item0From18?.endBehavior).to.eql(0);
    expect(item1From18?.endBehavior).to.eql(4);
    expect(item2From18?.endBehavior).to.eql(0);
    expect(item3From18?.endBehavior).to.eql(4);

    const scn21MeshFix = getStandardJSON({
      compositionId: 0,
      version: '2.1',
      images: [],
      gltf: ['xxx'],
      _imgs: {},
      compositions: [
        {
          id: 0,
          items: [
            {
              id: '1',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '12',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '13',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '14',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: 'mesh',
              duration: 8,
              name: 'extra-camera',
              pluginName: 'model',
              type: 'mesh',
              transform: {
                position: [0, 0, 5],
                rotation: [0, 40, 0],
              },
              content: {
                options: {
                  geometry: {},
                },
              },
            },
          ],
        },
      ],
    });
    //@ts-expect-error
    const item0From21 = scn21MeshFix.items.find(item => item.id === scn21MeshFix.compositions[0].items[0].id);
    //@ts-expect-error
    const item1From21 = scn21MeshFix.items.find(item => item.id === scn21MeshFix.compositions[0].items[1].id);
    //@ts-expect-error
    const item2From21 = scn21MeshFix.items.find(item => item.id === scn21MeshFix.compositions[0].items[2].id);
    //@ts-expect-error
    const item3From21 = scn21MeshFix.items.find(item => item.id === scn21MeshFix.compositions[0].items[3].id);

    expect(item0From21?.endBehavior).to.eql(0);
    expect(item1From21?.endBehavior).to.eql(4);
    expect(item2From21?.endBehavior).to.eql(0);
    expect(item3From21?.endBehavior).to.eql(4);

    const scn22MeshFix = getStandardJSON({
      compositionId: 0,
      version: '2.2',
      images: [],
      gltf: ['xxx'],
      _imgs: {},
      compositions: [
        {
          id: 0,
          items: [
            {
              id: '1',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '12',
              type: 'mesh',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '13',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 1,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: '14',
              type: 'light',
              pluginName: 'model',
              duration: 4,
              endBehavior: 4,
              content: {
                options: {
                  geometry: {},
                },
              },
            },
            {
              id: 'mesh',
              duration: 8,
              name: 'extra-camera',
              pluginName: 'model',
              type: 'mesh',
              transform: {
                position: [0, 0, 5],
                rotation: [0, 40, 0],
              },
              content: {
                options: {
                  geometry: {},
                },
              },
            },
          ],
        },
      ],
    });
    //@ts-expect-error
    const item0From22 = scn22MeshFix.items.find(item => item.id === scn22MeshFix.compositions[0].items[0].id);
    //@ts-expect-error
    const item1From22 = scn22MeshFix.items.find(item => item.id === scn22MeshFix.compositions[0].items[1].id);
    //@ts-expect-error
    const item2From22 = scn22MeshFix.items.find(item => item.id === scn22MeshFix.compositions[0].items[2].id);
    //@ts-expect-error
    const item3From22 = scn22MeshFix.items.find(item => item.id === scn22MeshFix.compositions[0].items[3].id);

    expect(item0From22?.endBehavior).to.eql(1);
    expect(item1From22?.endBehavior).to.eql(4);
    expect(item2From22?.endBehavior).to.eql(1);
    expect(item3From22?.endBehavior).to.eql(4);
  });
});
