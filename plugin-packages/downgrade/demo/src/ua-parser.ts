import { UAParser } from 'ua-parser-js';
import { UADecoder } from '@galacean/effects-plugin-downgrade';

(async () => {
  const parser = new UAParser();
  const result0 = parser.getResult();
  const label0 = document.createElement('label');

  label0.innerText = 'UAParser result: ' + JSON.stringify(result0, undefined, 2);
  document.body.appendChild(label0);
  console.info(result0);

  const decoder = new UADecoder();

  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(document.createElement('br'));
  const label1 = document.createElement('label');

  label1.innerText = 'UA: ' + navigator.userAgent;
  document.body.appendChild(label1);

  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(document.createElement('br'));
  const label2 = document.createElement('label');

  label2.innerText = 'UADecoder result: ' + JSON.stringify(decoder, undefined, 2);
  document.body.appendChild(label2);
})();
