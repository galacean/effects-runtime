export function isDowngradeIOS (): boolean {
  const iOSVersionRegex = /iPhone OS (\d+)_(\d+)/;
  const match = iOSVersionRegex.exec(navigator.userAgent);

  if (match) {
    return match[1] === '13' || (match[1] === '16' && match[2] === '5');
  }

  return false;
}

export function throwError (destroyedErrorMessage: string) {
  throw new Error(destroyedErrorMessage);
}

export function throwErrorPromise (destroyedErrorMessage: string) {
  return Promise.reject(destroyedErrorMessage);
}
