import { checkDowngradeResult, getDowngradeResult, parseWechatDeviceInfo } from '@galacean/effects-plugin-downgrade';

(async () => {
  // @ts-expect-error
  navigator.__defineGetter__('userAgent', function () {
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Mobile/14E8301 MicroMessenger/6.6.0 MiniGame NetType/WIFI Language/';
  });

  parseWechatDeviceInfo({
    benchmarkLevel: 34,
    brand: 'OPPO',
    memorySize: 7195,
    model: '2201123C',
    platform: 'android',
    system: 'Android 12',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: 21,
    brand: 'OPPO',
    memorySize: 5621,
    model: 'PBEM00',
    platform: 'android',
    system: 'Android 10',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: -1,
    brand: 'devtools',
    memorySize: 2048,
    model: 'Nexus 5X',
    platform: 'devtools',
    system: 'Android 5.0',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: -1,
    brand: 'devtools',
    memorySize: 2048,
    model: 'iPhone 14 Pro Max',
    platform: 'devtools',
    system: 'iOS 10.0.1',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: -1,
    brand: 'iPhone',
    memorySize: 7675,
    model: 'iPhone 15 pro<iPhone16,1>',
    platform: 'ios',
    system: 'iOS 17.3.1',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: -1,
    brand: 'iPhone',
    memorySize: 5650,
    model: 'iPhone 14 pro<iPhone15,2>',
    platform: 'ios',
    system: 'iOS 17.3.1',
  });

  parseWechatDeviceInfo({
    benchmarkLevel: -1,
    brand: 'iPhone',
    memorySize: 2959,
    model: 'iPhone SE (2nd generation)<iPhone12,8>',
    platform: 'ios',
    system: 'iOS 16.4.1',
  });

  const downgradeResult = getDowngradeResult({ autoQueryDevice: true });
  const downgradeDecision = checkDowngradeResult(downgradeResult);
  const resultLabel = document.createElement('label');

  resultLabel.innerText = `Result:${JSON.stringify(downgradeResult, undefined, 2)}`;
  const decisionLabel = document.createElement('label');

  decisionLabel.innerText = `Decision:${JSON.stringify(downgradeDecision, undefined, 2)}`;
  document.body.append(resultLabel);
  document.body.append(document.createElement('br'));
  document.body.append(decisionLabel);
})();
