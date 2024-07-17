import { getDowngradeResult, isWeChatMiniApp, WeChatMiniAppParser } from '@galacean/effects-plugin-downgrade';

const mockInfoList = [
  {
    'benchmarkLevel': 29,
    'cpuType': 'unknown',
    'system': 'Android 12',
    'memorySize': 15601,
    'model': 'ALN-AL10',
    'brand': 'HUAWEI',
    'platform': 'android',
    'remark': '华为Mate60 Pro+',
  },
  {
    'benchmarkLevel': 6,
    'cpuType': 'MT6762G',
    'system': 'Android 11',
    'memorySize': 3779,
    'model': '220233L2C',
    'brand': 'Redmi',
    'platform': 'android',
    'remark': '红米 10A',
  },
  {
    'benchmarkLevel': -1,
    'brand': 'iPhone',
    'memorySize': 7675,
    'model': 'iPhone 15 pro<iPhone16,1>',
    'platform': 'ios',
    'system': 'iOS 17.3.1',
    'remark': 'iPhone 15 pro',
  },
  {
    'benchmarkLevel': -1,
    'brand': 'devtools',
    'memorySize': 2048,
    'model': 'iPhone 5',
    'system': 'iOS 10.0.1',
    'platform': 'devtools',
  },
  {
    'benchmarkLevel': -1,
    'brand': 'devtools',
    'memorySize': 2048,
    'model': 'iPhone 15 Pro Max',
    'system': 'iOS 10.0.1',
    'platform': 'devtools',
  },
];

function processInfo (label: string, info: any) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = label;
  document.body.append(titleLabel);

  const parser = new WeChatMiniAppParser(info);
  const deviceInfo = parser.getDeviceInfo();
  const result = getDowngradeResult({ deviceInfo });

  const pre = document.createElement('pre');

  pre.innerHTML = JSON.stringify(result, null, 2).replaceAll('<', '(').replaceAll('>', ')');
  const div = document.createElement('div');

  div.appendChild(pre);

  document.body.append(div);
}

(async () => {
  if (isWeChatMiniApp()) {
    // @ts-expect-error
    if (wx.canIUse('getDeviceInfo')) {
      // @ts-expect-error
      const info = wx.getDeviceInfo() as WeChatDeviceInfo;
      const parser = new WeChatMiniAppParser(info);

      return parser.getDeviceInfo();
    } else {
      console.error('Can\'t use getDeviceInfo in WeChatMiniApp');
    }
  } else {
    mockInfoList.forEach((data, index) => {
      const label = `${index + 1}.${data.remark ?? data.model}`;

      processInfo(label, data);
    });
  }
})();
