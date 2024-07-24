// @ts-nocheck
import { spec } from '@galacean/effects';
import { getDowngradeResult, WechatMiniprogramParser } from '@galacean/effects-plugin-downgrade';

const { expect } = chai;

describe('Wechat parser', () => {
  it('Windows', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'Windows',
      system: 'Windows 10.0',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('Windows');
    expect(deviceInfo.osVersion).to.equal('10.0');
    expect(deviceInfo.platform).to.equal('Windows');
  });

  it('Nexus 5', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'Nexus 5',
      system: 'Android 5.0',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('Nexus 5');
    expect(deviceInfo.osVersion).to.equal('5.0');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Nexus 6', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'Nexus 6',
      system: 'Android 5.0',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('Nexus 6');
    expect(deviceInfo.osVersion).to.equal('5.0');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Mac 21-inch and above', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'Mac 21-inch and above',
      system: 'macOS 10.14.3',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('Mac 21-inch and above');
    expect(deviceInfo.osVersion).to.equal('10.14.3');
    expect(deviceInfo.platform).to.equal('macOS');
  });

  it('iPad', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPad',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPad');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 5', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 5',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone5,1');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 6/7/8', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 6/7/8',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone10,1');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 6/7/8 Plus', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 6/7/8 Plus',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone10,2');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone X', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone X',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone10,3');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone XR', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone XR',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone11,8');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone XS Max', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone XS Max',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone11,6');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 12/13 mini', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 12/13 mini',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone14,4');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 12/13 (Pro)', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 12/13 (Pro)',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone14,2');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 12/13 Pro Max', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 12/13 Pro Max',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone14,3');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14 Pro Max', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 14 Pro Max',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone15,3');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 15 Pro Max', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 15 Pro Max',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2048);
    expect(deviceInfo.model).to.equal('iPhone16,2');
    expect(deviceInfo.osVersion).to.equal('10.0.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 8 Plus (GSM+CDMA)<iPhone10,2>', () => {
    const data = {
      benchmarkLevel: '28',
      brand: 'iPhone',
      memorySize: 2973,
      model: 'iPhone 8 Plus (GSM+CDMA)<iPhone10,2>',
      system: 'iOS 16.4.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(2973);
    expect(deviceInfo.model).to.equal('iPhone10,2');
    expect(deviceInfo.originalModel).to.equal('iPhone 8 Plus (GSM+CDMA)<iPhone10,2>');
    expect(deviceInfo.osVersion).to.equal('16.4.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone SE (2nd generation)<iPhone12,8>', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 2959,
      model: 'iPhone SE (2nd generation)<iPhone12,8>',
      system: 'iOS 16.4.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(2959);
    expect(deviceInfo.model).to.equal('iPhone12,8');
    expect(deviceInfo.originalModel).to.equal('iPhone SE (2nd generation)<iPhone12,8>');
    expect(deviceInfo.osVersion).to.equal('16.4.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14<iPhone14,7>', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 5695,
      model: 'iPhone 14<iPhone14,7>',
      system: 'iOS 16.3',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(5695);
    expect(deviceInfo.model).to.equal('iPhone14,7');
    expect(deviceInfo.originalModel).to.equal('iPhone 14<iPhone14,7>');
    expect(deviceInfo.osVersion).to.equal('16.3');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14 pro<iPhone15,2>', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 5650,
      model: 'iPhone 14 pro<iPhone15,2>',
      system: 'iOS 17.3.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(5650);
    expect(deviceInfo.model).to.equal('iPhone15,2');
    expect(deviceInfo.originalModel).to.equal('iPhone 14 pro<iPhone15,2>');
    expect(deviceInfo.osVersion).to.equal('17.3.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 15 pro<iPhone16,1>', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 7675,
      model: 'iPhone 15 pro<iPhone16,1>',
      system: 'iOS 17.3.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('unknown');
    expect(deviceInfo.memoryMB).to.equal(7675);
    expect(deviceInfo.model).to.equal('iPhone16,1');
    expect(deviceInfo.originalModel).to.equal('iPhone 15 pro<iPhone16,1>');
    expect(deviceInfo.osVersion).to.equal('17.3.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('华为Mate 50', () => {
    const data = {
      benchmarkLevel: '35',
      brand: 'HUAWEI',
      memorySize: 7322,
      model: 'CET-AL00',
      system: 'Android 12',
      platform: 'android',
      remark: '华为Mate 50',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(7322);
    expect(deviceInfo.model).to.equal('CET-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为Mate60 Pro+', () => {
    const data = {
      benchmarkLevel: '29',
      brand: 'HUAWEI',
      memorySize: 15601,
      model: 'ALN-AL10',
      system: 'Android 12',
      platform: 'android',
      remark: '华为Mate60 Pro+',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(15601);
    expect(deviceInfo.model).to.equal('ALN-AL10');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米14', () => {
    const data = {
      benchmarkLevel: '31',
      brand: 'Xiaomi',
      memorySize: 7215,
      model: '23127PN0CC',
      system: 'Android 14',
      platform: 'android',
      remark: '小米14',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(7215);
    expect(deviceInfo.model).to.equal('23127PN0CC');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米 10A', () => {
    const data = {
      benchmarkLevel: '6',
      brand: 'Redmi',
      memorySize: 3779,
      model: '220233L2C',
      system: 'Android 11',
      platform: 'android',
      remark: '红米 10A',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.memoryMB).to.equal(3779);
    expect(deviceInfo.model).to.equal('220233L2C');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('2201123C', () => {
    const data = {
      benchmarkLevel: '34',
      brand: 'OPPO',
      memorySize: 7195,
      model: '2201123C',
      system: 'Android 12',
      platform: 'android',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(7195);
    expect(deviceInfo.model).to.equal('2201123C');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('PBEM00', () => {
    const data = {
      benchmarkLevel: '21',
      brand: 'OPPO',
      memorySize: 5621,
      model: 'PBEM00',
      system: 'Android 10',
      platform: 'android',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.memoryMB).to.equal(5621);
    expect(deviceInfo.model).to.equal('PBEM00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });
});

describe('Wechat Downgrade', () => {
  it('Nexus 6', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'Nexus 6',
      system: 'Android 5.0',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('');
  });

  it('iPhone X', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone X',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone 14 Pro Max', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'devtools',
      memorySize: 2048,
      model: 'iPhone 14 Pro Max',
      system: 'iOS 10.0.1',
      platform: 'devtools',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone 8 Plus (GSM+CDMA)<iPhone10,2>', () => {
    const data = {
      benchmarkLevel: '28',
      brand: 'iPhone',
      memorySize: 2973,
      model: 'iPhone 8 Plus (GSM+CDMA)<iPhone10,2>',
      system: 'iOS 16.4.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone SE (2nd generation)', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 2959,
      model: 'iPhone SE (2nd generation)<iPhone12,8>',
      system: 'iOS 16.4.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone SE (2nd generation) 16.7', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 2959,
      model: 'iPhone SE (2nd generation)<iPhone12,8>',
      system: 'iOS 16.7.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('Downgrade by OS version list');
  });

  it('iPhone 14 pro<iPhone15,2>', () => {
    const data = {
      benchmarkLevel: '-1',
      brand: 'iPhone',
      memorySize: 5650,
      model: 'iPhone 14 pro<iPhone15,2>',
      system: 'iOS 17.3.1',
      platform: 'ios',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为Mate 50', () => {
    const data = {
      benchmarkLevel: '35',
      brand: 'HUAWEI',
      memorySize: 7322,
      model: 'CET-AL00',
      system: 'Android 12',
      platform: 'android',
      remark: '华为Mate 50',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为Mate60 Pro+', () => {
    const data = {
      benchmarkLevel: '29',
      brand: 'HUAWEI',
      memorySize: 15601,
      model: 'ALN-AL10',
      system: 'Android 12',
      platform: 'android',
      remark: '华为Mate60 Pro+',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('小米14', () => {
    const data = {
      benchmarkLevel: '31',
      brand: 'Xiaomi',
      memorySize: 7215,
      model: '23127PN0CC',
      system: 'Android 14',
      platform: 'android',
      remark: '小米14',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('红米 10A', () => {
    const data = {
      benchmarkLevel: '6',
      brand: 'Redmi',
      memorySize: 3779,
      model: '220233L2C',
      system: 'Android 11',
      platform: 'android',
      remark: '红米 10A',
    };
    const parser = new WechatMiniprogramParser(data);
    const deviceInfo = parser.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('');
  });
});