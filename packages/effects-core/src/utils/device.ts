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

export function isAndroid (): boolean {
  return /\b[Aa]ndroid\b/.test(navigator.userAgent);
}

export function isSimulatorCellPhone (): boolean {
  return isAndroid() || /\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent);
}
