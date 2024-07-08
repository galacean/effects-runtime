import { getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }

  try {
    const downgradeResult = await getDowngradeResult(bizId);

    document.getElementById('J-downgradeResult')!.innerHTML = `Result: <pre>${JSON.stringify(downgradeResult, undefined, 2)}</pre>`;
  } catch (e: any) {
    console.error('biz', e);
    document.getElementById('J-errorMessage')!.innerHTML = JSON.stringify(e.message, undefined, 2);
  }

})();
