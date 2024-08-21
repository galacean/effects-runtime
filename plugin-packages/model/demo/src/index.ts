//@ts-nocheck
import '@galacean/effects-plugin-model';
import { createPlayer } from './utility';
import * as json from './json';
import * as camera from './camera';
import * as hitTest from './hit-test';

const demoMap = {
  json,
  camera,
  hitTest,
};

function getDemoIndex (idxOrModule) {
  for (let i = 0; i < demoArray.length; i++) {
    if (demoArray[i][1] === idxOrModule) {
      return i;
    }
  }
  if (demoArray[idxOrModule] !== undefined) {
    return idxOrModule;
  }

  return 0;
}

// 1. 获取 dom 对象
const menuEle = document.getElementById('J-menu');
const demoInfoEle = document.getElementById('J-demoInfo');
const demoArray = Object.entries(demoMap);
const storageKey = 'galacean-effects-plugin-model:demo-data';
let html = '';

// 2. 根据 demoMap 渲染菜单
demoArray.forEach(item => {
  const [name] = item;

  html += `
    <a class="am-list-item am-list-item-bordered">
      <div class="am-list-detailed-content">${name}</div>
    </a>
  `;
});
menuEle.innerHTML = html;

// 3. 给菜单添加事件
const menuListEle = menuEle.querySelectorAll('.am-list-item');

menuListEle.forEach((item, i) => {
  item.addEventListener('click', () => {
    localStorage.setItem(storageKey, i);
    location.replace(location.href);
  });
});

// 4. 执行渲染逻辑
(async function doRender () {
  const idx = getDemoIndex(localStorage.getItem(storageKey));
  const [name, demoInstance] = demoArray[idx];
  const env = demoInstance.getEnv ? demoInstance.getEnv() : 'editor';

  // 添加选中样式
  menuListEle.forEach((ele, i) => {
    ele.classList.remove('hover');
    if (i === Number(idx)) {
      ele.classList.add('hover');
    }
  });
  demoInstance.createUI && demoInstance.createUI();

  // 加载 scene
  await demoInstance.loadScene(createPlayer(env));
})();
