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
  const resultLabel = document.createElement('label');

  resultLabel.innerHTML = `<div><pre>Result:${JSON.stringify(downgradeResult, undefined, 2)}</pre></div>`;
  const decisionLabel = document.createElement('label');

  decisionLabel.innerHTML = `<div><pre>Decision:${JSON.stringify(downgradeDecision, undefined, 2)}</pre></div>`;
  document.body.append(resultLabel);
  document.body.append(decisionLabel);
})();
