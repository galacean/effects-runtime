import { combineImageTemplate, getBackgroundImage, spec } from '@galacean/effects-core';

const { expect } = chai;

describe('template image', () => {

  before(() => {
  });

  after(() => {

  });

  it('getBackgroundImage', async () => {
    const template: spec.TemplateContent = {
      variables: {
        'test': 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*L2GNRLWn9EAAAAAAAAAAAAAAARQnAQ',
      },
      background: {
        type: spec.BackgroundType.image,
        name: 'test',
        url: 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ',
      },
      width: 128,
      height: 128,
    };
    const result = getBackgroundImage(template, template.variables);

    expect(typeof result === 'string').to.be.true;
    expect(result).to.be.equal(template.variables['test']);

    const image1 = new Image();

    image1.src = 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*L2GNRLWn9EAAAAAAAAAAAAAAARQnAQ';
    const template2: spec.TemplateContent = {
      variables: {
        //@ts-expect-error
        'test2': image1,
      },
      background: {
        type: spec.BackgroundType.image,
        name: 'test2',
        url: 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ',
      },
      width: 128,
      height: 128,
    };
    const result2 = getBackgroundImage(template2, template2.variables) as HTMLImageElement;

    expect(result2 instanceof HTMLImageElement).to.be.true;
    //@ts-expect-error
    expect(result2.src).to.be.equal(template2.variables['test2'].src);
  });

  it('combineImageTemplate', async () => {
    const template: spec.TemplateContent = {
      variables: {
        'test': 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*L2GNRLWn9EAAAAAAAAAAAAAAARQnAQ',
      },
      background: {
        type: spec.BackgroundType.image,
        name: 'test',
        url: 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ',
      },
      width: 128,
      height: 128,
    };
    const result = await combineImageTemplate('https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ', template, template.variables);

    expect(result instanceof HTMLImageElement).to.be.true;
    expect(result.src).to.be.equal(template.variables['test']);

    const image1 = new Image();

    image1.src = 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*L2GNRLWn9EAAAAAAAAAAAAAAARQnAQ';
    const template2: spec.TemplateContent = {
      variables: {
        //@ts-expect-error
        'test2': image1,
      },
      background: {
        type: spec.BackgroundType.image,
        name: 'test2',
        url: 'https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ',
      },
      width: 128,
      height: 128,
    };
    const result2 = await combineImageTemplate('https://gw.alipayobjects.com/mdn/rms_7c464e/afts/img/A*rgNGR4Vb7lQAAAAAAAAAAAAAARQnAQ', template, template.variables);

    expect(result2 instanceof HTMLImageElement).to.be.true;
    //@ts-expect-error
    expect(result2.src).to.be.equal(template2.variables['test2'].src);
  });
});
