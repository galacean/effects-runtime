export function isIOS () {
  const str = navigator.userAgent.toLowerCase();
  const ver = str.match(/cpu (iphone )?os (.*?) like mac os/);

  return ver ? parseInt(ver[2], 10) : 0;
}

export function isMiniProgram () {
  return isAlipayMiniApp() || isWechatMiniApp();
}

export function isAlipayMiniApp () {
  return typeof my !== 'undefined' && my?.renderTarget === 'web';
}

export function isWechatMiniApp () {
  return window.__wxjs_environment === 'miniprogram';
}
