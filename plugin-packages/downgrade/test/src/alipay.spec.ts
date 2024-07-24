// @ts-nocheck
import { spec } from '@galacean/effects';
import { getDowngradeResult, AlipayMiniprogramParser } from '@galacean/effects-plugin-downgrade';

const { expect } = chai;

describe('Alipay parser', () => {
  it('iPhone 6 Plus 模拟器', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone7,1',
      system: '15.0',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone7,1');
    expect(deviceInfo.originalModel).to.equal('iPhone7,1');
    expect(deviceInfo.osVersion).to.equal('15.0');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 8 模拟器', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone10,1',
      system: '15.0',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone10,1');
    expect(deviceInfo.originalModel).to.equal('iPhone10,1');
    expect(deviceInfo.osVersion).to.equal('15.0');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14 Pro 模拟器', () => {
    const data = {
      brand: 'iPhone',
      model: 'iphone15,2',
      system: '15.0',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iphone15,2');
    expect(deviceInfo.originalModel).to.equal('iphone15,2');
    expect(deviceInfo.osVersion).to.equal('15.0');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 15 模拟器', () => {
    const data = {
      brand: 'iPhone',
      model: 'iphone15,4',
      system: '15.0',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iphone15,4');
    expect(deviceInfo.originalModel).to.equal('iphone15,4');
    expect(deviceInfo.osVersion).to.equal('15.0');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('华为 Mate 20 Pro 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Huawei',
      model: 'Huawei Mate 20 Pro',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('Mate 20 Pro');
    expect(deviceInfo.originalModel).to.equal('Huawei Mate 20 Pro');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 P40 Pro+ 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Huawei',
      model: 'Huawei P40 Pro Plus',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('P40 Pro Plus');
    expect(deviceInfo.originalModel).to.equal('Huawei P40 Pro Plus');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米 K30 Pro 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi Readmi K30 5G',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('Readmi K30 5G');
    expect(deviceInfo.originalModel).to.equal('Xiaomi Readmi K30 5G');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米 10 Pro 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi Mi 10 Pro',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('Mi 10 Pro');
    expect(deviceInfo.originalModel).to.equal('Xiaomi Mi 10 Pro');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Pixel 6 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Google',
      model: 'Pixel 6',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('Pixel 6');
    expect(deviceInfo.originalModel).to.equal('Pixel 6');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('iPhone 8', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone10,1',
      system: '13.6',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone10,1');
    expect(deviceInfo.originalModel).to.equal('iPhone10,1');
    expect(deviceInfo.osVersion).to.equal('13.6');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone SE2 真机', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone12,8',
      system: '16.4.1',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone12,8');
    expect(deviceInfo.originalModel).to.equal('iPhone12,8');
    expect(deviceInfo.osVersion).to.equal('16.4.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 13', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone14,5',
      system: '16.6',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone14,5');
    expect(deviceInfo.originalModel).to.equal('iPhone14,5');
    expect(deviceInfo.osVersion).to.equal('16.6');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14 Pro', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone15,2',
      system: '16.4',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.model).to.equal('iPhone15,2');
    expect(deviceInfo.originalModel).to.equal('iPhone15,2');
    expect(deviceInfo.osVersion).to.equal('16.4');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('华为 Mate 30 Pro', () => {
    const data = {
      performance: 'high',
      brand: 'HUAWEI',
      model: 'HUAWEI LIO-AL00',
      system: '10',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('LIO-AL00');
    expect(deviceInfo.originalModel).to.equal('HUAWEI LIO-AL00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 50 Pro', () => {
    const data = {
      performance: 'high',
      brand: 'HUAWEI',
      model: 'HUAWEI DCO-AL00',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('DCO-AL00');
    expect(deviceInfo.originalModel).to.equal('HUAWEI DCO-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 P40', () => {
    const data = {
      performance: 'high',
      brand: 'HUAWEI',
      model: 'HUAWEI ANA-AN00',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('ANA-AN00');
    expect(deviceInfo.originalModel).to.equal('HUAWEI ANA-AN00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 HONOR 30S', () => {
    const data = {
      performance: 'high',
      brand: 'HONOR',
      model: 'HUAWEI CDY-AN90',
      system: '10',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('CDY-AN90');
    expect(deviceInfo.originalModel).to.equal('HUAWEI CDY-AN90');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('samsung SM-S9210', () => {
    const data = {
      performance: 'high',
      brand: 'samsung',
      model: 'samsung SM-S9210',
      system: '14',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('SM-S9210');
    expect(deviceInfo.originalModel).to.equal('samsung SM-S9210');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo NEX 3 5G', () => {
    const data = {
      performance: 'high',
      brand: 'vivo',
      model: 'vivo V1924A',
      system: '10',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V1924A');
    expect(deviceInfo.originalModel).to.equal('vivo V1924A');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo V2203A', () => {
    const data = {
      performance: 'high',
      brand: 'vivo',
      model: 'vivo V2203A',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2203A');
    expect(deviceInfo.originalModel).to.equal('vivo V2203A');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('VIVO iQOO Pro', () => {
    const data = {
      performance: 'high',
      brand: 'vivo',
      model: 'vivo V1916A',
      system: '11',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V1916A');
    expect(deviceInfo.originalModel).to.equal('vivo V1916A');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('OPPO A5', () => {
    const data = {
      performance: 'low',
      brand: 'OPPO',
      model: 'OPPO PBAM00',
      system: '8.1.0',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('PBAM00');
    expect(deviceInfo.originalModel).to.equal('OPPO PBAM00');
    expect(deviceInfo.osVersion).to.equal('8.1.0');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米9 Pro 5G', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi Mi9 Pro 5G',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('Mi9 Pro 5G');
    expect(deviceInfo.originalModel).to.equal('Xiaomi Mi9 Pro 5G');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米 14 Pro', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi 23116PN5BC',
      system: '14',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('23116PN5BC');
    expect(deviceInfo.originalModel).to.equal('Xiaomi 23116PN5BC');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米10A', () => {
    const data = {
      performance: 'middle',
      brand: 'Redmi',
      model: 'Xiaomi 220233L2C',
      system: '11',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('220233L2C');
    expect(deviceInfo.originalModel).to.equal('Xiaomi 220233L2C');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

});

describe('Alipay Downgrade', () => {

  it('iPhone 14 Pro 模拟器', () => {
    const data = {
      brand: 'iPhone',
      model: 'iphone15,2',
      system: '15.0',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为 P40 Pro+ 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Huawei',
      model: 'Huawei P40 Pro Plus',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('红米 K30 Pro 模拟器', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi Readmi K30 5G',
      system: '9',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone 8', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone10,1',
      system: '13.6',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone SE2 真机', () => {
    const data = {
      brand: 'iPhone',
      model: 'iPhone12,8',
      system: '16.4.1',
      platform: 'iOS',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为 Mate 50 Pro', () => {
    const data = {
      performance: 'high',
      brand: 'HUAWEI',
      model: 'HUAWEI DCO-AL00',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为 P40', () => {
    const data = {
      performance: 'high',
      brand: 'HUAWEI',
      model: 'HUAWEI ANA-AN00',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('vivo V2203A', () => {
    const data = {
      performance: 'high',
      brand: 'vivo',
      model: 'vivo V2203A',
      system: '12',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('OPPO A5', () => {
    const data = {
      performance: 'low',
      brand: 'OPPO',
      model: 'OPPO PBAM00',
      system: '8.1.0',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('Downgrade by model list');
  });

  it('小米 14 Pro', () => {
    const data = {
      performance: 'high',
      brand: 'Xiaomi',
      model: 'Xiaomi 23116PN5BC',
      system: '14',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('红米10A', () => {
    const data = {
      performance: 'middle',
      brand: 'Redmi',
      model: 'Xiaomi 220233L2C',
      system: '11',
      platform: 'Android',
    };
    const parser = new AlipayMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });
});