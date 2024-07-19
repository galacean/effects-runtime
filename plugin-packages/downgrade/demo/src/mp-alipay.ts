import { isAlipayMiniApp } from '@galacean/effects';
import type { DowngradeResult } from '@galacean/effects-plugin-downgrade';
import { AlipayMiniprogramParser, getDowngradeResult } from '@galacean/effects-plugin-downgrade';

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

function processInfo (label: string, info: any) {
  createTitle(label);

  const parser = new AlipayMiniprogramParser(info);
  const deviceInfo = parser.getDeviceInfo();
  const result = getDowngradeResult({ deviceInfo });

  displayResult(result);
}

function createTitle (label: string) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = label;
  document.body.append(titleLabel);
}

function displayResult (result: DowngradeResult) {
  const pre = document.createElement('pre');
  const div = document.createElement('div');

  pre.innerHTML = JSON.stringify(result, null, 2);
  div.appendChild(pre);
  document.body.append(div);
}

