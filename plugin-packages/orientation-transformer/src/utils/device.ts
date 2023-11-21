export function isIOS () {
  const str = navigator.userAgent.toLowerCase();
  const ver = str.match(/cpu (iphone )?os (.*?) like mac os/);

  return ver ? parseInt(ver[2], 10) : 0;
}
