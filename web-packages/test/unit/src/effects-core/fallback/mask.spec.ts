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
    it(`migrates renderer mask modes from ${version} through to mask references`, () => {
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

      expect(scene.components[0]).to.have.property('mask').that.deep.equals({ isMask: true });
      expect(scene.components[1]).to.have.property('mask').that.deep.equals({
        isMask: false,
        alphaMaskEnabled: false,
        references: [{ mask: { id: 'mask-component' }, inverted: true }],
      });
    });
  }

  for (const version of ['3.3', '3.6', '3.7']) {
    it(`migrates legacy mask references from ${version} to 3.8`, () => {
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
      const scene = getStandardJSON(createScene(version, [component]));

      expect(scene.version).to.equal('3.8');
      expect(component.mask).to.deep.equal({
        isMask: false,
        alphaMaskEnabled: true,
        references: [{ mask: { id: 'mask-component' }, inverted: true }],
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
      expect(component.mask, component.id).to.deep.equal({
        isMask: false,
        alphaMaskEnabled: false,
        references: [{ mask: { id: 'mask-component' }, inverted: false }],
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
    const expected = JSON.parse(JSON.stringify(components));

    getStandardJSON(createScene('3.7', components));

    expect(components).to.deep.equal(expected);
  });

  for (const version of ['3.8', '3.9']) {
    it(`leaves ${version} mask data unchanged`, () => {
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
      const scene = getStandardJSON(createScene(version, components));

      expect(scene.version).to.equal(version);
      expect(components).to.deep.equal(expected);
    });
  }
});
