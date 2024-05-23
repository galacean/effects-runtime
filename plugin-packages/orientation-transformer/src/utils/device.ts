export function isIOS () {
  const str = navigator.userAgent.toLowerCase();
  const ver = str.match(/cpu (iphone )?os (.*?) like mac os/);

  return ver ? parseInt(ver[2], 10) : 0;
}

export function isMiniProgram () {
  return isAlipayMiniApp() || isWechatMiniApp();
}

export function isAlipayMiniApp () {
  //@ts-expect-error
  return typeof my !== 'undefined' && my?.renderTarget === 'web';
}

export function isWechatMiniApp () {
  //@ts-expect-error
  return window.__wxjs_environment === 'miniprogram';
}
