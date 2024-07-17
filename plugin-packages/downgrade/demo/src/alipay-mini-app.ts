import { isAlipayMiniApp } from '@galacean/effects';
import { getDowngradeResult, AlipayMiniAppParser } from '@galacean/effects-plugin-downgrade';

const mockInfoList = [
  {
    'brand': 'HUAWEI',
    'deviceOrientation': 'portrait',
    'model': 'HUAWEI DCO-AL00',
    'performance': 'high',
    'platform': 'Android',
    'system': '12',
    'remark': '华为 Mate 50 Pro',
  },
  {
    'brand': 'Xiaomi',
    'deviceOrientation': 'portrait',
    'model': 'Xiaomi 23116PN5BC',
    'performance': 'high',
    'platform': 'Android',
    'system': '14',
    'remark': '小米 14 Pro',
  },
  {
    'brand': 'iPhone',
    'deviceOrientation': 'portrait',
    'model': 'iPhone14,5',
    'platform': 'iOS',
    'system': '16.6',
    'remark': 'iPhone 13',
  },
];

function processInfo (label: string, info: any) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = label;
  document.body.append(titleLabel);

  const parser = new AlipayMiniAppParser(info);
  const deviceInfo = parser.getDeviceInfo();
  const result = getDowngradeResult({ deviceInfo });

  const pre = document.createElement('pre');

  pre.innerHTML = JSON.stringify(result, null, 2);
  const div = document.createElement('div');

  div.appendChild(pre);

  document.body.append(div);
}

(async () => {
  if (isAlipayMiniApp()) {
    if (my.canIUse('getSystemInfo')) {
      const systemInfo = my.getSystemInfo();

      processInfo('CurrentDevice', systemInfo);
    } else {
      console.error('Can\'t use getSystemInfo in AlipayMiniApp');
    }
  } else {
    mockInfoList.forEach((data, index) => {
      const label = `${index + 1}.${data.remark}`;

      processInfo(label, data);
    });
  }
})();
