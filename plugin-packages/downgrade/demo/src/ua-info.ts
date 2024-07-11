import { getDowngradeResult, UADecoder } from '@galacean/effects-plugin-downgrade';
import uaList from './ua-list';

(() => {
  for (let i = 0; i < uaList.length; i++) {
    processUA(`${i + 1}.${uaList[i].name}`, uaList[i].ua);
  }

  const uaGM1900 = 'Mozilla/5.0 (Linux; U; Android 11; zh-cn; GM1900 Build/RKQ1.201022.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/40.8.28.1';
  const gmResult = getDowngradeResult({ deviceInfo: new UADecoder(uaGM1900).getDeviceInfo() });

  console.info(gmResult);
  const uaiOS142 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Mobile/15E148 Safari/604.1';
  const iOS142Result = getDowngradeResult({ deviceInfo: new UADecoder(uaiOS142).getDeviceInfo() });

  console.info(iOS142Result);
  const uaiOS167 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Mobile/15E148 Safari/604.1';
  const iOS167Result = getDowngradeResult({ deviceInfo: new UADecoder(uaiOS167).getDeviceInfo() });

  console.info(iOS167Result);
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