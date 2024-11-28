export function getPixelRatio (): number {
  if (typeof screen === 'object' && typeof document === 'object') {
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const screenWidth = screen.width;
    const viewportScale = screenWidth / viewportWidth;

    return Math.min(2 * viewportScale, 2);
  }

  return 1;
}

export function isIOS (): boolean {
  // real ios device not in simulator
  return !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
}

export function isIOSByUA () {
  const str = navigator.userAgent.toLowerCase();
  const ver = str.match(/cpu (iphone )?os (.*?) like mac os/);

  return ver ? parseInt(ver[2], 10) : 0;
}

export function isAndroid (): boolean {
  return window && /\b[Aa]ndroid\b/.test(navigator.userAgent);
}

export function isSimulatorCellPhone (): boolean {
  return isAndroid() || (window && /\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent));
}

export function isMiniProgram () {
  return isAlipayMiniApp() || isWechatMiniApp();
}

export function isAlipayMiniApp (): boolean {
  return typeof my !== 'undefined' && my?.renderTarget === 'web';
}

export function isWechatMiniApp () {
  return window?.__wxjs_environment === 'miniprogram';
}
