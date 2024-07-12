import { getDowngradeResult, AlipayMiniAppParser } from '@galacean/effects-plugin-downgrade';
import alipayMiniList from './alipay-mini-list';

(async () => {
  alipayMiniList.forEach((info, index) => {
    processInfo(index, info);
  });
})();

function processInfo (index: number, info: any) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = `${index + 1}.${info.remark}`;
  document.body.appendChild(titleLabel);

  const parser = new AlipayMiniAppParser(info);
  const deviceInfo = parser.getDeviceInfo();
  const result = getDowngradeResult({ deviceInfo });

  const ul = document.createElement('ul');
  const listItem0 = document.createElement('li');

  listItem0.innerText = JSON.stringify(result, null, 2);
  listItem0.style.listStyle = 'disc'; // 设置列表项的样式为圆点
  listItem0.style.fontSize = '18px'; // 设置列表项文字的大小
  ul.appendChild(listItem0);

  document.body.appendChild(ul);
}