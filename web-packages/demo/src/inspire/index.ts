// @ts-nocheck
import { InspireList } from '../common/inspire-list';

const playerIframe = document.getElementById('J-playerIframe');
const prePlayerIframe = document.getElementById('J-prePlayerIframe');
const threeJSIframe = document.getElementById('J-threeJSIframe');
const iframeList = [playerIframe, prePlayerIframe, threeJSIframe];
const currentTime = 0;
const speed = 1;
const inspireList = new InspireList();
const renderFramework = inspireList.getFramework();
const playerOptions = {
  willCaptureImage: true,
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
      iframe.contentWindow.location.reload();
    });
    handleInit();
  };
  // TODO: 是否有用？
  handleResume();
}

function handleInit () {
  iframeList.forEach(iframe => {
    iframe.onload = () => {
      iframe.contentWindow.postMessage({
        type: 'init',
        playerOptions,
      });
    };
  });
}

async function handlePlay (url) {
  const json = await (await fetch(url)).json();

  iframeList.forEach(iframe => {
    iframe.contentWindow.postMessage({
      type: 'play',
      json,
      currentTime,
      speed,
    });
  });
}

function handleResume () {
  iframeList.forEach(iframe => {
    iframe.contentWindow.postMessage({
      type: 'resume',
    });
  });
}

function handlePause () {
  iframeList.forEach(iframe => {
    iframe.contentWindow.postMessage({
      type: 'pause',
    });
  });
}
