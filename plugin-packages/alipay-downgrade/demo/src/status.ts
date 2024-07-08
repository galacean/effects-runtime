import { getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }

  const downgradeResult = await getDowngradeResult(bizId);

  document.getElementById('J-downgradeResult')!.innerHTML = `Result: <pre>${JSON.stringify(downgradeResult, undefined, 2)}</pre>`;
})();
