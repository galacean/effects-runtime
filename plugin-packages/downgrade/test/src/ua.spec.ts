import { spec } from '@galacean/effects';
import { getDowngradeResult, UADecoder } from '@galacean/effects-plugin-downgrade';

const { expect } = chai;

describe('UA Decoder', () => {

  it('Windows', () => {
    const data = {
      name: 'Windows',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      remark: 'Chrome',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.osVersion).to.equal('10.0');
    expect(deviceInfo.platform).to.equal('Windows');
  });

  it('iPhone 7', () => {
    const data = {
      name: 'iPhone 7',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.3 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('15.7.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone X', () => {
    const data = {
      name: 'iPhone X',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('13.6');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone SE2', () => {
    const data = {
      name: 'iPhone SE2',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('16.3.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 8', () => {
    const data = {
      name: 'iPhone 8',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('16.4.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 11', () => {
    const data = {
      name: 'iPhone 11',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('14.2');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 12 Pro', () => {
    const data = {
      name: 'iPhone 12 Pro',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('14.4');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 13', () => {
    const data = {
      name: 'iPhone 13',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('16.0.2');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14', () => {
    const data = {
      name: 'iPhone 14',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('17.5');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPhone 14 Pro', () => {
    const data = {
      name: 'iPhone 14 Pro',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('iPhone');
    expect(deviceInfo.osVersion).to.equal('16.1');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPad mini 5', () => {
    const data = {
      name: 'iPad mini 5',
      ua: 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('iPad');
    expect(deviceInfo.osVersion).to.equal('14.6');
    expect(deviceInfo.platform).to.equal('iOS');
  });

  it('iPad Pro 4', () => {
    const data = {
      name: 'iPad Pro 4',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.osVersion).to.equal('10.15.7');
    expect(deviceInfo.platform).to.equal('Mac OS');
  });

  it('MacBook Pro', () => {
    const data = {
      name: 'MacBook Pro',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.osVersion).to.equal('10.15.7');
    expect(deviceInfo.platform).to.equal('Mac OS');
  });

  it('samsung SM-C5560', () => {
    const data = {
      name: 'samsung SM-C5560',
      ua: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-C5560) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.1 Chrome/115.0.0.0 Mobile Safari/537.36',
      remark: 'SamsungBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('SM-C5560');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('三星 Galaxy S9', () => {
    const data = {
      name: '三星 Galaxy S9',
      ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.1 Chrome/121.0.0.0 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('K');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('三星 Galaxy S10E', () => {
    const data = {
      name: '三星 Galaxy S10E',
      ua: 'Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-G9700) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.1 Chrome/110.0.5481.154 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('SM-G9700');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('三星Galaxy A70s', () => {
    const data = {
      name: '三星Galaxy A70s',
      ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.1 Chrome/117.0.0.0 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('K');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Google Pixel 3 XL', () => {
    const data = {
      name: 'Google Pixel 3 XL',
      ua: 'Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.96 Mobile Safari/537.36',
      remark: 'Chrome',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('Pixel 3 XL');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Google Pixel 8', () => {
    const data = {
      name: 'Google Pixel 8',
      ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('K');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('Google Pixel 7', () => {
    const data = {
      name: 'Google Pixel 7',
      ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('K');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米MIX4', () => {
    const data = {
      name: '小米MIX4',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; 2106118C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.3.5 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('2106118C');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米 Redmi K70', () => {
    const data = {
      name: '小米 Redmi K70',
      ua: 'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23113RKC6C Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.118 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.3.210611',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('23113RKC6C');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米 Note 5', () => {
    const data = {
      name: '红米 Note 5',
      ua: 'Mozilla/5.0 (Linux; U; Android 9; zh-cn; Redmi Note 5 Build/PKQ1.180904.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.4.80113 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('Redmi Note 5');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米 14 Pro', () => {
    const data = {
      name: '小米 14 Pro',
      ua: 'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23116PN5BC Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.118 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.8.211101 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('23116PN5BC');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米12 Pro 5G', () => {
    const data = {
      name: '小米12 Pro 5G',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; 2201122C Build/TKQ1.220807.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.6.210824 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('2201122C');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('XIAOMI Redmi K60', () => {
    const data = {
      name: 'XIAOMI Redmi K60',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; 23013RK75C Build/TKQ1.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.3.5 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('23013RK75C');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('XIAOMI Redmi Note 12T Pro', () => {
    const data = {
      name: 'XIAOMI Redmi Note 12T Pro',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; 23054RA19C Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.6.210824 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('23054RA19C');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米10A', () => {
    const data = {
      name: '红米10A',
      ua: 'Mozilla/5.0 (Linux; U; Android 11; zh-cn; 220233L2C Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/16.4.22 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('220233L2C');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('小米10S 全网通版', () => {
    const data = {
      name: '小米10S 全网通版',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; M2102J2SC Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.0.18 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('M2102J2SC');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('红米 Note 8', () => {
    const data = {
      name: '红米 Note 8',
      ua: 'Mozilla/5.0 (Linux; U; Android 9; zh-cn; Redmi Note 8 Build/PKQ1.190616.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/71.0.3578.141 Mobile Safari/537.36 XiaoMi/MiuiBrowser/12.2.15',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('Redmi Note 8');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 60 Pro', () => {
    const data = {
      name: '华为 Mate 60 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; ALN-AL10; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.3.331 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('ALN-AL10');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Pura 70 Pro', () => {
    const data = {
      name: '华为 Pura 70 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; HBN-AL00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('HBN-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为畅享 70', () => {
    const data = {
      name: '华为畅享 70',
      ua: 'Mozilla/5.0 (Linux; Android 10; HarmonyOS; FGD-AL00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('FGD-AL00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 60', () => {
    const data = {
      name: '华为 Mate 60',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; BRA-AL00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.311 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('BRA-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 荣耀 V20', () => {
    const data = {
      name: '华为 荣耀 V20',
      ua: 'Mozilla/5.0 (Linux; Android 10; PCT-AL10 Build/HUAWEIPCT-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('PCT-AL10');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 HONOR 30', () => {
    const data = {
      name: '华为 HONOR 30',
      ua: 'Mozilla/5.0 (Linux; Android 10; BMH-AN10 Build/HUAWEIBMH-AN10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.105 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('BMH-AN10');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 畅想60', () => {
    const data = {
      name: '华为 畅想60',
      ua: 'Mozilla/5.0 (Linux; Android 10; HarmonyOS; MGA-AL40; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('MGA-AL40');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 nova 11', () => {
    const data = {
      name: '华为 nova 11',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; FOA-AL00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('FOA-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 50 Pro', () => {
    const data = {
      name: '华为 Mate 50 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; DCO-AL00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.3.300 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('DCO-AL00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 P40 Pro+', () => {
    const data = {
      name: '华为 P40 Pro+',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; ELS-AN10; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('ELS-AN10');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 20', () => {
    const data = {
      name: '华为 Mate 20',
      ua: 'Mozilla/5.0 (Linux; Android 10; HMA-AL00 Build/HUAWEIHMA-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('HMA-AL00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 麦芒 8', () => {
    const data = {
      name: '华为 麦芒 8',
      ua: 'Mozilla/5.0 (Linux; Android 10; ELE-AL00 Build/HUAWEIELE-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/99.0.4844.88 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('ELE-AL00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 nova 8 Pro', () => {
    const data = {
      name: '华为 nova 8 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; BRQ-AN00 Build/HUAWEIBRQ-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.105 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('BRQ-AN00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 荣耀 9X Pro', () => {
    const data = {
      name: '华为 荣耀 9X Pro',
      ua: 'Mozilla/5.0 (Linux; Android 10; HLK-AL10 Build/HONORHLK-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/99.0.4844.88 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('HLK-AL10');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 Mate 20 X (5G)', () => {
    const data = {
      name: '华为 Mate 20 X (5G)',
      ua: 'Mozilla/5.0 (Linux; Android 10; HarmonyOS; EVR-AN00; HMSCore 6.13.0.352; GMSCore 20.15.16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.311 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('EVR-AN00');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('华为 P50E', () => {
    const data = {
      name: '华为 P50E',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; ABR-AL60; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('ABR-AL60');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀 70', () => {
    const data = {
      name: '荣耀 70',
      ua: 'Mozilla/5.0 (Linux; Android 12; FNE-AN00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.1.300 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('FNE-AN00');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀Magic6', () => {
    const data = {
      name: '荣耀Magic6',
      ua: 'Mozilla/5.0 (Linux; Android 14; BVL-AN00 Build/HONORBVL-AN00;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.38 SP-engine/2.76.0 languageType/0 bdh_dvt/0 bdh_de/0 bdh_ds/0 bdapp/1.0 (bdhonorbrowser; bdhonorbrowser) bdhonorbrowser/8.1.0.6 (P1 14) NABar/1.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('BVL-AN00');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀 90', () => {
    const data = {
      name: '荣耀 90',
      ua: 'Mozilla/5.0 (Linux; Android 13; REA-AN00 Build/HONORREA-AN00;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.38 SP-engine/2.76.0 languageType/0 bdh_dvt/0 bdh_de/1 bdh_ds/1 bdapp/1.0 (bdhonorbrowser; bdhonorbrowser) bdhonorbrowser/8.0.7.6 (Baidu; P1 13) NABar/1.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('REA-AN00');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀 Play5', () => {
    const data = {
      name: '荣耀 Play5',
      ua: 'Mozilla/5.0 (Linux; Android 10; HJC-AN90 Build/HONORHJC-AN90;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.38 SP-engine/2.76.0 languageType/0 bdh_dvt/0 bdh_de/1 bdh_ds/1 bdapp/1.0 (bdhonorbrowser; bdhonorbrowser) bdhonorbrowser/8.0.7.6 (Baidu; P1 10) NABar/1.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('HJC-AN90');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀Magic5 至臻版', () => {
    const data = {
      name: '荣耀Magic5 至臻版',
      ua: 'Mozilla/5.0 (Linux; Android 14; PGT-AN20 Build/HONORPGT-AN20;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.38 SP-engine/2.76.0 languageType/0 bdh_dvt/0 bdh_de/1 bdh_ds/1 bdapp/1.0 (bdhonorbrowser; bdhonorbrowser) bdhonorbrowser/8.0.7.5 (Baidu; P1 14) NABar/1.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('PGT-AN20');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀X30', () => {
    const data = {
      name: '荣耀X30',
      ua: 'Mozilla/5.0 (Linux; Android 11; ANY-AN00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.3.300 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('ANY-AN00');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀 50 SE', () => {
    const data = {
      name: '荣耀 50 SE',
      ua: 'Mozilla/5.0 (Linux; Android 11; JLH-AN00 Build/HONORJLH-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.93 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('JLH-AN00');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('荣耀X20 SE', () => {
    const data = {
      name: '荣耀X20 SE',
      ua: 'Mozilla/5.0 (Linux; Android 11; CHL-AN00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.3.300 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('CHL-AN00');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('VIVO S16', () => {
    const data = {
      name: 'VIVO S16',
      ua: 'Mozilla/5.0 (Linux; Android 13; V2244A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/20.3.50.0',
      remark: 'VivoBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2244A');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('VIVO -iQOO 12', () => {
    const data = {
      name: 'VIVO -iQOO 12',
      ua: 'Mozilla/5.0 (Linux; Android 14; V2307A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/18.0.10.2',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2307A');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo V2339A', () => {
    const data = {
      name: 'vivo V2339A',
      ua: 'Mozilla/5.0 (Linux; Android 14; V2339A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/19.4.0.7',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2339A');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('VIVO X80', () => {
    const data = {
      name: 'VIVO X80',
      ua: 'Mozilla/5.0 (Linux; Android 14; V2183A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/18.0.10.2',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2183A');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo S7t', () => {
    const data = {
      name: 'vivo S7t',
      ua: 'Mozilla/5.0 (Linux; Android 11; V2080A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.0.10.3',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('V2080A');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo X30', () => {
    const data = {
      name: 'vivo X30',
      ua: 'Mozilla/5.0 (Linux; Android 10; V1938CT; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.0.0.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('V1938CT');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo X70 Pro', () => {
    const data = {
      name: 'vivo X70 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 11; V2134A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.0.10.3',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('V2134A');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo Y73s', () => {
    const data = {
      name: 'vivo Y73s',
      ua: 'Mozilla/5.0 (Linux; Android 10; V2031A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/14.5.10.4',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('V2031A');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('vivo S9', () => {
    const data = {
      name: 'vivo S9',
      ua: 'Mozilla/5.0 (Linux; Android 13; V2072A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.0.10.4',
      remark: 'VivoBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('V2072A');
    expect(deviceInfo.osVersion).to.equal('13');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('OPPO A73', () => {
    const data = {
      name: 'OPPO A73',
      ua: 'Mozilla/5.0 (Linux; U; Android 7.1.1; zh-cn; OPPO A73 Build/N6F26Q) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/10.8.4.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('OPPO A73');
    expect(deviceInfo.osVersion).to.equal('7.1.1');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('OPPO K1', () => {
    const data = {
      name: 'OPPO K1',
      ua: 'Mozilla/5.0 (Linux; U; Android 10; zh-cn; PBCM30 Build/QKQ1.191224.003) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.80 Mobile Safari/537.36 HeyTapBrowser/40.7.29.2',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('PBCM30');
    expect(deviceInfo.osVersion).to.equal('10');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('OPPO A11', () => {
    const data = {
      name: 'OPPO A11',
      ua: 'Mozilla/5.0 (Linux; U; Android 9; zh-cn; PCHM10 Build/PKQ1.190714.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.80 Mobile Safari/537.36 HeyTapBrowser/20.7.29.2',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('PCHM10');
    expect(deviceInfo.osVersion).to.equal('9');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('OPPO A5', () => {
    const data = {
      name: 'OPPO A5',
      ua: 'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-cn; PBAM00 Build/OPM1.171019.026) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/10.8.9.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('low');
    expect(deviceInfo.model).to.equal('PBAM00');
    expect(deviceInfo.osVersion).to.equal('8.1.0');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('realme X7', () => {
    const data = {
      name: 'realme X7',
      ua: 'Mozilla/5.0 (Linux; U; Android 12; zh-cn; RMX2176 Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/40.8.29.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('RMX2176');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('motorola XT2241-1', () => {
    const data = {
      name: 'motorola XT2241-1',
      ua: 'Mozilla/5.0 (Linux; U; Android 14;zh-cn; XT2241-1 Build/U1SQ34.53-33) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.117 MobileLenovoBrowser/9.1.6 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('XT2241-1');
    expect(deviceInfo.osVersion).to.equal('14');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('motorola XT2251-1', () => {
    const data = {
      name: 'motorola XT2251-1',
      ua: 'Mozilla/5.0 (Linux; U; Android 12;zh-cn; XT2251-1 Build/S3SL32.16-72-46) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.117 MobileLenovoBrowser/9.1.3 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('high');
    expect(deviceInfo.model).to.equal('XT2251-1');
    expect(deviceInfo.osVersion).to.equal('12');
    expect(deviceInfo.platform).to.equal('Android');
  });

  it('一加 7', () => {
    const data = {
      name: '一加 7',
      ua: 'Mozilla/5.0 (Linux; U; Android 11; zh-cn; GM1900 Build/RKQ1.201022.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/40.8.28.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();

    expect(deviceInfo.level).to.equal('medium');
    expect(deviceInfo.model).to.equal('GM1900');
    expect(deviceInfo.osVersion).to.equal('11');
    expect(deviceInfo.platform).to.equal('Android');
  });

});

describe('UA Downgrade', () => {

  it('Windows', () => {
    const data = {
      name: 'Windows',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      remark: 'Chrome',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone 7', () => {
    const data = {
      name: 'iPhone 7',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.3 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('iPhone X', () => {
    const data = {
      name: 'iPhone X',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('iPhone SE2', () => {
    const data = {
      name: 'iPhone SE2',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('iPhone 14 Pro', () => {
    const data = {
      name: 'iPhone 14 Pro',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1',
      remark: 'Safari',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('Google Pixel 3 XL', () => {
    const data = {
      name: 'Google Pixel 3 XL',
      ua: 'Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.96 Mobile Safari/537.36',
      remark: 'Chrome',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('小米MIX4', () => {
    const data = {
      name: '小米MIX4',
      ua: 'Mozilla/5.0 (Linux; U; Android 13; zh-cn; 2106118C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.3.5 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('红米 Note 5', () => {
    const data = {
      name: '红米 Note 5',
      ua: 'Mozilla/5.0 (Linux; U; Android 9; zh-cn; Redmi Note 5 Build/PKQ1.180904.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.4.80113 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('');
  });

  it('小米 14 Pro', () => {
    const data = {
      name: '小米 14 Pro',
      ua: 'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23116PN5BC Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.118 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.8.211101 swan-mibrowser',
      remark: 'MiuiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为 Mate 60 Pro', () => {
    const data = {
      name: '华为 Mate 60 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; ALN-AL10; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.3.331 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为 Pura 70 Pro', () => {
    const data = {
      name: '华为 Pura 70 Pro',
      ua: 'Mozilla/5.0 (Linux; Android 12; HarmonyOS; HBN-AL00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('华为畅享 70', () => {
    const data = {
      name: '华为畅享 70',
      ua: 'Mozilla/5.0 (Linux; Android 10; HarmonyOS; FGD-AL00; HMSCore 6.14.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.4.302 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('华为 荣耀 V20', () => {
    const data = {
      name: '华为 荣耀 V20',
      ua: 'Mozilla/5.0 (Linux; Android 10; PCT-AL10 Build/HUAWEIPCT-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36',
      remark: 'HuaweiBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('荣耀Magic6', () => {
    const data = {
      name: '荣耀Magic6',
      ua: 'Mozilla/5.0 (Linux; Android 14; BVL-AN00 Build/HONORBVL-AN00;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.38 SP-engine/2.76.0 languageType/0 bdh_dvt/0 bdh_de/0 bdh_ds/0 bdapp/1.0 (bdhonorbrowser; bdhonorbrowser) bdhonorbrowser/8.1.0.6 (P1 14) NABar/1.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('荣耀X20 SE', () => {
    const data = {
      name: '荣耀X20 SE',
      ua: 'Mozilla/5.0 (Linux; Android 11; CHL-AN00; HMSCore 6.13.0.352) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/15.0.3.300 Mobile Safari/537.36',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('VIVO S16', () => {
    const data = {
      name: 'VIVO S16',
      ua: 'Mozilla/5.0 (Linux; Android 13; V2244A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/20.3.50.0',
      remark: 'VivoBrowser',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.S);
    expect(result.reason).to.equal('');
  });

  it('vivo X30', () => {
    const data = {
      name: 'vivo X30',
      ua: 'Mozilla/5.0 (Linux; Android 10; V1938CT; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.0.0.0',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('');
  });

  it('OPPO A73', () => {
    const data = {
      name: 'OPPO A73',
      ua: 'Mozilla/5.0 (Linux; U; Android 7.1.1; zh-cn; OPPO A73 Build/N6F26Q) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/10.8.4.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(false);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('');
  });

  it('OPPO A5', () => {
    const data = {
      name: 'OPPO A5',
      ua: 'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-cn; PBAM00 Build/OPM1.171019.026) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/10.8.9.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.B);
    expect(result.reason).to.equal('Downgrade by model list');
  });

  it('一加 7', () => {
    const data = {
      name: '一加 7',
      ua: 'Mozilla/5.0 (Linux; U; Android 11; zh-cn; GM1900 Build/RKQ1.201022.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/40.8.28.1',
    };
    const decoder = new UADecoder(data.ua);
    const deviceInfo = decoder.getDeviceInfo();
    const result = getDowngradeResult({ deviceInfo });

    expect(result.downgrade).to.equal(true);
    expect(result.level).to.equal(spec.RenderLevel.A);
    expect(result.reason).to.equal('Downgrade by model list');
  });

});
