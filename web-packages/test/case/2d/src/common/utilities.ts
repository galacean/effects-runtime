export function sleep (ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function getCurrnetTimeStr () {
  const date = new Date(Date.now());
  const timeStr = date.toLocaleString('zh-CN');
  const ms = `${date.getMilliseconds()}`;

  return timeStr.split(/[ /:]+/).join('') + ms.padStart(3, '0');
}

export async function loadScript (src: string) {
  const element = document.getElementById(src);

  if (element !== null) {
    return;
  }

  const script = document.createElement('script');

  script.id = src;
  script.src = src;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      console.debug(`[Test] Load script success: ${src}`);
      resolve(script);
    };
    script.onerror = () => {
      console.debug(`[Test] Load script fail: ${src}`);
      reject();
    };
  });
}
