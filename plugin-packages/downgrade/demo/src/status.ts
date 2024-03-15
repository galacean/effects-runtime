import { checkDowngradeResult, getDowngradeResult } from '@galacean/effects-plugin-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }

  const downgradeResult = getDowngradeResult();
  const downgradeDecision = checkDowngradeResult(downgradeResult);
  const resultLabel = document.createElement('label');

  resultLabel.textContent = `Result:${JSON.stringify(downgradeResult, undefined, 2)}`;
  const decisionLabel = document.createElement('label');

  decisionLabel.textContent = `Decision:${JSON.stringify(downgradeDecision, undefined, 2)}`;
  document.body.append(resultLabel);
  document.body.append(decisionLabel);
})();
