<script lang="ts" setup>
import { onMounted } from 'vue';
import { menuGui, treeData, treeGui } from '../utils';

import { ref } from 'vue'

const tabList = ref([
  { title: 'Hierarchy', key: 'Hierarchy', icon: 'i-ri-node-tree' },
])

onMounted(() => {
// 获取 DIV 元素和自定义上下文菜单
const myDiv = document.getElementById('myDiv')!;
const contextMenu = document.getElementById('contextMenu')!;

// 阻止默认的上下文菜单
myDiv.addEventListener('contextmenu', function (e) {
  e.preventDefault();

  // 显示自定义上下文菜单
  contextMenu.style.display = 'block';
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
});

// 隐藏自定义上下文菜单
document.addEventListener('click', function (e) {
  if (e.target!.closest('.custom-context-menu') === null) {
    contextMenu.style.display = 'none';
  }
});

// 菜单项事件
const menuAction1 = document.getElementById('menuAction1')!;
const menuAction2 = document.getElementById('menuAction2')!;
const menuAction3 = document.getElementById('menuAction3')!;
const menuAction4 = document.getElementById('menuAction4')!;
const menuAction5 = document.getElementById('menuAction5')!;
const menuAction6 = document.getElementById('menuAction6')!;
const menuAction7 = document.getElementById('menuAction7')!;
const menuAction8 = document.getElementById('menuAction8')!;
const menuAction9 = document.getElementById('menuAction9')!;


menuAction1.addEventListener('click', async function () {
  await menuGui.createEffectItem('Cube', '29cad98ed9f34a6c8d0609021497f9d7', treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction2.addEventListener('click', async function () {
  await menuGui.createEffectItem('Sphere', 'ae63faced6ce46cfb77f2ef0b90b0b85',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction3.addEventListener('click', async function () {
  await menuGui.createEffectItem('Cylinder', '795d5ab0fd4043f388b7f477bb4f70e4',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction4.addEventListener('click', async function () {
  await menuGui.createEffectItem('Cone', '3b857b9c506c4763b7630fa5d721b6c3',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction5.addEventListener('click', async function () {
  await menuGui.createEffectItem('Icosphere', 'a444eb693b69411da6d0fa4fc8670916',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction6.addEventListener('click', async function () {
  await menuGui.createEffectItem('Torus', 'b8136073cf7a45eb8d5a981bed295d93',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction7.addEventListener('click', async function () {
  await menuGui.createEffectItem('Grid', 'cf7c2b844e9e4b36abb796bc38a7d580',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction8.addEventListener('click', async function () {
  await menuGui.createEffectItem('Monkey', '1343860b8f4b4a79ac929518f0215c2a',treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction9.addEventListener('click', async function () {
  treeGui.activeItem.dispose();
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

});
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUITree class="w-full h-full" :data="treeData" v-bind="treeGui.panel" id="myDiv" />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
  <div class="custom-context-menu" id="contextMenu">
    <div class="context-menu-item" id="menuAction1">Cube</div>
    <div class="context-menu-item" id="menuAction2">Sphere</div>
    <div class="context-menu-item" id="menuAction3">Cylinder</div>
    <div class="context-menu-item" id="menuAction4">Cone</div>
    <div class="context-menu-item" id="menuAction5">Icosphere</div>
    <div class="context-menu-item" id="menuAction6">Torus</div>
    <div class="context-menu-item" id="menuAction7">Grid</div>
    <div class="context-menu-item" id="menuAction8">Monkey</div>
    <div class="context-menu-item" id="menuAction9">Delete</div>
  </div>
</template>

<style>
  .custom-context-menu {
    display: none;
    position: absolute;
    z-index: 1000;
    background-color: #000000;
    border: 1px solid #cccccc;
    border-radius: 4px; /* 更小的圆角 */
    width: 160px; /* 进一步缩小宽度 */
    overflow: hidden; /* 确保子项适应圆角 */
    font-size: 14px; /* 缩小字体大小 */
  }
  .context-menu-item {
    padding: 6px 8px; /* 进一步缩小内边距 */
    cursor: pointer;
  }
  .context-menu-item:hover {
    background-color: #2b4ac5;
  }

  /* 仍然可选：确保最后一个菜单项底部的圆角 */
  .context-menu-item:last-child {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }
</style>
