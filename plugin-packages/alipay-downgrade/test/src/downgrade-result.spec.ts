// @ts-nocheck
import { Player, spec } from '@galacean/effects';
import { getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

const { expect } = chai;

describe('Downgrade result', () => {
  it('mock-pass', async () => {
    const result = await getDowngradeResult('mock-pass');

    expect(result.bizId).to.equal('mock-pass');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('mock');
  });

  it('mock-fail', async () => {
    const result = await getDowngradeResult('mock-fail');

    expect(result.bizId).to.equal('mock-fail');
    expect(result.downgrade).to.equal(true);
    expect(result.reason).to.equal('mock');
  });

  it('current', async () => {
    const result = await getDowngradeResult('');

    expect(result.bizId).to.equal('');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('Non-Alipay environment');
  });

  it('render level S', async () => {
    const result = await getDowngradeResult('', { level: spec.RenderLevel.S });

    expect(result.bizId).to.equal('');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('Non-Alipay environment');
  });

  it('render level A', async () => {
    const result = await getDowngradeResult('', { level: spec.RenderLevel.A });

    expect(result.bizId).to.equal('');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('Non-Alipay environment');
  });

  it('render level B', async () => {
    const result = await getDowngradeResult('', { level: spec.RenderLevel.B });

    expect(result.bizId).to.equal('');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('Non-Alipay environment');
  });

  it('华为 nova 12', async () => {
    const systemInfo = {
      brand: 'HUAWEI',
      model: 'HUAWEI BLK-AL00',
      performance: 'high',
      platform: 'Android',
      system: '12',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'HUAWEI',
          deviceLevel: 'high',
          deviceScore: 100,
          model: 'BLK-AL00',
          osVersion: '12',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('VIVO S16', async () => {
    const systemInfo = {
      brand: 'vivo',
      model: 'vivo V2244A',
      performance: 'high',
      platform: 'Android',
      system: '13',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'vivo',
          deviceLevel: 'high',
          deviceScore: 100,
          model: 'V2244A',
          osVersion: '13',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('OPPO A9X', async () => {
    const systemInfo = {
      brand: 'OPPO',
      model: 'OPPO PCET00',
      performance: 'high',
      platform: 'Android',
      system: '11',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'OPPO',
          deviceLevel: 'high',
          deviceScore: -1,
          model: 'PCET00',
          osVersion: '11',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('小米9 Pro 5G', async () => {
    const systemInfo = {
      brand: 'Xiaomi',
      model: 'Xiaomi Mi9 Pro 5G',
      performance: 'high',
      platform: 'Android',
      system: '9',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'Xiaomi',
          deviceLevel: 'high',
          deviceScore: 82,
          model: 'Mi9 Pro 5G',
          osVersion: '9',
        },
      },
      resultReason: 4,
      resultReasonDesc: '技术点原因',
      resultType: 1,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('4, technical point downgrade');
  });

  it('红米10A', async () => {
    const systemInfo = {
      brand: 'Redmi',
      model: 'Xiaomi 220233L2C',
      performance: 'middle',
      platform: 'Android',
      system: '11',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'Redmi',
          deviceLevel: 'medium',
          deviceScore: -1,
          model: '220233L2C',
          osVersion: '11',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('0');
  });

  it('华为 荣耀 V20', async () => {
    const systemInfo = {
      brand: 'HONOR',
      model: 'HUAWEI PCT-AL10',
      performance: 'high',
      platform: 'Android',
      system: '10',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'HONOR',
          deviceLevel: 'high',
          deviceScore: 47,
          model: 'PCT-AL10',
          osVersion: '10',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('华为 荣耀 V20(Level A)', async () => {
    const systemInfo = {
      brand: 'HONOR',
      model: 'HUAWEI PCT-AL10',
      performance: 'high',
      platform: 'Android',
      system: '10',
    };
    const downgradeResult = {
      context: {
        deviceInfo: {
          brand: 'HONOR',
          deviceLevel: 'high',
          deviceScore: 47,
          model: 'PCT-AL10',
          osVersion: '10',
        },
      },
      resultReason: 0,
      resultReasonDesc: '未降级/unknown',
      resultType: 0,
    };
    const result = await getDowngradeResult('test', {
      level: spec.RenderLevel.A,
      systemInfo, downgradeResult,
    });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('0');
  });

  it('iPhone 13', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '17.4',
      platform: 'iOS',
      model: 'iPhone14,5',
    };
    const downgradeResult = {
      resultReasonDesc: '未降级/unknown',
      context: {
        deviceInfo: {
          osVersion: 17.399999618530273,
          deviceScore: '',
          deviceLevel: 'high',
          deviceVersion: 'iPhone14,5',
        },
      },
      resultType: 0,
      resultReason: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('iPhone SE2', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '16.6',
      platform: 'iOS',
      model: 'iPhone12,8',
    };
    const downgradeResult = {
      resultReasonDesc: '未降级/unknown',
      context: {
        deviceInfo: {
          osVersion: 16.600000381469727,
          deviceScore: '',
          deviceLevel: 'high',
          deviceVersion: 'iPhone12,8',
        },
      },
      resultType: 0,
      resultReason: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('iPhone 6Plus', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '12.5.7',
      platform: 'iOS',
      model: 'iPhone7,1',
    };
    const downgradeResult = {
      resultReasonDesc: '技术点原因',
      context: {
        deviceInfo: {
          osVersion: 12.5,
          deviceScore: '',
          deviceLevel: 'low',
          deviceVersion: 'iPhone7,1',
        },
      },
      resultType: 1,
      resultReason: 4,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('4, technical point downgrade');
  });

  it('iPhone 12 Pro Max', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '14.4',
      platform: 'iOS',
      model: 'iPhone13,4',
    };
    const downgradeResult = {
      resultReasonDesc: '未降级/unknown',
      context: {
        deviceInfo: {
          osVersion: 14.399999618530273,
          deviceScore: '',
          deviceLevel: 'high',
          deviceVersion: 'iPhone13,4',
        },
      },
      resultType: 0,
      resultReason: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('0');
  });

  it('iPhone 8Plus', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '14.6',
      platform: 'iOS',
      model: 'iPhone10,2',
    };
    const downgradeResult = {
      resultReasonDesc: '未降级/unknown',
      context: {
        deviceInfo: {
          osVersion: 14.600000381469727,
          deviceScore: '',
          deviceLevel: 'medium',
          deviceVersion: 'iPhone10,2',
        },
      },
      resultType: 0,
      resultReason: 0,
    };
    const result = await getDowngradeResult('test', { systemInfo, downgradeResult });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('0');
  });

  it('iPhone 8Plus(Level B)', async () => {
    const systemInfo = {
      brand: 'iPhone',
      system: '14.6',
      platform: 'iOS',
      model: 'iPhone10,2',
    };
    const downgradeResult = {
      resultReasonDesc: '未降级/unknown',
      context: {
        deviceInfo: {
          osVersion: 14.600000381469727,
          deviceScore: '',
          deviceLevel: 'medium',
          deviceVersion: 'iPhone10,2',
        },
      },
      resultType: 0,
      resultReason: 0,
    };
    const result = await getDowngradeResult('test', {
      level: spec.RenderLevel.B,
      systemInfo, downgradeResult,
    });

    expect(result.bizId).to.equal('test');
    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('0');
  });
});

