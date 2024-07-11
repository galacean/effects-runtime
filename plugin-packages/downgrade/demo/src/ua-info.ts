import { UADecoder } from '@galacean/effects-plugin-downgrade';
import uaList from './ua-list';

(() => {
  for (let i = 0; i < uaList.length; i++) {
    processUA(`${i + 1}.${uaList[i].name}`, uaList[i].ua);
  }
})();

function processUA (title: string, ua: string) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = title;
  document.body.appendChild(titleLabel);

  const parser = new (window as any).UAParser(ua);
  const parserResult = parser.getResult();
  const filteredParserResult = {
    ...parserResult.os,
    ...parserResult.device,
  };

  const decoder = new UADecoder(ua);
  const device = {
    ...decoder.device,
    sourceData: undefined,
  };

  const ul = document.createElement('ul');
  const listItem0 = document.createElement('li');

  listItem0.textContent = 'UA: ' + ua;
  listItem0.style.listStyle = 'disc'; // 设置列表项的样式为圆点
  listItem0.style.fontSize = '18px'; // 设置列表项文字的大小
  ul.appendChild(listItem0);

  const listItem1 = document.createElement('li');

  listItem1.innerText = ' Parser: ' + JSON.stringify(filteredParserResult, undefined, 2);
  listItem1.style.listStyle = 'disc'; // 设置列表项的样式为圆点
  listItem1.style.fontSize = '18px'; // 设置列表项文字的大小
  ul.appendChild(listItem1);

  const listItem2 = document.createElement('li');

  listItem2.innerText = 'Decoder: ' + JSON.stringify(device, undefined, 2);
  listItem2.style.listStyle = 'disc'; // 设置列表项的样式为圆点
  listItem2.style.fontSize = '18px'; // 设置列表项文字的大小
  ul.appendChild(listItem2);

  document.body.appendChild(ul);
}