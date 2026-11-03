import { getStandardJSON, MaskMode, spec } from '@galacean/effects';

const { expect } = chai;

function createScene (version: string, components: object[]) {
  return {
    version,
    components,
    items: [],
    compositions: [],
    animations: [],
    miscs: [],
    geometries: [],
    textures: [],
    images: [],
  };
}

describe('core/fallback/mask', () => {
  for (const version of ['3.0', '3.2']) {
    it(`migrates renderer mask modes from ${version} to track mattes without hiding the source`, () => {
      const components = [
        { id: 'mask-component', dataType: spec.DataType.SpriteComponent, renderer: { maskMode: MaskMode.MASK } },
        { id: 'masked-component', dataType: spec.DataType.SpriteComponent, renderer: { maskMode: MaskMode.REVERSE_OBSCURED } },
      ];
      const items = components.map(component => ({
        id: `${component.id}-item`,
        type: spec.ItemType.sprite,
        components: [{ id: component.id }],
      }));
      const scene = getStandardJSON({
        ...createScene(version, components),
        items,
        compositions: [{ id: 'composition', items: items.map(item => ({ id: item.id })) }],
      });

      expect(scene.components[0]).not.to.have.property('mask');
      expect(scene.components[0]).to.have.property('trackMatte').that.deep.equals({
        isTrackMatte: true, sourceVisible: true, alphaMaskEnabled: false, references: [],
      });
      expect(scene.components[1]).not.to.have.property('mask');
      expect(scene.components[1]).to.have.property('trackMatte').that.deep.equals({
        isTrackMatte: false,
        sourceVisible: true,
        alphaMaskEnabled: false,
        references: [{ source: { id: 'mask-component' }, inverted: true }],
      });
    });
  }

  for (const version of ['3.3', '3.6', '3.7']) {
    it(`migrates legacy mask references from ${version}`, () => {
      const component = {
        id: 'masked-sprite',
        dataType: spec.DataType.SpriteComponent,
        renderer: {},
        mask: {
          isMask: false,
          alphaMaskEnabled: true,
          reference: { id: 'mask-component' },
          inverted: true,
        },
      };

      getStandardJSON(createScene(version, [component]));

      expect(component).not.to.have.property('mask');
      expect(component).to.have.property('trackMatte').that.deep.equals({
        isTrackMatte: false,
        sourceVisible: true,
        alphaMaskEnabled: true,
        references: [{ source: { id: 'mask-component' }, inverted: true }],
      });
    });
  }

  it('migrates 3.7 masks independently of component type and sprite asset migration', () => {
    const components = [
      { dataType: spec.DataType.SpriteComponent, sprite: { id: 'existing-sprite' } },
      { dataType: spec.DataType.SpriteComponent, splits: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
      { dataType: spec.DataType.ParticleSystem },
      { dataType: spec.DataType.TextComponent },
      { dataType: spec.DataType.RichTextComponent },
      { dataType: spec.DataType.SpineComponent },
      { dataType: spec.DataType.VideoComponent },
      { dataType: spec.DataType.ShapeComponent },
      { dataType: spec.DataType.MeshComponent },
    ].map((component, index) => ({
      ...component,
      id: `component-${index}`,
      mask: { reference: { id: 'mask-component' } },
    }));

    getStandardJSON(createScene('3.7', components));

    for (const component of components) {
      expect(component, component.id).not.to.have.property('mask');
      expect(component, component.id).to.have.property('trackMatte').that.deep.equals({
        isTrackMatte: false,
        sourceVisible: true,
        alphaMaskEnabled: false,
        references: [{ source: { id: 'mask-component' }, inverted: false }],
      });
    }
  });

  it('preserves existing references in mixed 3.7 data, including an explicit empty list', () => {
    const masks = [
      {
        isMask: false,
        alphaMaskEnabled: true,
        reference: { id: 'legacy-mask' },
        references: [
          { mask: { id: 'forward-mask' }, inverted: false },
          { mask: { id: 'reverse-mask' }, inverted: true },
        ],
      },
      { reference: { id: 'legacy-mask' }, references: [] },
      { isMask: true, alphaMaskEnabled: true },
    ];
    const components = masks.map((mask, index) => ({ id: `component-${index}`, dataType: spec.DataType.MeshComponent, mask }));

    getStandardJSON(createScene('3.7', components));

    expect(components[0]).to.have.property('trackMatte').that.deep.equals({
      isTrackMatte: false, sourceVisible: true, alphaMaskEnabled: true,
      references: [
        { source: { id: 'forward-mask' }, inverted: false },
        { source: { id: 'reverse-mask' }, inverted: true },
      ],
    });
    expect(components[1]).to.have.property('trackMatte').that.deep.equals({
      isTrackMatte: false, sourceVisible: true, alphaMaskEnabled: false, references: [],
    });
    expect(components[2]).to.have.property('trackMatte').that.deep.equals({
      isTrackMatte: true, sourceVisible: true, alphaMaskEnabled: true, references: [],
    });
  });

  it('migrates 3.8 track matte references to the 3.9 schema', () => {
    const component = {
      id: 'masked-component',
      dataType: spec.DataType.MeshComponent,
      mask: { references: [{ mask: { id: 'mask-component' }, inverted: true }] },
    };
    const scene = getStandardJSON(createScene('3.8', [component]));

    expect(scene.version).equals('3.9');
    expect(component).not.to.have.property('mask');
    expect(component).to.have.property('trackMatte').that.deep.equals({
      isTrackMatte: false, sourceVisible: true, alphaMaskEnabled: false,
      references: [{ source: { id: 'mask-component' }, inverted: true }],
    });
  });

  for (const version of ['3.9', '4.0']) {
    it(`does not apply the 3.8 migration to ${version} data`, () => {
      const components = [
        {
          id: 'masked-component',
          dataType: spec.DataType.MeshComponent,
          mask: { references: [{ mask: { id: 'mask-component' }, inverted: true }] },
        },
        {
          id: 'legacy-component',
          dataType: spec.DataType.MeshComponent,
          mask: { reference: { id: 'mask-component' }, inverted: true },
        },
      ];
      const expected = JSON.parse(JSON.stringify(components));

      getStandardJSON(createScene(version, components));

      expect(components).to.deep.equal(expected);
    });
  }

  for (const version of ['3.2', '3.8']) {
    it(`keeps owned paths and existing track mattes intact across repeated ${version} migration`, () => {
      const pathComponent = {
        id: 'owned-paths', dataType: spec.DataType.MaskComponent, item: { id: 'layer' },
        masks: [{
          id: 'mask', name: 'mask', operation: spec.MaskOperation.Subtract, inverted: true,
          path: {
            points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], easingIns: [], easingOuts: [],
            shapes: [{ close: true, indexes: [0, 1, 2].map(point => ({ point, easingIn: 0, easingOut: 0 })) }],
          },
        }],
        // Unknown fields on a path component must not enter legacy matte migration either.
        mask: { references: [{ mask: { id: 'path-metadata' }, inverted: true }] },
      };
      const pathsBefore = JSON.parse(JSON.stringify(pathComponent));
      const trackMatte = {
        isTrackMatte: true, sourceVisible: false,
        references: [{ source: { id: 'new-source' }, inverted: true }],
      };
      const existing = {
        id: 'existing', dataType: spec.DataType.MeshComponent, trackMatte,
        mask: { isMask: true, references: [{ mask: { id: 'obsolete-source' } }] },
      };
      const legacy = {
        id: 'legacy', dataType: spec.DataType.MeshComponent,
        mask: { references: [{ mask: { id: 'source' }, inverted: false }] },
      };
      const scene = getStandardJSON(createScene(version, [legacy, pathComponent, existing]));

      expect(pathComponent).to.deep.equal(pathsBefore);
      expect(existing.trackMatte).equals(trackMatte);
      expect(existing.trackMatte.sourceVisible).equals(false);
      expect(existing).not.to.have.property('mask');
      expect(legacy).not.to.have.property('mask');
      expect(legacy).to.have.property('trackMatte').that.deep.equals({
        isTrackMatte: false, sourceVisible: true, alphaMaskEnabled: false,
        references: [{ source: { id: 'source' }, inverted: false }],
      });
      const migrated = JSON.parse(JSON.stringify(scene));

      getStandardJSON(scene);
      expect(scene).to.deep.equal(migrated);
    });
  }
});
