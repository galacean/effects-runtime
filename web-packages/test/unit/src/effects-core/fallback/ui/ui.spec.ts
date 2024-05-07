import { getStandardItem, spec } from '@galacean/effects';

const { expect } = chai;

describe('ui element', () => {
  const items = [
    {
      'name': 'click',
      'delay': 0,
      'id': 6,
      'ui': {
        'options': {
          'duration': 2,
          'type': 'click',
          'width': 2,
          'height': 1,
          'showPreview': true,
          'previewColor': ['color', [237, 21, 21, 1]],
        },
        'transform': { 'position': [0.2, 1.5, 0.1] },
      },
    },
    {
      'name': 'message',
      'delay': 0,
      'id': 5,
      'ui': {
        'options': {
          'duration': 2,
          'type': 'message',
          'width': 0.6,
          'height': 0.4,
          'showPreview': true,
          'endBehavior': 1,
        },
        'transform': { 'position': [-1, -0.02, 0] },
      },
    },
    {
      'name': 'drag',
      'delay': 0,
      'id': 4,
      'ui': {
        'options': {
          'duration': 2,
          'type': 'drag',
          'width': 0.6,
          'height': 0.4,
          'showPreview': true,
          'enableInEditor': true,
          'target': 'camera',
          'dxRange': [1, 5],
        },
      },
    },
    {
      'name': 'orientation',
      'delay': 0,
      'id': 3,
      'ui': {
        'options': {
          'duration': 2,
          'type': 'orientation',
          'width': 0.6,
          'height': 0.4,
          'showPreview': true,
        },
      },
    },
  ];

  it('load click item', () => {
    const item = getStandardItem(items[0]);

    expect(item.type).to.eql(spec.ItemType.interact);
    expect(item.duration).to.eql(2);
    expect(item.transform?.position).to.eql([0.2, 1.5, 0.1]);
    expect(item.transform?.scale).to.eql([2, 1, 1]);
    const content = item.content;
    const options = content.options;

    expect(options.type).to.eql(spec.InteractType.CLICK);
    expect(options.showPreview).to.be.true;
    expect(options.behavior).to.eql(spec.InteractBehavior.NOTIFY, 'endBehavior');
  });

  it('load message item', () => {
    const item = getStandardItem(items[1]);

    expect(item.type).to.eql(spec.ItemType.interact);
    expect(item.duration).to.eql(2);
    expect(item.endBehavior).to.eql(spec.END_BEHAVIOR_PAUSE);
    expect(item.transform?.position).to.eql([-1, -0.02, 0]);
    expect(item.transform?.scale).to.eql([0.6, 0.4, 1]);
    const options = item.content.options;

    expect(options.type).to.eql(spec.InteractType.MESSAGE, 'type');
  });

  it('load drag item', () => {
    const item = getStandardItem(items[2]);

    expect(item.type).to.eql(spec.ItemType.interact);
    expect(item.duration).to.eql(2);
    expect(item.transform?.scale).to.eql([0.6, 0.4, 1]);
    const content = item.content;
    const options = content.options;

    expect(options.type).to.eql(spec.InteractType.DRAG, 'type');
    expect(options.enableInEditor).to.be.true;
    expect(options.dxRange).to.eql([1, 5]);
    expect(options.dyRange).to.not.exist;
    expect(options.target).to.eql('camera');
  });

});
