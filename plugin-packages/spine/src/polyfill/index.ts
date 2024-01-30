export function decodeText (array: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(array);
  }

  // TextDecoder polyfill
  let s = '';

  for (let i = 0, il = array.length; i < il; i++) {
    s += String.fromCharCode(array[i]);
  }

  return decodeURIComponent(encodeURIComponent(s));
}
