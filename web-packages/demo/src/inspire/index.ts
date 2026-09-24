import { InspireList } from '../common/inspire-list';

const playerIframe = document.getElementById('J-playerIframe') as HTMLIFrameElement;
const prePlayerIframe = document.getElementById('J-prePlayerIframe') as HTMLIFrameElement;
const threeJSIframe = document.getElementById('J-threeJSIframe') as HTMLIFrameElement;
const iframeList = [playerIframe, prePlayerIframe, threeJSIframe];
const currentTime = 0;
const speed = 1;
const inspireList = new InspireList();
const renderFramework = inspireList.getFramework();
const playerOptions = {
  renderOptions: {
    willCaptureImage: true,
  },
  pixelRatio: 2,
  interactive: true,
  env: 'editor',
  renderFramework,
};

bindEventListeners();
handleInit();

function bindEventListeners () {
  inspireList.handleStart = () => {
    handlePause();
    void handlePlay(inspireList.currentInspire);
  };
  inspireList.handlePause = handlePause;
  // 切换 WebGL/WebGL2
  inspireList.handleChange = () => {
    playerOptions.renderFramework = inspireList.getFramework();
    iframeList.forEach(iframe => {
      iframe.contentWindow?.location.reload();
    });
  };
}

function handleInit () {
  iframeList.forEach(iframe => {
    const init = () => {
      iframe.contentWindow?.postMessage({
        type: 'init',
        playerOptions,
      }, window.origin);
    };

    iframe.onload = init;
    if (iframe.contentDocument?.readyState === 'complete') {
      init();
    }
  });
}

async function handlePlay (url: string) {
  const json = await (await fetch(url)).json();

  iframeList.forEach(iframe => {
    iframe.contentWindow?.postMessage({
      type: 'play',
      json,
      currentTime,
      speed,
    }, window.origin);
  });
}

function handlePause () {
  iframeList.forEach(iframe => {
    iframe.contentWindow?.postMessage({
      type: 'pause',
    }, window.origin);
  });
}
