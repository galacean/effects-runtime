import UAParser from 'ua-parser-js';

(async () => {
  const parser = new UAParser();
  const result0 = parser.getResult();
  const label0 = document.createElement('label');

  label0.innerText = 'UAParser result: ' + JSON.stringify(result0, undefined, 2);
  document.body.appendChild(label0);
  console.info(result0);

  // const downgradeResult = getDowngradeResult();
  // const downgradeDecision = checkDowngradeResult(downgradeResult);
  // const resultLabel = document.createElement('label');

  // resultLabel.textContent = `Result:${JSON.stringify(downgradeResult, undefined, 2)}`;
  // const decisionLabel = document.createElement('label');

  // decisionLabel.textContent = `Decision:${JSON.stringify(downgradeDecision, undefined, 2)}`;
  // document.body.append(resultLabel);
  // document.body.append(decisionLabel);
})();
