import { checkDowngradeResult, getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }

  const downgradeResult = await getDowngradeResult(bizId);
  const downgradeDecision = checkDowngradeResult(downgradeResult);

  document.getElementById('J-downgradeResult')!.innerHTML = `Result: <pre>${JSON.stringify(downgradeResult, undefined, 2)}</pre>`;
  document.getElementById('J-downgradeDecision')!.innerHTML = `Decision: <pre>${JSON.stringify(downgradeDecision, undefined, 2)}</pre>`;
})();
