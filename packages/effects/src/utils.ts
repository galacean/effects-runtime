export function isDowngradeIOS (): boolean {
  const iOSVersionRegex = /iPhone OS (\d+)_(\d+)/;
  const match = iOSVersionRegex.exec(navigator.userAgent);

  if (match) {
    return match[1] === '13' || (match[1] === '16' && match[2] === '5');
  }

  return false;
}
