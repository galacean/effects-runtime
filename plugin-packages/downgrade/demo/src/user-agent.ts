import { UADecoder } from '@galacean/effects-plugin-downgrade';

let mockUserAgent: string | undefined;
// mockUserAgent = 'Mozilla/5.0 (Linux; U; Android 11; zh-cn; GM1900 Build/RKQ1.201022.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.61 Mobile Safari/537.36 HeyTapBrowser/40.8.28.1',

(async () => {
  const decoder = new UADecoder(mockUserAgent);
  const deviceInfo = decoder.getDeviceInfo();

  processInfo('1.UADecoder', deviceInfo);

  const parser = new (window as any).UAParser(mockUserAgent);
  const result = parser.getResult();

  processInfo('2.UAParser', result);
})();

function processInfo (title: string, info: any) {
  const titleLabel = document.createElement('h2');

  titleLabel.innerText = title;
  document.body.append(titleLabel);

  const pre = document.createElement('pre');

  pre.innerHTML = JSON.stringify(info, null, 2);
  const div = document.createElement('div');

  div.appendChild(pre);
  document.body.append(div);
}
