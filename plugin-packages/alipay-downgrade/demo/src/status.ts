import { checkDowngrade, setAlipayDowngradeBizId } from '@galacean/effects-plugin-alipay-downgrade';

(async () => {
  let bizId = 'test';
  const matches = location.search.match(/bizId=(\w+)/);

  if (matches) {
    bizId = matches[1];
    console.info('Input bizId:', bizId);
  }
  setAlipayDowngradeBizId(bizId);
  const result = await checkDowngrade(bizId);
  const label = document.createElement('label');

  label.innerHTML = `<div><pre>${JSON.stringify(result, undefined, 2)}</pre></div>`;
  document.body.append(label);
})();
