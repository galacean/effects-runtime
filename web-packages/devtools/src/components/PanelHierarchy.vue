<script lang="ts" setup>
import { onMounted } from 'vue';
import { menuGui, treeData, treeGui } from '../utils';

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

menuAction2.addEventListener('click', function () {
  alert('Menu Item 1 clicked');
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});

menuAction1.addEventListener('click', async function () {
  await menuGui.createEffectItem(treeGui.activeItem);
  contextMenu.style.display = 'none'; // 隐藏上下文菜单
});
});

</script>

<template>
  <AGUITree class="w-full h-full" :data="treeData" v-bind="treeGui.panel" id="myDiv" />
  <div class="custom-context-menu" id="contextMenu">
    <div class="context-menu-item" id="menuAction1">CreateEffectVFXItem</div>
    <div class="context-menu-item" id="menuAction2">Menu Item 1</div>
  </div>
</template>


<style>
  .custom-context-menu {
    display: none;
    position: absolute;
    z-index: 1000;
    background-color: #000000;
    border: 1px solid #cccccc;
  }
  .context-menu-item {
    padding: 8px;
    cursor: pointer;
  }
  .context-menu-item:hover {
    background-color: #e0e0e0;
  }
</style>
