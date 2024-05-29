import { isAlipayMiniApp } from '@galacean/effects';
import { checkDowngrade, getSystemInfo, setAlipayDowngradeBizId, downgradeForMiniprogram } from '@galacean/effects-plugin-alipay-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }
  setAlipayDowngradeBizId(bizId);
  const downgradeResult = await checkDowngrade(bizId);
  const systemInfoResult = await getSystemInfo();
  const isAlipayMiniProgram = isAlipayMiniApp();
  const downgradeMiniprogram = downgradeForMiniprogram();
  const downgradeLabel = document.createElement('label');
  const systemInfoLabel = document.createElement('label');
  const miniprogramLabel = document.createElement('label');

  downgradeLabel.innerHTML = `<div><pre>${JSON.stringify(downgradeResult, undefined, 2)}</pre></div>`;
  systemInfoLabel.innerHTML = `<div><pre>${JSON.stringify(systemInfoResult, undefined, 2)}</pre></div>`;
  miniprogramLabel.innerHTML = `<div><pre>downgradeMiniprogram: ${downgradeMiniprogram}</pre></div>`;
  document.body.append(downgradeLabel);
  document.body.append(systemInfoLabel);
  document.body.append(miniprogramLabel);
})();
